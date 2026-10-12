/**
 * PointVet platform alerts. Read-only evidence; acknowledgement never resolves an incident.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Check, RefreshCw } from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
export default function PlatformAlertsPage(){
 const [filter,setFilter]=useState("active");
 const qc=useQueryClient();
 const q=useQuery({queryKey:["platform-alerts"],queryFn:async()=>(await api.get("/plataforma/monitoramento/alertas")).data,refetchInterval:60000});
 const acknowledge=useMutation({mutationFn:async key=>api.post("/plataforma/monitoramento/alertas/reconhecer",{key}),onSuccess:()=>qc.invalidateQueries({queryKey:["platform-alerts"]})});
 const all=q.data?.dados||[];
 const displayed=all.filter(x=>filter==="all"||(filter==="active"?!x.acknowledgement:!!x.acknowledgement));
 const date=x=>x?new Date(x).toLocaleString("pt-BR",{timeZone:"America/Bahia"}):"Aguardando evidência";
 return <div className="page-stack"><section className="panel">
  <div className="panel__heading"><div><span>Operações da plataforma</span><h2><BellRing size={21} style={{verticalAlign:"middle",marginRight:8}}/>Central de Alertas</h2></div>
    <button className="ghost-button" onClick={()=>q.refetch()} disabled={q.isFetching}><RefreshCw size={16}/>Atualizar</button></div>
  <p>Alertas gerados apenas por incidentes registrados e evidências recebidas do worker. Reconhecer não resolve o problema. Ainda não há envio de notificações por e-mail, WhatsApp ou push.</p>
  <div className="monitoring-filters"><label>Exibir <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Não reconhecidos</option><option value="acknowledged">Reconhecidos</option><option value="all">Todos os alertas atuais</option></select></label></div>
  {q.isLoading&&<p>Buscando alertas...</p>}
  {q.isError&&<div className="alert alert--error">{getApiErrorMessage(q.error)}</div>}
  {acknowledge.isError&&<div className="alert alert--error">{getApiErrorMessage(acknowledge.error)}</div>}
  {!q.isLoading&&!q.isError&&displayed.length===0&&<p>Nenhum alerta para o filtro selecionado.</p>}
  {displayed.map(a=><article key={a.key} className="platform-metric" style={{marginBottom:12,alignItems:"flex-start"}}>
   <span><AlertTriangle size={20} color={a.severity==="critical"?"#dc2626":"#a16207"}/></span><div style={{flex:1,minWidth:0}}>
    <small>{a.category==="BACKUP"?"Backup":"Infraestrutura"} · {a.severity==="critical"?"Crítico":"Informativo"}</small>
    <strong style={{fontSize:17}}>{a.title}</strong><p>{a.detail}</p>
    <small>{date(a.detectedAt)}{a.acknowledgement?" · Reconhecido em "+date(a.acknowledgement.acknowledgedAt):""}</small>
    {!a.acknowledgement&&<button type="button" className="ghost-button" disabled={acknowledge.isPending} onClick={()=>acknowledge.mutate(a.key)}><Check size={16}/>Reconhecer</button>}
   </div></article>)}
 </section></div>;
}
