import prisma from "../../config/prisma.js";

const TIMEZONE_PADRAO = "America/Sao_Paulo";
const formattersTimezone = new Map();

function somenteNumeros(valor) {
  if (!valor) return null;
  const v = String(valor).replace(/\D/g, "");
  return v || null;
}

function data(valor) {
  return valor ? new Date(`${valor}T00:00:00.000Z`) : null;
}

function dataIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function validarCompetencia(competencia) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia || ""))) {
    throw new Error("COMPETENCIA_INVALIDA");
  }
  return competencia;
}

function competenciaDaDataKey(dateKey) {
  return String(dateKey).slice(0, 7);
}

function limitesUtcCompetencia(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1) - 36 * 60 * 60 * 1000);
  const fim = new Date(Date.UTC(ano, mes, 1) + 36 * 60 * 60 * 1000);
  return { inicio, fim };
}

function datasDaCompetencia(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const datas = [];
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    datas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return datas;
}

function getTimezoneFormatter(timezone) {
  const key = timezone || TIMEZONE_PADRAO;
  if (!formattersTimezone.has(key)) {
    formattersTimezone.set(key, new Intl.DateTimeFormat("en-CA", {
      timeZone: key,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }));
  }
  return formattersTimezone.get(key);
}

function partesTimezone(value, timezone) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getTimezoneFormatter(timezone).formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  let hora = Number(map.hour || 0);
  if (hora === 24) hora = 0;
  const ano = Number(map.year);
  const mes = Number(map.month);
  const dia = Number(map.day);
  const dateKey = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return {
    ano,
    mes,
    dia,
    hora,
    minuto: Number(map.minute || 0),
    segundo: Number(map.second || 0),
    dateKey,
    minutosDia: hora * 60 + Number(map.minute || 0),
    diaSemana: new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay(),
  };
}

function minutosHora(hora) {
  if (!hora) return null;
  const [h, m] = String(hora).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutosPrevistosJornada(jornada) {
  if (!jornada?.ativo) return 0;
  const entrada = minutosHora(jornada.entradaPrevista);
  let saida = minutosHora(jornada.saidaPrevista);
  if (entrada === null || saida === null) return 0;
  if (saida < entrada) saida += 24 * 60;
  let total = saida - entrada;

  const inicioIntervalo = minutosHora(jornada.inicioIntervalo);
  let fimIntervalo = minutosHora(jornada.fimIntervalo);
  if (inicioIntervalo !== null && fimIntervalo !== null) {
    if (fimIntervalo < inicioIntervalo) fimIntervalo += 24 * 60;
    total -= Math.max(0, fimIntervalo - inicioIntervalo);
  }
  return Math.max(0, total);
}

function ajusteAprovadoMaisRecente(registro) {
  return (registro?.ajustes || []).find((ajuste) => ajuste.status === "APROVADO") || null;
}

function dataEfetivaRegistro(registro) {
  return new Date(ajusteAprovadoMaisRecente(registro)?.horarioNovo || registro.registradoEm);
}

function serializarRegistro(registro) {
  return {
    id: registro.id,
    tipo: registro.tipo,
    registradoEm: new Date(registro.registradoEm).toISOString(),
    horarioEfetivo: dataEfetivaRegistro(registro).toISOString(),
  };
}

function dentroVinculoFuncionario(funcionario, dateKey) {
  const admissao = dataIso(funcionario.dataAdmissao);
  const demissao = dataIso(funcionario.dataDemissao);
  if (admissao && dateKey < admissao) return false;
  if (demissao && dateKey > demissao) return false;
  return true;
}

function analisarDia({ dateKey, registros, jornada, timezone, hojeKey, minutosAgora }) {
  const ordenados = [...registros].sort((a, b) => dataEfetivaRegistro(a) - dataEfetivaRegistro(b));
  let estado = "FORA";
  let inicioTrabalho = null;
  let inicioPausa = null;
  let minutosTrabalhados = 0;
  let minutosPausa = 0;
  const inconsistencias = [];

  for (const registro of ordenados) {
    const horario = dataEfetivaRegistro(registro).getTime();
    if (registro.tipo === "ENTRADA") {
      if (estado !== "FORA") inconsistencias.push("Entrada registrada sem encerramento da jornada anterior.");
      estado = "TRABALHO";
      inicioTrabalho = horario;
      inicioPausa = null;
    } else if (registro.tipo === "INICIO_PAUSA") {
      if (estado !== "TRABALHO" || inicioTrabalho === null) {
        inconsistencias.push("Início de pausa sem entrada/retorno válido.");
      } else {
        minutosTrabalhados += Math.max(0, Math.round((horario - inicioTrabalho) / 60000));
      }
      estado = "PAUSA";
      inicioTrabalho = null;
      inicioPausa = horario;
    } else if (registro.tipo === "FIM_PAUSA") {
      if (estado !== "PAUSA" || inicioPausa === null) {
        inconsistencias.push("Retorno de pausa sem início de pausa válido.");
      } else {
        minutosPausa += Math.max(0, Math.round((horario - inicioPausa) / 60000));
      }
      estado = "TRABALHO";
      inicioPausa = null;
      inicioTrabalho = horario;
    } else if (registro.tipo === "SAIDA") {
      if (estado === "TRABALHO" && inicioTrabalho !== null) {
        minutosTrabalhados += Math.max(0, Math.round((horario - inicioTrabalho) / 60000));
      } else {
        inconsistencias.push("Saída registrada sem período de trabalho aberto.");
      }
      if (estado === "PAUSA" && inicioPausa !== null) {
        minutosPausa += Math.max(0, Math.round((horario - inicioPausa) / 60000));
      }
      estado = "FORA";
      inicioTrabalho = null;
      inicioPausa = null;
    }
  }

  if (dateKey === hojeKey && estado === "TRABALHO" && inicioTrabalho !== null) {
    minutosTrabalhados += Math.max(0, Math.round((Date.now() - inicioTrabalho) / 60000));
  }
  if (dateKey === hojeKey && estado === "PAUSA" && inicioPausa !== null) {
    minutosPausa += Math.max(0, Math.round((Date.now() - inicioPausa) / 60000));
  }

  const previsto = jornada ? minutosPrevistosJornada(jornada) : 0;
  const primeiraEntrada = ordenados.find((r) => r.tipo === "ENTRADA");
  const ultimaSaida = [...ordenados].reverse().find((r) => r.tipo === "SAIDA");
  const primeiraEntradaMin = primeiraEntrada ? partesTimezone(dataEfetivaRegistro(primeiraEntrada), timezone).minutosDia : null;
  const ultimaSaidaMin = ultimaSaida ? partesTimezone(dataEfetivaRegistro(ultimaSaida), timezone).minutosDia : null;
  const tolerancia = Number(jornada?.toleranciaMinutos || 0);
  const entradaPrevistaMin = minutosHora(jornada?.entradaPrevista);
  const saidaPrevistaMin = minutosHora(jornada?.saidaPrevista);
  const atrasoEntrada = jornada && primeiraEntradaMin !== null && entradaPrevistaMin !== null
    ? Math.max(0, primeiraEntradaMin - entradaPrevistaMin - tolerancia)
    : 0;
  const saidaAntecipada = jornada && ultimaSaidaMin !== null && saidaPrevistaMin !== null
    ? Math.max(0, saidaPrevistaMin - ultimaSaidaMin - tolerancia)
    : 0;

  const divergencias = [];
  const hoje = dateKey === hojeKey;
  const passado = dateKey < hojeKey;
  const jornadaTerminouHoje = Boolean(
    hoje && jornada && saidaPrevistaMin !== null && minutosAgora > saidaPrevistaMin + tolerancia
  );

  if (jornada && ordenados.length === 0 && (passado || jornadaTerminouHoje)) {
    divergencias.push({ tipo: "FALTA", severidade: "ALERTA", mensagem: "Jornada prevista sem registro de ponto." });
  }
  if (!jornada && ordenados.length > 0) {
    divergencias.push({ tipo: "SEM_JORNADA", severidade: "ALERTA", mensagem: "Há registros em um dia sem jornada configurada." });
  }
  if (ordenados.length > 0 && estado !== "FORA") {
    divergencias.push({
      tipo: passado ? "BATIDA_INCOMPLETA" : "JORNADA_EM_ANDAMENTO",
      severidade: passado ? "CRITICA" : "INFO",
      mensagem: passado ? "A sequência de batidas terminou sem uma saída válida." : "Jornada do dia ainda está em andamento.",
    });
  }
  for (const mensagem of inconsistencias) {
    divergencias.push({ tipo: "SEQUENCIA_INVALIDA", severidade: "CRITICA", mensagem });
  }
  if (atrasoEntrada > 0) {
    divergencias.push({ tipo: "ATRASO", severidade: "ALERTA", minutos: atrasoEntrada, mensagem: `Entrada após a tolerância em ${atrasoEntrada} min.` });
  }
  if (saidaAntecipada > 0) {
    divergencias.push({ tipo: "SAIDA_ANTECIPADA", severidade: "ALERTA", minutos: saidaAntecipada, mensagem: `Saída antes do previsto em ${saidaAntecipada} min.` });
  }

  const falta = jornada && ordenados.length === 0 && (passado || jornadaTerminouHoje) ? 1 : 0;
  const saldo = minutosTrabalhados - previsto;

  return {
    data: dateKey,
    diaSemana: new Date(`${dateKey}T12:00:00.000Z`).getUTCDay(),
    jornada: jornada ? {
      entradaPrevista: jornada.entradaPrevista,
      saidaPrevista: jornada.saidaPrevista,
      inicioIntervalo: jornada.inicioIntervalo,
      fimIntervalo: jornada.fimIntervalo,
      toleranciaMinutos: jornada.toleranciaMinutos,
    } : null,
    minutosPrevistos: previsto,
    minutosTrabalhados,
    minutosPausa,
    minutosExtras: Math.max(0, saldo),
    minutosAtraso: atrasoEntrada + saidaAntecipada,
    saldoBanco: saldo,
    falta,
    registros: ordenados.map(serializarRegistro),
    divergencias,
  };
}

async function timezoneOrganizacao(organizacaoId) {
  const config = await prisma.configuracaoOrganizacao.findUnique({
    where: { organizacaoId },
    select: { timezone: true },
  });
  return config?.timezone || TIMEZONE_PADRAO;
}

async function validarEmpresaDaOrganizacao(organizacaoId, empresaId) {
  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, organizacaoId, ativo: true },
    select: { id: true },
  });
  if (!empresa) throw new Error("EMPRESA_INVALIDA");
}

async function auditar(tx, { organizacaoId, empresaId, usuarioId, acao, entidade, entidadeId, dadosAnteriores, dadosNovos }) {
  return tx.auditoria.create({
    data: {
      organizacaoId,
      empresaId: empresaId || null,
      usuarioId: usuarioId || null,
      acao,
      entidade,
      entidadeId: entidadeId || null,
      dadosAnteriores: dadosAnteriores || undefined,
      dadosNovos: dadosNovos || undefined,
    },
  });
}

async function garantirCompetenciaAberta({ funcionarioId, empresaId, competencia }) {
  const fechamento = await prisma.fechamentoPonto.findUnique({
    where: { funcionarioId_empresaId_competencia: { funcionarioId, empresaId, competencia } },
    select: { status: true },
  });
  if (fechamento?.status === "FECHADO") throw new Error("COMPETENCIA_FECHADA");
}

export async function listarFuncoes(organizacaoId) {
  return prisma.funcaoFuncionario.findMany({
    where: { organizacaoId },
    orderBy: { nome: "asc" },
  });
}

export async function criarFuncao(organizacaoId, dados) {
  const existente = await prisma.funcaoFuncionario.findFirst({
    where: {
      organizacaoId,
      nome: { equals: dados.nome, mode: "insensitive" },
    },
  });
  if (existente) throw new Error("FUNCAO_JA_EXISTE");
  return prisma.funcaoFuncionario.create({
    data: {
      organizacaoId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      ativo: dados.ativo ?? true,
    },
  });
}

export async function atualizarFuncao(organizacaoId, id, dados) {
  const atual = await prisma.funcaoFuncionario.findFirst({ where: { id, organizacaoId } });
  if (!atual) throw new Error("FUNCAO_INVALIDA");

  if (dados.nome && dados.nome !== atual.nome) {
    const duplicada = await prisma.funcaoFuncionario.findFirst({
      where: {
        organizacaoId,
        id: { not: id },
        nome: { equals: dados.nome, mode: "insensitive" },
      },
    });
    if (duplicada) throw new Error("FUNCAO_JA_EXISTE");
  }

  return prisma.funcaoFuncionario.update({
    where: { id },
    data: {
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(dados, "descricao") ? { descricao: dados.descricao || null } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function listarFuncionarios(organizacaoId, busca) {
  return prisma.funcionario.findMany({
    where: {
      organizacaoId,
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { cpf: { contains: somenteNumeros(busca) || busca } },
              { matricula: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: {
      funcao: true,
      usuario: { select: { id: true, nome: true, email: true, status: true } },
      empresas: { include: { empresa: { select: { id: true, nomeFantasia: true, tipo: true } } } },
      jornadas: { orderBy: [{ empresaId: "asc" }, { diaSemana: "asc" }] },
    },
  });
}

async function validarRelacoes(organizacaoId, dados) {
  if (dados.funcaoId) {
    const funcao = await prisma.funcaoFuncionario.findFirst({ where: { id: dados.funcaoId, organizacaoId } });
    if (!funcao) throw new Error("FUNCAO_INVALIDA");
  }

  if (dados.usuarioId) {
    const vinculo = await prisma.usuarioOrganizacao.findUnique({
      where: { usuarioId_organizacaoId: { usuarioId: dados.usuarioId, organizacaoId } },
    });
    if (!vinculo?.ativo) throw new Error("USUARIO_INVALIDO");
  }

  for (const empresa of dados.empresas || []) {
    await validarEmpresaDaOrganizacao(organizacaoId, empresa.empresaId);
  }
}

export async function criarFuncionario(organizacaoId, dados) {
  await validarRelacoes(organizacaoId, dados);
  const cpf = somenteNumeros(dados.cpf);

  if (cpf) {
    const existente = await prisma.funcionario.findFirst({ where: { organizacaoId, cpf } });
    if (existente) throw new Error("CPF_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    const funcionario = await tx.funcionario.create({
      data: {
        organizacaoId,
        usuarioId: dados.usuarioId || null,
        funcaoId: dados.funcaoId || null,
        nome: dados.nome,
        cpf,
        email: dados.email || null,
        telefone: somenteNumeros(dados.telefone),
        matricula: dados.matricula || null,
        dataAdmissao: data(dados.dataAdmissao),
        dataDemissao: data(dados.dataDemissao),
        salarioBase: dados.salarioBase ?? null,
        status: dados.status ?? "ATIVO",
        observacoes: dados.observacoes || null,
      },
    });

    if (dados.empresas?.length) {
      await tx.funcionarioEmpresa.createMany({
        data: dados.empresas.map((item) => ({
          funcionarioId: funcionario.id,
          empresaId: item.empresaId,
          principal: item.principal ?? false,
        })),
      });
    }

    return tx.funcionario.findUnique({
      where: { id: funcionario.id },
      include: { funcao: true, empresas: { include: { empresa: true } } },
    });
  });
}

export async function atualizarFuncionario(organizacaoId, id, dados) {
  const atual = await prisma.funcionario.findFirst({ where: { id, organizacaoId } });
  if (!atual) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  await validarRelacoes(organizacaoId, dados);

  const cpf = Object.prototype.hasOwnProperty.call(dados, "cpf") ? somenteNumeros(dados.cpf) : undefined;

  if (cpf && cpf !== atual.cpf) {
    const duplicado = await prisma.funcionario.findFirst({ where: { organizacaoId, cpf, id: { not: id } } });
    if (duplicado) throw new Error("CPF_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    await tx.funcionario.update({
      where: { id },
      data: {
        ...(Object.prototype.hasOwnProperty.call(dados, "usuarioId") ? { usuarioId: dados.usuarioId || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "funcaoId") ? { funcaoId: dados.funcaoId || null } : {}),
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(cpf !== undefined ? { cpf } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "email") ? { email: dados.email || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "telefone") ? { telefone: somenteNumeros(dados.telefone) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "matricula") ? { matricula: dados.matricula || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "dataAdmissao") ? { dataAdmissao: data(dados.dataAdmissao) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "dataDemissao") ? { dataDemissao: data(dados.dataDemissao) } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "salarioBase") ? { salarioBase: dados.salarioBase } : {}),
        ...(dados.status ? { status: dados.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(dados, "observacoes") ? { observacoes: dados.observacoes || null } : {}),
      },
    });

    if (dados.empresas) {
      await tx.funcionarioEmpresa.deleteMany({ where: { funcionarioId: id } });
      if (dados.empresas.length) {
        await tx.funcionarioEmpresa.createMany({
          data: dados.empresas.map((item) => ({ funcionarioId: id, empresaId: item.empresaId, principal: item.principal ?? false })),
        });
      }
    }

    return tx.funcionario.findUnique({
      where: { id },
      include: { funcao: true, empresas: { include: { empresa: true } } },
    });
  });
}

export async function salvarJornadas(organizacaoId, funcionarioId, jornadas) {
  const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, organizacaoId } });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  for (const jornada of jornadas) await validarEmpresaDaOrganizacao(organizacaoId, jornada.empresaId);

  return prisma.$transaction(async (tx) => {
    for (const jornada of jornadas) {
      await tx.jornadaTrabalho.upsert({
        where: { funcionarioId_empresaId_diaSemana: { funcionarioId, empresaId: jornada.empresaId, diaSemana: jornada.diaSemana } },
        update: jornada,
        create: { funcionarioId, ...jornada },
      });
    }
    return tx.jornadaTrabalho.findMany({ where: { funcionarioId }, orderBy: [{ diaSemana: "asc" }, { empresaId: "asc" }] });
  });
}

export async function statusPonto(organizacaoId, funcionarioId, empresaId) {
  const funcionario = await prisma.funcionario.findFirst({
    where: {
      id: funcionarioId,
      organizacaoId,
      status: { not: "DESLIGADO" },
      empresas: { some: { empresaId, ativo: true } },
    },
  });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");

  const ultimo = await prisma.registroPonto.findFirst({ where: { funcionarioId, empresaId }, orderBy: { registradoEm: "desc" } });

  let tiposPermitidos;
  if (!ultimo || ultimo.tipo === "SAIDA") tiposPermitidos = ["ENTRADA"];
  else if (ultimo.tipo === "ENTRADA") tiposPermitidos = ["INICIO_PAUSA", "SAIDA"];
  else if (ultimo.tipo === "INICIO_PAUSA") tiposPermitidos = ["FIM_PAUSA"];
  else tiposPermitidos = ["SAIDA", "INICIO_PAUSA"];

  return { ultimoRegistro: ultimo, proximoTipo: tiposPermitidos[0], tiposPermitidos };
}

export async function proximoTipoPonto(organizacaoId, funcionarioId, empresaId) {
  const status = await statusPonto(organizacaoId, funcionarioId, empresaId);
  return status.proximoTipo;
}

export async function baterPonto({ organizacaoId, empresaId, funcionarioId, usuarioId, tipo, origem, ip, userAgent }) {
  const status = await statusPonto(organizacaoId, funcionarioId, empresaId);
  const tipoEscolhido = tipo || status.proximoTipo;
  if (!status.tiposPermitidos.includes(tipoEscolhido)) throw new Error("TIPO_PONTO_INVALIDO");

  const timezone = await timezoneOrganizacao(organizacaoId);
  const competencia = competenciaDaDataKey(partesTimezone(new Date(), timezone).dateKey);
  await garantirCompetenciaAberta({ funcionarioId, empresaId, competencia });

  return prisma.registroPonto.create({
    data: { funcionarioId, empresaId, registradoPorId: usuarioId || null, tipo: tipoEscolhido, origem, ip, userAgent },
  });
}

export async function listarRegistros({ organizacaoId, funcionarioId, empresaId, inicio, fim }) {
  const funcionario = await prisma.funcionario.findFirst({ where: { id: funcionarioId, organizacaoId } });
  if (!funcionario) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  if (empresaId) await validarEmpresaDaOrganizacao(organizacaoId, empresaId);

  return prisma.registroPonto.findMany({
    where: {
      funcionarioId,
      ...(empresaId ? { empresaId } : {}),
      ...(inicio || fim ? { registradoEm: { ...(inicio ? { gte: new Date(inicio) } : {}), ...(fim ? { lte: new Date(fim) } : {}) } } : {}),
    },
    orderBy: { registradoEm: "desc" },
    include: {
      empresa: { select: { id: true, nomeFantasia: true } },
      ajustes: {
        orderBy: { createdAt: "desc" },
        include: {
          usuario: { select: { id: true, nome: true } },
          analisadoPor: { select: { id: true, nome: true } },
        },
      },
    },
  });
}

export async function ajustarPonto({ organizacaoId, registroId, usuarioId, horarioNovo, motivo }) {
  const registro = await prisma.registroPonto.findFirst({
    where: { id: registroId, funcionario: { organizacaoId } },
    include: { ajustes: { orderBy: { createdAt: "desc" } } },
  });
  if (!registro) throw new Error("REGISTRO_NAO_ENCONTRADO");

  const pendente = registro.ajustes.find((ajuste) => ajuste.status === "PENDENTE");
  if (pendente) throw new Error("AJUSTE_PENDENTE_EXISTENTE");

  const timezone = await timezoneOrganizacao(organizacaoId);
  const ultimoAprovado = registro.ajustes.find((ajuste) => ajuste.status === "APROVADO");
  const horarioAnterior = ultimoAprovado?.horarioNovo ?? registro.registradoEm;
  const novoHorario = new Date(horarioNovo);
  const competencias = new Set([
    competenciaDaDataKey(partesTimezone(horarioAnterior, timezone).dateKey),
    competenciaDaDataKey(partesTimezone(novoHorario, timezone).dateKey),
  ]);
  for (const competencia of competencias) {
    await garantirCompetenciaAberta({ funcionarioId: registro.funcionarioId, empresaId: registro.empresaId, competencia });
  }

  return prisma.$transaction(async (tx) => {
    const ajuste = await tx.ajustePonto.create({
      data: {
        registroId,
        usuarioId,
        horarioAnterior,
        horarioNovo: novoHorario,
        motivo,
        status: "PENDENTE",
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
    await auditar(tx, {
      organizacaoId,
      empresaId: registro.empresaId,
      usuarioId,
      acao: "PONTO_AJUSTE_SOLICITADO",
      entidade: "AjustePonto",
      entidadeId: ajuste.id,
      dadosNovos: { registroId, horarioAnterior: horarioAnterior.toISOString(), horarioNovo: novoHorario.toISOString(), motivo },
    });
    return ajuste;
  });
}

export async function listarAjustesPonto({ organizacaoId, empresaId, status, competencia }) {
  if (status && !["PENDENTE", "APROVADO", "REJEITADO"].includes(status)) throw new Error("STATUS_AJUSTE_INVALIDO");
  if (competencia) validarCompetencia(competencia);
  await validarEmpresaDaOrganizacao(organizacaoId, empresaId);
  const timezone = await timezoneOrganizacao(organizacaoId);
  const faixa = competencia ? limitesUtcCompetencia(competencia) : null;

  const ajustes = await prisma.ajustePonto.findMany({
    where: {
      ...(status ? { status } : {}),
      registro: {
        empresaId,
        funcionario: { organizacaoId },
        ...(faixa ? { registradoEm: { gte: faixa.inicio, lt: faixa.fim } } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      usuario: { select: { id: true, nome: true } },
      analisadoPor: { select: { id: true, nome: true } },
      registro: {
        include: {
          funcionario: { select: { id: true, nome: true, matricula: true } },
        },
      },
    },
  });

  if (!competencia) return ajustes;
  return ajustes.filter((ajuste) => {
    const original = competenciaDaDataKey(partesTimezone(ajuste.registro.registradoEm, timezone).dateKey);
    const novo = competenciaDaDataKey(partesTimezone(ajuste.horarioNovo, timezone).dateKey);
    return original === competencia || novo === competencia;
  });
}

export async function analisarAjustePonto({ organizacaoId, empresaId, ajusteId, usuarioId, decisao, observacao }) {
  const ajuste = await prisma.ajustePonto.findFirst({
    where: { id: ajusteId, registro: { empresaId, funcionario: { organizacaoId } } },
    include: { registro: true },
  });
  if (!ajuste) throw new Error("AJUSTE_NAO_ENCONTRADO");
  if (ajuste.status !== "PENDENTE") throw new Error("AJUSTE_JA_ANALISADO");

  if (decisao === "APROVAR") {
    const timezone = await timezoneOrganizacao(organizacaoId);
    const competencias = new Set([
      competenciaDaDataKey(partesTimezone(ajuste.horarioAnterior, timezone).dateKey),
      competenciaDaDataKey(partesTimezone(ajuste.horarioNovo, timezone).dateKey),
    ]);
    for (const competencia of competencias) {
      await garantirCompetenciaAberta({ funcionarioId: ajuste.registro.funcionarioId, empresaId, competencia });
    }
  }

  const status = decisao === "APROVAR" ? "APROVADO" : "REJEITADO";
  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.ajustePonto.update({
      where: { id: ajusteId },
      data: {
        status,
        analisadoPorId: usuarioId,
        analisadoEm: new Date(),
        observacaoAnalise: observacao || null,
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        analisadoPor: { select: { id: true, nome: true } },
        registro: { include: { funcionario: { select: { id: true, nome: true } } } },
      },
    });
    await auditar(tx, {
      organizacaoId,
      empresaId,
      usuarioId,
      acao: status === "APROVADO" ? "PONTO_AJUSTE_APROVADO" : "PONTO_AJUSTE_REJEITADO",
      entidade: "AjustePonto",
      entidadeId: ajusteId,
      dadosAnteriores: { status: ajuste.status },
      dadosNovos: { status, observacao: observacao || null },
    });
    return atualizado;
  });
}

async function gerarRelatorioMensal({ organizacaoId, empresaId, competencia }) {
  validarCompetencia(competencia);
  await validarEmpresaDaOrganizacao(organizacaoId, empresaId);
  const timezone = await timezoneOrganizacao(organizacaoId);
  const agora = new Date();
  const agoraLocal = partesTimezone(agora, timezone);
  const hojeKey = agoraLocal.dateKey;
  const competenciaAtual = competenciaDaDataKey(hojeKey);
  const faixa = limitesUtcCompetencia(competencia);

  const funcionariosEncontrados = await prisma.funcionario.findMany({
    where: {
      organizacaoId,
      empresas: { some: { empresaId, ativo: true } },
    },
    orderBy: { nome: "asc" },
    include: {
      funcao: { select: { id: true, nome: true } },
      jornadas: { where: { empresaId, ativo: true }, orderBy: { diaSemana: "asc" } },
    },
  });
  const datasCompetencia = datasDaCompetencia(competencia);
  const primeiroDiaCompetencia = datasCompetencia[0];
  const ultimoDiaCompetencia = datasCompetencia[datasCompetencia.length - 1];
  const funcionarios = funcionariosEncontrados.filter((funcionario) => {
    const admissao = dataIso(funcionario.dataAdmissao);
    const demissao = dataIso(funcionario.dataDemissao);
    return (!admissao || admissao <= ultimoDiaCompetencia) && (!demissao || demissao >= primeiroDiaCompetencia);
  });
  const ids = funcionarios.map((f) => f.id);

  if (!ids.length) {
    return {
      competencia,
      timezone,
      competenciaAtual,
      empresaId,
      resumo: { funcionarios: 0, fechados: 0, minutosPrevistos: 0, minutosTrabalhados: 0, saldoBancoCompetencia: 0, divergencias: 0, ajustesPendentes: 0 },
      funcionarios: [],
    };
  }

  const [registros, fechamentos, anteriores, posteriores] = await Promise.all([
    prisma.registroPonto.findMany({
      where: { funcionarioId: { in: ids }, empresaId, registradoEm: { gte: faixa.inicio, lt: faixa.fim } },
      orderBy: { registradoEm: "asc" },
      include: { ajustes: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.fechamentoPonto.findMany({ where: { funcionarioId: { in: ids }, empresaId, competencia } }),
    prisma.fechamentoPonto.findMany({
      where: { funcionarioId: { in: ids }, empresaId, competencia: { lt: competencia }, status: "FECHADO" },
      orderBy: { competencia: "desc" },
    }),
    prisma.fechamentoPonto.findMany({
      where: { funcionarioId: { in: ids }, empresaId, competencia: { gt: competencia }, status: "FECHADO" },
      select: { funcionarioId: true, competencia: true },
    }),
  ]);

  const registrosPorFuncionario = new Map(ids.map((id) => [id, []]));
  for (const registro of registros) registrosPorFuncionario.get(registro.funcionarioId)?.push(registro);
  const fechamentoPorFuncionario = new Map(fechamentos.map((f) => [f.funcionarioId, f]));
  const anteriorPorFuncionario = new Map();
  for (const anterior of anteriores) {
    if (!anteriorPorFuncionario.has(anterior.funcionarioId)) anteriorPorFuncionario.set(anterior.funcionarioId, anterior);
  }
  const posteriorPorFuncionario = new Map();
  for (const posterior of posteriores) {
    if (!posteriorPorFuncionario.has(posterior.funcionarioId)) posteriorPorFuncionario.set(posterior.funcionarioId, posterior.competencia);
  }

  const datas = datasDaCompetencia(competencia);
  const linhas = [];

  for (const funcionario of funcionarios) {
    const registrosFuncionario = registrosPorFuncionario.get(funcionario.id) || [];
    const porDia = new Map();
    let ajustesPendentes = 0;

    for (const registro of registrosFuncionario) {
      const dataEfetiva = dataEfetivaRegistro(registro);
      const key = partesTimezone(dataEfetiva, timezone).dateKey;
      if (competenciaDaDataKey(key) === competencia) {
        if (!porDia.has(key)) porDia.set(key, []);
        porDia.get(key).push(registro);
      }
      ajustesPendentes += (registro.ajustes || []).filter((a) => a.status === "PENDENTE").length;
    }

    const jornadasPorDia = new Map(funcionario.jornadas.map((j) => [j.diaSemana, j]));
    const dias = [];
    for (const dateKey of datas) {
      if (!dentroVinculoFuncionario(funcionario, dateKey)) continue;
      if (competencia > competenciaAtual || (competencia === competenciaAtual && dateKey > hojeKey)) continue;
      const diaSemana = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
      const jornada = jornadasPorDia.get(diaSemana) || null;
      const registrosDia = porDia.get(dateKey) || [];
      if (!jornada && registrosDia.length === 0) continue;
      dias.push(analisarDia({
        dateKey,
        registros: registrosDia,
        jornada,
        timezone,
        hojeKey,
        minutosAgora: agoraLocal.minutosDia,
      }));
    }

    const calculado = dias.reduce((acc, dia) => {
      acc.minutosPrevistos += dia.minutosPrevistos;
      acc.minutosTrabalhados += dia.minutosTrabalhados;
      acc.minutosExtras += dia.minutosExtras;
      acc.minutosAtraso += dia.minutosAtraso;
      acc.minutosPausa += dia.minutosPausa;
      acc.faltas += dia.falta;
      for (const div of dia.divergencias) acc.divergencias.push({ data: dia.data, ...div });
      return acc;
    }, { minutosPrevistos: 0, minutosTrabalhados: 0, minutosExtras: 0, minutosAtraso: 0, minutosPausa: 0, faltas: 0, divergencias: [] });

    const anterior = anteriorPorFuncionario.get(funcionario.id);
    const saldoBancoAnterior = Number(anterior?.saldoBancoAcumulado || 0);
    const saldoBancoCompetencia = calculado.minutosTrabalhados - calculado.minutosPrevistos;
    const saldoBancoAcumulado = saldoBancoAnterior + saldoBancoCompetencia;
    const fechamento = fechamentoPorFuncionario.get(funcionario.id) || null;
    const fechado = fechamento?.status === "FECHADO";
    const divergenciasSnapshot = Array.isArray(fechamento?.divergencias) ? fechamento.divergencias : calculado.divergencias;
    const diasSnapshot = Array.isArray(fechamento?.espelho) ? fechamento.espelho : dias;

    const linha = {
      funcionario: {
        id: funcionario.id,
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        matricula: funcionario.matricula,
        funcao: funcionario.funcao,
      },
      statusFechamento: fechamento?.status || "ABERTO",
      fechamentoId: fechamento?.id || null,
      fechadoEm: fechamento?.fechadoEm || null,
      observacoes: fechamento?.observacoes || null,
      minutosPrevistos: fechado ? fechamento.minutosPrevistos : calculado.minutosPrevistos,
      minutosTrabalhados: fechado ? fechamento.minutosTrabalhados : calculado.minutosTrabalhados,
      minutosExtras: fechado ? fechamento.minutosExtras : calculado.minutosExtras,
      minutosAtraso: fechado ? fechamento.minutosAtraso : calculado.minutosAtraso,
      minutosPausa: fechado ? fechamento.minutosPausa : calculado.minutosPausa,
      faltas: fechado ? fechamento.faltas : calculado.faltas,
      saldoBancoAnterior: fechado ? fechamento.saldoBancoAnterior : saldoBancoAnterior,
      saldoBancoCompetencia: fechado ? fechamento.saldoBancoCompetencia : saldoBancoCompetencia,
      saldoBancoAcumulado: fechado ? fechamento.saldoBancoAcumulado : saldoBancoAcumulado,
      divergencias: divergenciasSnapshot,
      divergenciasCriticas: divergenciasSnapshot.filter((d) => d.severidade === "CRITICA").length,
      ajustesPendentes: fechado ? 0 : ajustesPendentes,
      fechamentoPosterior: posteriorPorFuncionario.get(funcionario.id) || null,
      dias: fechado ? diasSnapshot : dias,
    };
    linha.prontoParaFechar = Boolean(
      !fechado
      && competencia < competenciaAtual
      && linha.divergenciasCriticas === 0
      && linha.ajustesPendentes === 0
      && !linha.fechamentoPosterior
    );
    linhas.push(linha);
  }

  const resumo = linhas.reduce((acc, linha) => {
    acc.funcionarios += 1;
    if (linha.statusFechamento === "FECHADO") acc.fechados += 1;
    acc.minutosPrevistos += linha.minutosPrevistos;
    acc.minutosTrabalhados += linha.minutosTrabalhados;
    acc.saldoBancoCompetencia += linha.saldoBancoCompetencia;
    acc.divergencias += linha.divergencias.length;
    acc.ajustesPendentes += linha.ajustesPendentes;
    return acc;
  }, { funcionarios: 0, fechados: 0, minutosPrevistos: 0, minutosTrabalhados: 0, saldoBancoCompetencia: 0, divergencias: 0, ajustesPendentes: 0 });

  return { competencia, timezone, competenciaAtual, empresaId, resumo, funcionarios: linhas };
}

export async function fechamentoMensal({ organizacaoId, empresaId, competencia }) {
  return gerarRelatorioMensal({ organizacaoId, empresaId, competencia });
}

function erroComDetalhes(codigo, detalhes) {
  const error = new Error(codigo);
  error.detalhes = detalhes;
  return error;
}

function validarLinhaParaFechamento(linha, competencia, competenciaAtual) {
  if (competencia >= competenciaAtual) throw new Error("COMPETENCIA_EM_ANDAMENTO");
  if (linha.statusFechamento === "FECHADO") throw new Error("FECHAMENTO_JA_REALIZADO");
  if (linha.fechamentoPosterior) throw new Error("FECHAMENTO_FORA_ORDEM");
  const bloqueios = [];
  if (linha.ajustesPendentes > 0) bloqueios.push(`${linha.ajustesPendentes} ajuste(s) pendente(s)`);
  if (linha.divergenciasCriticas > 0) bloqueios.push(`${linha.divergenciasCriticas} divergência(s) crítica(s)`);
  if (bloqueios.length) throw erroComDetalhes("FECHAMENTO_BLOQUEADO", { funcionarioId: linha.funcionario.id, funcionario: linha.funcionario.nome, bloqueios });
}

function dadosFechamento(linha, usuarioId, observacoes) {
  return {
    fechadoPorId: usuarioId,
    minutosPrevistos: linha.minutosPrevistos,
    minutosTrabalhados: linha.minutosTrabalhados,
    minutosExtras: linha.minutosExtras,
    minutosAtraso: linha.minutosAtraso,
    minutosPausa: linha.minutosPausa,
    faltas: linha.faltas,
    saldoBancoAnterior: linha.saldoBancoAnterior,
    saldoBancoCompetencia: linha.saldoBancoCompetencia,
    saldoBancoAcumulado: linha.saldoBancoAcumulado,
    divergencias: linha.divergencias,
    espelho: linha.dias,
    observacoes: observacoes || null,
    status: "FECHADO",
    fechadoEm: new Date(),
    reabertoPorId: null,
    reabertoEm: null,
    motivoReabertura: null,
  };
}

export async function fecharPontoFuncionario({ organizacaoId, empresaId, funcionarioId, usuarioId, competencia, observacoes }) {
  const relatorio = await gerarRelatorioMensal({ organizacaoId, empresaId, competencia });
  const linha = relatorio.funcionarios.find((item) => item.funcionario.id === funcionarioId);
  if (!linha) throw new Error("FUNCIONARIO_NAO_ENCONTRADO");
  validarLinhaParaFechamento(linha, competencia, relatorio.competenciaAtual);

  return prisma.$transaction(async (tx) => {
    const fechamento = await tx.fechamentoPonto.upsert({
      where: { funcionarioId_empresaId_competencia: { funcionarioId, empresaId, competencia } },
      update: dadosFechamento(linha, usuarioId, observacoes),
      create: { funcionarioId, empresaId, competencia, ...dadosFechamento(linha, usuarioId, observacoes) },
    });
    await auditar(tx, {
      organizacaoId,
      empresaId,
      usuarioId,
      acao: "PONTO_FECHAMENTO_MENSAL",
      entidade: "FechamentoPonto",
      entidadeId: fechamento.id,
      dadosNovos: { competencia, funcionarioId, saldoBancoCompetencia: linha.saldoBancoCompetencia, saldoBancoAcumulado: linha.saldoBancoAcumulado },
    });
    return fechamento;
  });
}

export async function fecharCompetencia({ organizacaoId, empresaId, usuarioId, competencia, observacoes }) {
  const relatorio = await gerarRelatorioMensal({ organizacaoId, empresaId, competencia });
  if (competencia >= relatorio.competenciaAtual) throw new Error("COMPETENCIA_EM_ANDAMENTO");

  const abertas = relatorio.funcionarios.filter((linha) => linha.statusFechamento !== "FECHADO");
  const bloqueados = abertas.filter((linha) => !linha.prontoParaFechar).map((linha) => ({
    funcionarioId: linha.funcionario.id,
    funcionario: linha.funcionario.nome,
    ajustesPendentes: linha.ajustesPendentes,
    divergenciasCriticas: linha.divergenciasCriticas,
    fechamentoPosterior: linha.fechamentoPosterior,
  }));
  if (bloqueados.length) throw erroComDetalhes("FECHAMENTO_BLOQUEADO", { funcionarios: bloqueados });

  if (!abertas.length) return { fechados: 0, competencia };

  await prisma.$transaction(async (tx) => {
    for (const linha of abertas) {
      const fechamento = await tx.fechamentoPonto.upsert({
        where: { funcionarioId_empresaId_competencia: { funcionarioId: linha.funcionario.id, empresaId, competencia } },
        update: dadosFechamento(linha, usuarioId, observacoes),
        create: { funcionarioId: linha.funcionario.id, empresaId, competencia, ...dadosFechamento(linha, usuarioId, observacoes) },
      });
      await auditar(tx, {
        organizacaoId,
        empresaId,
        usuarioId,
        acao: "PONTO_FECHAMENTO_MENSAL",
        entidade: "FechamentoPonto",
        entidadeId: fechamento.id,
        dadosNovos: { competencia, funcionarioId: linha.funcionario.id, saldoBancoAcumulado: linha.saldoBancoAcumulado },
      });
    }
  }, { maxWait: 10000, timeout: 30000 });

  return { fechados: abertas.length, competencia };
}

export async function reabrirFechamento({ organizacaoId, empresaId, fechamentoId, usuarioId, motivo }) {
  const fechamento = await prisma.fechamentoPonto.findFirst({
    where: { id: fechamentoId, empresaId, funcionario: { organizacaoId } },
  });
  if (!fechamento) throw new Error("FECHAMENTO_NAO_ENCONTRADO");
  if (fechamento.status !== "FECHADO") throw new Error("FECHAMENTO_NAO_FECHADO");

  const posterior = await prisma.fechamentoPonto.findFirst({
    where: {
      funcionarioId: fechamento.funcionarioId,
      empresaId,
      competencia: { gt: fechamento.competencia },
      status: "FECHADO",
    },
    orderBy: { competencia: "asc" },
  });
  if (posterior) throw erroComDetalhes("REABERTURA_FORA_ORDEM", { competenciaPosterior: posterior.competencia });

  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.fechamentoPonto.update({
      where: { id: fechamentoId },
      data: {
        status: "ABERTO",
        reabertoPorId: usuarioId,
        reabertoEm: new Date(),
        motivoReabertura: motivo,
      },
    });
    await auditar(tx, {
      organizacaoId,
      empresaId,
      usuarioId,
      acao: "PONTO_FECHAMENTO_REABERTO",
      entidade: "FechamentoPonto",
      entidadeId: fechamentoId,
      dadosAnteriores: { status: fechamento.status, competencia: fechamento.competencia, saldoBancoAcumulado: fechamento.saldoBancoAcumulado },
      dadosNovos: { status: "ABERTO", motivo },
    });
    return atualizado;
  });
}

function csvCampo(value) {
  const text = String(value ?? "");
  if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function minutosCsv(value) {
  const total = Number(value || 0);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

export async function exportarFechamentoCsv({ organizacaoId, empresaId, competencia }) {
  const relatorio = await gerarRelatorioMensal({ organizacaoId, empresaId, competencia });
  const empresa = await prisma.empresa.findFirst({ where: { id: empresaId, organizacaoId }, select: { nomeFantasia: true, cnpj: true } });
  const header = [
    "Competência", "Empresa", "CNPJ", "Funcionário", "Matrícula", "CPF", "Função", "Status",
    "Previsto", "Trabalhado", "Extras", "Atrasos/saídas antecipadas", "Pausas", "Faltas",
    "Banco anterior", "Saldo competência", "Banco acumulado", "Divergências", "Ajustes pendentes",
  ];
  const rows = relatorio.funcionarios.map((linha) => [
    competencia,
    empresa?.nomeFantasia || "",
    empresa?.cnpj || "",
    linha.funcionario.nome,
    linha.funcionario.matricula || "",
    linha.funcionario.cpf || "",
    linha.funcionario.funcao?.nome || "",
    linha.statusFechamento,
    minutosCsv(linha.minutosPrevistos),
    minutosCsv(linha.minutosTrabalhados),
    minutosCsv(linha.minutosExtras),
    minutosCsv(linha.minutosAtraso),
    minutosCsv(linha.minutosPausa),
    linha.faltas,
    minutosCsv(linha.saldoBancoAnterior),
    minutosCsv(linha.saldoBancoCompetencia),
    minutosCsv(linha.saldoBancoAcumulado),
    linha.divergencias.length,
    linha.ajustesPendentes,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCampo).join(";")).join("\r\n")}`;
}
