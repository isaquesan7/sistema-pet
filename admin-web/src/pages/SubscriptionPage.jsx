import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, CreditCard, Crown, Gauge, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatCurrency, formatDate } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";

const moduleLabels = { PDV:"PDV", ESTOQUE:"Estoque", CONSULTORIO:"Consultório", BANHO_TOSA:"Banho e Tosa", FINANCEIRO:"Financeiro", PORTAL_CLIENTE:"Portal do cliente", PONTO:"Ponto", FISCAL:"Fiscal", RELATORIOS:"Relatórios" };
const statusLabels = { TRIAL:"Período de teste", ATIVA:"Ativa", INADIMPLENTE:"Pagamento pendente", SUSPENSA:"Suspensa", CANCELADA:"Cancelada", PENDENTE:"Pendente", PAGA:"Paga", VENCIDA:"Vencida" };

function LimitCard({ label, data }) {
  const pct = data?.limite ? Math.min(100, Math.round((data.usado / data.limite) * 100)) : 0;
  return <div className="subscription-limit"><div><span>{label}</span><strong>{data?.usado ?? 0}{data?.limite ? ` / ${data.limite}` : " / ∞"}</strong></div><div className="subscription-limit__bar"><span style={{width:`${data?.limite ? pct : 8}%`}}/></div></div>;
}

export default function SubscriptionPage() {
  const { selectedOrganization, refreshSession } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState("MENSAL");
  const subscriptionQuery = useQuery({ queryKey:["saas-subscription", selectedOrganization?.id], queryFn: async()=> (await api.get("/saas/assinatura")).data, retry:false });
  const plansQuery = useQuery({ queryKey:["saas-public-plans"], queryFn: async()=> (await api.get("/saas/publico/planos")).data.dados || [], staleTime:300000 });
  const payload = subscriptionQuery.data || {};
  const assinatura = payload.assinatura;
  const plans = plansQuery.data || [];
  const currentPlan = assinatura?.plano;
  const role = selectedOrganization?.papel;
  const canManage = ["PROPRIETARIO","ADMINISTRADOR"].includes(role);

  const generate = useMutation({ mutationFn: async(planId)=> (await api.post("/saas/assinatura/faturas", { planoId, ciclo })).data.fatura, onSuccess:()=>{ setError(""); qc.invalidateQueries({queryKey:["saas-subscription"]}); }, onError:(e)=>setError(getApiErrorMessage(e)) });
  const simulate = useMutation({ mutationFn: async(id)=>api.post(`/saas/assinatura/faturas/${id}/simular-pagamento`), onSuccess:async()=>{ setError(""); await qc.invalidateQueries({queryKey:["saas-subscription"]}); await refreshSession(); }, onError:(e)=>setError(getApiErrorMessage(e)) });

  const trialDays = useMemo(()=> assinatura?.trialFimEm ? Math.max(0, Math.ceil((new Date(assinatura.trialFimEm)-new Date())/86400000)) : null, [assinatura?.trialFimEm]);
  if (subscriptionQuery.isLoading) return <div className="page-loading"><LoaderCircle className="spin"/>Carregando assinatura...</div>;
  if (subscriptionQuery.error) return <div className="alert alert--error">{getApiErrorMessage(subscriptionQuery.error)}</div>;
  if (!assinatura) return <div className="empty-state"><CreditCard size={30}/><strong>Assinatura não encontrada</strong><p>Contate o suporte PetRise.</p></div>;

  return <div className="page-stack subscription-page">
    <header className="page-heading"><div><span className="section-kicker">PetRise SaaS</span><h1>Plano e assinatura</h1><p>Acompanhe o plano contratado, limites de uso e cobranças da organização.</p></div><span className={`status-pill status-pill--${assinatura.status?.toLowerCase()}`}>{statusLabels[assinatura.status] || assinatura.status}</span></header>
    {error && <div className="alert alert--error">{error}</div>}
    {assinatura.acesso?.bloqueada && <div className="subscription-blocked"><AlertTriangle size={22}/><div><strong>Acesso operacional bloqueado</strong><span>{assinatura.acesso.motivo === "TRIAL_EXPIRADO" ? "Seu período de teste terminou. Gere e quite uma fatura para reativar a organização." : "Regularize a assinatura para voltar a usar os módulos operacionais."}</span></div></div>}
    <section className="subscription-hero"><div><span className="subscription-hero__icon"><Crown size={24}/></span><div><small>Plano atual</small><h2>{currentPlan?.nome}</h2><p>{currentPlan?.descricao}</p></div></div><div className="subscription-hero__price"><strong>{formatCurrency(assinatura.ciclo === "ANUAL" ? currentPlan?.precoAnual : currentPlan?.precoMensal)}</strong><span>/{assinatura.ciclo === "ANUAL" ? "ano" : "mês"}</span>{assinatura.status === "TRIAL" && <small>{trialDays} dia(s) restantes de trial</small>}</div></section>
    <section className="panel"><div className="panel__heading"><div><span>Uso</span><h2>Limites do plano</h2></div><Gauge size={20}/></div><div className="subscription-limits"><LimitCard label="Empresas/CNPJs" data={assinatura.uso?.empresas}/><LimitCard label="Usuários" data={assinatura.uso?.usuarios}/><LimitCard label="Clientes" data={assinatura.uso?.clientes}/><LimitCard label="Pets" data={assinatura.uso?.pets}/><LimitCard label="Funcionários" data={assinatura.uso?.funcionarios}/></div></section>
    <section className="panel"><div className="panel__heading"><div><span>Recursos</span><h2>Módulos contratados</h2></div></div><div className="subscription-modules">{(currentPlan?.modulos || []).map((m)=><span key={m}><CheckCircle2 size={15}/>{moduleLabels[m] || m}</span>)}</div></section>
    {canManage && <section className="panel"><div className="panel__heading"><div><span>Planos</span><h2>Alterar ou renovar assinatura</h2><p>A alteração é aplicada depois da confirmação do pagamento da fatura.</p></div><div className="onboarding-cycle"><button className={cycle==="MENSAL"?"is-active":""} onClick={()=>setCycle("MENSAL")}>Mensal</button><button className={cycle==="ANUAL"?"is-active":""} onClick={()=>setCycle("ANUAL")}>Anual</button></div></div><div className="subscription-plans">{plans.map((plan)=><article key={plan.id} className={`subscription-plan ${currentPlan?.id===plan.id?"is-current":""}`}><span>{currentPlan?.id===plan.id?"Seu plano":"Disponível"}</span><h3>{plan.nome}</h3><strong>{formatCurrency(cycle==="ANUAL"?plan.precoAnual:plan.precoMensal)}<small>/{cycle==="ANUAL"?"ano":"mês"}</small></strong><p>{plan.descricao}</p><div>{plan.modulos.map((m)=><small key={m}><Check size={12}/>{moduleLabels[m]||m}</small>)}</div><button className={currentPlan?.id===plan.id?"secondary-button":"primary-button"} disabled={generate.isPending} onClick={()=>generate.mutate(plan.id)}>{currentPlan?.id===plan.id?"Gerar renovação":"Gerar fatura deste plano"}</button></article>)}</div></section>}
    <section className="panel"><div className="panel__heading"><div><span>Cobranças</span><h2>Faturas</h2></div><button className="ghost-button" onClick={()=>subscriptionQuery.refetch()}><RefreshCw size={15}/>Atualizar</button></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>{(assinatura.faturas||[]).length ? assinatura.faturas.map((f)=><tr key={f.id}><td><strong>{f.descricao || "Assinatura PetRise"}</strong>{f.planoDestino && <small className="table-subline">{f.planoDestino.nome}</small>}</td><td>{formatDate(f.vencimento)}</td><td>{formatCurrency(f.valor)}</td><td><span className={`status-pill status-pill--${f.status.toLowerCase()}`}>{statusLabels[f.status]||f.status}</span></td><td>{payload.billingDevelopment && ["PENDENTE","VENCIDA"].includes(f.status) ? <button className="primary-button primary-button--small" disabled={simulate.isPending} onClick={()=>simulate.mutate(f.id)}><Sparkles size={14}/>Simular pagamento</button> : f.status === "PAGA" ? <span className="inline-success"><Check size={14}/>Pago</span> : null}</td></tr>) : <tr><td colSpan="5" className="empty-cell">Nenhuma fatura gerada.</td></tr>}</tbody></table></div>{payload.billingDevelopment && <div className="dev-note"><Sparkles size={16}/><span><strong>Modo de desenvolvimento.</strong> O botão de simulação não representa cobrança real e deve permanecer desativado em produção.</span></div>}</section>
  </div>;
}
