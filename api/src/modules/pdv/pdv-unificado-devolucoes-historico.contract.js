/**
 * PointVet M.5.23 — projection of manual external refund attestations.
 * Read-only audit and GROSS still not declared, not a bank-confirmed balance.
 * Data are authoritative DB snapshots prepared by the guarded GET service.
 */
import {createHash} from "node:crypto";
import {centavosM522,reaisM522} from "./pdv-unificado-devolucao-declarada.contract.js";
import {gerarReferenciaRevisaoManualM519} from "./pdv-unificado-revisao-financeira.contract.js";
const fail=x=>{throw Error("M523_"+x);};
const hex=/^[a-f0-9]{64}$/;
const ref=/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/;
const str=x=>typeof x==="string"&&x.length>0;
function dbMoney(v){
 const s=String(v);
 if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(s))fail("VALOR_DB_INVALIDO");
 const [n,d=""]=s.split(".");
 return n+"."+d.padEnd(2,"0");
}
export function projetarHistoricoDevolucoesM523({
 organizacaoId,empresaId,comandaId,preparacoes=[],devolucoes=[],
 entradas=[],correcoes=[],auditorias=[]
}={}){
 if(![organizacaoId,empresaId,comandaId].every(str)||
    !Array.isArray(preparacoes)||!Array.isArray(devolucoes)||
    !Array.isArray(entradas)||!Array.isArray(correcoes)||
    !Array.isArray(auditorias)||preparacoes.length>50||
    devolucoes.length>500||auditorias.length>500)
  fail("CONSULTA_INCOMPLETA");
 const byPrep=new Map(),byEntry=new Map(),corrected=new Set(),byAudit=new Map();
 for(const p of preparacoes){
  if(!p||p.organizacaoId!==organizacaoId||p.empresaId!==empresaId||
     p.comandaId!==comandaId||!str(p.id)||byPrep.has(p.id)||
     !hex.test(p.fingerprint||"")||
     p.status!=="PREPARADA_SEM_BAIXA")
   fail("PREPARACAO_INVALIDA");
  const bruto=centavosM522(dbMoney(p.bruto),true);
  const liquido=centavosM522(dbMoney(p.liquidoDeclarado),true);
  if(bruto<liquido)fail("COMPOSICAO_DIVERGENTE");
  byPrep.set(p.id,{...p,brutoCentavos:bruto,liquidoCentavos:liquido});
 }
 for(const e of entradas){
  if(!e||e.empresaId!==empresaId||
     e.origem!=="REPASSE_CARTAO_MANUAL_UNIFICADO"||
     e.direcao!=="ENTRADA"||!byPrep.has(e.origemId)||
     byEntry.has(e.origemId)||!str(e.id)||
     e.contaFinanceiraId!==byPrep.get(e.origemId).contaFinanceiraId||
     centavosM522(dbMoney(e.valor),true)!==byPrep.get(e.origemId).liquidoCentavos)
   fail("ENTRADA_DIVERGENTE");
  byEntry.set(e.origemId,e);
 }
 for(const correction of correcoes){
  if(!correction||correction.empresaId!==empresaId||
     correction.origem!=="ESTORNO_REPASSE_CARTAO_MANUAL_UNIFICADO"||
     correction.direcao!=="SAIDA"||
     ![...byEntry.values()].some(e=>e.id===correction.origemId))
   fail("CORRECAO_ORFA");
  if(corrected.has(correction.origemId))fail("CORRECAO_DUPLICADA");
  corrected.add(correction.origemId);
 }
 for(const a of auditorias){
  if(!a||a.organizacaoId!==organizacaoId||a.empresaId!==empresaId||
     a.acao!=="DEVOLUCAO_EXTERNA_DECLARADA_CI"||
     a.entidade!=="DEVOLUCAO_CLIENTE_MANUAL"||
     !str(a.entidadeId)||byAudit.has(a.entidadeId))
   fail("AUDITORIA_INVALIDA");
  byAudit.set(a.entidadeId,a);
 }
 const byRefund=new Set(),byRef=new Set();
 const grouped=new Map([...byPrep.keys()].map(k=>[k,[]]));
 for(const d of devolucoes){
  const p=byPrep.get(d.preparacaoId),entry=byEntry.get(d.preparacaoId);
  if(!p||!entry||corrected.has(entry.id)||!d||
     d.organizacaoId!==organizacaoId||d.empresaId!==empresaId||
     d.comandaId!==comandaId||d.conciliacaoOrigemId!==entry.id||
     !str(d.id)||byRefund.has(d.id)||!ref.test(d.referenciaExterna||"")||
     byRef.has(d.referenciaExterna)||!hex.test(d.fingerprint||"")||
     !hex.test(d.codigoRevisao||"")||
     d.confirmacaoHumanaExterna!==true||
     !str(d.usuarioId)||!str(d.motivo)||d.motivo.trim().length<12||
     d.motivo.trim().length>500)
   fail("DEVOLUCAO_DIVERGENTE");
  byRefund.add(d.id);byRef.add(d.referenciaExterna);
  const review=p.parecerDocumental;
  if(!review||review.preparacaoId!==p.id||
     review.organizacaoId!==organizacaoId||review.empresaId!==empresaId||
     review.status!=="CONFERENCIA_DOCUMENTAL_DECLARADA"||
     !hex.test(review.fingerprint||"")||entry.usuarioId===d.usuarioId)
   fail("PARECER_OU_OPERADOR_DIVERGENTE");
  const version=gerarReferenciaRevisaoManualM519({
   organizacaoId,empresaId,comandaId,preparacaoId:p.id,
   etapa:"REPASSE_INTERNO_CONFIRMADO_MANUALMENTE",
   fingerprintPreparacao:p.fingerprint,fingerprintParecer:review.fingerprint,
   contaFinanceiraId:p.contaFinanceiraId,
   valorLiquido:reaisM522(p.liquidoCentavos),lancamentoOriginalId:entry.id
  });
  if(version.codigoRevisao!==d.codigoRevisao)
   fail("VERSAO_DIVERGENTE");
  const amount=centavosM522(dbMoney(d.valorBruto),true);
  const before=centavosM522(d.snapshot?.saldoAntes),
   after=centavosM522(d.snapshot?.saldoDepois);
  if(d.snapshot?.status!=="DECLARACAO_HUMANA_NAO_VERIFICADA_PELO_BANCO"||
     d.snapshot?.naoHaComprovacaoAutomatica!==true||
     d.snapshot?.naoAlteraCaixaFinanceiroFiscal!==true||
     d.snapshot?.motivo!==d.motivo||before-after!==amount)
   fail("SNAPSHOT_INCONSISTENTE");
  const record={
   versao:"M522_V1",organizacaoId,empresaId,usuarioId:d.usuarioId,
   comandaId,preparacaoId:p.id,conciliacaoOrigemId:entry.id,
   referenciaExterna:d.referenciaExterna,motivo:d.motivo.trim(),
   valorBruto:reaisM522(amount),saldoRestanteBrutoEsperado:reaisM522(before),
   codigoRevisao:d.codigoRevisao
  };
  if(createHash("sha256").update(JSON.stringify(record)).digest("hex")!==d.fingerprint)
   fail("FINGERPRINT_DIVERGENTE");
  const audit=byAudit.get(d.id);
  if(!audit||audit.usuarioId!==d.usuarioId||
     audit.dadosNovos?.fingerprint!==d.fingerprint||
     audit.dadosNovos?.preparacaoId!==p.id||
     audit.dadosNovos?.conciliacaoOrigemId!==entry.id||
     audit.dadosNovos?.referenciaExterna!==d.referenciaExterna||
     audit.dadosNovos?.valorBruto!==reaisM522(amount)||
     audit.dadosNovos?.saldoRestante!==reaisM522(after)||
     audit.dadosNovos?.comprovacaoAutomaticaBanco!==false||
     audit.dadosNovos?.semMutacaoFinanceiraFiscal!==true)
   fail("AUDITORIA_DIVERGENTE");
  grouped.get(p.id).push({...d,amount,before,after});
 }
 if(byAudit.size!==devolucoes.length)
  fail("AUDITORIA_ORFA");
 let totalBruto=0,totalDeclarado=0,totalSemDeclaracao=0;
 const resultado=preparacoes.map(pOriginal=>{
  const p=byPrep.get(pOriginal.id),entry=byEntry.get(p.id);
  const group=grouped.get(p.id).sort((a,b)=>{
   const dateA=new Date(a.createdAt).getTime(),dateB=new Date(b.createdAt).getTime();
   return dateA-dateB||a.id.localeCompare(b.id);
  });
  let remaining=p.brutoCentavos,sum=0;
  const movimentos=group.map(row=>{
   if(!Number.isFinite(new Date(row.createdAt).getTime())||
      row.before!==remaining||row.after!==remaining-row.amount||
      row.after<0||row.amount>remaining)
    fail("SALDO_OU_ORDEM_DIVERGENTE");
   remaining=row.after;sum+=row.amount;
   return Object.freeze({
    id:row.id,referenciaExterna:row.referenciaExterna,
    valorBrutoDeclarado:reaisM522(row.amount),
    saldoBrutoNaoDeclaradoApos:reaisM522(remaining),
    usuarioId:row.usuarioId,
    motivo:row.motivo,registradoEm:new Date(row.createdAt).toISOString(),
    tipo:"DECLARACAO_DE_DEVOLUCAO_EXTERNA_NAO_VERIFICADA"
   });
  });
  totalBruto+=p.brutoCentavos;totalDeclarado+=sum;totalSemDeclaracao+=remaining;
  if(![totalBruto,totalDeclarado,totalSemDeclaracao].every(Number.isSafeInteger))
   fail("TOTAL_FORA_DO_LIMITE");
  const stage=!entry?"SEM_REPASSE_INTERNO":
   corrected.has(entry.id)?"REPASSE_INTERNO_COMPENSADO":"REPASSE_INTERNO_ATIVO";
  if(group.length&&stage!=="REPASSE_INTERNO_ATIVO")
   fail("DEVOLUCAO_SEM_REPASSE_ATIVO");
  return Object.freeze({
   preparacaoId:p.id,referenciaExtrato:p.referenciaExtrato,
   estadoRepasseInterno:stage,
   brutoOriginal:reaisM522(p.brutoCentavos),
   totalDevolucoesDeclaradas:reaisM522(sum),
   brutoSemDeclaracaoNoLivro:reaisM522(remaining),
   quantidadeDeclaracoes:group.length,
   movimentos:Object.freeze(movimentos),
   permiteNovoReembolso:false,permiteNovoRegistro:false
  });
 });
 return Object.freeze({
  fase:"M5_23_HISTORICO_DEVOLUCOES_EXTERNA_READ_ONLY",
  organizacaoId,empresaId,comandaId,
  preparacoes:Object.freeze(resultado),
  totais:Object.freeze({
   brutoPreparacoes:reaisM522(totalBruto),
   devolucoesDeclaradas:reaisM522(totalDeclarado),
   brutoSemDeclaracaoNoLivro:reaisM522(totalSemDeclaracao),
   quantidadeDeclaracoes:devolucoes.length
  }),
  historicoExternoComprovadoCompleto:false,
  bancoVerificadoIndependentemente:false,
  saldoBancarioDisponivel:false,
  permiteNovoReembolso:false,permiteNovoRegistro:false,
  geraMovimentoFinanceiro:false,geraEstornoFiscal:false,
  liberaCheckout:false,leituraSomente:true
 });
}
