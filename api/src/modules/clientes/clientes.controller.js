import {
  criarClienteSchema,
  atualizarClienteSchema,
} from "./clientes.schema.js";

import * as clientesService from "./clientes.service.js";

function responderErro(error, res, next) {
  if (
    error.message ===
    "CLIENTE_NAO_ENCONTRADO"
  ) {
    return res.status(404).json({
      success: false,
      message: "Cliente não encontrado.",
    });
  }

  if (
    error.message ===
    "DOCUMENTO_JA_CADASTRADO"
  ) {
    return res.status(409).json({
      success: false,
      message:
        "Já existe um cliente cadastrado com este CPF/CNPJ.",
    });
  }

  next(error);
}

export async function criar(req, res, next) {
  try {
    const resultado =
      criarClienteSchema.safeParse(req.body);

    if (!resultado.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos.",
        errors:
          resultado.error.flatten().fieldErrors,
      });
    }

    const cliente =
      await clientesService.criarCliente(
        req.organizacao.id,
        resultado.data
      );

    return res.status(201).json({
      success: true,
      message:
        "Cliente cadastrado com sucesso.",
      cliente,
    });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function listar(
  req,
  res,
  next
) {
  try {
    const pagina = Math.max(
      Number(req.query.pagina) || 1,
      1
    );

    const limite = Math.min(
      Math.max(
        Number(req.query.limite) || 20,
        1
      ),
      100
    );

    const busca =
      req.query.busca?.trim() || "";

    const resultado =
      await clientesService.listarClientes({
        organizacaoId: req.organizacao.id,
        busca,
        pagina,
        limite,
      });

    return res.status(200).json({
      success: true,
      ...resultado,
    });
  } catch (error) {
    next(error);
  }
}

export async function buscarPorId(
  req,
  res,
  next
) {
  try {
    const cliente =
      await clientesService.buscarClientePorId(
        req.organizacao.id,
        req.params.id
      );

    return res.status(200).json({
      success: true,
      cliente,
    });
  } catch (error) {
    responderErro(error, res, next);
  }
}

export async function atualizar(
  req,
  res,
  next
) {
  try {
    const resultado =
      atualizarClienteSchema.safeParse(
        req.body
      );

    if (!resultado.success) {
      return res.status(400).json({
        success: false,
        message: "Dados inválidos.",
        errors:
          resultado.error.flatten().fieldErrors,
      });
    }

    const cliente =
      await clientesService.atualizarCliente(
        req.organizacao.id,
        req.params.id,
        resultado.data
      );

    return res.status(200).json({
      success: true,
      message:
        "Cliente atualizado com sucesso.",
      cliente,
    });
  } catch (error) {
    responderErro(error, res, next);
  }
}