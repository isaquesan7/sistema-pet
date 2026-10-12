/** PointVet 18.1 — protected read-only platform organization overview. */
import {useQuery} from "@tanstack/react-query";
import {Building2,UsersRound,PawPrint,ContactRound} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
const limits=[["empresas","limiteEmpresas","Empresas"],["usuarios","limiteUsuarios","Usuários"],["clientes","limiteClientes","Clientes"],["pets","limitePets","Pets"],["funcionarios","limiteFuncionarios","Funcionários"]];
export default function OrganizationDetailPage({id,onClose}){
 const q=useQuery({queryKey:["platform-organization-detail",id],enabled:!!id,queryFn:async()=>(await api.get(`/saas/plataforma/organizacoes/${encodeURIComponent(id)}/detalhes`)).data.dados});
 const org=q.data;
 return <section className="panel">
  <div className="panel__heading"><div><span>Visão consolidada · somente leitura</span><h2>{org?.configuracao?.nomeExibicao||org?.nome||"Detalhes da organização"}</h2></div><button className="ghost-button" type="button" onClick={onClose}>Voltar à lista</button></div>
  {q.isLoading&&<p>Carregando indicadores...</p>}
  {q.isError&&<div className="alert alert--error">{getApiErrorMessage(q.error)}</div>}
  {org&&<div className="page-stack">
   <p><strong>Identificador:</strong> {org.slug} · <strong>Status:</strong> {org.ativo?"Ativa":"Inativa"} · <strong>Plano:</strong> {org.assinaturaSaaS?.plano?.nome||"Não contratado"} · <strong>Assinatura:</strong> {org.assinaturaSaaS?.status||"Ausente"} · <strong>Ciclo:</strong> {org.assinaturaSaaS?.ciclo||"—"}</p>
   <section className="platform-metrics">{[[Building2,"Empresas",org.metricas.empresas],[UsersRound,"Usuários",org.metricas.usuarios],[ContactRound,"Clientes",org.metricas.clientes],[PawPrint,"Pets",org.metricas.pets]].map(([Icon,label,value])=><article className="platform-metric" key={label}><span><Icon size={20}/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>
   <h3>Consumo do plano</h3>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Recurso</th><th>Em uso</th><th>Limite</th><th>Ocupação</th></tr></thead><tbody>{limits.map(([key,limit,label])=>{const count=org.metricas[key];const max=org.assinaturaSaaS?.plano?.[limit];return <tr key={key}><td>{label}</td><td>{count}</td><td>{max==null?"Sem limite definido":max}</td><td>{max>0?`${Math.round(count/max*100)}%`:"—"}</td></tr>})}</tbody></table></div>
   <p>Usuários com vínculo ativo: <strong>{org.metricas.usuariosAtivos}</strong>. Contagens incluem registros ativos e inativos, exceto quando indicado.</p>
   <h3>Empresas vinculadas</h3>
   <div className="table-scroll"><table className="data-table"><thead><tr><th>Empresa</th><th>Localidade</th><th>Situação</th></tr></thead><tbody>{org.empresas.map(e=><tr key={e.id}><td>{e.nomeFantasia}</td><td>{[e.cidade,e.estado].filter(Boolean).join(" / ")||"—"}</td><td>{e.ativo?"Ativa":"Inativa"}</td></tr>)}{!org.empresas.length&&<tr><td colSpan="3">Nenhuma empresa vinculada.</td></tr>}</tbody></table></div>
   <h3>Módulos da organização</h3>
   <div className="platform-plan-modules">{org.modulos.length?org.modulos.map(m=><span key={m.modulo}>{m.modulo.replaceAll("_"," ")} — {m.habilitado&&m.contratado?"Habilitado":"Não habilitado"}</span>):<p>Nenhuma configuração de módulo encontrada.</p>}</div>
  </div>}
 </section>;
}
