/** Permission-gated read-only client sales, payments and purchases. */
import {useMemo,useState} from "react";
import {Printer} from "lucide-react";
import {formatCurrency} from "../lib/formatters.js";
const num=v=>Number(v)||0;
export default function ClientFinanceTab({sales=[],pets=[]}){
 const [status,setStatus]=useState("TODOS"),[payment,setPayment]=useState("TODOS"),[pet,setPet]=useState("TODOS"),[subtab,setSubtab]=useState("vendas");
 const filtered=useMemo(()=>sales.filter(v=>{
  if(status!=="TODOS"&&v.status!==status)return false;
  const paid=num(v.valorPago),total=num(v.valorTotal);
  if(payment==="PAGAS"&&paid<total)return false;
  if(payment==="DEBITO"&&paid>=total)return false;
  if(pet!=="TODOS"&&!v.itens?.some(item=>item.petId===pet))return false;
  return true;
 }),[sales,status,payment,pet]);
 const total=filtered.reduce((a,v)=>a+num(v.valorTotal),0);
 const paid=filtered.reduce((a,v)=>a+num(v.valorPago),0);
 const purchased=filtered.flatMap(v=>(v.itens||[]).map(item=>({...item,venda:v.numero,data:v.createdAt})));
 const receipts=filtered.flatMap(v=>(v.pagamentos||[]).filter(p=>p.status==="APROVADO").map(p=>({...p,venda:v.numero})));
 return <div className="pv-client-financial">
  <div className="pv-client-filters">
   <label>Situação da venda<select className="form-control" value={status} onChange={e=>setStatus(e.target.value)}><option value="TODOS">Todas</option><option value="ABERTA">Abertas</option><option value="FINALIZADA">Finalizadas</option><option value="CANCELADA">Canceladas</option><option value="ESTORNADA">Estornadas</option></select></label>
   <label>Situação do pagamento<select className="form-control" value={payment} onChange={e=>setPayment(e.target.value)}><option value="TODOS">Todos</option><option value="PAGAS">Pagas</option><option value="DEBITO">Em débito ou parcial</option></select></label>
   <label>Pet<select className="form-control" value={pet} onChange={e=>setPet(e.target.value)}><option value="TODOS">Todos os pets</option>{pets.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
  </div>
  <div className="pv-client-finance-cards">
   <div><span>Ordens/vendas</span><strong>{filtered.length}</strong></div>
   <div><span>Valor total</span><strong>{formatCurrency(total)}</strong></div>
   <div><span>Valor pago</span><strong>{formatCurrency(paid)}</strong></div>
   <div><span>Valor em aberto</span><strong>{formatCurrency(Math.max(0,total-paid))}</strong></div>
  </div>
  <div className="pv-detail-tabs">{[["vendas","Histórico de vendas"],["recebimentos","Recebimentos"],["produtos","Produtos e serviços"]].map(([key,label])=><button key={key} className={subtab===key?"selected":""} onClick={()=>setSubtab(key)}>{label}</button>)}</div>
  <div className="pv-detail-section-actions"><h3>{subtab==="vendas"?"Vendas e ordens":subtab==="recebimentos"?"Recebimentos":"Itens adquiridos"}</h3><button className="ghost-button" onClick={()=>window.print()}><Printer size={16}/> Imprimir</button></div>
  <div className="pv-detail-ledger">
   {subtab==="vendas"?filtered.map(v=><div key={v.id}><strong>Venda #{v.numero}</strong><span>{new Date(v.createdAt).toLocaleDateString("pt-BR")} · {v.status}</span><strong>{formatCurrency(v.valorTotal)}</strong><small>Pago: {formatCurrency(v.valorPago)}</small></div>):subtab==="recebimentos"?receipts.map((r,i)=><div key={i}><strong>Venda #{r.venda}</strong><span>{r.forma?.replaceAll("_"," ")} · {r.pagoEm?new Date(r.pagoEm).toLocaleDateString("pt-BR"):"Sem data de pagamento"}</span><strong>{formatCurrency(num(r.valor))}</strong></div>):purchased.map((item,i)=><div key={i}><strong>{item.descricao}</strong><span>Venda #{item.venda} · {num(item.quantidade).toLocaleString("pt-BR")} itens</span><strong>{formatCurrency(num(item.valorTotal))}</strong></div>)}
   {((subtab==="vendas"&&!filtered.length)||(subtab==="recebimentos"&&!receipts.length)||(subtab==="produtos"&&!purchased.length))&&<p className="pv-empty">Nenhum registro encontrado com os filtros selecionados.</p>}
  </div>
  <p className="pv-dashboard-note">Registros vinculados ao cliente; valores recebidos correspondem a pagamentos aprovados. Ordens de outros módulos sem venda vinculada não aparecem aqui.</p>
 </div>;
}
