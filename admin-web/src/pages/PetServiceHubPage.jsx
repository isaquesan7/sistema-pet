/**
 * Pet-specific service hub. Always validates tutor/pet relationship before exposing data.
 * The available panels follow the current company type, modules and permissions.
 */
import {useParams,useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {ArrowLeft,CalendarDays,ClipboardList,HeartPulse,PackageCheck,PawPrint,Scissors} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {useAuth} from "../context/AuthContext.jsx";
import "../clients.css";

export default function PetServiceHubPage(){
 const {id,petId,area}=useParams();
 const navigate=useNavigate();
 const {hasPermission,selectedCompany,selectedOrganization}=useAuth();
 const clinical=area==="clinica";
 const allowed=clinical?selectedCompany?.tipo!=="BANHO_TOSA"&&selectedOrganization?.modulos?.includes("CONSULTORIO")&&hasPermission("consultorio.acessar"):selectedCompany?.tipo!=="LOJA_CONSULTORIO"&&selectedOrganization?.modulos?.includes("BANHO_TOSA")&&hasPermission("banho_tosa.acessar");
 const pet=useQuery({queryKey:["pet-hub",petId],enabled:allowed,queryFn:async()=>(await api.get(`/pets/${petId}`)).data.pet});
 const history=useQuery({queryKey:["pet-service-hub",petId,area,selectedCompany?.id],enabled:allowed&&pet.data?.clienteId===id,
  queryFn:async()=>clinical?(await api.get(`/consultorio/pets/${petId}/historico`)).data :(await api.get(`/banho-tosa/pets/${petId}/resumo`)).data});
 const related=useQuery({queryKey:["pet-client-related",id],enabled:allowed&&!clinical&&pet.data?.clienteId===id,queryFn:async()=>(await api.get(`/clientes/${id}/relacionados`)).data});
 const p=pet.data;
 const entries=clinical?history.data?.dados||history.data?.historico||history.data?.atendimentos||[]:[];
 const grooming=history.data?.dados||{};
 const appointments=grooming.agendamentos||[];
 const upcoming=appointments.filter(a=>new Date(a.inicio).getTime()>=Date.now());
 const previous=grooming.ordens||[];
 const isArrayHistory=Array.isArray(entries);
 return <div className="page-stack pv-pet-hub">
  <button className="ghost-button pv-back" onClick={()=>navigate(`/clientes/${id}`)}><ArrowLeft size={17}/> Voltar ao cliente</button>
  {!allowed?<div className="alert alert--error">Esta área não está disponível para o seu estabelecimento ou suas permissões.</div>:pet.isLoading?<p>Carregando pet...</p>:pet.isError?<div className="alert alert--error">{getApiErrorMessage(pet.error)}</div>:p?.clienteId!==id?<div className="alert alert--error">Pet não pertence ao cliente informado.</div>:<>
   <header className="pv-pet-hub-title"><span className="pv-pet-hub-icon"><PawPrint size={30}/></span><div><span className="page-kicker">{clinical?"Área clínica":"Banho e tosa"}</span><h1>{p.nome}</h1><p>{p.especie?.nome||"Espécie não informada"} · {p.raca?.nome||"Raça não informada"} · Tutor: {p.cliente?.nome}</p></div></header>
   <div className="pv-pet-identity-grid"><section className="panel pv-detail-panel"><h2>Informações do pet</h2><dl>{[["Sexo",p.sexo],["Nascimento",p.dataNascimento?new Date(p.dataNascimento).toLocaleDateString("pt-BR"):"Não informado"],["Peso recente",p.pesos?.[0]?.peso?`${p.pesos[0].peso} kg`:"Não informado"],["Microchip",p.microchip],["Alergias",p.alergias],["Doenças preexistentes",p.doencasPreexistentes],["Observações",p.observacoes]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||"Não informado"}</dd></div>)}</dl></section>
    <section className="panel pv-detail-panel"><h2>Atalhos do módulo</h2><p className="pv-empty">Para realizar novos atendimentos ou movimentações, utilize o módulo principal, que aplica as regras de autorização e registro existentes.</p><button className="primary-button" onClick={()=>navigate(clinical?"/consultorio":"/banho-e-tosa")}>{clinical?<HeartPulse size={18}/>:<Scissors size={18}/>} Abrir {clinical?"Consultório":"Banho e Tosa"}</button></section></div>
   {clinical?<section className="panel pv-detail-panel"><h2><ClipboardList size={21}/> Histórico clínico</h2>{history.isLoading?<p>Carregando histórico...</p>:history.isError?<div className="alert alert--error">{getApiErrorMessage(history.error)}</div>:isArrayHistory&&entries.length?<div className="pv-detail-ledger">{entries.map((item,i)=><div key={item.id||i}><strong>{item.status||"Atendimento"}</strong><span>{item.createdAt?new Date(item.createdAt).toLocaleString("pt-BR"):"Data não informada"}</span><span>{item.queixaPrincipal||item.diagnostico||"Ver prontuário no Consultório"}</span></div>)}</div>:<p className="pv-empty">Nenhum atendimento clínico registrado para este pet.</p>}</section>:
    <div className="pv-pet-grooming-sections"><section className="panel pv-detail-panel"><h2><CalendarDays size={21}/> Próximos agendamentos</h2>{related.isLoading?<p>Carregando...</p>:upcoming.length?<div className="pv-detail-ledger">{upcoming.map(a=><div key={a.id}><strong>{new Date(a.inicio).toLocaleString("pt-BR")}</strong><span>{a.status}</span></div>)}</div>:<p className="pv-empty">Nenhum agendamento futuro encontrado.</p>}</section>
    <section className="panel pv-detail-panel"><h2><Scissors size={21}/> Serviços recentes</h2>{previous.length?<div className="pv-detail-ledger">{previous.slice(0,10).map(a=><div key={a.id}><strong>OS #{a.numero} · {new Date(a.entrada).toLocaleString("pt-BR")}</strong><span>{a.status}</span><small>{(a.itens||[]).map(i=>i.itemCatalogo?.nome).filter(Boolean).join(", ")||"Serviço não detalhado"}</small></div>)}</div>:<p className="pv-empty">Nenhuma ordem de serviço encontrada.</p>}</section>
    <section className="panel pv-detail-panel"><h2><PackageCheck size={21}/> Pacotes ativos</h2>{grooming.pacotes?.length?<div className="pv-detail-ledger">{grooming.pacotes.map(pkg=><div key={pkg.id}><strong>{pkg.nome}</strong><span>{pkg.fimValidade?"Até "+new Date(pkg.fimValidade).toLocaleDateString("pt-BR"):"Sem validade definida"}</span><small>{pkg.itens.map(i=>i.nome+": "+(i.total-i.consumida)+" disponível").join(" · ")}</small></div>)}</div>:<p className="pv-empty">Nenhum pacote ativo vinculado a este pet.</p>}</section></div>}
  </>}
 </div>;
}
