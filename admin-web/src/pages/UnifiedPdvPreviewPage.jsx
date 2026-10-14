/** Fase 20.1 — preview only; no stock, financial or fiscal mutation. */
import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ArrowLeft,Plus,Trash2,ShieldCheck} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import {useAuth} from "../context/AuthContext.jsx";
import "../clients.css";
export default function UnifiedPdvPreviewPage(){
 const {selectedOrganization,hasPermission}=useAuth();
 const [motivoCancelar,setMotivoCancelar]=useState("Revisão da comanda");
 const queryClient=useQueryClient();
 const [draft,setDraft]=useState(null);
 const [savedNotice,setSavedNotice]=useState("");
 const [localChanges,setLocalChanges]=useState(false);
 const [clientSearch,setClientSearch]=useState(""),[clientId,setClientId]=useState("");
 const [search,setSearch]=useState(""),[lines,setLines]=useState([]);
 const eligibility=useQuery({queryKey:["unified-eligibility",selectedOrganization?.id],queryFn:async()=>(await api.get("/pdv-unificado/disponibilidade")).data.dados});
 const enabled=Boolean(eligibility.data?.preferenciaUnificado);
 const clients=useQuery({queryKey:["unified-clients",clientSearch],enabled,queryFn:async()=>(await api.get("/clientes",{params:{busca:clientSearch,limite:30}})).data.dados||[]});
 const clientDetails=useQuery({queryKey:["unified-client-pets",clientId],enabled:enabled&&Boolean(clientId),queryFn:async()=>(await api.get(`/clientes/${clientId}`)).data.cliente});
 const catalog=useQuery({queryKey:["unified-catalog",search],enabled,queryFn:async()=>(await api.get("/pdv-unificado/catalogo",{params:{busca:search}})).data.dados||[]});
 const draftList=useQuery({queryKey:["unified-drafts",selectedOrganization?.id],enabled,queryFn:async()=>(await api.get("/pdv-unificado/rascunhos")).data.dados||[]});
 const save=useMutation({mutationFn:async()=>{
   const dados={clienteId,itens:lines.map(x=>({empresaId:x.empresaId,itemCatalogoId:x.itemCatalogoId,quantidade:x.quantidade,petId:x.petId||null}))};
   const response=draft?await api.put(`/pdv-unificado/rascunhos/${draft.id}`,{...dados,versao:draft.versao}):await api.post("/pdv-unificado/rascunhos",dados);
   return response.data.dados;
 },onSuccess:async data=>{setLocalChanges(false);setDraft({id:data.id,versao:data.versao});setSavedNotice(`Rascunho #${data.numero} salvo. Sem venda ou cobrança.`);await queryClient.invalidateQueries({queryKey:["unified-drafts"]});}});
 const closingReview=useQuery({queryKey:["unified-preclose",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id),queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/pre-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const closingPlan=useQuery({queryKey:["unified-close-plan",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id)&&closingReview.data?.pendencias?.length===0,queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/plano-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const reservation=useQuery({queryKey:["unified-reservation",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id),queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/reserva`,{params:{versao:draft.versao}})).data.dados});
 const isReserved=reservation.data?.status==="RESERVADA";
 const reserveMutation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/reservar`,{versao:draft.versao})).data.dados,onSuccess:async()=>{setSavedNotice("Operações reservadas com segurança. Nenhuma cobrança foi realizada.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const cancelReservation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/cancelar-reserva`,{versao:draft.versao,motivo:motivoCancelar})).data.dados,onSuccess:async()=>{setSavedNotice("Reserva cancelada. Ajuste e salve uma nova versão da comanda.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const preview=useMutation({mutationFn:async()=>(await api.post("/pdv-unificado/simulacao",{clienteId,itens:lines.map(x=>({empresaId:x.empresaId,itemCatalogoId:x.itemCatalogoId,quantidade:x.quantidade,petId:x.petId||null}))})).data.dados});
 function reopen(saved){
   setLocalChanges(false);setClientId(saved.cliente.id);setClientSearch(saved.cliente.nome);setDraft({id:saved.id,versao:saved.versaoRascunho});setSavedNotice("");
   setLines(saved.itens.filter(i=>i.status==="ATIVO").map(i=>{const product=(catalog.data||[]).find(p=>p.id===i.itemCatalogoId);return {empresaId:i.empresaId,itemCatalogoId:i.itemCatalogoId,petId:i.petId||"",quantidade:Number(i.quantidade),nome:product?.nome||"Item do catálogo",empresa:product?.empresa?.nomeFantasia||"Empresa vinculada",exigePet:Boolean(product?.servico?.exigePet)};}));preview.reset();
 }
 function add(item){setLocalChanges(true);setSavedNotice("");setLines(rows=>{const i=rows.findIndex(r=>r.itemCatalogoId===item.id);if(i>=0)return rows.map((r,j)=>j===i?{...r,quantidade:r.quantidade+1}:r);return [...rows,{itemCatalogoId:item.id,empresaId:item.empresaId,nome:item.nome,empresa:item.empresa?.nomeFantasia,quantidade:1,preco:item.precoVenda,petId:"",exigePet:Boolean(item.servico?.exigePet)}];});preview.reset();}
 return <div className="page-stack pv-unified-preview">
  <Link className="ghost-button pv-back" to="/pdv"><ArrowLeft size={18}/> Voltar ao PDV</Link>
  <section className="page-heading"><div><span className="page-kicker">Fase 20.1 · Homologação</span><h1>Comanda multiempresa — Simulação</h1><p>Confira itens e valores por empresa. Nenhuma venda ou pagamento será registrado nesta tela.</p></div></section>
  {eligibility.isLoading?<p>Conferindo acesso...</p>:eligibility.isError?<p className="alert alert--error">{getApiErrorMessage(eligibility.error)}</p>:!enabled?<div className="panel pv-detail-panel"><h2>Preferência ainda desativada</h2><p>Um gestor pode habilitar a preferência em Configurações → Módulos. Isso libera somente a simulação e não altera o PDV tradicional.</p></div>:<>
   <section className="panel pv-detail-panel"><div className="pv-detail-section-actions"><h2>Rascunhos recentes</h2><button type="button" className="ghost-button" onClick={()=>{setDraft(null);setClientId("");setLines([]);setLocalChanges(false);setSavedNotice("");preview.reset();}}>Nova comanda</button></div>{draftList.isError&&<p className="alert alert--error">{getApiErrorMessage(draftList.error)}</p>}{(draftList.data||[]).map(d=><button key={d.id} className="ghost-button" type="button" onClick={()=>reopen(d)}>#{d.numero} · {d.cliente.nome} · versão {d.versaoRascunho}</button>)}</section>
   <section className="panel pv-detail-panel"><h2>Cliente</h2><input className="form-control" placeholder="Buscar tutor" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/><select className="form-control" value={clientId} onChange={e=>{setClientId(e.target.value);setLocalChanges(true);preview.reset();}} aria-label="Selecione cliente" disabled={isReserved}><option value="">Selecione um cliente ativo</option>{(clients.data||[]).map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select></section>
   <section className="panel pv-detail-panel"><h2>Produtos e serviços autorizados</h2><input className="form-control" placeholder="Buscar em suas empresas" value={search} onChange={e=>setSearch(e.target.value)}/>{catalog.isError&&<p className="alert alert--error">{getApiErrorMessage(catalog.error)}</p>}<div className="pv-unified-catalog">{(catalog.data||[]).map(item=><div key={item.id}><div><strong>{item.nome}</strong><span>{item.empresa?.nomeFantasia} · {formatCurrency(item.precoVenda)}</span></div><button className="ghost-button" disabled={isReserved} onClick={()=>add(item)}><Plus size={16}/> Adicionar</button></div>)}</div></section>
   <section className="panel pv-detail-panel"><h2>Itens da simulação</h2>{lines.map(row=><div className="pv-unified-line" key={row.itemCatalogoId}><div><strong>{row.nome}</strong><small>{row.empresa}</small></div>{row.exigePet&&<label>Pet<select className="form-control" value={row.petId||""} disabled={isReserved} onChange={e=>{setLines(ls=>ls.map(l=>l.itemCatalogoId===row.itemCatalogoId?{...l,petId:e.target.value}:l));setLocalChanges(true);preview.reset();}}><option value="">Selecione o pet</option>{(clientDetails.data?.pets||[]).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>}<label>Quantidade<input type="number" min="0.001" max="10000" step="0.001" className="form-control" value={row.quantidade} disabled={isReserved} onChange={e=>{setLines(ls=>ls.map(l=>l.itemCatalogoId===row.itemCatalogoId?{...l,quantidade:Number(e.target.value)}:l));setLocalChanges(true);preview.reset();}}/></label><button className="icon-button" title="Remover" disabled={isReserved} onClick={()=>{setLines(ls=>ls.filter(l=>l.itemCatalogoId!==row.itemCatalogoId));setLocalChanges(true);preview.reset();}}><Trash2 size={18}/></button></div>)}{!lines.length&&<p className="pv-empty">Adicione produtos e serviços para simular.</p>}<div className="pv-pet-card-actions"><button className="primary-button" disabled={!clientId||!lines.length||preview.isPending||isReserved} onClick={()=>preview.mutate()}><ShieldCheck size={17}/> Validar e calcular sem cobrar</button><button type="button" className="ghost-button" disabled={!clientId||!lines.length||save.isPending||isReserved} onClick={()=>{setSavedNotice("");save.mutate();}}> {save.isPending?"Salvando...":draft?"Atualizar rascunho":"Salvar rascunho"} </button></div>{save.isError&&<p className="alert alert--error">{getApiErrorMessage(save.error)}</p>}{savedNotice&&<p className="alert alert--success">{savedNotice}</p>}{closingReview.isError&&<p className="alert alert--error">{getApiErrorMessage(closingReview.error)}</p>}{closingPlan.isError&&<p className="alert alert--error">{getApiErrorMessage(closingPlan.error)}</p>}{closingPlan.data&&<div className="pv-unified-total"><h3>Planejamento por empresa — sem executar</h3>{closingPlan.data.operacoes.map(op=><div key={op.empresaId}><span>{op.empresa} · {op.cnpj}</span><strong>{formatCurrency(Number(op.total))}</strong></div>)}<p>Operações apenas planejadas. O sistema não cria vendas, não movimenta caixa e não emite notas fiscais.</p></div>}{reservation.isError&&<p className="alert alert--error">{getApiErrorMessage(reservation.error)}</p>}
 {reserveMutation.isError&&<p className="alert alert--error">{getApiErrorMessage(reserveMutation.error)}</p>}
 {cancelReservation.isError&&<p className="alert alert--error">{getApiErrorMessage(cancelReservation.error)}</p>}
 {closingPlan.data&&!reservation.data&&<div className="pv-unified-total"><h3>Reserva do fechamento (sem cobrança)</h3><p>Registra as operações planejadas e bloqueia a edição até a reserva ser cancelada. Nenhuma venda é criada. {localChanges?"Salve as alterações antes de reservar.":""}</p><button type="button" className="ghost-button" disabled={reserveMutation.isPending||localChanges} onClick={()=>reserveMutation.mutate()}>{reserveMutation.isPending?"Reservando...":"Reservar operações por empresa"}</button></div>}
 {reservation.data&&<div className="pv-unified-total"><h3>Reserva #{reservation.data.id.slice(0,8)}</h3><p>Status: {reservation.data.status==="RESERVADA"?"Reservada — edição bloqueada":"Cancelada — edição liberada"}. Sem pagamentos ou notas fiscais.</p>{reservation.data.operacoes.map(op=><div key={op.id}><span>{op.nome} · {op.cnpj}</span><strong>{formatCurrency(Number(op.valor))}</strong></div>)}{isReserved&&hasPermission("pdv.cancelar_venda")&&<><label>Motivo para cancelar a reserva<input className="form-control" value={motivoCancelar} onChange={e=>setMotivoCancelar(e.target.value)}/></label><button type="button" className="ghost-button" disabled={cancelReservation.isPending||motivoCancelar.trim().length<5} onClick={()=>cancelReservation.mutate()}>{cancelReservation.isPending?"Cancelando...":"Cancelar reserva e liberar edição"}</button></>}</div>}
 {isReserved&&<UnifiedAllocationConference draft={draft} reservation={reservation.data} dirty={localChanges}/>}
 {closingReview.data&&<div className="pv-unified-total"><h3>Pré-fechamento (somente conferência)</h3>{closingReview.data.empresas.map(e=><div key={e.empresaId}><span>{e.nome} · {e.cnpj}</span><strong>{formatCurrency(Number(e.total))}</strong></div>)}<div><strong>Total por empresas</strong><strong>{formatCurrency(Number(closingReview.data.total))}</strong></div>{closingReview.data.pendencias.length?<p>Há {closingReview.data.pendencias.length} pendência(s) de preço ou cadastro. Revise os itens antes de seguir.</p>:<p>Itens conferidos. Fechamento, pagamento e notas fiscais continuam desabilitados.</p>}</div>}{preview.isError&&<p className="alert alert--error">{getApiErrorMessage(preview.error)}</p>}{preview.data&&<div className="pv-unified-total"><h3>Resumo por empresa</h3>{preview.data.empresas.map(e=><div key={e.empresaId}><strong>{e.empresa}</strong><span>{formatCurrency(Number(e.total))}</span></div>)}<div><strong>Total consolidado</strong><strong>{formatCurrency(Number(preview.data.total))}</strong></div><p>Prévia validada. Nenhuma venda, estoque ou documento fiscal foi movimentado.</p></div>}</section>
  </>}
 </div>;
}


/** Pure payment-allocation conference; absolutely no charges or finance writes. */
function UnifiedAllocationConference({draft,reservation,dirty}){
 const [forms,setForms]=useState({});
 const sessions=useQuery({
  queryKey:["unified-cash-sessions",draft?.id,draft?.versao],
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/caixas-disponiveis`,{params:{versao:draft.versao}})).data.dados||[]
 });
 const diagnosis=useQuery({
  queryKey:["unified-recovery-diagnosis",draft?.id,draft?.versao],
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/diagnostico-recuperacao`,{params:{versao:draft.versao}})).data.dados
 });
 const conference=useMutation({
  mutationFn:async()=>{
   const alocacoes=reservation.operacoes.map(op=>{
    const own=(sessions.data||[]).filter(s=>s.empresaId===op.empresaId);
    const fields=forms[op.empresaId]||{};
    return {empresaId:op.empresaId,sessaoCaixaId:fields.sessaoCaixaId||own[0]?.sessaoCaixaId||"",
     pagamentos:[{forma:fields.forma||"PIX",valorCentavos:Math.round(Number(fields.valor??op.valor)*100)}]};
   });
   return (await api.post(`/pdv-unificado/rascunhos/${draft.id}/conferencia-alocacao`,{versao:draft.versao,alocacoes})).data.dados;
  }
 });
 function set(companyId,patch){setForms(current=>({...current,[companyId]:{...current[companyId],...patch}}));conference.reset();}
 return <section className="panel pv-detail-panel"><h2>Conferência de pagamentos por empresa</h2>
  <p>Simulação somente leitura. Selecione um caixa aberto para cada empresa. Não existe cobrança, split, utilização de crédito nem emissão fiscal nesta etapa.</p>
  {sessions.isError&&<p className="alert alert--error">{getApiErrorMessage(sessions.error)}</p>}
  {reservation.operacoes.map(op=>{
   const opts=(sessions.data||[]).filter(x=>x.empresaId===op.empresaId);
   const current=forms[op.empresaId]||{};
   return <div key={op.empresaId} className="pv-unified-line">
    <div><strong>{op.nome} — {formatCurrency(Number(op.valor))}</strong><small>CNPJ: {op.cnpj}</small></div>
    <label>Caixa aberto<select className="form-control" value={current.sessaoCaixaId||opts[0]?.sessaoCaixaId||""} onChange={e=>set(op.empresaId,{sessaoCaixaId:e.target.value})}>
     {!opts.length&&<option value="">Nenhum caixa aberto</option>}
     {opts.map(x=><option key={x.sessaoCaixaId} value={x.sessaoCaixaId}>{x.caixa}</option>)}
    </select></label>
    <label>Forma<select className="form-control" value={current.forma||"PIX"} onChange={e=>set(op.empresaId,{forma:e.target.value})}>
     <option value="PIX">Pix</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_DEBITO">Débito</option><option value="CARTAO_CREDITO">Crédito</option><option value="TRANSFERENCIA">Transferência</option>
    </select></label>
    <label>Valor simulado<input className="form-control" type="number" min="0.01" step="0.01" value={current.valor??op.valor} onChange={e=>set(op.empresaId,{valor:e.target.value})}/></label>
   </div>;
  })}
  <button className="ghost-button" type="button" disabled={dirty||sessions.isLoading||conference.isPending||!(sessions.data||[]).length} onClick={()=>conference.mutate()}>{conference.isPending?"Conferindo...":"Conferir alocação (sem cobrar)"}</button>
  {dirty&&<p>Salve as alterações locais antes de conferir a alocação.</p>}
  {conference.isError&&<p className="alert alert--error">{getApiErrorMessage(conference.error)}</p>}
  {conference.data&&<div className="pv-unified-total">
   <strong>{conference.data.preConferenciaAprovada?"Alocações consistentes — execução ainda desativada":"Alocações com pendências"}</strong>
   {conference.data.pendencias.map((e,i)=><p key={i}>{e.codigo} — empresa {e.empresaId}</p>)}
   <p>Nenhuma venda ou pagamento foi registrado.</p>
  </div>}
  {diagnosis.data?.exigeRevisaoManual&&<p className="alert alert--error">Diagnóstico de recuperação identificou divergência de estado. Não efetue cobranças; encaminhe para revisão.</p>}
 </section>;
}
