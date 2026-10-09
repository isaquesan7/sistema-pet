import {
  criarPetSchema,
  atualizarPetSchema,
  adicionarPesoSchema,
  criarEspecieSchema,
  atualizarEspecieSchema,
  criarRacaSchema,
  atualizarRacaSchema,
} from "./pets.schema.js";
import * as petsService from "./pets.service.js";
import { verificarLimiteRecurso } from "../saas/saas.service.js";

function responderErro(error, res, next) {
  const erros = {
    CLIENTE_NAO_ENCONTRADO: [404, "Tutor não encontrado."],
    PET_NAO_ENCONTRADO: [404, "Pet não encontrado."],
    ESPECIE_NAO_ENCONTRADA: [404, "Espécie não encontrada."],
    RACA_NAO_ENCONTRADA: [404, "Raça não encontrada."],
    RACA_NAO_PERTENCE_ESPECIE: [400, "A raça selecionada não pertence à espécie informada."],
    MICROCHIP_JA_CADASTRADO: [409, "Este microchip já está vinculado a outro pet."],
    ESPECIE_JA_CADASTRADA: [409, "Já existe uma espécie com este nome nesta organização."],
    RACA_JA_CADASTRADA: [409, "Já existe uma raça com este nome para esta espécie."],
  };

  if (error.message === "LIMITE_PLANO_ATINGIDO") {
    return res.status(403).json({ success: false, message: `Seu plano atingiu o limite de ${error.limite} pets.`, code: error.message });
  }

  const resposta = erros[error.message];
  if (resposta) {
    return res.status(resposta[0]).json({ success: false, message: resposta[1] });
  }
  next(error);
}

function validar(schema, body, res) {
  const resultado = schema.safeParse(body);
  if (!resultado.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos.",
      errors: resultado.error.flatten().fieldErrors,
    });
    return null;
  }
  return resultado.data;
}

export async function criar(req, res, next) {
  try {
    const dados = validar(criarPetSchema, req.body, res);
    if (!dados) return;
    await verificarLimiteRecurso(req.organizacao.id, "pets");
    const pet = await petsService.criarPet(req.organizacao.id, dados);
    return res.status(201).json({ success: true, message: "Pet cadastrado com sucesso.", pet });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function listar(req, res, next) {
  try {
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const limite = Math.min(Math.max(Number(req.query.limite) || 20, 1), 100);
    const resultado = await petsService.listarPets({
      organizacaoId: req.organizacao.id,
      busca: req.query.busca?.trim() || "",
      clienteId: req.query.clienteId || null,
      especieId: req.query.especieId || null,
      pagina,
      limite,
    });
    return res.status(200).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

export async function buscarPorId(req, res, next) {
  try {
    const pet = await petsService.buscarPetPorId(req.organizacao.id, req.params.id);
    return res.status(200).json({ success: true, pet });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function atualizar(req, res, next) {
  try {
    const dados = validar(atualizarPetSchema, req.body, res);
    if (!dados) return;
    const pet = await petsService.atualizarPet(req.organizacao.id, req.params.id, dados);
    return res.status(200).json({ success: true, message: "Pet atualizado com sucesso.", pet });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function adicionarPeso(req, res, next) {
  try {
    const dados = validar(adicionarPesoSchema, req.body, res);
    if (!dados) return;
    const peso = await petsService.adicionarPeso(req.organizacao.id, req.params.id, dados);
    return res.status(201).json({ success: true, message: "Peso registrado com sucesso.", peso });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function especies(req, res, next) {
  try {
    const dados = await petsService.listarEspecies(req.organizacao.id);
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function criarEspecie(req, res, next) {
  try {
    const dados = validar(criarEspecieSchema, req.body, res);
    if (!dados) return;
    const especie = await petsService.criarEspecie(req.organizacao.id, dados);
    return res.status(201).json({ success: true, especie });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function atualizarEspecie(req, res, next) {
  try {
    const dados = validar(atualizarEspecieSchema, req.body, res);
    if (!dados) return;
    const especie = await petsService.atualizarEspecie(req.organizacao.id, req.params.id, dados);
    return res.json({ success: true, especie });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function racas(req, res, next) {
  try {
    const dados = await petsService.listarRacas(req.organizacao.id, req.query.especieId);
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function criarRaca(req, res, next) {
  try {
    const dados = validar(criarRacaSchema, req.body, res);
    if (!dados) return;
    const raca = await petsService.criarRaca(req.organizacao.id, dados);
    return res.status(201).json({ success: true, raca });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function atualizarRaca(req, res, next) {
  try {
    const dados = validar(atualizarRacaSchema, req.body, res);
    if (!dados) return;
    const raca = await petsService.atualizarRaca(req.organizacao.id, req.params.id, dados);
    return res.json({ success: true, raca });
  } catch (error) {
    responderErro(error, res, next);
  }
}
