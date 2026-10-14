/**
 * Fase 20.2 — conferência de alocação do fechamento multiempresa.
 * Não executa venda, pagamento, crédito, estoque ou documento fiscal.
 * Revalida a reserva e cada caixa, sem confiar em totais do navegador.
 */
import {z} from "zod";
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {consultarReservaFechamento,planejarFechamento} from "./pdv-unificado.service.js";

// "Crédito do cliente" só poderá entrar após a homologação do razão no PR #35.
// Valores inteiros em centavos impedem divergência por arredondamento no cliente.
const formaSchema=z.enum(["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"]);
const moneySchema=z.number().int().safe().positive().max(99999999999);
export const conferenciaAlocacaoSchema=z.object({
 versao:z.number().int().positive(),
 alocacoes:z.array(z.object({
  empresaId:z.string().min(1),
  sessaoCaixaId:z.string().min(1),
  pagamentos:z.array(z.object({forma:formaSchema,valorCentavos:moneySchema}).strict()).min(1).max(10)
 }).strict()).min(1).max(30)
}).strict();

function toCents(value){
 const result=Math.round(Number(value)*100);
 if(!Number.isSafeInteger(result)||result<0)throw Error("VALOR_RESERVADO_INVALIDO");
 return result;
}

/** Read-only financial readiness. A valid answer does NOT authorize payment. */
export async function conferirAlocacaoFechamento({organizacaoId,usuarioId,empresaId,id,dados},db=prisma){
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao:dados.versao},db);
 if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
 if(reserva.status!=="RESERVADA")throw Error("RESERVA_NAO_EDITAVEL");
 const operacoes=reserva.operacoes;
 if(operacoes.some(o=>o.status!=="RESERVADA"||o.vendaId))throw Error("RESERVA_NAO_EDITAVEL");
 const allowed=new Map(operacoes.map(o=>[o.empresaId,o]));
 const seen=new Set();
 const problems=[];
 for(const a of dados.alocacoes){
  if(seen.has(a.empresaId)){problems.push({codigo:"EMPRESA_REPETIDA",empresaId:a.empresaId});continue;}
  seen.add(a.empresaId);
  if(!allowed.has(a.empresaId))throw Error("EMPRESA_SEM_ACESSO");
 }
 for(const o of operacoes){
  if(!seen.has(o.empresaId))problems.push({codigo:"EMPRESA_SEM_ALOCACAO",empresaId:o.empresaId});
 }
 const sessionIds=[...new Set(dados.alocacoes.map(a=>a.sessaoCaixaId))];
 const sessions=await db.sessaoCaixa.findMany({
  where:{id:{in:sessionIds}},
  select:{id:true,status:true,caixa:{select:{empresaId:true,ativo:true}}}
 });
 const bySession=new Map(sessions.map(s=>[s.id,s]));
 const allocations=[];
 for(const a of dados.alocacoes){
  const op=allowed.get(a.empresaId);
  if(!op)continue;
  const sessao=bySession.get(a.sessaoCaixaId);
  if(!sessao||sessao.status!=="ABERTO"||!sessao.caixa.ativo||sessao.caixa.empresaId!==a.empresaId){
   problems.push({codigo:"CAIXA_INDISPONIVEL_OU_OUTRA_EMPRESA",empresaId:a.empresaId});
  }
  const amount=a.pagamentos.reduce((n,p)=>n+p.valorCentavos,0);
  if(!Number.isSafeInteger(amount)||amount!==toCents(op.valor)){
   problems.push({codigo:"PAGAMENTO_DIVERGENTE",empresaId:a.empresaId});
  }
  allocations.push({
   empresaId:a.empresaId,cnpj:op.cnpj,empresa:op.nome,
   valorReservado:op.valor,valorAlocado:(amount/100).toFixed(2),
   sessaoCaixaId:a.sessaoCaixaId,
   chaveIdempotencia:op.chaveIdempotencia,
   formas:a.pagamentos.map(p=>({forma:p.forma,valor:(p.valorCentavos/100).toFixed(2)}))
  });
 }
 const problemsUnique=[...new Map(problems.map(p=>[`${p.codigo}:${p.empresaId}`,p])).values()];
 return {
  reservaId:reserva.id,comandaId:reserva.comandaId,versao:reserva.versao,
  totalReservado:reserva.total,empresas:allocations,pendencias:problemsUnique,
  preConferenciaAprovada:problemsUnique.length===0,
  execucaoDisponivel:false,splitDisponivel:false,creditoClienteDisponivel:false,emissaoFiscalDisponivel:false,
  mensagem:"Conferência sem criar vendas, cobrar, movimentar estoque, utilizar crédito ou emitir documento fiscal."
 };
}

/** Detect inconsistent operation links without any repair/mutation.
 * This is for later manual incident review and retry orchestration.
 */
export async function diagnosticarRecuperacaoFechamento({organizacaoId,usuarioId,empresaId,id,versao},db=prisma){
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},db);
 if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
 const vendaIds=reserva.operacoes.map(o=>o.vendaId).filter(Boolean);
 const vendas=vendaIds.length?await db.venda.findMany({
  where:{id:{in:vendaIds},comandaId:id,empresa:{organizacaoId}},
  select:{id:true,empresaId:true,status:true,valorTotal:true}
 }):[];
 const byVenda=new Map(vendas.map(v=>[v.id,v]));
 const operacoes=reserva.operacoes.map(op=>{
  let diagnostico="AGUARDANDO_EXECUCAO_FUTURA";
  if(reserva.status==="CANCELADA"&&op.status==="CANCELADA"&&!op.vendaId)diagnostico="CANCELADA";
  else if(op.vendaId){
   const venda=byVenda.get(op.vendaId);
   if(!venda||venda.empresaId!==op.empresaId)diagnostico="VINCULO_INCONSISTENTE";
   else if(toCents(venda.valorTotal)!==toCents(op.valor))diagnostico="VALOR_DIVERGENTE";
   else if(op.status==="CONCLUIDA"&&venda.status==="FINALIZADA")diagnostico="VINCULO_CONFIRMADO";
   else diagnostico="ESTADO_REQUER_REVISAO";
  }else if(op.status!=="RESERVADA"||reserva.status!=="RESERVADA")diagnostico="ESTADO_REQUER_REVISAO";
  return {empresaId:op.empresaId,cnpj:op.cnpj,operacaoId:op.id,chaveIdempotencia:op.chaveIdempotencia,vendaId:op.vendaId,diagnostico};
 });
 return {reservaId:reserva.id,status:reserva.status,operacoes,
  exigeRevisaoManual:operacoes.some(o=>["VINCULO_INCONSISTENTE","VALOR_DIVERGENTE","ESTADO_REQUER_REVISAO"].includes(o.diagnostico)),
  recuperacaoAutomaticaHabilitada:false,execucaoDisponivel:false,
  mensagem:"Diagnóstico apenas leitura: nenhuma repetição automática de cobrança ou venda."};
}

/** Only cash sessions for companies within the validated reservation are exposed. */
export async function listarCaixasDisponiveisUnificados({organizacaoId,usuarioId,empresaId,id,versao},db=prisma){
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao});
 if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
 if(reserva.status!=="RESERVADA")return [];
 const ids=reserva.operacoes.map(o=>o.empresaId);
 const sessions=await db.sessaoCaixa.findMany({
  where:{status:"ABERTO",caixa:{empresaId:{in:ids},ativo:true}},
  select:{id:true,caixaId:true,caixa:{select:{nome:true,empresaId:true}}},
  orderBy:{dataAbertura:"desc"},
  take:100
 });
 return sessions.map(s=>({sessaoCaixaId:s.id,empresaId:s.caixa.empresaId,caixa:s.caixa.nome}));
}

/** Stable payload representation for idempotency; user-supplied amounts remain untrusted
 * until the read-only financial conference and cart price reconciliation pass in TX. */
function normalizarAlocacoes(alocacoes){
 return alocacoes.map(a=>({
  empresaId:a.empresaId,sessaoCaixaId:a.sessaoCaixaId,
  pagamentos:a.pagamentos.map(p=>({forma:p.forma,valorCentavos:p.valorCentavos}))
   .sort((a,b)=>a.forma.localeCompare(b.forma)||a.valorCentavos-b.valorCentavos)
 })).sort((a,b)=>a.empresaId.localeCompare(b.empresaId));
}
function apresentarPreparacao(prep,reutilizada=false){
 return {id:prep.id,reservaId:prep.reservaId,status:prep.status,
  fingerprint:prep.fingerprint,criadoEm:prep.createdAt,reutilizada,
  total:prep.snapshot.total,operacoes:prep.snapshot.operacoes.map(({empresaId,cnpj,total})=>({empresaId,cnpj,total})),
  execucaoDisponivel:false,pagamentosGerados:false,vendasGeradas:false,
  mensagem:"Snapshot registrado. Nenhuma venda, pagamento, baixa de estoque ou nota fiscal foi criada."};
}
/** An immutable seller allocation snapshot, NOT a sale.
 * On retries, the unique reservation key and payload fingerprint return the original
 * record; a different payload gets a conflict, never an overwrite.
 */
export async function prepararExecucaoUnificada({organizacaoId,usuarioId,empresaId,id,dados}){
 const normalizadas=normalizarAlocacoes(dados.alocacoes);
 return prisma.$transaction(async tx=>{
  // Same row lock ordering as draft edits and reservations.
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const comanda=await tx.comanda.findFirst({
   where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
   select:{id:true,clienteId:true,status:true,versaoRascunho:true,
    itens:{where:{status:"ATIVO"},select:{
      id:true,empresaId:true,itemCatalogoId:true,petId:true,descricao:true,
      quantidade:true,valorUnitario:true,valorTotal:true,desconto:true
    }}}
  });
  if(!comanda)throw Error("RASCUNHO_NAO_ENCONTRADO");
  if(comanda.status!=="ABERTA"||comanda.versaoRascunho!==dados.versao)throw Error("RASCUNHO_DESATUALIZADO");
  const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao:dados.versao},tx);
  if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
  if(reserva.status!=="RESERVADA"||reserva.operacoes.some(op=>op.status!=="RESERVADA"||op.vendaId))throw Error("RESERVA_NAO_EDITAVEL");
  const fingerprint=createHash("sha256").update(JSON.stringify({reservaId:reserva.id,versao:dados.versao,alocacoes:normalizadas})).digest("hex");
  const prior=await tx.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
  if(prior){
   if(prior.status!=="PREPARADA")throw Error("PREPARACAO_INVALIDADA");
   if(prior.fingerprint!==fingerprint)throw Error("PREPARACAO_DIVERGENTE");
   return apresentarPreparacao(prior,true);
  }

  // Revalidate current catalog/pet/roles under the same serializable DB TX.
  const plano=await planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao:dados.versao},tx);
  if(plano.operacoes.length!==reserva.operacoes.length||
   plano.operacoes.some(p=>!reserva.operacoes.some(op=>op.empresaId===p.empresaId&&op.chaveIdempotencia===p.chaveIdempotencia&&toCents(op.valor)===toCents(p.total)))||
   toCents(plano.total)!==toCents(reserva.total))throw Error("RESERVA_PLANO_DIVERGENTE");
  const conference=await conferirAlocacaoFechamento({organizacaoId,usuarioId,empresaId,id,dados},tx);
  if(!conference.preConferenciaAprovada)throw Error("ALOCACAO_COM_PENDENCIAS");
  const allocationByCompany=new Map(normalizadas.map(a=>[a.empresaId,a]));
  const operacoes=reserva.operacoes.map(op=>({
   empresaId:op.empresaId,cnpj:op.cnpj,chaveIdempotencia:op.chaveIdempotencia,
   total:op.valor,
   sessaoCaixaId:allocationByCompany.get(op.empresaId).sessaoCaixaId,
   pagamentos:allocationByCompany.get(op.empresaId).pagamentos,
   itens:comanda.itens.filter(line=>line.empresaId===op.empresaId)
    .map(line=>({
      comandaItemId:line.id,itemCatalogoId:line.itemCatalogoId,petId:line.petId,
      descricao:line.descricao,quantidade:String(line.quantidade),
      valorUnitario:String(line.valorUnitario),desconto:String(line.desconto),
      valorTotal:String(line.valorTotal)
    })).sort((a,b)=>a.comandaItemId.localeCompare(b.comandaItemId))
  })).sort((a,b)=>a.empresaId.localeCompare(b.empresaId));
  if(operacoes.some(op=>op.itens.length===0))throw Error("RESERVA_PLANO_DIVERGENTE");
  const snapshot={schemaVersao:1,comandaId:id,clienteId:comanda.clienteId,
   versaoRascunho:dados.versao,total:reserva.total,operacoes};
  const created=await tx.criacaoPreparacaoUnificada.create({
   data:{reservaId:reserva.id,criadoPorId:usuarioId,fingerprint,snapshot}
  });
  return apresentarPreparacao(created);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
/** Query never charges and requires permission to every company in the reservation. */
export async function consultarPreparacaoUnificada({organizacaoId,usuarioId,empresaId,id,versao}){
 const reserva=await consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao});
 if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
 const prep=await prisma.criacaoPreparacaoUnificada.findUnique({where:{reservaId:reserva.id}});
 return prep?apresentarPreparacao(prep,true):null;
}
