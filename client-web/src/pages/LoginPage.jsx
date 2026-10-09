import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PawPrint } from "lucide-react";
import { useClientAuth } from "../context/ClientAuthContext.jsx";

export default function LoginPage() {
  const { session, login, organization, loadingConfig } = useClientAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: "", senha: "", manterConectado: true });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (session) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await login(form.login, form.senha, form.manterConectado); navigate("/"); }
    catch (err) { setError(err.response?.data?.message || "Não foi possível entrar."); }
    finally { setBusy(false); }
  }
  const name = organization?.configuracao?.nomeExibicao || organization?.nome || "seu pet shop";
  return <div className="auth-screen"><section className="auth-card">
    <div className="portal-logo"><span><PawPrint/></span><b>PetRise</b></div>
    <p className="eyebrow">PORTAL DO CLIENTE</p><h1>Cuide do seu pet de onde estiver.</h1>
    <p className="muted">{loadingConfig ? "Carregando..." : `Acesse ${name}, acompanhe seus pets e faça agendamentos.`}</p>
    {error && <div className="error-box">{error}</div>}
    <form onSubmit={submit} className="stack-form">
      <label>E-mail ou telefone<input value={form.login} onChange={(e)=>setForm({...form,login:e.target.value})} required /></label>
      <label>Senha<input type="password" value={form.senha} onChange={(e)=>setForm({...form,senha:e.target.value})} required /></label>
      <label className="check-row"><input type="checkbox" checked={form.manterConectado} onChange={(e)=>setForm({...form,manterConectado:e.target.checked})}/><span>Mantenha-me conectado</span></label>
      <button className="primary-button" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
    </form>
    <p className="auth-switch">Ainda não tem conta? <Link to="/cadastro">Criar minha conta</Link></p>
  </section></div>;
}
