/** Guided setup: progress is derived from persisted tenant data, no fake checkmarks. */
import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {CheckCircle2,Circle,RefreshCw} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {useAuth} from "../context/AuthContext.jsx";
export default function ActivationPage(){
 const {selectedCompany}=useAuth();
 const q=useQuery({queryKey:["activation",selectedCompany?.id],enabled:!!selectedCompany?.id,queryFn:async()=>(await api.get("/saas/ativacao")).data.dados,staleTime:30000});
 const d=q.data;
 return <div className="page-stack"><section className="panel">
  <div className="panel__heading"><div><span>Primeiros passos · PointVet</span><h1>Prepare sua operação</h1></div><button className="ghost-button" onClick={()=>q.refetch()} disabled={q.isFetching}><RefreshCw size={16}/>Atualizar</button></div>
  <p>Este guia utiliza os cadastros reais da sua organização e da unidade selecionada. Nenhum item é marcado como concluído apenas por acessar a página.</p>
  {q.isLoading&&<p>Verificando configuração...</p>}
  {q.isError&&<div className="alert alert--error">{getApiErrorMessage(q.error)}</div>}
  {d&&<><h2>{d.completed} de {d.total} etapas concluídas</h2><progress max={d.total} value={d.completed} style={{width:"100%"}} aria-label="Progresso da configuração"/>
   <div className="page-stack">{d.steps.map(s=><article className="platform-metric" key={s.id}><span>{s.done?<CheckCircle2 size={20}/>:<Circle size={20}/>}</span><div><strong>{s.label}</strong><small>{s.done?"Concluído":"Pendente"}</small></div><Link className="ghost-button" to={s.href}>Abrir módulo</Link></article>)}</div>
   <p><strong>Módulos habilitados:</strong> {d.modules.length?d.modules.map(x=>x.replaceAll("_"," ")).join(", "):"Nenhum módulo habilitado"}.</p>
   {d.completed===d.total&&<p>As etapas iniciais estão concluídas. Você já pode continuar utilizando os módulos contratados.</p>}
  </>}
 </section></div>;
}
