/** PointVet 18.2 — real SaaS finance overview, no payment mutation. */
import {useQuery} from "@tanstack/react-query";
import {Activity,CheckCircle2,Clock3,Wallet,TrendingUp,AlertTriangle} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
const money=n=>formatCurrency(n||0);
export default function PlatformFinancialPage(){
 const q=useQuery({queryKey:["platform-financial-indicators"],queryFn:async()=>(await api.get("/saas/plataforma/indicadores-financeiros")).data.dados,refetchInterval:120000});
 const d=q.data;
 const metrics=d?[["MRR contratado",d.mrrContratado,TrendingUp],["ARR contratado",d.arrContratado,Activity],["Faturas pagas (histórico)",d.recebidoHistorico,CheckCircle2],["Faturas pendentes",d.pendente,Clock3],["Faturas vencidas",d.vencido,AlertTriangle]]:[];
 return <div className="page-stack">
  <section className="panel"><div className="panel__heading"><div><span>Financeiro da plataforma</span><h2>Indicadores SaaS</h2></div><button className="ghost-button" onClick={()=>q.refetch()} disabled={q.isFetching}>Atualizar</button></div>
   <p>Indicadores contratuais e faturas registradas. Valores recebidos não equivalem à conciliação bancária; MRR e ARR não significam dinheiro recebido.</p>
   {q.isLoading&&<p>Calculando indicadores...</p>}
   {q.isError&&<div className="alert alert--error">{getApiErrorMessage(q.error)}</div>}
   {d&&<><section className="platform-metrics">{metrics.map(([name,value,Icon])=><article className="platform-metric" key={name}><span><Icon size={20}/></span><div><small>{name}</small><strong>{money(value)}</strong></div></article>)}</section><p>{d.nota}</p></>}
  </section>
  {d&&<section className="panel"><div className="panel__heading"><div><span>Assinaturas cadastradas</span><h2>Situação contratual</h2></div></div>
   <div className="platform-status-grid">{Object.entries(d.assinaturas).map(([name,count])=><article key={name} className="platform-metric"><span><Wallet size={18}/></span><div><small>{name}</small><strong>{count}</strong></div></article>)}</div>
  </section>}
  {d&&<section className="panel"><div className="panel__heading"><div><span>Faturas pagas por data de pagamento</span><h2>Recebimentos registrados por mês</h2></div></div>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Mês</th><th>Valor das faturas pagas</th></tr></thead><tbody>{d.recebimentosMensais.length?d.recebimentosMensais.map(r=><tr key={r.month}><td>{r.month}</td><td>{money(r.value)}</td></tr>):<tr><td colSpan="2">Nenhum pagamento de fatura registrado.</td></tr>}</tbody></table></div>
  </section>}
 </div>;
}
