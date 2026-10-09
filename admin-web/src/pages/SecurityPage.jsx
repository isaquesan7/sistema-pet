import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, FileLock2, RefreshCw, Search, ShieldCheck, Upload, UserX } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import InlineNotice from "../components/InlineNotice.jsx";
import FormField from "../components/FormField.jsx";

function dateTime(value) { return value ? new Date(value).toLocaleString("pt-BR") : "—"; }
function bytes(value) { const n=Number(value||0); if (!n) return "—"; if(n<1024) return `${n} B`; if(n<1048576) return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; }
function toBase64(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||"").split(",").pop()||""); r.onerror=reject; r.readAsDataURL(file); }); }

export default function SecurityPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("auditoria");
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [policy, setPolicy] = useState({ lgpdContatoEmail:"", retencaoAuditoriaDias:3650, retencaoArquivosExcluidosDias:30 });

  const canAudit = hasPermission("seguranca.auditoria");
  const canLgpd = hasPermission("lgpd.gerenciar");
  const canFiles = hasPermission("arquivos.gerenciar");
  const canManageOrg = hasPermission("organizacao.gerenciar");

  const org = useQuery({ queryKey:["security-org"], queryFn:async()=>(await api.get("/organizacao/atual")).data.organizacao });
  useEffect(()=>{ const c=org.data?.configuracao; if(c) setPolicy({ lgpdContatoEmail:c.lgpdContatoEmail||"", retencaoAuditoriaDias:c.retencaoAuditoriaDias||3650, retencaoArquivosExcluidosDias:c.retencaoArquivosExcluidosDias||30 }); },[org.data]);

  const audit = useQuery({ queryKey:["security-audit",search], enabled:canAudit && tab==="auditoria", queryFn:async()=>(await api.get("/seguranca/auditoria",{params:{busca:search||undefined,limite:150}})).data.dados||[] });
  const requests = useQuery({ queryKey:["security-lgpd"], enabled:canLgpd && tab==="lgpd", queryFn:async()=>(await api.get("/seguranca/lgpd/solicitacoes")).data.dados||[] });
  const files = useQuery({ queryKey:["security-files"], enabled:canFiles && tab==="arquivos", queryFn:async()=>(await api.get("/seguranca/arquivos",{params:{limite:150}})).data.dados||[] });
  const clients = useQuery({ queryKey:["security-client-search",clientSearch], enabled:canLgpd && tab==="lgpd", queryFn:async()=>(await api.get("/clientes",{params:{busca:clientSearch||undefined,limite:30}})).data.dados||[] });

  const chosen = useMemo(()=>clients.data?.find((c)=>c.id===selectedClient),[clients.data,selectedClient]);
  const policyMutation = useMutation({ mutationFn:async()=>api.patch("/organizacao/configuracao",policy), onSuccess:()=>{ setError(""); setFeedback("Política de privacidade e retenção atualizada."); qc.invalidateQueries({queryKey:["security-org"]}); }, onError:(e)=>setError(getApiErrorMessage(e)) });
  const exportMutation = useMutation({ mutationFn:async()=> (await api.post(`/seguranca/lgpd/clientes/${selectedClient}/exportar`,{})).data, onSuccess:(data)=>{ setError(""); setFeedback("Exportação LGPD gerada. O download será iniciado."); if(data.url) window.open(data.url,"_blank","noopener,noreferrer"); qc.invalidateQueries({queryKey:["security-lgpd"]}); qc.invalidateQueries({queryKey:["security-files"]}); }, onError:(e)=>setError(getApiErrorMessage(e)) });
  const anonymizeMutation = useMutation({ mutationFn:async()=> (await api.post(`/seguranca/lgpd/clientes/${selectedClient}/anonimizar`,{confirmacao:"ANONIMIZAR"})).data, onSuccess:()=>{ setError(""); setFeedback("Cliente anonimizado e sessões do portal revogadas."); setSelectedClient(""); qc.invalidateQueries({queryKey:["security-lgpd"]}); qc.invalidateQueries({queryKey:["security-client-search"]}); }, onError:(e)=>setError(getApiErrorMessage(e)) });
  const uploadMutation = useMutation({ mutationFn:async()=>{ if(!uploadFile) throw new Error("Selecione um arquivo."); const base64=await toBase64(uploadFile); return api.post("/seguranca/arquivos/upload",{tipo:"OUTRO",nomeOriginal:uploadFile.name,mimeType:uploadFile.type||"application/octet-stream",base64}); }, onSuccess:()=>{ setError(""); setFeedback("Arquivo enviado ao armazenamento privado."); setUploadFile(null); qc.invalidateQueries({queryKey:["security-files"]}); }, onError:(e)=>setError(getApiErrorMessage(e)) });

  async function openFile(id){ try { const {data}=await api.get(`/seguranca/arquivos/${id}/url`); window.open(data.url,"_blank","noopener,noreferrer"); } catch(e){ setError(getApiErrorMessage(e)); } }

  return <div className="page-stack">
    <section className="page-heading"><div><span className="page-kicker">Fase 16</span><h1>Segurança, LGPD e Arquivos</h1><p>Auditoria, governança de dados pessoais e armazenamento privado da organização.</p></div><div className="company-badge"><ShieldCheck size={18}/><div><strong>Proteção operacional</strong><span>Tenant isolado e ações rastreáveis</span></div></div></section>
    <InlineNotice tone="error">{error}</InlineNotice><InlineNotice tone="success">{feedback}</InlineNotice>

    {canManageOrg && <section className="panel"><div className="panel__heading"><div><span>Governança</span><h2>Política de privacidade e retenção</h2><p>Parâmetros organizacionais para atendimento de titulares e retenção controlada.</p></div></div><div className="security-policy-grid"><FormField label="E-mail de contato LGPD"><input className="form-control" type="email" value={policy.lgpdContatoEmail} onChange={(e)=>setPolicy({...policy,lgpdContatoEmail:e.target.value})}/></FormField><FormField label="Auditoria (dias)"><input className="form-control" type="number" min="365" max="3650" value={policy.retencaoAuditoriaDias} onChange={(e)=>setPolicy({...policy,retencaoAuditoriaDias:e.target.value})}/></FormField><FormField label="Arquivos excluídos (dias)"><input className="form-control" type="number" min="1" max="365" value={policy.retencaoArquivosExcluidosDias} onChange={(e)=>setPolicy({...policy,retencaoArquivosExcluidosDias:e.target.value})}/></FormField><button className="primary-button" disabled={policyMutation.isPending} onClick={()=>policyMutation.mutate()}>{policyMutation.isPending?"Salvando...":"Salvar política"}</button></div></section>}

    <div className="settings-tabs">
      {canAudit && <button className={`settings-tab ${tab==="auditoria"?"settings-tab--active":""}`} onClick={()=>setTab("auditoria")}><ShieldCheck size={16}/> Auditoria</button>}
      {canLgpd && <button className={`settings-tab ${tab==="lgpd"?"settings-tab--active":""}`} onClick={()=>setTab("lgpd")}><UserX size={16}/> LGPD</button>}
      {canFiles && <button className={`settings-tab ${tab==="arquivos"?"settings-tab--active":""}`} onClick={()=>setTab("arquivos")}><FileLock2 size={16}/> Arquivos privados</button>}
    </div>

    {tab==="auditoria" && canAudit && <section className="panel"><div className="panel__heading"><div><span>Trilha de eventos</span><h2>Auditoria recente</h2></div><label className="search-input"><Search size={15}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Ação, entidade ou usuário"/></label></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>Ação</th><th>Entidade</th><th>Usuário</th><th>Empresa</th><th>IP</th></tr></thead><tbody>{(audit.data||[]).map((x)=><tr key={x.id}><td>{dateTime(x.createdAt)}</td><td><strong>{x.acao}</strong></td><td>{x.entidade}{x.entidadeId?` · ${x.entidadeId}`:""}</td><td>{x.usuario?.nome||"Sistema"}</td><td>{x.empresa?.nomeFantasia||"Organização"}</td><td>{x.ip||"—"}</td></tr>)}</tbody></table></div></section>}

    {tab==="lgpd" && canLgpd && <div className="page-stack"><section className="panel"><div className="panel__heading"><div><span>Titulares</span><h2>Exportação e anonimização</h2><p>A anonimização preserva históricos clínicos, financeiros e fiscais necessários, removendo dados pessoais identificáveis.</p></div></div><div className="form-stack"><label className="search-input"><Search size={15}/><input value={clientSearch} onChange={(e)=>setClientSearch(e.target.value)} placeholder="Buscar tutor por nome, telefone ou CPF"/></label><select className="form-control" value={selectedClient} onChange={(e)=>setSelectedClient(e.target.value)}><option value="">Selecione um cliente</option>{(clients.data||[]).map((c)=><option key={c.id} value={c.id}>{c.nome} {c.cpfCnpj?`· ${c.cpfCnpj}`:""}</option>)}</select>{chosen && <div className="security-actions"><button className="secondary-button" disabled={exportMutation.isPending} onClick={()=>exportMutation.mutate()}><Download size={15}/>{exportMutation.isPending?"Gerando...":"Exportar dados"}</button><button className="text-button security-danger" disabled={anonymizeMutation.isPending} onClick={()=>{ if(window.confirm(`Anonimizar permanentemente os dados pessoais de ${chosen.nome}? O histórico obrigatório será preservado.`)) anonymizeMutation.mutate(); }}><UserX size={15}/>{anonymizeMutation.isPending?"Anonimizando...":"Anonimizar titular"}</button></div>}</div></section>
      <section className="panel"><div className="panel__heading"><div><span>Rastreabilidade</span><h2>Solicitações LGPD</h2></div><button className="icon-button" onClick={()=>requests.refetch()}><RefreshCw size={16}/></button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>Titular</th><th>Tipo</th><th>Status</th><th>Responsável</th></tr></thead><tbody>{(requests.data||[]).map((x)=><tr key={x.id}><td>{dateTime(x.createdAt)}</td><td>{x.cliente?.nome||x.clienteId}</td><td>{x.tipo}</td><td>{x.status}</td><td>{x.solicitadoPor?.nome||"Sistema"}</td></tr>)}</tbody></table></div></section></div>}

    {tab==="arquivos" && canFiles && <section className="panel"><div className="panel__heading"><div><span>Railway Object Storage</span><h2>Arquivos privados</h2><p>Os objetos ficam privados no bucket e são entregues por URL temporária somente após autorização.</p></div></div><div className="security-upload"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,application/json" onChange={(e)=>setUploadFile(e.target.files?.[0]||null)}/><button className="secondary-button" disabled={!uploadFile||uploadMutation.isPending} onClick={()=>uploadMutation.mutate()}><Upload size={15}/>{uploadMutation.isPending?"Enviando...":"Enviar arquivo privado"}</button>{uploadFile?<span>{uploadFile.name} · {bytes(uploadFile.size)}</span>:null}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>Arquivo</th><th>Tipo</th><th>Tamanho</th><th>Data</th><th></th></tr></thead><tbody>{(files.data||[]).map((x)=><tr key={x.id}><td><strong>{x.nomeOriginal}</strong></td><td>{x.tipo}</td><td>{bytes(x.tamanhoBytes)}</td><td>{dateTime(x.confirmadoEm||x.createdAt)}</td><td><button className="icon-button" title="Abrir link temporário" onClick={()=>openFile(x.id)}><Archive size={15}/></button></td></tr>)}</tbody></table></div></section>}
  </div>;
}
