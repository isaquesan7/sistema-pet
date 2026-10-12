/**
 * Platform administration audit records (not tenant audit).
 * Read-only, access controlled by platform superadmin API.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
const labels={PLAN_CREATED:"Plano criado",PLAN_UPDATED:"Plano alterado",SUBSCRIPTION_UPDATED:"Assinatura alterada",INVOICE_CREATED:"Fatura criada",INVOICE_PAID:"Fatura liquidada",INVOICE_CANCELLED:"Fatura cancelada"};
export default function PlatformAuditPage(){
 const [action,setAction]=useState("");
 const q=useQuery({queryKey:["platform-audit",action],queryFn:async()=>(await api.get("/saas/plataforma/auditoria",{params:{action,limit:100}})).data.dados,refetchInterval:60000});
 return <div className="page-stack"><section className="panel">
   <div className="panel__heading"><div><span>Rastreabilidade administrativa</span><h2>Central de Auditoria</h2></div>
     <button type="button" className="ghost-button" onClick={()=>q.refetch()} disabled={q.isFetching}><RefreshCw size={16}/>Atualizar</button></div>
   <p>Registros de alterações comerciais realizadas no Console Interno a partir da ativação desta função. Dados sensíveis e conteúdo das solicitações não são armazenados.</p>
   <div className="monitoring-filters"><label>Ação <select value={action} onChange={e=>setAction(e.target.value)}><option value="">Todas as ações</option>{Object.entries(labels).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label></div>
   {q.isLoading && <p>Consultando auditoria...</p>}
   {q.isError && <div className="alert alert--error">{getApiErrorMessage(q.error)}</div>}
   {q.data?.length===0 && <p>Nenhuma ação registrada para o filtro selecionado.</p>}
   {q.data?.length>0 && <div className="monitoring-scroll"><table className="monitoring-table"><thead><tr><th>Data (Salvador)</th><th>Ação</th><th>Responsável</th><th>Recurso</th><th>Resultado</th></tr></thead><tbody>{q.data.map(x=><tr key={x.id}>
     <td>{new Date(x.createdAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</td>
     <td>{labels[x.action]||x.action}</td><td>{x.actorName||x.actorId}</td>
     <td>{x.resourceType}{x.resourceId?" · "+x.resourceId:""}</td>
     <td>{x.result==="SUCCESS"?"Concluído":"Falhou"} (HTTP {x.httpStatus})</td>
   </tr>)}</tbody></table></div>}
   <p style={{opacity:.75}}><ShieldCheck size={15} style={{verticalAlign:"middle",marginRight:6}}/>A auditoria registra somente ações instrumentadas. Não constitui histórico retroativo nem trilha transacional imutável.</p>
 </section></div>;
}
