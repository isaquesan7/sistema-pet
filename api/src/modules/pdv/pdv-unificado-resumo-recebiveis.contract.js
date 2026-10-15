/**
 * PointVet M.5.6 — conferência PURA, por empresa, dos recebíveis de cartão.
 * Nenhuma escrita, repasse, PSP, TEF, conciliação bancária ou fiscal.
 * Falha fechado ao encontrar parcelas, pagamentos ou auditorias divergentes.
 */
import {centavosExatos} from "./pdv-unificado-fechamento-manual.contract.js";
const FAIL=(reason)=>{throw Error("M56_"+reason)};
const amount=n=>String(Math.floor(n/100))+"."+String(n%100).padStart(2,"0");
const digest=/^[a-f0-9]{64}$/;
const safeSum=(a,b)=>{
 if(!Number.isSafeInteger(a+b))FAIL("VALOR_EXCESSIVO");
 return a+b;
};
const totals=()=>({original:0,pendente:0,conciliadoDeclarado:0,estornado:0});
const fmt=t=>Object.freeze(Object.fromEntries(Object.entries(t).map(([k,v])=>[k,amount(v)])));
export function consolidarRecebiveisCartaoM56({organizacaoId,empresaId,comandaId,linhas,auditorias}={}){
 if(!organizacaoId||!empresaId||!comandaId||!Array.isArray(linhas)||!Array.isArray(auditorias))
  FAIL("CONTEXTO_INVALIDO");
 const metrics=totals(),byAudit=new Map(),ids=new Set(),rows=[];
 for(const audit of auditorias){
  if(audit?.acao!=="REPASSE_CARTAO_CONCILIADO_MANUAL_CI"||
     audit.entidade!=="ParcelaRecebivelManualUnificado"||
     audit.empresaId!==empresaId||audit.organizacaoId!==organizacaoId||
     !audit.entidadeId||byAudit.has(audit.entidadeId))FAIL("AUDITORIA_INVALIDA");
  byAudit.set(audit.entidadeId,audit);
 }
 for(const line of [...linhas].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(!line?.id||ids.has("l:"+line.id)||line.forma!=="CARTAO_CREDITO"||
     line.operacao?.empresaId!==empresaId||
     line.operacao?.reserva?.comandaId!==comandaId||
     !line.pagamentoId||line.pagamento?.id!==line.pagamentoId||
     line.pagamento.forma!=="CARTAO_CREDITO"||
     line.pagamento.vendaId!==line.operacao.vendaId||
     line.operacao.venda?.id!==line.operacao.vendaId||
     line.operacao.venda.empresaId!==empresaId||
     line.registro?.status!=="REGISTRADO"||
     !Array.isArray(line.parcelasRecebiveis)||
     !Number.isInteger(line.parcelas)||line.parcelas<1||line.parcelas>24)
   FAIL("LINHA_INVALIDA");
  ids.add("l:"+line.id);
  const original=centavosExatos(line.valor);
  if(centavosExatos(line.pagamento.valor)!==original||
     line.pagamento.parcelas!==line.parcelas||
     line.parcelasRecebiveis.length!==line.parcelas)FAIL("PAGAMENTO_DIVERGENTE");
  const t=totals(),installments=[],indexSet=new Set();
  let hasCanceled=false,hasActive=false;
  for(const p of [...line.parcelasRecebiveis].sort((a,b)=>a.indice-b.indice)){
   if(!p?.id||ids.has("p:"+p.id)||p.linhaId!==line.id||
      !Number.isInteger(p.indice)||p.indice<1||p.indice>line.parcelas||
      indexSet.has(p.indice)||p.quantidadeTotal!==line.parcelas)FAIL("PARCELAS_INVALIDAS");
   ids.add("p:"+p.id);indexSet.add(p.indice);
   const cents=centavosExatos(p.valor),audit=byAudit.get(p.id);
   let column;
   if(p.status==="CONCILIADA"){
    if(!p.conciliadoEm||!audit||!audit.dadosNovos||
       audit.dadosNovos.status!=="CONCILIADA"||
       audit.dadosNovos.confirmouRepasseExterno!==true||
       audit.dadosNovos.provaBancariaIndependente!==false||
       audit.dadosNovos.origem!=="DECLARACAO_DO_OPERADOR"||
       audit.dadosNovos.valorCentavos!==cents||
       typeof audit.dadosNovos.referenciaExterna!=="string"||
       audit.dadosNovos.referenciaExterna.length<8||
       typeof audit.dadosNovos.contaFinanceiraId!=="string"||
       !digest.test(audit.dadosNovos.fingerprint||""))FAIL("CONCILIACAO_SEM_PROVA_INTERNA");
    byAudit.delete(p.id);column="conciliadoDeclarado";hasActive=true;
   }else if(p.status==="AGUARDANDO_REPASSE"){
    if(p.conciliadoEm||audit)FAIL("PENDENCIA_ADULTERADA");
    column="pendente";hasActive=true;
   }else if(p.status==="ESTORNADA"){
    if(p.conciliadoEm||audit)FAIL("ESTORNO_COM_CONCILIACAO");
    column="estornado";hasCanceled=true;
   }else FAIL("STATUS_DESCONHECIDO");
   t[column]=safeSum(t[column],cents);
   t.original=safeSum(t.original,cents);
   installments.push(Object.freeze({id:p.id,indice:p.indice,
    status:p.status,valor:amount(cents),confirmacaoBancariaIndependente:false}));
  }
  if(hasCanceled&&hasActive)FAIL("ESTORNO_PARCIAL_INCONSISTENTE");
  const canceled=hasCanceled;
  if(canceled?line.pagamento.status!=="ESTORNADO"||
       line.operacao.status!=="ESTORNADA"||
       line.operacao.venda.status!=="ESTORNADA"||
       line.operacao.reserva.status!=="CANCELADA"||
       line.comandaStatus!=="CANCELADA":
       line.pagamento.status!=="PENDENTE"||
       line.operacao.status!=="CONCLUIDA"||
       line.operacao.venda.status!=="FINALIZADA"||
       line.operacao.reserva.status!=="RESERVADA"||
       line.comandaStatus!=="FECHADA")FAIL("ESTADO_ECONOMICO_INCONSISTENTE");
  if(t.original!==original||t.original!==t.pendente+t.conciliadoDeclarado+t.estornado)
   FAIL("SOMA_DIVERGENTE");
  for(const k of Object.keys(t))metrics[k]=safeSum(metrics[k],t[k]);
  rows.push(Object.freeze({linhaId:line.id,pagamentoId:line.pagamentoId,
   empresaId,quantidadeParcelas:line.parcelas,
   situacao:canceled?"ESTORNADO":t.pendente===0?"REPASSE_INTEGRAL_DECLARADO":
    t.conciliadoDeclarado>0?"REPASSE_PARCIAL_DECLARADO":"AGUARDANDO_REPASSE",
   totais:fmt(t),parcelas:Object.freeze(installments)}));
 }
 if(byAudit.size)FAIL("AUDITORIA_ORFA");
 return Object.freeze({fase:"M5_6_RESUMO_RECEBIVEIS_CI",organizacaoId,
  empresaId,comandaId,totais:fmt(metrics),linhas:Object.freeze(rows),
  leituraSomente:true,provaBancariaIndependente:false,
  statusPagamentoAlterado:false,autorizacaoFiscal:false,
  gerouPagamento:false,gerouMovimentoCaixa:false,
  executarConciliacao:false,autorizarProducao:false});
}
