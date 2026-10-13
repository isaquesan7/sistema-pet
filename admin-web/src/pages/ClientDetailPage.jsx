/** Client details with the complete stored profile and related active pets. */
import {useState} from "react";
import {useParams,useNavigate} from "react-router-dom";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {ArrowLeft,Edit3,Plus,PawPrint,UserRound} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import {formatDocument,formatPhone} from "../lib/formatters.js";
import {useAuth} from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import "../clients.css";
export default function ClientDetailPage(){
 const {id}=useParams(),navigate=useNavigate(),qc=useQueryClient();
 const {hasPermission}=useAuth();
 const [petOpen,setPetOpen]=useState(false),[petError,setPetError]=useState(""),[pet,setPet]=useState({nome:"",especieId:"",racaId:"",sexo:"NAO_INFORMADO",dataNascimento:"",cor:"",observacoes:""});
 const [tab,setTab]=useState("dados");
 const query=useQuery({queryKey:["client-detail",id],queryFn:async()=>(await api.get(`/clientes/${id}`)).data.cliente});
 const related=useQuery({queryKey:["client-related",id],enabled:tab!=="dados",queryFn:async()=>(await api.get(`/clientes/${id}/relacionados`)).data});
 const species=useQuery({queryKey:["species"],queryFn:async()=>(await api.get("/pets/catalogos/especies")).data.dados||[]});
 const breeds=useQuery({queryKey:["breeds",pet.especieId],enabled:Boolean(pet.especieId),queryFn:async()=>(await api.get("/pets/catalogos/racas",{params:{especieId:pet.especieId}})).data.dados||[]});
 const createPet=useMutation({mutationFn:async()=>api.post("/pets",{clienteId:id,nome:pet.nome.trim(),especieId:pet.especieId,racaId:pet.racaId||null,sexo:pet.sexo,dataNascimento:pet.dataNascimento||null,cor:pet.cor||null,observacoes:pet.observacoes||null}),onSuccess:async()=>{setPetOpen(false);await qc.invalidateQueries({queryKey:["client-detail",id]});await qc.invalidateQueries({queryKey:["pets"]});await qc.invalidateQueries({queryKey:["clients"]});},onError:e=>setPetError(getApiErrorMessage(e))});
 const c=query.data;
 return <div className="page-stack pv-client-details">
  <button type="button" className="ghost-button pv-back" onClick={()=>navigate("/clientes")}><ArrowLeft size={18}/> Voltar para clientes</button>
  {query.isError?<div className="alert alert--error">{getApiErrorMessage(query.error)}</div>:query.isLoading?<div className="loading-state">Carregando informações do cliente...</div>:<>
  <section className="pv-detail-head"><div><span className="page-kicker">Ficha do tutor</span><h1><UserRound size={26}/>{c.nome}</h1><p>{c.ativo?"Cliente ativo":"Cliente inativo"} · cadastrado em {new Date(c.createdAt).toLocaleDateString("pt-BR")}</p></div><button type="button" className="primary-button" onClick={()=>navigate("/clientes",{state:{editClientId:id}})}><Edit3 size={18}/> Editar cliente</button></section>
  <div className="pv-detail-tabs" role="tablist" aria-label="Informações do cliente">{[["dados","Dados pessoais"],["financeiro","Histórico financeiro"],["agenda","Agendamentos"],["orcamentos","Orçamentos"],["credito","Crédito do cliente"]].map(([key,label])=><button type="button" role="tab" aria-selected={tab===key} key={key} className={tab===key?"selected":""} onClick={()=>setTab(key)}>{label}</button>)}</div>
  {tab==="dados"?<div className="pv-detail-columns"><section className="panel pv-detail-panel"><h2>Informações do tutor</h2><dl>{[["Nome",c.nome],["Documento",formatDocument(c.cpfCnpj)],["Data de nascimento",c.dataNascimento?new Date(c.dataNascimento).toLocaleDateString("pt-BR"):"—"],["WhatsApp",formatPhone(c.whatsapp)],["Telefone",formatPhone(c.telefone)],["E-mail",c.email],["Endereço",[c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.estado].filter(Boolean).join(", ")],["CEP",c.cep],["Observações",c.observacoes]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value||"Não informado"}</dd></div>)}</dl></section>
   <section className="panel pv-detail-panel"><div className="pv-detail-pets-head"><h2>Pets do cliente</h2><button type="button" className="ghost-button" disabled={!hasPermission("pets.criar")} onClick={()=>setPetOpen(true)}><Plus size={17}/> Novo pet</button></div>{c.pets?.length?<div className="pv-detail-pets">{c.pets.map(p=><div key={p.id}><PawPrint size={21}/><strong>{p.nome}</strong><small>{p.especie?.nome||"Espécie não informada"} · {p.raca?.nome||"Sem raça informada"}</small></div>)}</div>:<p className="pv-empty">Nenhum pet cadastrado para este tutor.</p>}</section></div>:<section className="panel pv-detail-panel"><h2>{({financeiro:"Histórico financeiro",agenda:"Agendamentos",orcamentos:"Orçamentos",credito:"Crédito do cliente"})[tab]}</h2>
   {related.isLoading?<p>Carregando registros...</p>:related.isError?<div className="alert alert--error">{getApiErrorMessage(related.error)}</div>:tab==="financeiro"&&!related.data?.permissoes?.financeiro?<p className="pv-empty">Seu perfil não tem acesso ao histórico financeiro.</p>:tab==="financeiro"?<div className="pv-detail-ledger">{(related.data?.dados?.vendas||[]).map(v=><div key={v.id}><strong>Venda #{v.numero}</strong><span>{new Date(v.createdAt).toLocaleDateString("pt-BR")} · {v.status}</span><strong>{formatCurrency(v.valorTotal)}</strong><small>Pago: {formatCurrency(v.valorPago)}</small></div>)}{!related.data?.dados?.vendas?.length&&<p className="pv-empty">Nenhuma venda vinculada ao cliente.</p>}</div>:tab==="agenda"?<div className="pv-detail-ledger">{(related.data?.dados?.agendamentos||[]).map(a=><div key={a.id}><strong>{a.pet?.nome||"Pet"}</strong><span>{new Date(a.inicio).toLocaleString("pt-BR")}</span><strong>{a.status}</strong></div>)}{!related.data?.dados?.agendamentos?.length&&<p className="pv-empty">Nenhum agendamento de banho e tosa vinculado ao cliente.</p>}</div>:tab==="credito"&&!related.data?.permissoes?.financeiro?<p className="pv-empty">Acesso financeiro necessário.</p>:tab==="credito"?<div className="pv-detail-ledger">{(related.data?.dados?.titulos||[]).filter(t=>t.tipo==="RECEBER").map(t=><div key={t.id}><strong>{t.descricao}</strong><span>{t.status}</span><strong>{formatCurrency(t.valorOriginal-t.valorPago)} em aberto</strong></div>)}<p className="pv-empty">Esta lista apresenta títulos a receber, não uma carteira de crédito pré-pago.</p></div>:<p className="pv-empty">Ainda não há módulo de orçamentos integrado ao cadastro do cliente.</p>}
  </section>}
  </>}
  <Modal drawer open={petOpen} title="Cadastrar novo pet" subtitle={c?.nome||"Tutor selecionado"} onClose={()=>!createPet.isPending&&setPetOpen(false)} footer={<><button className="ghost-button" onClick={()=>setPetOpen(false)}>Cancelar</button><button type="submit" form="pv-new-pet" className="primary-button" disabled={createPet.isPending}>{createPet.isPending?"Salvando...":"Cadastrar pet"}</button></>}>
   <form id="pv-new-pet" className="pv-pet-form" onSubmit={e=>{e.preventDefault();setPetError("");createPet.mutate();}}>{petError&&<div className="alert alert--error">{petError}</div>}
    <label>Nome do pet *<input className="form-control" required value={pet.nome} onChange={e=>setPet(x=>({...x,nome:e.target.value}))}/></label>
    <label>Espécie *<select className="form-control" required value={pet.especieId} onChange={e=>setPet(x=>({...x,especieId:e.target.value,racaId:""}))}><option value="">Selecione</option>{(species.data||[]).map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
    <label>Raça<select className="form-control" value={pet.racaId} onChange={e=>setPet(x=>({...x,racaId:e.target.value}))}><option value="">Não informada</option>{(breeds.data||[]).map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
    <label>Sexo<select className="form-control" value={pet.sexo} onChange={e=>setPet(x=>({...x,sexo:e.target.value}))}><option value="NAO_INFORMADO">Não informado</option><option value="MACHO">Macho</option><option value="FEMEA">Fêmea</option></select></label>
    <label>Data de nascimento<input className="form-control" type="date" value={pet.dataNascimento} onChange={e=>setPet(x=>({...x,dataNascimento:e.target.value}))}/></label>
    <label>Cor ou pelagem<input className="form-control" value={pet.cor} onChange={e=>setPet(x=>({...x,cor:e.target.value}))}/></label>
    <label>Observações<textarea className="form-control" rows={4} value={pet.observacoes} onChange={e=>setPet(x=>({...x,observacoes:e.target.value}))}/></label>
   </form>
  </Modal>
 </div>;
}
