import "../dashboard.css";
/**
 * PointVet Dashboard V2 — business overview from the existing permission-scoped
 * reports endpoint. Never substitutes missing data with invented metrics.
 */
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ArrowDownRight,ArrowUpRight,CalendarDays,Printer,RefreshCw,TrendingUp,Warehouse} from "lucide-react";
import api from "../lib/api.js";
import {useAuth} from "../context/AuthContext.jsx";
import {formatCurrency} from "../lib/formatters.js";

const initialMonth=()=>new Date().toLocaleDateString("sv-SE",{year:"numeric",month:"2-digit"});
function period(month){const [year,m]=month.split("-").map(Number);const last=new Date(year,m,0).getDate();return {dataInicio:`${month}-01`,dataFim:`${month}-${String(last).padStart(2,"0")}`};}
function money(value){return formatCurrency(Number(value)||0);}
function greeting(){const hour=new Date().getHours();return hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";}
const palette=["#6454d6","#14a78a","#e5a33a","#3979df","#c964a2","#64748b"];
function HorizontalBars({rows,labelKey,valueKey="valor",empty="Nenhum registro neste período"}){
 const list=(rows||[]).slice(0,8),max=Math.max(...list.map(x=>Number(x[valueKey])||0),0);
 if(!list.length)return <p className="pv-empty">{empty}</p>;
 return <div className="pv-bars">{list.map((item,i)=><div className="pv-bar-row" key={String(item[labelKey])+"-"+i}><div className="pv-bar-label"><strong>{String(item[labelKey]||"Não informado").replaceAll("_"," ")}</strong><span>{money(item[valueKey])}</span></div><div className="pv-bar-track"><span style={{width:`${max?100*(Number(item[valueKey])||0)/max:0}%`,background:palette[i%palette.length]}}/></div></div>)}</div>;
}
function Trend({rows}){
 const series=(rows||[]).map(row=>({x:row.data,realizadas:Number(row.realizadas)||0,canceladas:Number(row.canceladas)||0}));
 const max=Math.max(1,...series.flatMap(x=>[x.realizadas,x.canceladas]));
 return <div className="pv-trend">{series.length?<><div className="pv-trend-legend"><span><i style={{background:"#6454d6"}}/> Finalizadas</span><span><i style={{background:"#dc555b"}}/> Canceladas/estornadas</span></div><div className="pv-trend-bars" role="img" aria-label="Comparação diária de vendas finalizadas e canceladas">{series.map(d=><div className="pv-trend-column" key={d.x} title={`${d.x} · Finalizadas: ${d.realizadas} · Canceladas: ${d.canceladas}`}><div style={{height:`${d.realizadas/max*100}%`,background:"#6454d6"}}/><div style={{height:`${d.canceladas/max*100}%`,background:"#dc555b"}}/></div>)}</div><div className="pv-trend-axis"><span>{series[0].x.slice(8)}</span><span>Dia do mês</span><span>{series.at(-1).x.slice(8)}</span></div></>:<p className="pv-empty">Sem vendas finalizadas ou canceladas neste período.</p>}</div>;
}
function MainCard({title,value,detail,tone,icon:Icon}){return <article className={`pv-kpi pv-kpi--${tone}`}><div className="pv-kpi-heading"><span>{title}</span><Icon size={23}/></div><strong>{value}</strong><small>{detail}</small></article>;}
function InlineStat({title,value,detail}){return <article className="pv-inline-stat"><span>{title}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</article>;}
export default function DashboardPage(){
 const {user,selectedCompany,selectedOrganization,hasPermission}=useAuth();
 const canReports=hasPermission("relatorios.visualizar")&&(selectedOrganization?.modulos||[]).includes("RELATORIOS");
 const [draftMonth,setDraftMonth]=useState(initialMonth);
 const [month,setMonth]=useState(initialMonth);
 const query=useQuery({queryKey:["dashboard-v2",selectedCompany?.id,month],enabled:canReports,queryFn:async()=>(await api.get("/relatorios/painel",{params:{escopo:"empresa",...period(month)}})).data.dados,staleTime:60000});
 const r=query.data,v=r?.vendas,f=r?.financeiro,e=r?.estoque;
 const display=(n,converter=money)=>query.isLoading?"Carregando...":query.isError||!r?"—":converter(n);
 function printReport(){window.print();}
 return <div className="pv-dashboard page-stack">
  <section className="pv-dashboard-head">
   <div><span className="page-kicker">Visão geral · {selectedCompany?.nomeFantasia||"Empresa"}</span><h1>{greeting()}, {(user?.nomeExibicao||user?.nome||"usuário").split(" ")[0]}!</h1><p>Veja os resultados da sua operação com informações reais e organizadas.</p></div>
   <div className="pv-month-controls"><label htmlFor="pv-month">Mês de fechamento</label><div><input id="pv-month" type="month" value={draftMonth} onChange={e=>setDraftMonth(e.target.value)}/><button className="primary-button" disabled={!draftMonth} onClick={()=>setMonth(draftMonth)}><CalendarDays size={17}/> Buscar</button><button className="ghost-button" disabled={!r} onClick={printReport}><Printer size={17}/> Imprimir</button></div></div>
  </section>
  {canReports?<>{query.isError&&<div className="alert alert--error" role="alert">Não foi possível carregar o painel deste mês. Tente novamente.</div>}
   {r?.avisos?.length>0&&<div className="alert alert--warning" role="status">Alguns indicadores não puderam ser calculados; consulte Relatórios para detalhes.</div>}
   <section className="pv-block"><div className="pv-section-head"><div><span>Financeiro</span><h2>Resumo financeiro</h2></div><span>{month.split("-").reverse().join("/")}</span></div>
    <div className="pv-primary-grid">
     <MainCard title="Vendas fechadas" value={display(v?.faturamento)} detail="Faturamento de vendas finalizadas" tone="green" icon={TrendingUp}/>
     <MainCard title="Contas a receber" value={display(f?.receberAberto)} detail="Saldo em aberto na data da consulta" tone="blue" icon={ArrowDownRight}/>
     <MainCard title="Contas a pagar" value={display(f?.pagarAberto)} detail="Saldo em aberto na data da consulta" tone="red" icon={ArrowUpRight}/>
    </div>
   </section>
   <section className="pv-block"><div className="pv-section-head"><div><span>Comercial</span><h2>Resumo das vendas do mês</h2></div><Link to="/relatorios">Ver relatórios completos</Link></div>
    <div className="pv-inline-grid">
     <InlineStat title="Vendas finalizadas" value={display(v?.vendas,n=>Number(n||0).toLocaleString("pt-BR"))}/>
     <InlineStat title="Faturamento finalizado" value={display(v?.faturamento)}/>
     <InlineStat title="Recebimentos registrados" value={display(f?.recebimentos)}/>
     <InlineStat title="Vendas canceladas" value={display(v?.canceladas,n=>Number(n||0).toLocaleString("pt-BR"))} detail="Canceladas ou estornadas no período"/>
    </div>
   </section>
   <div className="pv-chart-grid">
    <section className="panel pv-report-panel"><div className="pv-section-head"><div><span>Composição</span><h2>Vendas por categoria</h2></div></div><HorizontalBars rows={v?.categorias} labelKey="categoria"/></section>
    <section className="panel pv-report-panel"><div className="pv-section-head"><div><span>Recebimentos</span><h2>Meios de pagamento</h2></div></div><HorizontalBars rows={v?.pagamentos} labelKey="forma" empty="Nenhum pagamento aprovado registrado."/></section>
   </div>
   <section className="panel pv-report-panel"><div className="pv-section-head"><div><span>Evolução</span><h2>Atividade mensal: realizadas × canceladas</h2></div><span>Quantidade de vendas por dia</span></div><Trend rows={v?.atividadeDiaria}/></section>
   <section className="pv-block"><div className="pv-section-head"><div><span>Gestão</span><h2>Indicadores complementares</h2></div></div>
    <div className="pv-inline-grid">
     <InlineStat title="Ticket médio" value={display(v?.ticketMedio)}/>
     <InlineStat title="Média de itens por venda" value={display(v?.vendas?Number(v?.unidades||0)/v.vendas:0,n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:2}))}/>
     <InlineStat title="Resultado financeiro" value={display(f?.resultado)} detail="Recebimentos − pagamentos no período"/>
     <InlineStat title="Estoque abaixo do mínimo" value={display(e?.itensEstoqueBaixo,n=>Number(n||0).toLocaleString("pt-BR"))} detail="Alertas atuais"/>
     <InlineStat title="Contas a receber vencidas" value={display(f?.receberVencido)}/>
     <InlineStat title="Custo da mercadoria vendida" value="Não disponível" detail="Aguardando cálculo de CMV na API"/>
    </div>
   </section>
   <p className="pv-dashboard-note">Vendas e recebimentos utilizam as datas do período selecionado. Contas em aberto e alertas de estoque representam a posição atual, não um histórico do mês selecionado.</p>
  </>:<section className="panel pv-report-panel"><Warehouse size={26}/><h2>Visão geral da empresa</h2><p>Os indicadores financeiros deste painel exigem o módulo de Relatórios e a permissão de visualização. Seus demais módulos continuam acessíveis pelo menu.</p></section>}
 </div>;
}
