/** M.5.71 — entrada por comandas, inspirada apenas na hierarquia operacional
 * das referencias enviadas; identidade visual, permissoes e contratos PointVet.
 * Este componente nao cobra, nao movimenta caixa, nao cria orcamentos implicitos.
 */
import {useMemo,useState} from "react";
import {ClipboardList,Search,Plus,Store,Eye,WalletCards,ArrowRight,ArrowDownCircle,ArrowUpCircle,CalendarClock} from "lucide-react";
import {formatCurrency,formatDateTime,formatDocument} from "../lib/formatters.js";

const labels={ABERTA:"Aberta",PARCIALMENTE_FECHADA:"Parcialmente fechada",RESERVADA:"Reservada",FECHADA:"Fechada",FINALIZADA:"Finalizada",ESTORNADA:"Estornada",CANCELADA:"Cancelada"};
function today(value){
 if(!value)return false;
 const date=new Date(value);
 return !Number.isNaN(date.valueOf())&&date.toDateString()===new Date().toDateString();
}
export function orderSearchable(order){
 return [order.numero,order.cliente?.nome,order.cliente?.cpfCnpj,
  ...(order.itens||[]).flatMap(i=>[i.pet?.nome,i.descricao,i.empresa?.nomeFantasia])]
  .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
}
export function listOrderRows({commands=[],drafts=[],sales=[],quotes=[],filter="ABERTAS",search="",clientId="",petId=""}){
 const normalized=String(search).trim().toLocaleLowerCase("pt-BR");
 const commandedIds=new Set(commands.map(order=>order.id));
 const rows=[
  ...commands.map(order=>({kind:"COMANDA",order,status:order.status,
   date:(["FECHADA","CANCELADA"].includes(order.status)?order.fechadaEm||order.updatedAt:order.createdAt),number:order.numero,
   client:order.cliente?.nome||"Consumidor não identificado",
   pet:[...new Set((order.itens||[]).map(i=>i.pet?.nome).filter(Boolean))].join(", ")||"—",
   company:[...new Set((order.itens||[]).map(i=>i.empresa?.nomeFantasia).filter(Boolean))].join(" + ")||"Sem itens",
   total:(order.itens||[]).filter(i=>i.status!=="CANCELADO").reduce((sum,i)=>sum+Number(i.valorTotal||0),0),
   searchValue:orderSearchable(order)})),
  ...drafts.map(order=>({kind:"UNIFICADA",order,status:order.status||"ABERTA",
   date:order.createdAt,number:order.numero,client:order.cliente?.nome||"Consumidor não identificado",
   pet:[...new Set((order.itens||[]).map(i=>i.pet?.nome).filter(Boolean))].join(", ")||"—",
   company:"Rascunho inteligente",
   total:(order.itens||[]).filter(i=>i.status==="ATIVO").reduce((s,i)=>s+Number(i.valorTotal||0),0),
   searchValue:orderSearchable(order)})),
  ...quotes.map(order=>({kind:"ORCAMENTO",order,status:order.status,date:order.createdAt,number:order.numero,
   client:order.cliente?.nome||"Consumidor não identificado",pet:"—",company:"Orçamento deste CNPJ",total:Number(order.total||0),
   searchValue:orderSearchable(order)})),
  ...sales.filter(order=>!order.comandaId||!commandedIds.has(order.comandaId)).map(order=>({kind:"VENDA",order,status:order.status,
   date:order.finalizadaEm||order.createdAt,number:order.numero,client:order.cliente?.nome||"Consumidor não identificado",
   pet:"—",company:"Venda do CNPJ",total:Number(order.valorTotal||0),
   searchValue:[order.numero,order.cliente?.nome].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR")}))
 ];
 return rows.filter(row=>{
  const isOpen=["ABERTA","PARCIALMENTE_FECHADA","RESERVADA"].includes(row.status);
  const passes=filter==="ABERTAS"?(isOpen&&row.kind!=="ORCAMENTO"):filter==="FECHADAS"?
   (!isOpen&&row.kind!=="ORCAMENTO"&&today(row.date)):row.kind==="ORCAMENTO";
  if(!passes||normalized&&!row.searchValue.includes(normalized))return false;
  if(clientId&&row.order.cliente?.id!==clientId)return false;
  if(petId&&!(row.order.itens||[]).some(i=>i.petId===petId||i.pet?.id===petId))return false;
  return true;
 }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
}
export default function PdvOrdersHome({
 commands=[],drafts=[],sales=[],quotes=[],clients=[],intelligent=false,openSession,
 companyName="",isLoading=false,creating=false,error="",quotesError="",
 onCreate,onOpenCommand,onOpenDraft,onOpenSale,onOpenQuote,onStartQuote,onCash,onCashAction
}){
 const [view,setView]=useState("ABERTAS");
 const [search,setSearch]=useState("");
 const [filterClient,setFilterClient]=useState("");
 const [filterPet,setFilterPet]=useState("");
 const [clientId,setClientId]=useState("");
 const [petId,setPetId]=useState("");
 const [budget,setBudget]=useState(false);
 const client=clients.find(c=>c.id===clientId);
 const filteredClient=clients.find(c=>c.id===filterClient);
 const allRows=useMemo(()=>listOrderRows({commands,drafts,sales,quotes,filter:view,search,clientId:filterClient,petId:filterPet}),[commands,drafts,sales,quotes,view,search,filterClient,filterPet]);
 const countOpen=useMemo(()=>listOrderRows({commands,drafts,sales,quotes,filter:"ABERTAS"}).length,[commands,drafts,sales,quotes]);
 const countClosed=useMemo(()=>listOrderRows({commands,drafts,sales,quotes,filter:"FECHADAS"}).length,[commands,drafts,sales,quotes]);
 const countQuotes=quotes.length;
 return <section className="pdv-orders-home" aria-label="Central de comandas e ordens">
  <div className="panel pdv-orders-main">
   <div className="pdv-orders-head">
    <div><span>OPERAÇÃO / COMANDAS</span><h2>Ordens e atendimentos</h2><p>Acompanhe suas comandas e continue de onde parou.</p></div>
    <ClipboardList size={22}/>
   </div>
   <div className="pdv-orders-tabs" role="group" aria-label="Filtrar comandas">
    <button type="button" className={view==="ABERTAS"?"active":""} aria-pressed={view==="ABERTAS"} onClick={()=>setView("ABERTAS")}>Em aberto <span>{countOpen}</span></button>
    <button type="button" className={view==="FECHADAS"?"active":""} aria-pressed={view==="FECHADAS"} onClick={()=>setView("FECHADAS")}>Fechadas hoje <span>{countClosed}</span></button>
    <button type="button" className={view==="ORCAMENTOS"?"active":""} aria-pressed={view==="ORCAMENTOS"} onClick={()=>setView("ORCAMENTOS")}>Orçamentos <span>{countQuotes}</span></button>
   </div>
   {view==="ORCAMENTOS"&&quotesError&&<p className="alert alert--error" role="alert">{quotesError}</p>}
   <div className="pdv-orders-filters">
    <label className="search-box pdv-orders-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)}
     aria-label="Buscar comanda por número, tutor, pet ou CPF" placeholder="Buscar ordem, cliente, CPF ou pet..." /></label>
    <div className="pdv-orders-filter-line">
     <label><span>Filtrar por tutor</span><select className="form-control" aria-label="Filtrar por tutor" value={filterClient} onChange={e=>{setFilterClient(e.target.value);setFilterPet("");}}>
       <option value="">Todos os tutores</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
     </select></label>
     <label><span>Filtrar por pet</span><select className="form-control" aria-label="Filtrar por pet" value={filterPet} disabled={!filterClient} onChange={e=>setFilterPet(e.target.value)}>
       <option value="">Todos os pets</option>{(filteredClient?.pets||[]).filter(p=>p.ativo!==false).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
     </select></label>
    </div>
   </div>
   <div className="pdv-orders-list-caption"><span>COMANDA / CLIENTE</span><span>ABERTA EM</span><span>VALOR</span><span>AÇÃO</span></div>
   <div className="pdv-orders-list" aria-live="polite">
    {isLoading?<div className="loading-state">Carregando comandas...</div>:allRows.length?allRows.map(row=><button
     key={row.kind+row.order.id} className="pdv-order-row" type="button" onClick={()=>{
       if(row.kind==="UNIFICADA")onOpenDraft(row.order);
       else if(row.kind==="VENDA")onOpenSale(row.order);
       else if(row.kind==="ORCAMENTO")onOpenQuote(row.order);
       else onOpenCommand(row.order);
     }}>
      <div className="pdv-order-row__number"><strong>#{row.number}</strong><small>{row.kind==="UNIFICADA"?"Inteligente":row.kind==="VENDA"?"Venda":row.kind==="ORCAMENTO"?"Orçamento":"Comanda"}</small></div>
      <div className="pdv-order-row__identity"><strong>{row.client}</strong><small>{row.order.cliente?.cpfCnpj?formatDocument(row.order.cliente.cpfCnpj)+" · ":""}{row.pet!=="—"?row.pet+" · ":""}{row.company}</small></div>
      <div className="pdv-order-row__date"><small>{formatDateTime(row.date)}</small><span className={row.status==="FECHADA"||row.status==="FINALIZADA"?"pdv-order-status is-closed":"pdv-order-status"}>{labels[row.status]||row.status}</span></div>
      <strong className="pdv-order-row__total">{formatCurrency(row.total)}</strong><span className="pdv-order-row__open"><Eye size={15}/> Abrir</span>
     </button>):<div className="pdv-orders-empty"><ClipboardList size={26}/><strong>Nenhuma ordem encontrada</strong><p>{view==="FECHADAS"?"Nenhuma comanda ou venda fechada hoje com estes filtros.":view==="ORCAMENTOS"?"Nenhum orçamento encontrado para os filtros atuais.":"Abra uma nova comanda para começar ou ajuste os filtros."}</p></div>}
   </div>
   <div className="pdv-orders-footnote"><CalendarClock size={14}/> {allRows.length} registro(s) exibido(s) · a API apresenta apenas registros recentes. Filtre por cliente para localizar um atendimento específico.</div>
  </div>
  <aside className="pdv-orders-side">
   <section className="panel pdv-orders-create"><div className="pdv-orders-side-head"><Plus size={17}/><strong>Abrir ordem</strong></div>
    <div className="pdv-orders-side-body">
     <label className="form-field"><span>Tutor (opcional para produtos)</span>
      <select className="form-control" value={clientId} onChange={e=>{setClientId(e.target.value);setPetId("");}}>
       <option value="">Consumidor não identificado</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
      </select></label>
     <label className="form-field"><span>Pet (obrigatório apenas para serviços)</span>
      <select className="form-control" value={petId} onChange={e=>setPetId(e.target.value)} disabled={!clientId}>
       <option value="">Selecionar depois</option>{(client?.pets||[]).filter(p=>p.ativo!==false).map(p=><option value={p.id} key={p.id}>{p.nome}</option>)}
      </select></label>
     <label className="pdv-orders-budget"><input type="checkbox" checked={budget} onChange={e=>setBudget(e.target.checked)}/> Criar orçamento em vez de comanda</label>
     {budget&&<p className="pdv-orders-hint">Orçamentos são criados no perfil do tutor e permanecem separados das vendas. Selecione um tutor para continuar.</p>}
     {error&&<p className="alert alert--error" role="alert">{error}</p>}
     <button className="primary-button" type="button" disabled={creating||(budget&&!clientId)} onClick={()=>
      budget?onStartQuote(clientId):onCreate({clienteId:clientId||null,petId:petId||null})}>
      {budget?<ArrowRight size={16}/>:<Plus size={17}/>}
      {creating?"Abrindo...":budget?"Ir aos orçamentos do tutor":"Abrir nova comanda"}
     </button>
     <small>{intelligent?"Modo Inteligente: os valores continuam separados por empresa.":"Modo por empresa: a venda será registrada somente no CNPJ selecionado."} Serviços exigem tutor e pet válidos.</small>
    </div>
   </section>
   <section className="panel pdv-orders-cash"><div className="pdv-orders-side-head"><Store size={17}/><strong>Caixa · {companyName||"CNPJ selecionado"}</strong></div>
    <div className="pdv-orders-side-body">
     <div className="pdv-orders-cash-status"><span className={openSession?"pdv-order-status is-closed":"pdv-order-status"}>{openSession?"Aberto":"Fechado"}</span><strong>{openSession?.caixa?.nome||"Sem caixa aberto"}</strong></div>
     <p>As operações financeiras são feitas no caixa do CNPJ atual, sem conexão automática com bancos ou maquininhas.</p>
     <div className="pdv-orders-cash-actions">
      <button className="ghost-button" type="button" onClick={onCash}><WalletCards size={15}/> Resumo e caixas</button>
      {openSession&&<button className="ghost-button" type="button" onClick={()=>onCashAction("SUPPLY")}><ArrowDownCircle size={15}/> Suprimento</button>}
      {openSession&&<button className="ghost-button" type="button" onClick={()=>onCashAction("WITHDRAW")}><ArrowUpCircle size={15}/> Sangria</button>}
      {openSession&&<button className="ghost-button pdv-danger" type="button" onClick={()=>onCashAction("CLOSE")}>Fechar caixa</button>}
     </div>
    </div>
   </section>
  </aside>
 </section>;
}
