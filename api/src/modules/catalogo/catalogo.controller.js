import {
  categoriaSchema,
  categoriaAtualizarSchema,
  itemSchema,
  itemAtualizarSchema,
  calculoPrecoSchema,
} from "./catalogo.schema.js";
import * as service from "./catalogo.service.js";

function erro(error, res, next) {
  const mapa = {
    CATEGORIA_NAO_ENCONTRADA: [404, "Categoria não encontrada."],
    CATEGORIA_TIPO_INCOMPATIVEL: [400, "A categoria não pertence ao tipo do item."],
    CATEGORIA_PAI_INVALIDA: [400, "Categoria pai inválida."],
    CATEGORIA_JA_EXISTE: [409, "Já existe uma categoria com este nome e tipo."],
    CATEGORIA_TIPO_EM_USO: [409, "Não é possível alterar o tipo de uma categoria que possui itens ou subcategorias vinculados."],
    ITEM_NAO_ENCONTRADO: [404, "Produto/serviço não encontrado."],
    CODIGO_INTERNO_JA_EXISTE: [409, "Já existe um item com este código interno nesta empresa."],
    CODIGO_BARRAS_JA_EXISTE: [409, "Já existe um item com este código de barras nesta empresa."],
    CUSTO_INVALIDO: [400, "Custo inválido."],
    PRECO_INVALIDO: [400, "Preço inválido."],
    PRECO_OU_MARKUP_OBRIGATORIO: [400, "Informe preço de venda ou markup."],
  };
  const resposta = mapa[error.message];
  if (resposta) return res.status(resposta[0]).json({ success: false, message: resposta[1] });
  next(error);
}

function parse(schema, body, res) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Dados inválidos.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return null;
  }
  return parsed.data;
}

export async function calcular(req, res, next) {
  try {
    const dados = parse(calculoPrecoSchema, req.body, res);
    if (!dados) return;
    return res.json({ success: true, precificacao: service.calcularPrecificacao(dados) });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function listarCategorias(req, res, next) {
  try {
    const dados = await service.listarCategorias(req.organizacao.id, req.query.tipo);
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function criarCategoria(req, res, next) {
  try {
    const dados = parse(categoriaSchema, req.body, res);
    if (!dados) return;
    const categoria = await service.criarCategoria(req.organizacao.id, dados);
    return res.status(201).json({ success: true, categoria });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function atualizarCategoria(req, res, next) {
  try {
    const dados = parse(categoriaAtualizarSchema, req.body, res);
    if (!dados) return;
    const categoria = await service.atualizarCategoria(req.organizacao.id, req.params.id, dados);
    return res.json({ success: true, categoria });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function listarItens(req, res, next) {
  try {
    const ativo = req.query.ativo === undefined ? undefined : req.query.ativo === "true";
    const dados = await service.listarItens({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      tipo: req.query.tipo,
      busca: req.query.busca?.trim(),
      ativo,
    });
    return res.json({ success: true, dados });
  } catch (error) {
    next(error);
  }
}

export async function buscarItem(req, res, next) {
  try {
    const item = await service.buscarItem({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      id: req.params.id,
    });
    return res.json({ success: true, item });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function criarItem(req, res, next) {
  try {
    const dados = parse(itemSchema, req.body, res);
    if (!dados) return;
    const item = await service.criarItem({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      usuarioId: req.usuario.id,
      dados,
    });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    erro(error, res, next);
  }
}

export async function atualizarItem(req, res, next) {
  try {
    const dados = parse(itemAtualizarSchema, req.body, res);
    if (!dados) return;
    const item = await service.atualizarItem({
      empresaId: req.empresa.id,
      organizacaoId: req.organizacao.id,
      usuarioId: req.usuario.id,
      id: req.params.id,
      dados,
    });
    return res.json({ success: true, item });
  } catch (error) {
    erro(error, res, next);
  }
}
