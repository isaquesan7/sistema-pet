/** PointVet support: shared presentation, server enforces tenant scope. */
import {useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import api,{getApiErrorMessage} from "../lib/api.js";
export default function SupportPage({platform=false}){
 const base=platform?"/saas/plataforma/suporte":"/saas/suporte";
 const qc=useQueryClient();
 const [selected,setSelected]=useState(null),[subject,setSubject]=useState(""),[category,setCategory]=useState("GERAL"),[message,setMessage]=useState(""),[reply,setReply]=useState(""),[status,setStatus]=useState(""),[error,setError]=useState("");
 const list=useQuery({queryKey:["support",base],queryFn:async()=>(await api.get(base)).data.dados,refetchInterval:60000});
 const thread=useQuery({queryKey:["support",base,selected],enabled:!!selected,queryFn:async()=>(await api.get(base+"/"+selected)).data.dados});
 const refresh=()=>{qc.invalidateQueries({queryKey:["support",base]});};
 const open=useMutation({mutationFn:async()=>api.post(base,{subject,category,body:message}),onSuccess:r=>{setSubject("");setMessage("");setSelected(r.data.id);setError("");refresh();},onError:e=>setError(getApiErrorMessage(e))});
 const respond=useMutation({mutationFn:async()=>api.post(base+"/"+selected+"/respostas",{body:reply}),onSuccess:()=>{setReply("");setError("");refresh();},onError:e=>setError(getApiErrorMessage(e))});
 const change=useMutation({mutationFn:async s=>api.patch(base+"/"+selected+"/status",{status:s}),onSuccess:()=>{setError("");refresh();},onError:e=>setError(getApiErrorMessage(e))});
 return <div className="page-stack"><section className="panel">
  <div className="panel__heading"><div><span>{platform?"Administração da plataforma":"Atendimento da plataforma"}</span><h2>Central de Suporte</h2></div><button className="ghost-button" type="button" onClick={()=>{list.refetch();thread.refetch();}}>Atualizar</button></div>
  <p>{platform?"Chamados das organizações. Responda ou atualize o estado de cada solicitação.":"Abra um chamado e acompanhe a resposta do PointVet. Somente gestores da sua organização podem acessar esta área."}</p>
  {error&&<div className="alert alert--error">{error}</div>}
  {!platform&&<form className="form-grid" onSubmit={e=>{e.preventDefault();open.mutate();}}>
   <label className="field"><span>Assunto</span><input required minLength={4} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
   <label className="field"><span>Categoria</span><select value={category} onChange={e=>setCategory(e.target.value)}>{[["GERAL","Geral"],["ACESSO","Acesso"],["FINANCEIRO","Financeiro"],["ERRO","Problema técnico"],["SUGESTAO","Sugestão"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label className="field"><span>Descrição</span><textarea required maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
   <button className="primary-button" disabled={open.isPending||subject.trim().length<4||!message.trim()} type="submit">Abrir chamado</button>
  </form>}
  {list.isError&&<div className="alert alert--error">{getApiErrorMessage(list.error)}</div>}
  {list.isLoading&&<p>Carregando chamados...</p>}
  <div className="table-scroll"><table className="data-table"><thead><tr><th>Assunto</th>{platform&&<th>Organização</th>}<th>Status</th><th>Atualizado</th><th>Ação</th></tr></thead><tbody>{list.data?.map(t=><tr key={t.id}><td>{t.subject}</td>{platform&&<td>{t.organizationName}</td>}<td>{t.status.replaceAll("_"," ")}</td><td>{new Date(t.updatedAt).toLocaleString("pt-BR")}</td><td><button type="button" className="mini-button" onClick={()=>{setSelected(t.id);setStatus(t.status);}}>Visualizar</button></td></tr>)}{list.data?.length===0&&<tr><td colSpan={platform?5:4}>Nenhum chamado.</td></tr>}</tbody></table></div>
 </section>{selected&&<section className="panel"><div className="panel__heading"><div><span>Conversa do chamado</span><h2>{thread.data?.subject||"Carregando..."}</h2></div><button className="ghost-button" onClick={()=>setSelected(null)}>Fechar</button></div>
 {thread.isError&&<div className="alert alert--error">{getApiErrorMessage(thread.error)}</div>}
 {thread.data?.messages.map(m=><article className="platform-metric" key={m.id} style={{marginBottom:8}}><div><strong>{m.authorName}{m.isStaff?" · Equipe PointVet":""}</strong><small>{new Date(m.createdAt).toLocaleString("pt-BR")}</small><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{m.body}</p></div></article>)}
 {platform&&<div className="row-actions"><label className="field"><span>Status</span><select value={status||thread.data?.status||"ABERTO"} onChange={e=>setStatus(e.target.value)}>{["ABERTO","EM_ANALISE","AGUARDANDO_CLIENTE","RESOLVIDO"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label><button className="ghost-button" onClick={()=>change.mutate(status||thread.data?.status||"ABERTO")} disabled={change.isPending}>Salvar status</button></div>}
 <form className="form-grid" onSubmit={e=>{e.preventDefault();respond.mutate();}}><label className="field"><span>Nova resposta</span><textarea required maxLength={4000} value={reply} onChange={e=>setReply(e.target.value)}/></label><button type="submit" className="primary-button" disabled={!reply.trim()||respond.isPending}>Enviar resposta</button></form>
 </section>}</div>;
}
