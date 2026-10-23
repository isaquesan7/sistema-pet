/** M.5.71 — Central de comandas: ponto de entrada de todos os atendimentos.
 * Listas de leitura do tenant já filtradas pela API. Venda concluída é exibida
 * apenas no histórico de hoje, não é reaberta como comanda editável.
 */
import {useMemo,useState} from "react";
import {Eye,Plus,Search,ReceiptText,Store} from "lucide-react";
import {formatCurrency,formatDateTime} from "../lib/formatters.js";

function isToday(value){
 if(!value)return false;
 const date=new Date(value),today=new Date();
 return Number.isFinite(date.getTime())&&date.getFullYear()===today.getFullYear()
  &&date.getMonth()===today.getMonth()&&date.getDate()===today.getDate();
}
const money=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
const statusText={ABERTA:"Aberta",PARCIALMENTE_FECHADA:"Parcialmente fechada",FECHADA:"Fechada",CANCELADA:"Cancelada"};
export default function PdvOrdersHome({commands=[],sales=[],clients=[],openSession,selectedCompany,onOpenCommand,onOpenSale,onCreateCommand,creating=false,createError="",onOpenCash}){
 const [filter,setFilter]=useState("OPEN");
 const [search,setSearch]=useState("");
 const [clientId,setClientId]=useState("");
 const [budgetMode,setBudgetMode]=useState(false);
 const normalized=search.trim().toLocaleLowerCase("pt-BR");
 const activeCommands=useMemo(()=>commands.filter(c=>["ABERTA","PARCIALMENTE_FECHADA"].includes(c.status)),[commands]);
 const todaySales=useMemo(()=>sales.filter(s=>isToday(s.createdAt)&&s.status==="FINALIZADA"),[sales]);
 const rows=filter==="OPEN"?activeCommands:filter==="CLOSED"?todaySales:[];
 const matches=rows.filter(item=>{
  if(!normalized)return true;
  const text=filter==="CLOSED"?[item.numero,item.cliente?.nome,item.id]:[item.numero,item.cliente?.nome,item.id,...(item.itens||[]).map(i=>i.pet?.nome)];
  return text.filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalized);
 });
 return <section className="pdv-orders-home" aria-label="Central de comandas do ponto de venda">
  <div className="panel pdv-orders-home__list">
   <header className="pdv-orders-home__title"><div><span className="pdv-eyebrow">ATENDIMENTOS</span><h2>Comandas e ordens</h2><p>Localize atendimentos abertos ou consulte vendas finalizadas hoje.</p></div><ReceiptText size={22}/></header>
   <div className="pdv-orders-home__tabs" role="group" aria-label="Situação das ordens">
    <button type="button" className={filter==="OPEN"?"active":""} aria-pressed={filter==="OPEN"} onClick={()=>setFilter("OPEN")}>Em aberto ({activeCommands.length})</button>
    <button type="button" className={filter==="CLOSED"?"active":""} aria-pressed={filter==="CLOSED"} onClick={()=>setFilter("CLOSED")}>Finalizadas hoje ({todaySales.length})</button>
    <button type="button" className={filter==="QUOTES"?"active":""} aria-pressed={filter==="QUOTES"} onClick={()=>setFilter("QUOTES")}>Orçamentos</button>
   </div>
   {filter==="QUOTES"?<div className="pdv-orders-home__empty">Orçamentos têm fluxo próprio. Esta lista será conectada ao módulo de orçamentos; nenhum orçamento é tratado como venda.</div>:<>
    <label className="search-box pdv-search"><Search size={17}/><input aria-label="Buscar comanda, cliente ou pet" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nº, tutor ou pet..."/></label>
    <div className="table-scroll"><table className="pdv-orders-home__table"><thead><tr><th>Nº</th><th>Tutor / pet</th><th>Data</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead><tbody>
     {matches.map(item=><tr key={item.id}>
      <td><strong>#{item.numero}</strong></td>
      <td><strong>{item.cliente?.nome||"Consumidor não identificado"}</strong>{filter==="OPEN"&&<small>{[...new Set((item.itens||[]).map(i=>i.pet?.nome).filter(Boolean))].join(", ")||"Sem pet"}</small>}</td>
      <td>{formatDateTime(item.createdAt)}</td>
      <td><strong>{formatCurrency(filter==="CLOSED"?item.valorTotal:(item.itens||[]).filter(i=>i.status!=="CANCELADO").reduce((sum,i)=>sum+money(i.valorTotal),0))}</strong></td>
      <td><span className={filter==="CLOSED"?"badge badge--success":"badge badge--muted"}>{filter==="CLOSED"?"Finalizada":statusText[item.status]||item.status}</span></td>
      <td><button type="button" className="ghost-button" onClick={()=>filter==="CLOSED"?onOpenSale(item.id):onOpenCommand(item.id)}><Eye size={14}/> {filter==="CLOSED"?"Consultar":"Abrir"}</button></td>
     </tr>)}
    </tbody></table></div>
    {!matches.length&&<div className="pdv-orders-home__empty">{normalized?"Nenhuma comanda encontrada.":"Nenhum atendimento nesta situação."}</div>}
   </>}
  </div>
  <aside className="pdv-orders-home__side">
   <section className="panel pdv-orders-home__create">
    <div className="pdv-orders-home__side-title"><Plus size={18}/><h2>Abrir nova comanda</h2></div>
    <p>Tutor opcional para produtos. Para lançar serviços, selecione tutor e pet na comanda.</p>
    <label className="form-field"><span>Tutor (opcional para produtos)</span>
     <select className="form-control" value={clientId} onChange={e=>setClientId(e.target.value)}>
      <option value="">Consumidor não identificado</option>
      {clients.map(client=><option value={client.id} key={client.id}>{client.nome}</option>)}
     </select></label>
    <label className="pdv-orders-home__quote"><input type="checkbox" checked={budgetMode} onChange={e=>setBudgetMode(e.target.checked)}/> Orçamento (em preparação)</label>
    {budgetMode&&<p className="pdv-orders-home__warning">Ainda não criaremos orçamento por este atalho: para isso, utilize o módulo Orçamentos. Desmarque para criar comanda.</p>}
    {createError&&<p className="alert alert--error" role="alert">{createError}</p>}
    <button className="primary-button" type="button" disabled={budgetMode||creating} onClick={()=>onCreateCommand(clientId)}>
     <Plus size={16}/>{creating?"Abrindo...":"Abrir nova comanda"}
    </button>
   </section>
   <section className="panel pdv-orders-home__cash">
    <div className="pdv-orders-home__side-title"><Store size={18}/><h2>Caixa do CNPJ</h2></div>
    <strong>{openSession?.caixa?.nome||"Caixa fechado"}</strong>
    <small>{selectedCompany?.nomeFantasia||"Empresa selecionada"}</small>
    <button type="button" className="ghost-button" onClick={onOpenCash}>{openSession?"Gerenciar caixa":"Abrir caixa"}</button>
   </section>
  </aside>
 </section>;
}
