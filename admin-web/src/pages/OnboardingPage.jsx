import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronLeft, ChevronRight, Eye, EyeOff, LoaderCircle, PawPrint, ShieldCheck, Sparkles } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatCurrency } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";

const moduleLabels = {
  PDV: "PDV", ESTOQUE: "Estoque", CONSULTORIO: "Consultório", BANHO_TOSA: "Banho e Tosa",
  FINANCEIRO: "Financeiro", PORTAL_CLIENTE: "Portal do cliente", PONTO: "Ponto", FISCAL: "Fiscal", RELATORIOS: "Relatórios",
};

function digits(value) { return String(value || "").replace(/\D/g, ""); }
function formatCnpjInput(value) {
  const d = digits(value).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

export default function OnboardingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({
    planoSlug: "", ciclo: "MENSAL",
    organizacaoNome: "", organizacaoWhatsapp: "",
    empresaNome: "", razaoSocial: "", cnpj: "", tipo: "LOJA_CONSULTORIO", empresaTelefone: "", empresaEmail: "",
    adminNome: "", adminEmail: "", adminTelefone: "", senha: "",
  });

  const plansQuery = useQuery({
    queryKey: ["saas-public-plans"],
    queryFn: async () => (await api.get("/saas/publico/planos")).data.dados || [],
    staleTime: 300000,
  });
  const plans = plansQuery.data || [];
  const selectedPlan = useMemo(() => plans.find((p) => p.slug === form.planoSlug) || plans.find((p) => p.destaque) || plans[0], [plans, form.planoSlug]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function set(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function next() {
    setError("");
    if (step === 1 && !selectedPlan) return setError("Selecione um plano para continuar.");
    if (step === 2 && (!form.organizacaoNome.trim() || !form.empresaNome.trim() || !form.razaoSocial.trim() || digits(form.cnpj).length !== 14)) return setError("Preencha os dados da organização e um CNPJ com 14 dígitos.");
    setStep((value) => Math.min(3, value + 1));
  }

  async function submit(event) {
    event.preventDefault(); setError("");
    if (form.senha.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    setLoading(true);
    try {
      const payload = {
        planoSlug: selectedPlan.slug,
        ciclo: form.ciclo,
        organizacao: { nome: form.organizacaoNome, whatsapp: form.organizacaoWhatsapp || null },
        empresa: { nomeFantasia: form.empresaNome, razaoSocial: form.razaoSocial, cnpj: digits(form.cnpj), tipo: form.tipo, telefone: form.empresaTelefone || null, email: form.empresaEmail || null },
        administrador: { nome: form.adminNome, email: form.adminEmail, telefone: form.adminTelefone || null, senha: form.senha },
      };
      const { data } = await api.post("/saas/onboarding", payload);
      setDone(data.dados);
    } catch (e) { setError(getApiErrorMessage(e)); }
    finally { setLoading(false); }
  }

  if (done) {
    return <div className="onboarding-page"><div className="onboarding-success">
      <span className="onboarding-success__icon"><Check size={30}/></span>
      <BrandMark />
      <h1>Sua operação já está no PetRise.</h1>
      <p><strong>{done.organizacao.nome}</strong> foi criada no plano <strong>{done.plano.nome}</strong>{done.assinatura.trialFimEm ? " com período de teste ativo." : "."}</p>
      <div className="onboarding-success__summary"><span>Administrador</span><strong>{done.administrador.email}</strong><span>Primeira empresa</span><strong>{done.empresa.nomeFantasia}</strong></div>
      <button className="primary-button primary-button--large" type="button" onClick={() => navigate("/login", { replace: true })}>Entrar no PetRise</button>
    </div></div>;
  }

  return <div className="onboarding-page">
    <header className="onboarding-header"><BrandMark/><Link to="/login" className="ghost-button">Já tenho conta</Link></header>
    <main className="onboarding-shell">
      <section className="onboarding-copy"><span className="eyebrow-pill">Comece no seu ritmo</span><h1>Seu pet shop pronto para crescer com o PetRise.</h1><p>Crie sua organização, primeiro CNPJ e administrador em poucos minutos. Seus dados já nascem isolados por tenant.</p><div className="onboarding-trust"><span><ShieldCheck size={18}/> Ambiente multiempresa</span><span><Sparkles size={18}/> Trial automático</span><span><PawPrint size={18}/> Sem dados de demonstração misturados</span></div></section>
      <section className="onboarding-card">
        <div className="onboarding-progress">{[1,2,3].map((n) => <span key={n} className={step >= n ? "is-active" : ""}>{n}<small>{n===1?"Plano":n===2?"Empresa":"Acesso"}</small></span>)}</div>
        {error && <div className="alert alert--error">{error}</div>}
        {step === 1 && <div className="onboarding-step"><div className="section-kicker">Plano</div><h2>Escolha como quer começar</h2><div className="onboarding-cycle"><button type="button" className={form.ciclo === "MENSAL" ? "is-active" : ""} onClick={() => set("ciclo","MENSAL")}>Mensal</button><button type="button" className={form.ciclo === "ANUAL" ? "is-active" : ""} onClick={() => set("ciclo","ANUAL")}>Anual</button></div><div className="onboarding-plans">{plansQuery.isLoading ? <div className="mini-empty"><LoaderCircle className="spin" size={22}/> Carregando planos...</div> : plans.map((plan) => <button type="button" key={plan.id} className={`onboarding-plan ${selectedPlan?.id === plan.id ? "is-selected" : ""}`} onClick={() => set("planoSlug", plan.slug)}><span>{plan.destaque ? "Mais escolhido" : "Plano"}</span><strong>{plan.nome}</strong><em>{formatCurrency(form.ciclo === "ANUAL" ? plan.precoAnual : plan.precoMensal)}<small>/{form.ciclo === "ANUAL" ? "ano" : "mês"}</small></em><p>{plan.descricao}</p><div>{plan.modulos.slice(0,6).map((m) => <small key={m}><Check size={12}/>{moduleLabels[m] || m}</small>)}</div><footer>{plan.trialDias ? `${plan.trialDias} dias para testar` : "Sem trial"}</footer></button>)}</div></div>}
        {step === 2 && <div className="onboarding-step"><div className="section-kicker">Organização</div><h2>Conte-nos sobre sua empresa</h2><div className="form-grid form-grid--2"><label className="field"><span>Nome da organização</span><input value={form.organizacaoNome} onChange={(e)=>set("organizacaoNome",e.target.value)} placeholder="Ex.: Pet King"/></label><label className="field"><span>WhatsApp</span><input value={form.organizacaoWhatsapp} onChange={(e)=>set("organizacaoWhatsapp",e.target.value)} placeholder="(71) 99999-9999"/></label><label className="field"><span>Nome fantasia do primeiro CNPJ</span><input value={form.empresaNome} onChange={(e)=>set("empresaNome",e.target.value)} placeholder="Pet King Loja"/></label><label className="field"><span>Razão social</span><input value={form.razaoSocial} onChange={(e)=>set("razaoSocial",e.target.value)} /></label><label className="field"><span>CNPJ</span><input value={form.cnpj} onChange={(e)=>set("cnpj",formatCnpjInput(e.target.value))} placeholder="00.000.000/0000-00"/></label><label className="field"><span>Tipo da empresa</span><select value={form.tipo} onChange={(e)=>set("tipo",e.target.value)}><option value="LOJA_CONSULTORIO">Loja + Consultório</option><option value="BANHO_TOSA">Banho e Tosa</option><option value="OUTRA">Outra operação</option></select></label><label className="field"><span>Telefone</span><input value={form.empresaTelefone} onChange={(e)=>set("empresaTelefone",e.target.value)}/></label><label className="field"><span>E-mail da empresa</span><input type="email" value={form.empresaEmail} onChange={(e)=>set("empresaEmail",e.target.value)}/></label></div></div>}
        {step === 3 && <form className="onboarding-step" onSubmit={submit}><div className="section-kicker">Administrador</div><h2>Crie seu acesso principal</h2><div className="form-grid form-grid--2"><label className="field"><span>Seu nome</span><input required value={form.adminNome} onChange={(e)=>set("adminNome",e.target.value)}/></label><label className="field"><span>Telefone</span><input value={form.adminTelefone} onChange={(e)=>set("adminTelefone",e.target.value)}/></label><label className="field field--span-2"><span>E-mail de acesso</span><input type="email" required value={form.adminEmail} onChange={(e)=>set("adminEmail",e.target.value)} placeholder="voce@empresa.com.br"/></label><label className="field field--span-2"><span>Senha</span><div className="input-with-icon"><input type={showPassword?"text":"password"} required minLength={8} value={form.senha} onChange={(e)=>set("senha",e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small>Mínimo de 8 caracteres.</small></label></div><div className="onboarding-review"><Building2 size={20}/><div><span>{form.organizacaoNome}</span><strong>{selectedPlan?.nome} · {form.ciclo === "ANUAL" ? "Anual" : "Mensal"}</strong><small>{selectedPlan?.trialDias ? `Você começa com ${selectedPlan.trialDias} dias de teste.` : "Assinatura ativa após contratação."}</small></div></div><button className="primary-button primary-button--large" type="submit" disabled={loading}>{loading ? "Criando sua conta..." : "Criar minha conta PetRise"}</button></form>}
        <footer className="onboarding-actions">{step > 1 ? <button className="ghost-button" type="button" onClick={()=>setStep(s=>s-1)}><ChevronLeft size={16}/>Voltar</button> : <span/>}{step < 3 ? <button className="primary-button" type="button" onClick={next}>Continuar<ChevronRight size={16}/></button> : null}</footer>
      </section>
    </main>
  </div>;
}
