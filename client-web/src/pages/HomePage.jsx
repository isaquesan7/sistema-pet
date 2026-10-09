import { useQuery } from "@tanstack/react-query";
import { CalendarDays, HeartPulse, PawPrint, Scissors } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useClientAuth } from "../context/ClientAuthContext.jsx";

function fmt(date){return date?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(date)):"—";}
export default function HomePage(){
 const {account}=useClientAuth();
 const pets=useQuery({queryKey:["portal-pets"],queryFn:async()=> (await api.get("/portal/pets")).data.dados});
 const appts=useQuery({queryKey:["portal-agendamentos"],queryFn:async()=> (await api.get("/portal/agendamentos")).data});
 const next=[...(appts.data?.consultorio||[]).map(x=>({type:"Consulta",date:x.agendadoPara,pet:x.pet?.nome,status:x.status})),...(appts.data?.banhoTosa||[]).map(x=>({type:"Banho e Tosa",date:x.inicio,pet:x.pet?.nome,status:x.status}))].filter(x=>new Date(x.date)>=new Date()&&!['CANCELADO','FALTOU'].includes(x.status)).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,3);
 return <div className="page-stack"><section className="hero-card"><div><p className="eyebrow">BEM-VINDO AO PETRISE</p><h1>Olá, {account?.cliente?.nome?.split(" ")[0]} 👋</h1><p>Seu espaço para acompanhar e agendar os cuidados dos seus pets.</p></div><PawPrint size={54}/></section>
 <div className="quick-grid"><Link to="/agendar?tipo=CONSULTORIO"><HeartPulse/><div><b>Consultório</b><span>Agendar atendimento</span></div></Link><Link to="/agendar?tipo=BANHO_TOSA"><Scissors/><div><b>Banho e Tosa</b><span>Escolher horário</span></div></Link><Link to="/pets"><PawPrint/><div><b>Meus pets</b><span>{pets.data?.length||0} cadastrados</span></div></Link><Link to="/agendamentos"><CalendarDays/><div><b>Minha agenda</b><span>Ver todos</span></div></Link></div>
 <section className="panel"><div className="section-title"><div><p className="eyebrow">PRÓXIMOS</p><h2>Agendamentos</h2></div><Link to="/agendamentos">Ver todos</Link></div>{next.length? <div className="appointment-list">{next.map((x,i)=><div className="appointment-card" key={i}><div className="date-badge">{new Date(x.date).getDate()}<small>{new Date(x.date).toLocaleString('pt-BR',{month:'short'})}</small></div><div><b>{x.type}</b><span>{x.pet} • {fmt(x.date)}</span></div><em>{x.status.replaceAll('_',' ')}</em></div>)}</div>:<div className="empty-state">Você ainda não tem próximos agendamentos.</div>}</section></div>;
}
