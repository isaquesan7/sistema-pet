/** M.5.71 — painel inicial do PDV por comandas.
 * Apenas organiza dados já autorizados pelo backend. Nenhum pagamento é executado aqui.
 * O PDV tradicional e o inteligente usam exatamente o mesmo componente visual.
 */
import {useMemo,useState} from "react";
import {ClipboardList,Search,Plus,Store,ReceiptText,Eye,WalletCards} from "lucide-react";
import {formatCurrency,formatDateTime} from "../lib/formatters.js";

const labels={ABERTA:"Aberta",PARCIALMENTE_FECHADA:"Parcialmente fechada",FECHADA:"Fechada",CANCELADA:"Cancelada"};
function today(value){
 if(!value)return false;
 const date=new Date(value);
 return !Number.isNaN(date.valueOf())&&date.toDateString()===new Date().toDateString();
}
export function orderSearchable(order){
 return [order.numero,order.cliente?.nome,order.cliente?.cpfCnpj,...(order.itens||[]).flatMap(i=>[i.pet?.nome,i.descricao])]
  .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}
export function listOrderRows({commands=[],drafts=[],sales=[],filter="ABERTAS",search=""}){
 const normalized=String(search).trim().toLocaleLowerCase("pt-BR");
 const rows=[
  ...commands.map(order=>({kind:"COMANDA",order,status:order.status,
   date:order.createdAt||order.updatedAt,number:order.numero,client:order.cliente?.nome||"Consumidor não identificado",
   pet:[...new Set((order.itens||[]).map(i=>i.pet?.nome).filter(Boolean))].join(", ")||"—",
   company:[...new Set((order.itens||[]).map(i=>i.empresa?.nomeFantasia).filter(Boolean))].join(" + ")||"—",
   total:(order.itens||[]).reduce((sum,i)=>sum+Number(i.valorTotal||0),0),
   searchValue:orderSearchable(order)})),
  ...drafts.map(order=>({kind:"UNIFICADA",order,status:order.status||"ABERTA",
   date:order.createdAt,number:order.numero,client:order.cliente?.nome||"Consumidor não identificado",
   pet:"—",company:"Múltiplos CNPJs",
   total:(order.itens||[]).filter(i=>i.status==="ATIVO").reduce((s,i)=>s+Number(i.valorTotal||0),0),
   searchValue:orderSearchable(order)})),
  ...sales.map(order=>({kind:"VENDA",order,status:order.status,
   date:order.finalizadaEm||order.createdAt,number:order.numero,client:order.cliente?.nome||"Consumidor não identificado",
   pet:"—",company:"Venda registrada",total:Number(order.valorTotal||0),
   searchValue:[order.numero,order.cliente?.nome].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR")}))
 ];
 return rows.filter(row=>{
  const isOpen=["ABERTA","PARCIALMENTE_FECHADA"].includes(row.status);
  const passes=filter==="ABERTAS"?isOpen:filter==="FECHADAS"?(!isOpen&&today(row.date)):false;
  return passes&&(!normalized||row.searchValue.includes(normalized));
 }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
}
export default function PdvOrdersHome({
 commands=[],drafts=[],sales=[],clients=[],intelligent=false,openSession,
 companyName="",isLoading=false,creating=false,error="",onCreate,onOpenCommand,onOpenDraft,onOpenSale,onCash
}){
 const [view,setView]=useState("ABERTAS");
 const [search,setSearch]=useState("");
 const [clientId,setClientId]=useState("");
 const [petId,setPetId]=useState("");
 const [budget,setBudget]=useState(false);
 const client=clients.find(c=>c.id===clientId);
 const rows=useMemo(()=>listOrderRows({commands,drafts,sales,filter:view,search}),[commands,drafts,sales,view,search]);
 return <section className="pdv-orders-home" aria-label="Central de comandas e ordens">
  <div className="panel pdv-orders-main">
   <div className="pdv-orders-head"><div><span>01 / ORDENS E COMANDAS</span><h2>Atendimentos</h2><p>Escolha uma comanda existente ou abra uma nova para iniciar o atendimento.</p></div><ClipboardList size={22}/></div>
   <div className="pdv-orders-tabs" role="group" aria-label="Filtrar comandas">
    <button type="button" className={view==="ABERTAS"?"active":""} aria-pressed={view==="ABERTAS"} onClick={()=>setView("ABERTAS")}>Em aberto</button>
    <button type="button" className={view==="FECHADAS"?"active":""} aria-pressed={view==="FECHADAS"} onClick={()=>setView("FECHADAS")}>Fechadas hoje</button>
    <button type="button" className={view==="ORCAMENTOS"?"active":""} aria-pressed={view==="ORCAMENTOS"} onClick={()=>setView("ORCAMENTOS")}>Orçamentos</button>
   </div>
   {view==="ORCAMENTOS"?<div className="pdv-orders-empty"><ReceiptText size={25}/><strong>Orçamentos do cliente</strong><p>Os orçamentos continuam disponíveis no perfil de cada cliente. A lista geral será conectada quando houver uma consulta global autorizada; nenhuma ordem fictícia será exibida aqui.</p></div>:<>
    <label className="search-box pdv-orders-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Buscar comanda por número, tutor, pet ou CPF" placeholder="Número, cliente, CPF ou pet..."/></label>
    <div className="pdv-orders-list" aria-live="polite">
     {isLoading?<div className="loading-state">Carregando comandas...</div>:rows.length?rows.map(row=><button key={row.kind+row.order.id} className="pdv-order-row" type="button" onClick={()=>{
      if(row.kind==="UNIFICADA")onOpenDraft(row.order);
      else if(row.kind==="VENDA")onOpenSale(row.order);
      else onOpenCommand(row.order);
     }}>
      <div className="pdv-order-row__number"><strong>#{row.number}</strong><small>{row.kind==="UNIFICADA"?"Inteligente":row.kind==="VENDA"?"Venda":"Comanda"}</small></div>
      <div className="pdv-order-row__identity"><strong>{row.client}</strong><small>{row.pet!=="—"?row.pet+" · ":""}{row.company}</small></div>
      <div className="pdv-order-row__date"><small>{formatDateTime(row.date)}</small><span className={row.status==="FECHADA"||row.status==="FINALIZADA"?"pdv-order-status is-closed":"pdv-order-status"}>{labels[row.status]||row.status}</span></div>
      <strong className="pdv-order-row__total">{formatCurrency(row.total)}</strong><Eye size={17}/>
     </button>):<div className="pdv-orders-empty"><ClipboardList size={26}/><strong>Nenhuma ordem encontrada</strong><p>{view==="FECHADAS"?"Nenhuma comanda ou venda fechada hoje com os filtros atuais.":"Abra uma nova comanda para começar."}</p></div>}
    </div>
   </>}
  </div>
  <aside className="pdv-orders-side">
   <section className="panel pdv-orders-create"><div className="pdv-orders-side-head"><Plus size={17}/><strong>Abrir nova comanda</strong></div>
    <div className="pdv-orders-side-body">
     <label className="form-field"><span>Tutor (opcional para produtos)</span>
      <select className="form-control" value={clientId} onChange={e=>{setClientId(e.target.value);setPetId("");}}>
       <option value="">Consumidor não identificado</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
      </select></label>
     <label className="form-field"><span>Pet (obrigatório apenas para serviços)</span>
      <select className="form-control" value={petId} onChange={e=>setPetId(e.target.value)} disabled={!clientId}>
       <option value="">Selecionar depois</option>{(client?.pets||[]).filter(p=>p.ativo!==false).map(p=><option value={p.id} key={p.id}>{p.nome}</option>)}
      </select></label>
     <label className="pdv-orders-budget"><input type="checkbox" checked={budget} onChange={e=>setBudget(e.target.checked)}/> Orçamento</label>
     {budget&&<p className="pdv-orders-hint">Orçamentos devem ser criados no perfil do cliente. Não serão convertidos em venda sem autorização.</p>}
     {error&&<p className="alert alert--error" role="alert">{error}</p>}
     <button className="primary-button" type="button" disabled={creating||budget} onClick={()=>onCreate({clienteId:clientId||null,petId:petId||null})}>
      <Plus size={17}/>{creating?"Abrindo...":"Abrir nova comanda"}</button>
     <small>É possível adicionar produtos sem identificar o tutor. Para adicionar qualquer serviço, selecione tutor e pet antes do lançamento.</small>
    </div>
   </section>
   <section className="panel pdv-orders-cash"><div className="pdv-orders-side-head"><Store size={17}/><strong>Caixa · {companyName||"CNPJ selecionado"}</strong></div>
    <div className="pdv-orders-side-body"><span className={openSession?"pdv-order-status is-closed":"pdv-order-status"}>{openSession?"Aberto":"Fechado"}</span><p>{openSession?openSession.caixa?.nome||"Sessão aberta":"Abra um caixa antes de finalizar vendas."}</p><button type="button" className="ghost-button" onClick={onCash}><WalletCards size={16}/> Gerenciar caixa</button></div>
   </section>
  </aside>
 </section>;
}
