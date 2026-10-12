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
 const notifications=useQuery({queryKey:["platform-notification-outbox"],queryFn:async()=>(await api.get("/plataforma/monitoramento/alertas/notificacoes")).data,refetchInterval:60000});
 const history=useQuery({queryKey:["platform-alert-history"],queryFn:async()=>(await api.get("/plataforma/monitoramento/alertas/historico")).data.dados,refetchInterval:60000});
 const acknowledge=useMutation({mutationFn:async key=>api.post("/plataforma/monitoramento/alertas/reconhecer",{key}),onSuccess:()=>qc.invalidateQueries({queryKey:["platform-alerts"]})});
 const all=q.data?.dados||[];
 const displayed=all.filter(x=>filter==="all"||(filter==="active"?!x.acknowledgement:!!x.acknowledgement));
 const date=x=>x?new Date(x).toLocaleString("pt-BR",{timeZone:"America/Bahia"}):"Aguardando evidência";
 return <div className="page-stack"><section className="panel">
  <div className="panel__heading"><div><span>Operações da plataforma</span><h2><BellRing size={21} style={{verticalAlign:"middle",marginRight:8}}/>Central de Alertas</h2></div>
    <button className="ghost-button" onClick={()=>{q.refetch();history.refetch();notifications.refetch();}} disabled={q.isFetching}><RefreshCw size={16}/>Atualizar</button></div>
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
 </section><section className="panel">
  <div className="panel__heading"><div><span>Histórico confirmado pelo coletor</span><h2>Incidentes recuperados</h2></div></div>
  <p>Somente incidentes com recuperação registrada. A lista não inclui histórico de alertas de backup nem períodos anteriores à ativação do coletor.</p>
  {history.isLoading&&<p>Consultando histórico...</p>}
  {history.isError&&<div className="alert alert--error">{getApiErrorMessage(history.error)}</div>}
  {history.data?.length===0&&<p>Nenhum incidente recuperado registrado até o momento.</p>}
  {history.data?.length>0&&<div className="monitoring-scroll"><table className="monitoring-table"><thead><tr><th>Serviço</th><th>Abertura</th><th>Recuperação</th><th>Falhas registradas</th><th>Reconhecido por</th></tr></thead><tbody>{history.data.map(x=><tr key={x.id}><td>{x.serviceKey==="admin"?"Console":"Portal"}</td><td>{date(x.openedAt)}</td><td>{date(x.recoveredAt)}</td><td>{x.failureCount}</td><td>{x.acknowledgedByName||"Não reconhecido"}</td></tr>)}</tbody></table></div>}
 </section><section className="panel">
  <div className="panel__heading"><div><span>Preparação de envio</span><h2>Notificações externas</h2></div></div>
  <p>Nenhum canal de envio externo está configurado. A fila registra apenas a intenção de envio para incidentes reais; não envia e-mail, WhatsApp ou push.</p>
  {notifications.isError&&<div className="alert alert--error">{getApiErrorMessage(notifications.error)}</div>}
  {notifications.isLoading&&<p>Consultando fila...</p>}
  {notifications.data?.dados?.length===0&&<p>Não há notificações preparadas.</p>}
  {notifications.data?.dados?.length>0&&<div className="monitoring-scroll"><table className="monitoring-table"><thead><tr><th>Evento</th><th>Data</th><th>Situação</th></tr></thead><tbody>{notifications.data.dados.map(n=><tr key={n.id}><td>{n.title}</td><td>{date(n.createdAt)}</td><td>{n.state==="AWAITING_CHANNEL"?"Aguardando configuração de canal":n.state}</td></tr>)}</tbody></table></div>}
 </section></div>;
}
