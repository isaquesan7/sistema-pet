/**
 * PointVet M.5.17 — training-only form for a manually checked repasse.
 * No network mutation or storage. Nothing from this form is a real receipt,
 * payment, card settlement, bank connection or a cashier operation.
 */
import {useState} from "react";
const amountCents=s=>{
 if(typeof s!=="string"||!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(s))
  return null;
 const [major,minor=""]=s.split(".");
 const value=Number(major)*100+Number(minor.padEnd(2,"0"));
 return Number.isSafeInteger(value)?value:null;
};
function RepasseDraft({plan}){
 const correcting=plan.operacaoSimulavel==="SIMULAR_CORRECAO";
 const [reference,setReference]=useState(correcting?"":plan.referenciaExtrato);
 const [amount,setAmount]=useState("");
 const [reason,setReason]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [feedback,setFeedback]=useState(null);
 function change(fn){return value=>{fn(value);setFeedback(null);};}
 function simulate(){
  const expected=amountCents(plan.valorLiquido),actual=amountCents(amount);
  let error=null;
  if(!confirmed)error="Marque que consultou o comprovante ou extrato fora do PointVet.";
  else if(actual===null||expected!==actual||actual<=0)
   error="O valor líquido precisa coincidir exatamente com a pré-baixa (em reais, com ponto decimal).";
  else if(!/^[A-Za-z0-9][A-Za-z0-9_./:-]{7,119}$/.test(reference))
   error="Informe uma referência externa válida, com 8 a 120 caracteres.";
  else if(!correcting&&reference!==plan.referenciaExtrato)
   error="A referência deve ser idêntica à da pré-baixa original.";
  else if(correcting&&(reference===plan.referenciaExtrato||
    reason.trim().length<12||reason.trim().length>500))
   error="Para corrigir, informe uma nova referência e uma justificativa entre 12 e 500 caracteres.";
  setFeedback(error?{error}:{ok:true});
 }
 return <div className="panel" aria-label="Simulação local de conferência manual">
  <p><strong>{correcting?"Prévia de correção por contralançamento":"Prévia de confirmação de repasse"}</strong></p>
  <p>Bruto: <strong>{plan.valorBruto}</strong> · Tarifa: <strong>{plan.tarifaCartao}</strong> · Antecipação: <strong>{plan.descontoAntecipacao}</strong> · Líquido esperado: <strong>{plan.valorLiquido}</strong> (R$)</p>
  <p><strong>Somente treinamento:</strong> nenhum dado digitado será enviado ao servidor, salvo, lançado na contabilidade ou transmitido ao banco.</p>
  {correcting?<p>A correção real exige outro funcionário autorizado, análise do lançamento original e contralançamento auditado. Esta tela não faz isso.</p>:null}
  <div className="finance-filterbar">
   <label>Referência do extrato ou da correção
    <input className="form-control" type="text" maxLength={120}
     value={reference} onChange={e=>change(setReference)(e.target.value)}/>
   </label>
   <label>Valor líquido conferido (R$)
    <input className="form-control" type="text" inputMode="decimal"
     placeholder="58.80" value={amount} onChange={e=>change(setAmount)(e.target.value)}/>
   </label>
  </div>
  {correcting?<label>Justificativa da correção (mínimo 12 caracteres)
   <textarea className="form-control" rows={3} value={reason}
    maxLength={500} onChange={e=>change(setReason)(e.target.value)}/>
  </label>:null}
  <label><input type="checkbox" checked={confirmed}
   onChange={e=>change(setConfirmed)(e.target.checked)}/>
   Declaro, somente para esta simulação, que consultei os dados externamente.
  </label>
  <div><button type="button" className="secondary-button"
   onClick={simulate}>Validar campos da simulação (não salva)</button></div>
  {feedback?.error?<p className="alert alert--error" role="alert">{feedback.error}</p>:null}
  {feedback?.ok?<p role="status">Os campos conferem localmente. **Nenhuma operação foi executada.** A autorização do segundo funcionário e a validação transacional continuam pendentes.</p>:null}
 </div>;
}
export default function UnifiedCardManualDryRun({planos=[],empresaId,comandaId}){
 const [selectedId,setSelectedId]=useState("");
 const available=planos.filter(p=>p.operacaoSimulavel);
 const current=available.find(p=>p.preparacaoId===selectedId)||available[0];
 return <section aria-label="Simulação local de repasse">
  <h3>Simulador de confirmação ou correção manual — sem salvar</h3>
  <p>Exercício de preenchimento antes da homologação operacional. Não gera comprovante, baixa, Pix, caixa nem saldo bancário.</p>
  {!available.length?<p>Não há repasses elegíveis para simulação. Conclua as etapas documentais necessárias fora deste simulador.</p>:<>
   <label>Selecione o repasse para simular
    <select className="form-control" value={current?.preparacaoId||""}
     onChange={e=>setSelectedId(e.target.value)}>
     {available.map(p=><option key={p.preparacaoId} value={p.preparacaoId}>
      {p.referenciaExtrato} · {p.operacaoSimulavel==="SIMULAR_CORRECAO"?"Simular correção":"Simular confirmação"}
     </option>)}
    </select>
   </label>
   <RepasseDraft key={[empresaId,comandaId,current?.preparacaoId,current?.etapa,
     current?.valorLiquido,current?.referenciaExtrato].join(":")} plan={current}/>
  </>}
 </section>;
}
