/**
 * PointVet M.5.21 — browser-only post-repasse customer-refund risk exercise.
 * Never issues POST/PATCH/DELETE, never sends entered amounts to PointVet/banks.
 * Scenario recoveries are NOT confirmed refunds of tariffs by an acquirer.
 */
import {useState} from "react";
const AMOUNT=/^(?:0|[1-9]\d{0,10})\.\d{2}$/;
const cents=x=>{
 if(typeof x!=="string"||!AMOUNT.test(x))return null;
 const [a,b]=x.split(".");
 const n=Number(a)*100+Number(b);
 return Number.isSafeInteger(n)?n:null;
};
const fmt=n=>(Math.trunc(n/100)+"."+String(n%100).padStart(2,"0"));
function RefundExercise({row}){
 const [refund,setRefund]=useState("");
 const [fee,setFee]=useState("0.00");
 const [early,setEarly]=useState("0.00");
 const [agreed,setAgreed]=useState(false);
 const [result,setResult]=useState(null);
 function update(fn){return value=>{fn(value);setResult(null);};}
 function check(){
  const value=cents(refund),reFee=cents(fee),reEarly=cents(early);
  const remaining=cents(row.brutoSemDeclaracaoNoLivro);
  const original=cents(row.valorBruto),maxFee=cents(row.tarifaInformada),
   maxEarly=cents(row.descontoAntecipacaoInformado);
  if(!agreed)return setResult({error:"Confirme que os valores de recuperação são hipóteses, não valores recebidos."});
  if(remaining===null||value===null||value<=0||value>original||value>remaining||reFee===null||reEarly===null||
     reFee>maxFee||reEarly>maxEarly||reFee+reEarly>value)
   return setResult({error:"Confira os valores com duas casas decimais. A devolução hipotética não pode superar o bruto ainda sem declaração no livro; as recuperações também não podem superar tarifas ou a devolução."});
  setResult({value:fmt(value),fee:fmt(reFee),early:fmt(reEarly),
   exposure:fmt(value-reFee-reEarly),partial:value<original});
 }
 return <div className="panel">
  <p><strong>Simulação para referência externa: {row.referenciaExtrato}</strong></p>
  <p>Bruto original: <strong>{row.valorBruto}</strong> · Tarifa informada: <strong>{row.tarifaInformada}</strong> · Antecipação informada: <strong>{row.descontoAntecipacaoInformado}</strong> · Líquido lançado internamente: <strong>{row.valorLiquido}</strong> (valores em R$)</p>
  <p><strong>Bruto sem declaração no livro: R$ {row.brutoSemDeclaracaoNoLivro}.</strong> Este valor não comprova saldo disponível, devoluções externas anteriores nem autoriza novo reembolso.</p>
  <p>Versão financeira interna: <code title={row.codigoRevisao}>{row.codigoRevisao?.slice(0,16)}</code>. Se houver devolução anterior, outra taxa, alteração do repasse ou revisão, estes números <strong>não</strong> são suficientes para autorizar a operação.</p>
  <div className="finance-filterbar">
   <label>Devolução bruta hipotética ao cliente (R$)
    <input type="text" inputMode="decimal" className="form-control" placeholder="120.00"
     value={refund} onChange={e=>update(setRefund)(e.target.value)}/>
   </label>
   <label>Recuperação hipotética da tarifa (R$)
    <input type="text" inputMode="decimal" className="form-control"
     value={fee} onChange={e=>update(setFee)(e.target.value)}/>
   </label>
   <label>Recuperação hipotética do custo de antecipação (R$)
    <input type="text" inputMode="decimal" className="form-control"
     value={early} onChange={e=>update(setEarly)(e.target.value)}/>
   </label>
  </div>
  <label><input type="checkbox" checked={agreed}
   onChange={e=>update(setAgreed)(e.target.checked)}/>
   Entendo que as recuperações de tarifas são meras hipóteses e ainda não foram comprovadas.
  </label>
  <div><button type="button" className="secondary-button"
   onClick={check}>Simular impacto (não devolve nem salva)</button></div>
  {result?.error?<p className="alert alert--error" role="alert">{result.error}</p>:null}
  {result&&!result.error?<div role="status">
   <p><strong>Devolução {result.partial?"parcial":"integral"} hipotética: R$ {result.value}</strong></p>
   <p>Recuperação hipotética da tarifa: R$ {result.fee}; antecipação: R$ {result.early}. Exposição estimada caso ambas ocorram: <strong>R$ {result.exposure}</strong>.</p>
   <p>Sem recuperação, o desembolso proposto seria R$ {result.value}. Isto não confirma saldo, devolução, crédito bancário, despesa, estorno fiscal ou ausência de devoluções anteriores.</p>
  </div>:null}
 </div>;
}
export default function UnifiedCardRefundDryRun({plano,empresaId,comandaId,historico}){
 const [selectedId,setSelectedId]=useState("");
 const eligible=(plano?.preparacoes||[]).flatMap(x=>{
  const match=historico?.preparacoes?.find(p=>p.preparacaoId===x.preparacaoId);
  if(!x.podeSimularDevolucao||!match||
     match.estadoRepasseInterno!=="REPASSE_INTERNO_ATIVO"||
     cents(match.brutoOriginal)!==cents(x.valorBruto)||
     (cents(match.brutoSemDeclaracaoNoLivro)||0)<=0)return [];
  return [{...x,brutoSemDeclaracaoNoLivro:match.brutoSemDeclaracaoNoLivro}];
 });
 const current=eligible.find(x=>x.preparacaoId===selectedId)||eligible[0];
 if(!historico?.leituraSomente||historico?.permiteNovoReembolso!==false||
    historico.empresaId!==empresaId||historico.comandaId!==comandaId)
  return <p className="alert alert--error">Histórico de devoluções ainda não validado. Simulação indisponível.</p>;
 if(!plano?.leituraSomente||plano?.permiteEstornoAutomatico!==false)
  return <p className="alert alert--error">Prévia de devolução indisponível.</p>;
 return <section aria-label="Simulação de devolução pós-repasse">
  <h3>Simulador de devolução após repasse — sem salvar</h3>
  <p><strong>Devolução ao cliente e correção de lançamento interno são operações distintas.</strong> O PointVet não executa reembolso bancário. As condições de tarifa, antecipação, estorno fiscal e devoluções anteriores precisam ser conferidas externamente.</p>
  {!eligible.length?<p>Não há repasse interno ativo com bruto sem declaração validado para esta simulação.</p>:<>
   <label>Repasse ativo usado no cenário
    <select className="form-control" value={current?.preparacaoId||""}
     onChange={e=>setSelectedId(e.target.value)}>
     {eligible.map(x=><option key={x.preparacaoId} value={x.preparacaoId}>
      {x.referenciaExtrato} · bruto R$ {x.valorBruto}
     </option>)}
    </select>
   </label>
   <RefundExercise key={[empresaId,comandaId,current.preparacaoId,
    current.codigoRevisao].join(":")} row={current}/>
  </>}
 </section>;
}
