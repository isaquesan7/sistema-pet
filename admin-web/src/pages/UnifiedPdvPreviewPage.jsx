/** Fase 20.1 — preview only; no stock, financial or fiscal mutation. */
import {useState} from "react";
import {useQuery,useMutation} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ArrowLeft,Plus,Trash2,ShieldCheck} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import {useAuth} from "../context/AuthContext.jsx";
import "../clients.css";
export default function UnifiedPdvPreviewPage(){
 const {selectedOrganization}=useAuth();
 const [clientSearch,setClientSearch]=useState(""),[clientId,setClientId]=useState("");
 const [search,setSearch]=useState(""),[lines,setLines]=useState([]);
 const eligibility=useQuery({queryKey:["unified-eligibility",selectedOrganization?.id],queryFn:async()=>(await api.get("/pdv-unificado/disponibilidade")).data.dados});
 const enabled=Boolean(eligibility.data?.preferenciaUnificado);
 const clients=useQuery({queryKey:["unified-clients",clientSearch],enabled,queryFn:async()=>(await api.get("/clientes",{params:{busca:clientSearch,limite:30}})).data.dados||[]});
 const catalog=useQuery({queryKey:["unified-catalog",search],enabled,queryFn:async()=>(await api.get("/pdv-unificado/catalogo",{params:{busca:search}})).data.dados||[]});
 const preview=useMutation({mutationFn:async()=>(await api.post("/pdv-unificado/simulacao",{clienteId,itens:lines.map(x=>({empresaId:x.empresaId,itemCatalogoId:x.itemCatalogoId,quantidade:x.quantidade,petId:null}))})).data.dados});
 function add(item){setLines(rows=>{const i=rows.findIndex(r=>r.itemCatalogoId===item.id);if(i>=0)return rows.map((r,j)=>j===i?{...r,quantidade:r.quantidade+1}:r);return [...rows,{itemCatalogoId:item.id,empresaId:item.empresaId,nome:item.nome,empresa:item.empresa?.nomeFantasia,quantidade:1,preco:item.precoVenda}];});preview.reset();}
 return <div className="page-stack pv-unified-preview">
  <Link className="ghost-button pv-back" to="/pdv"><ArrowLeft size={18}/> Voltar ao PDV</Link>
  <section className="page-heading"><div><span className="page-kicker">Fase 20.1 · Homologação</span><h1>Comanda multiempresa — Simulação</h1><p>Confira itens e valores por empresa. Nenhuma venda ou pagamento será registrado nesta tela.</p></div></section>
  {eligibility.isLoading?<p>Conferindo acesso...</p>:eligibility.isError?<p className="alert alert--error">{getApiErrorMessage(eligibility.error)}</p>:!enabled?<div className="panel pv-detail-panel"><h2>Preferência ainda desativada</h2><p>Um gestor pode habilitar a preferência em Configurações → Módulos. Isso libera somente a simulação e não altera o PDV tradicional.</p></div>:<>
   <section className="panel pv-detail-panel"><h2>Cliente</h2><input className="form-control" placeholder="Buscar tutor" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/><select className="form-control" value={clientId} onChange={e=>{setClientId(e.target.value);preview.reset();}} aria-label="Selecione cliente"><option value="">Selecione um cliente ativo</option>{(clients.data||[]).map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select></section>
   <section className="panel pv-detail-panel"><h2>Produtos e serviços autorizados</h2><input className="form-control" placeholder="Buscar em suas empresas" value={search} onChange={e=>setSearch(e.target.value)}/>{catalog.isError&&<p className="alert alert--error">{getApiErrorMessage(catalog.error)}</p>}<div className="pv-unified-catalog">{(catalog.data||[]).map(item=><div key={item.id}><div><strong>{item.nome}</strong><span>{item.empresa?.nomeFantasia} · {formatCurrency(item.precoVenda)}</span></div><button className="ghost-button" onClick={()=>add(item)}><Plus size={16}/> Adicionar</button></div>)}</div></section>
   <section className="panel pv-detail-panel"><h2>Itens da simulação</h2>{lines.map(row=><div className="pv-unified-line" key={row.itemCatalogoId}><div><strong>{row.nome}</strong><small>{row.empresa}</small></div><label>Quantidade<input type="number" min="0.001" max="10000" step="0.001" className="form-control" value={row.quantidade} onChange={e=>{setLines(ls=>ls.map(l=>l.itemCatalogoId===row.itemCatalogoId?{...l,quantidade:Number(e.target.value)}:l));preview.reset();}}/></label><button className="icon-button" title="Remover" onClick={()=>{setLines(ls=>ls.filter(l=>l.itemCatalogoId!==row.itemCatalogoId));preview.reset();}}><Trash2 size={18}/></button></div>)}{!lines.length&&<p className="pv-empty">Adicione produtos e serviços para simular.</p>}<button className="primary-button" disabled={!clientId||!lines.length||preview.isPending} onClick={()=>preview.mutate()}><ShieldCheck size={17}/> Validar e calcular sem cobrar</button>{preview.isError&&<p className="alert alert--error">{getApiErrorMessage(preview.error)}</p>}{preview.data&&<div className="pv-unified-total"><h3>Resumo por empresa</h3>{preview.data.empresas.map(e=><div key={e.empresaId}><strong>{e.empresa}</strong><span>{formatCurrency(Number(e.total))}</span></div>)}<div><strong>Total consolidado</strong><strong>{formatCurrency(Number(preview.data.total))}</strong></div><p>Prévia validada. Nenhuma venda, estoque ou documento fiscal foi movimentado.</p></div>}</section>
  </>}
 </div>;
}
