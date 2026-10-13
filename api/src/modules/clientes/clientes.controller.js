import {
  criarClienteSchema,
  atualizarClienteSchema,
} from "./clientes.schema.js";

import * as clientesService from "./clientes.service.js";
import { verificarLimiteRecurso } from "../saas/saas.service.js";

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

  if (error.message === "LIMITE_PLANO_ATINGIDO") {
    return res.status(403).json({ success: false, message: `Seu plano atingiu o limite de ${error.limite} clientes.`, code: error.message });
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

    await verificarLimiteRecurso(req.organizacao.id, "clientes");

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
    const tipoBusca=["TODOS","NOME","DOCUMENTO","TELEFONE","EMAIL","PET"].includes(req.query.tipoBusca)?req.query.tipoBusca:"TODOS";
    const situacao=["ATIVOS","INATIVOS","TODOS"].includes(req.query.situacao)?req.query.situacao:"ATIVOS";

    const resultado =
      await clientesService.listarClientes({
        organizacaoId: req.organizacao.id,
        busca,
        tipoBusca,
        situacao,
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
export async function excluir(req,res,next){
 try{
  await clientesService.excluirCliente(req.organizacao.id,req.params.id);
  return res.json({success:true,message:"Cadastro excluído definitivamente."});
 }catch(error){
  if(error.message==="CLIENTE_COM_VINCULOS")return res.status(409).json({success:false,message:"Este cliente possui pets ou registros associados. A exclusão definitiva foi bloqueada para preservar históricos clínicos, financeiros e fiscais."});
  responderErro(error,res,next);
 }
}

export async function relacionados(req,res,next){
 try{
  const dados=await clientesService.detalhesRelacionados(req.organizacao.id,req.params.id);
  // Financial figures must not be exposed to users without financial access.
  const financeiro=req.permissoes?.includes("financeiro.visualizar");
  return res.json({success:true,dados:{vendas:financeiro?dados.vendas:[],titulos:financeiro?dados.titulos:[],agendamentos:dados.agendamentos},permissoes:{financeiro}});
 }catch(error){responderErro(error,res,next);}
}
