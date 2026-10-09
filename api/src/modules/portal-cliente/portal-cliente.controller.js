import * as schema from "./portal-cliente.schema.js";
import * as service from "./portal-cliente.service.js";

function parse(schemaObj, data, res) {
  const result = schemaObj.safeParse(data);
  if (!result.success) {
    res.status(400).json({ success: false, message: "Dados inválidos.", errors: result.error.flatten().fieldErrors });
    return null;
  }
  return result.data;
}

function knownError(error, res, next) {
  const messages = {
    ORGANIZACAO_NAO_ENCONTRADA: [404, "Organização não encontrada."],
    PORTAL_DESABILITADO: [403, "O portal do cliente não está habilitado para esta organização."],
    ASSINATURA_PORTAL_INDISPONIVEL: [403, "O portal está temporariamente indisponível porque a assinatura da organização precisa ser regularizada."],
    LIMITE_PLANO_ATINGIDO: [403, "O limite contratado no plano atual foi atingido. A organização precisa ampliar o plano para continuar."],
    CONTA_JA_EXISTE: [409, "Já existe uma conta vinculada a estes dados."],
    CREDENCIAIS_INVALIDAS: [401, "E-mail/telefone ou senha inválidos."],
    REFRESH_INVALIDO: [401, "Sua sessão expirou. Entre novamente."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado."],
    ESPECIE_NAO_ENCONTRADA: [404, "Espécie não encontrada."],
    RACA_NAO_ENCONTRADA: [404, "Raça não encontrada."],
    EMPRESA_NAO_CONFIGURADA: [409, "A empresa responsável por este serviço ainda não foi configurada."],
    SERVICO_INDISPONIVEL: [400, "O serviço selecionado não está disponível para agendamento online."],
    HORARIO_INVALIDO: [400, "Escolha um horário futuro válido."],
    HORARIO_INDISPONIVEL: [409, "Este horário não está mais disponível."],
    PERIODO_INVALIDO: [400, "Período inválido."],
    AGENDAMENTO_NAO_ENCONTRADO: [404, "Agendamento não encontrado."],
    AGENDAMENTO_NAO_CANCELAVEL: [409, "Este agendamento não pode mais ser cancelado pelo portal."],
    CANCELAMENTO_EXIGE_REEMBOLSO: [409, "Este agendamento já foi pago. O cancelamento exige análise de reembolso pela empresa."],
    TRANSACAO_NAO_ENCONTRADA: [404, "Transação não encontrada."],
    TRANSACAO_EXPIRADA: [409, "A reserva de pagamento expirou. Faça um novo agendamento."],
    SIMULADOR_INDISPONIVEL: [403, "O simulador de pagamento não está disponível."],
    GATEWAY_PAGAMENTO_NAO_CONFIGURADO: [503, "O pagamento online ainda não foi configurado pela empresa."],
    GATEWAY_PAGAMENTO_NAO_IMPLEMENTADO: [501, "O provedor de pagamento selecionado ainda precisa do adaptador de integração."],
  };
  const item = messages[error.message];
  if (item) return res.status(item[0]).json({ success: false, message: item[1] });
  next(error);
}

export async function publicConfig(req, res, next) { try { res.json({ success: true, organizacao: await service.publicConfig(req.params.slug) }); } catch (e) { knownError(e, res, next); } }
export async function cadastrar(req, res, next) { const data = parse(schema.cadastroSchema, req.body, res); if (!data) return; try { res.status(201).json({ success: true, ...(await service.register(data, { ip: req.ip, userAgent: req.get("user-agent") })) }); } catch (e) { knownError(e, res, next); } }
export async function login(req, res, next) { const data = parse(schema.loginSchema, req.body, res); if (!data) return; try { res.json({ success: true, ...(await service.login(data, { ip: req.ip, userAgent: req.get("user-agent") })) }); } catch (e) { knownError(e, res, next); } }
export async function refresh(req, res, next) { const data = parse(schema.refreshSchema, req.body, res); if (!data) return; try { res.json({ success: true, ...(await service.refresh({ token: data.refreshToken, ip: req.ip, userAgent: req.get("user-agent") })) }); } catch (e) { knownError(e, res, next); } }
export async function logout(req, res, next) { try { await service.logout(req.body?.refreshToken); res.json({ success: true }); } catch (e) { next(e); } }
export async function me(req, res) { res.json({ success: true, conta: { id: req.contaCliente.id, email: req.contaCliente.email, telefone: req.contaCliente.telefone, cliente: req.cliente, organizacao: { id: req.organizacao.id, slug: req.organizacao.slug, nome: req.organizacao.nome, configuracao: req.organizacao.configuracao } } }); }
export async function atualizarPerfil(req, res, next) { const data = parse(schema.perfilSchema, req.body, res); if (!data) return; try { const account = await service.updateProfile(req.contaCliente.id, data); res.json({ success: true, conta: account }); } catch (e) { knownError(e, res, next); } }
export async function pets(req, res, next) { try { res.json({ success: true, dados: await service.listPets({ clientId: req.cliente.id, organizationId: req.organizacao.id }) }); } catch (e) { next(e); } }
export async function criarPet(req, res, next) { const data = parse(schema.petSchema, req.body, res); if (!data) return; try { res.status(201).json({ success: true, pet: await service.createPet({ clientId: req.cliente.id, organizationId: req.organizacao.id, data }) }); } catch (e) { knownError(e, res, next); } }
export async function atualizarPet(req, res, next) { const data = parse(schema.petSchema.partial(), req.body, res); if (!data) return; try { res.json({ success: true, pet: await service.updatePet({ petId: req.params.id, clientId: req.cliente.id, organizationId: req.organizacao.id, data }) }); } catch (e) { knownError(e, res, next); } }
export async function catalogos(req, res, next) { try { res.json({ success: true, ...(await service.catalogs(req.organizacao.id)) }); } catch (e) { next(e); } }
export async function servicos(req, res, next) { try { const kind = req.query.tipo === "BANHO_TOSA" ? "BANHO_TOSA" : "CONSULTORIO"; res.json({ success: true, ...(await service.services({ organizationId: req.organizacao.id, kind })) }); } catch (e) { knownError(e, res, next); } }
export async function disponibilidade(req, res, next) { try { const kind = req.query.tipo === "BANHO_TOSA" ? "BANHO_TOSA" : "CONSULTORIO"; res.json({ success: true, ...(await service.blockedIntervals({ organizationId: req.organizacao.id, kind, start: req.query.inicio, end: req.query.fim })) }); } catch (e) { knownError(e, res, next); } }
export async function agendarConsultorio(req, res, next) { const data = parse(schema.agendamentoConsultorioSchema, req.body, res); if (!data) return; try { const appointment = await service.scheduleClinic({ account: req.contaCliente, petId: data.petId, itemCatalogoId: data.itemCatalogoId, inicio: data.inicio, complaint: data.queixaPrincipal }); res.status(201).json({ success: true, agendamento: appointment }); } catch (e) { knownError(e, res, next); } }
export async function agendarBanho(req, res, next) { const data = parse(schema.agendamentoBanhoSchema, req.body, res); if (!data) return; try { const result = await service.scheduleGrooming({ account: req.contaCliente, petId: data.petId, itemCatalogoIds: data.itemCatalogoIds, inicio: data.inicio, notes: data.observacoesCliente, paymentMethod: data.formaPagamento }); res.status(201).json({ success: true, ...result }); } catch (e) { knownError(e, res, next); } }
export async function agendamentos(req, res, next) { try { res.json({ success: true, ...(await service.listAppointments({ account: req.contaCliente })) }); } catch (e) { next(e); } }
export async function cancelar(req, res, next) { try { res.json({ success: true, agendamento: await service.cancelAppointment({ account: req.contaCliente, type: req.params.tipo, id: req.params.id }) }); } catch (e) { knownError(e, res, next); } }
export async function simularPagamento(req, res, next) { try { res.json({ success: true, transacao: await service.simulatePayment({ account: req.contaCliente, transactionId: req.params.id }) }); } catch (e) { knownError(e, res, next); } }
export async function saudePet(req, res, next) { try { res.json({ success: true, ...(await service.petHealth({ account: req.contaCliente, petId: req.params.id })) }); } catch (e) { knownError(e, res, next); } }
