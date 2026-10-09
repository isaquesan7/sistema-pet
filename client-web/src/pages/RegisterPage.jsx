import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PawPrint } from "lucide-react";
import { useClientAuth } from "../context/ClientAuthContext.jsx";

export default function RegisterPage() {
  const { session, register, organization } = useClientAuth(); const navigate = useNavigate();
  const [form,setForm]=useState({nome:"",email:"",telefone:"",cpfCnpj:"",senha:"",manterConectado:true});
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  if(session) return <Navigate to="/" replace/>;
  async function submit(e){e.preventDefault();setError("");setBusy(true);try{await register(form);navigate("/");}catch(err){setError(err.response?.data?.message||"Não foi possível criar sua conta.");}finally{setBusy(false);}}
  return <div className="auth-screen"><section className="auth-card wide-auth">
    <div className="portal-logo"><span><PawPrint/></span><b>PetRise</b></div><p className="eyebrow">{organization?.configuracao?.nomeExibicao||organization?.nome||"PORTAL DO CLIENTE"}</p><h1>Crie sua conta</h1>
    <p className="muted">Se você já possui cadastro no estabelecimento, o PetRise tentará vinculá-lo automaticamente.</p>{error&&<div className="error-box">{error}</div>}
    <form onSubmit={submit} className="stack-form two-cols">
      <label>Nome completo<input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} required/></label>
      <label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
      <label>Telefone/WhatsApp<input value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/></label>
      <label>CPF/CNPJ<input value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})}/></label>
      <label className="full">Senha<input type="password" minLength="8" value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} required/></label>
      <label className="check-row full"><input type="checkbox" checked={form.manterConectado} onChange={e=>setForm({...form,manterConectado:e.target.checked})}/><span>Mantenha-me conectado</span></label>
      <button className="primary-button full" disabled={busy}>{busy?"Criando...":"Criar conta"}</button>
    </form><p className="auth-switch">Já possui conta? <Link to="/login">Entrar</Link></p>
  </section></div>;
}
