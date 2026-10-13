/** Client quotes: real service-backed creation, approvals and searchable history. */
import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {Plus,Printer} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import Modal from "./Modal.jsx";
const emptyItem=()=>({descricao:"",quantidade:1,valorUnitario:"",petId:""});
export default function ClientQuotesTab({clientId,pets=[]}){
 const qc=useQueryClient(),[filter,setFilter]=useState("TODOS"),[drawer,setDrawer]=useState(false),[form,setForm]=useState({validade:"",observacoes:"",desconto:"0",itens:[emptyItem()]}),[error,setError]=useState("");
 const query=useQuery({queryKey:["client-quotes",clientId],queryFn:async()=>(await api.get(`/clientes-financeiro/${clientId}/orcamentos`)).data.dados});
 const create=useMutation({mutationFn:async()=>api.post(`/clientes-financeiro/${clientId}/orcamentos`,{validade:form.validade||null,observacoes:form.observacoes||null,desconto:Number(form.desconto)||0,itens:form.itens.map(i=>({descricao:i.descricao,quantidade:Number(i.quantidade),valorUnitario:Number(i.valorUnitario),petId:i.petId||null}))}),onSuccess:async()=>{setDrawer(false);setError("");setForm({validade:"",observacoes:"",desconto:"0",itens:[emptyItem()]});await qc.invalidateQueries({queryKey:["client-quotes",clientId]});},onError:e=>setError(getApiErrorMessage(e))});
 const change=useMutation({mutationFn:async({id,status})=>api.post(`/clientes-financeiro/${clientId}/orcamentos/${id}/status`,{status}),onSuccess:()=>qc.invalidateQueries({queryKey:["client-quotes",clientId]}),onError:e=>setError(getApiErrorMessage(e))});
 const quotes=(query.data||[]).filter(q=>filter==="TODOS"||q.status===filter);
 const subtotal=form.itens.reduce((sum,i)=>sum+(Number(i.quantidade)||0)*(Number(i.valorUnitario)||0),0);
 const updateItem=(index,key,value)=>setForm(f=>({...f,itens:f.itens.map((item,i)=>i===index?{...item,[key]:value}:item)}));
 return <div className="pv-client-quotes">
  <div className="pv-detail-section-actions"><h3>Orçamentos do cliente</h3><button className="primary-button" onClick={()=>setDrawer(true)}><Plus size={17}/> Novo orçamento</button></div>
  <div className="pv-client-quote-filters"><label>Situação<select className="form-control" value={filter} onChange={e=>setFilter(e.target.value)}><option value="TODOS">Todos</option>{["RASCUNHO","ENVIADO","APROVADO","REJEITADO","CANCELADO","EXPIRADO"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></label></div>
  {error&&<p className="alert alert--error">{error}</p>}
  <div className="pv-detail-ledger">{query.isLoading?<p>Carregando orçamentos...</p>:query.isError?<p className="alert alert--error">{getApiErrorMessage(query.error)}</p>:quotes.length?quotes.map(q=><div key={q.id} className="pv-quote-row"><strong>Orçamento #{q.numero}</strong><span>{q.status} · {new Date(q.createdAt).toLocaleDateString("pt-BR")}</span><strong>{formatCurrency(q.total)}</strong><small>{q.itens?.map(i=>i.descricao).join(", ")}</small><div className="pv-pet-card-actions">{q.status==="RASCUNHO"&&<button className="ghost-button" disabled={change.isPending} onClick={()=>change.mutate({id:q.id,status:"ENVIADO"})}>Marcar enviado</button>}{["RASCUNHO","ENVIADO"].includes(q.status)&&<><button className="ghost-button" disabled={change.isPending} onClick={()=>change.mutate({id:q.id,status:"APROVADO"})}>Aprovar</button><button className="ghost-button pv-danger-action" disabled={change.isPending} onClick={()=>{if(window.confirm("Cancelar este orçamento?"))change.mutate({id:q.id,status:"CANCELADO"});}}>Cancelar</button></>}<button className="ghost-button" onClick={()=>window.print()}><Printer size={16}/> Imprimir</button></div></div>):<p className="pv-empty">Nenhum orçamento encontrado.</p>}</div>
  <Modal drawer open={drawer} title="Novo orçamento" subtitle="Proposta comercial sem lançamento financeiro" onClose={()=>!create.isPending&&setDrawer(false)} footer={<><button className="ghost-button" onClick={()=>setDrawer(false)}>Cancelar</button><button className="primary-button" form="pv-quote-new" type="submit" disabled={create.isPending}>Salvar orçamento</button></>}>
   <form id="pv-quote-new" className="pv-pet-form" onSubmit={e=>{e.preventDefault();setError("");create.mutate();}}>
   {error&&<div className="alert alert--error">{error}</div>}
   <label>Validade<input type="date" className="form-control" value={form.validade} onChange={e=>setForm(f=>({...f,validade:e.target.value}))}/></label>
   {form.itens.map((item,index)=><div className="pv-quote-item" key={index}>
    <strong>Item {index+1}</strong><label>Descrição<input className="form-control" required minLength={2} value={item.descricao} onChange={e=>updateItem(index,"descricao",e.target.value)}/></label>
    <label>Pet<select className="form-control" value={item.petId} onChange={e=>updateItem(index,"petId",e.target.value)}><option value="">Sem pet específico</option>{pets.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <div className="pv-quote-numbers"><label>Quantidade<input className="form-control" type="number" min="0.001" step="0.001" required value={item.quantidade} onChange={e=>updateItem(index,"quantidade",e.target.value)}/></label><label>Preço unitário<input className="form-control" type="number" min="0" step="0.01" required value={item.valorUnitario} onChange={e=>updateItem(index,"valorUnitario",e.target.value)}/></label></div>
    {form.itens.length>1&&<button type="button" className="ghost-button" onClick={()=>setForm(f=>({...f,itens:f.itens.filter((_,i)=>i!==index)}))}>Remover item</button>}
   </div>)}
   <button type="button" className="ghost-button" onClick={()=>setForm(f=>({...f,itens:[...f.itens,emptyItem()]}))}><Plus size={16}/> Adicionar item</button>
   <label>Desconto (R$)<input type="number" step="0.01" min="0" className="form-control" value={form.desconto} onChange={e=>setForm(f=>({...f,desconto:e.target.value}))}/></label>
   <label>Observações<textarea className="form-control" rows={3} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/></label>
   <div className="pv-quote-total"><span>Total previsto</span><strong>{formatCurrency(Math.max(0,subtotal-(Number(form.desconto)||0)))}</strong></div>
   </form>
  </Modal>
 </div>;
}
