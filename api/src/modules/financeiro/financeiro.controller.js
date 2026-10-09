import * as s from "./financeiro.service.js";
import { categoriaSchema, contaSchema, tituloSchema, tituloUpdateSchema, baixaSchema, cancelarTituloSchema, conciliacaoSchema } from "./financeiro.schema.js";

function parse(schema, body, res) {
  const result=schema.safeParse(body);
  if(!result.success){res.status(400).json({success:false,message:"Dados inválidos.",errors:result.error.flatten().fieldErrors});return null;}
  return result.data;
}
function map(error,res,next){
  const m={
    CATEGORIA_NAO_ENCONTRADA:[404,"Categoria financeira não encontrada."],CATEGORIA_TIPO_INVALIDO:[400,"A categoria selecionada não é compatível com este tipo de lançamento."],
    CONTA_NAO_ENCONTRADA:[404,"Conta financeira não encontrada."],CLIENTE_NAO_ENCONTRADO:[404,"Cliente não encontrado."],FORNECEDOR_NAO_ENCONTRADO:[404,"Fornecedor não encontrado."],ENTRADA_NAO_ENCONTRADA:[404,"Entrada de estoque não encontrada."],ENTRADA_SOMENTE_PAGAR:[400,"Uma entrada de estoque só pode originar uma conta a pagar."],
    TITULO_NAO_ENCONTRADO:[404,"Lançamento financeiro não encontrado."],TITULO_NAO_EDITAVEL:[409,"Este lançamento não pode mais ser editado."],TITULO_FIADO_NAO_EDITAVEL:[409,"O lançamento de fiado é controlado pela venda. Altere pelo fluxo financeiro de recebimento."],VALOR_MENOR_QUE_PAGO:[409,"O valor do título não pode ficar abaixo do valor já liquidado."],
    TITULO_NAO_BAIXAVEL:[409,"Este lançamento não está disponível para baixa."],BAIXA_INVALIDA:[400,"Os valores informados para a baixa são inválidos."],BAIXA_MAIOR_SALDO:[409,"A baixa ultrapassa o saldo em aberto deste lançamento."],TITULO_FIADO_NAO_CANCELAVEL:[409,"Para cancelar um fiado, cancele a venda de origem. Se já houve recebimento, regularize-o antes."],TITULO_COM_BAIXAS:[409,"Este lançamento já possui baixa e não pode ser cancelado diretamente."],
    MOVIMENTO_NAO_ENCONTRADO:[404,"Movimento financeiro não encontrado ou não está disponível para conciliação."],CONCILIACAO_NAO_ENCONTRADA:[404,"Conciliação não encontrada."],
  };
  if(error.code==="P2002") return res.status(409).json({success:false,message:"Já existe um cadastro ou conciliação com estes dados."});
  const x=m[error.message];if(x)return res.status(x[0]).json({success:false,message:x[1]});next(error);
}

export async function resumo(req,res,next){try{return res.json({success:true,resumo:await s.resumo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,escopo:req.query.escopo,dataInicio:req.query.dataInicio,dataFim:req.query.dataFim})})}catch(e){next(e)}}
export async function fluxo(req,res,next){try{return res.json({success:true,dados:await s.fluxo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,escopo:req.query.escopo,dataInicio:req.query.dataInicio,dataFim:req.query.dataFim})})}catch(e){next(e)}}
export async function relatorio(req,res,next){try{return res.json({success:true,relatorio:await s.relatorioGerencial({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,escopo:req.query.escopo,dataInicio:req.query.dataInicio,dataFim:req.query.dataFim})})}catch(e){next(e)}}
export async function categorias(req,res,next){try{return res.json({success:true,dados:await s.listarCategorias(req.organizacao.id)})}catch(e){next(e)}}
export async function criarCategoria(req,res,next){try{const d=parse(categoriaSchema,req.body,res);if(!d)return;return res.status(201).json({success:true,categoria:await s.salvarCategoria({organizacaoId:req.organizacao.id,dados:d})})}catch(e){map(e,res,next)}}
export async function atualizarCategoria(req,res,next){try{const d=parse(categoriaSchema.partial(),req.body,res);if(!d)return;return res.json({success:true,categoria:await s.salvarCategoria({organizacaoId:req.organizacao.id,id:req.params.id,dados:d})})}catch(e){map(e,res,next)}}
export async function contas(req,res,next){try{return res.json({success:true,dados:await s.listarContas(req.empresa.id)})}catch(e){next(e)}}
export async function criarConta(req,res,next){try{const d=parse(contaSchema,req.body,res);if(!d)return;return res.status(201).json({success:true,conta:await s.salvarConta({empresaId:req.empresa.id,dados:d})})}catch(e){map(e,res,next)}}
export async function atualizarConta(req,res,next){try{const d=parse(contaSchema.partial(),req.body,res);if(!d)return;return res.json({success:true,conta:await s.salvarConta({empresaId:req.empresa.id,id:req.params.id,dados:d})})}catch(e){map(e,res,next)}}
export async function referencias(req,res,next){try{return res.json({success:true,dados:await s.referencias({organizacaoId:req.organizacao.id,empresaId:req.empresa.id})})}catch(e){next(e)}}
export async function titulos(req,res,next){try{return res.json({success:true,dados:await s.listarTitulos({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,tipo:req.query.tipo,status:req.query.status,busca:req.query.busca?.trim(),dataInicio:req.query.dataInicio,dataFim:req.query.dataFim,limite:req.query.limite})})}catch(e){next(e)}}
export async function titulo(req,res,next){try{return res.json({success:true,titulo:await s.buscarTitulo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,id:req.params.id})})}catch(e){map(e,res,next)}}
export async function criarTitulo(req,res,next){try{const d=parse(tituloSchema,req.body,res);if(!d)return;return res.status(201).json({success:true,titulos:await s.criarTitulos({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,dados:d})})}catch(e){map(e,res,next)}}
export async function atualizarTitulo(req,res,next){try{const d=parse(tituloUpdateSchema,req.body,res);if(!d)return;return res.json({success:true,titulo:await s.atualizarTitulo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,id:req.params.id,dados:d})})}catch(e){map(e,res,next)}}
export async function baixar(req,res,next){try{const d=parse(baixaSchema,req.body,res);if(!d)return;return res.json({success:true,...await s.baixarTitulo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,id:req.params.id,dados:d})})}catch(e){map(e,res,next)}}
export async function cancelar(req,res,next){try{const d=parse(cancelarTituloSchema,req.body,res);if(!d)return;return res.json({success:true,titulo:await s.cancelarTitulo({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,id:req.params.id,motivo:d.motivo})})}catch(e){map(e,res,next)}}
export async function fiado(req,res,next){try{return res.json({success:true,dados:await s.listarFiado({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,busca:req.query.busca?.trim()})})}catch(e){next(e)}}
export async function pendentes(req,res,next){try{return res.json({success:true,dados:await s.pendentesConciliacao({empresaId:req.empresa.id,limite:req.query.limite})})}catch(e){next(e)}}
export async function conciliacoes(req,res,next){try{return res.json({success:true,dados:await s.listarConciliacoes(req.empresa.id)})}catch(e){next(e)}}
export async function conciliar(req,res,next){try{const d=parse(conciliacaoSchema,req.body,res);if(!d)return;return res.status(201).json({success:true,conciliacao:await s.conciliar({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,dados:d})})}catch(e){map(e,res,next)}}
export async function desconciliar(req,res,next){try{return res.json({success:true,conciliacao:await s.desconciliar({organizacaoId:req.organizacao.id,empresaId:req.empresa.id,usuarioId:req.usuario.id,id:req.params.id})})}catch(e){map(e,res,next)}}
