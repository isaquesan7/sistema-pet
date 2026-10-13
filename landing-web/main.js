/**
 * PointVet commercial site: real public plan data, no fake prices or trial claims.
 * Config is injected via config.js; all links point to the existing admin onboarding.
 */
const config = window.POINTVET_SITE_CONFIG || {};
const apiBase = String(config.apiUrl || "").replace(/\/$/, "");
const appBase = String(config.appUrl || "").replace(/\/$/, "");
const plansNode = document.getElementById("plans");
const formatBRL = (n) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(Number(n));
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels = {PDV:"Ponto de venda",ESTOQUE:"Controle de estoque",CONSULTORIO:"Consultório veterinário",BANHO_TOSA:"Banho e tosa",FINANCEIRO:"Financeiro",PORTAL_CLIENTE:"Portal do tutor",PONTO:"Controle de ponto",FISCAL:"Ferramentas fiscais",RELATORIOS:"Relatórios"};
const getStartUrl = (slug) => {
  if (!appBase) return "#planos";
  const url = new URL(appBase + "/comecar");
  if (slug) url.searchParams.set("plano",slug);
  return url.toString();
};
document.querySelectorAll("[data-app-link]").forEach((link)=>link.href=appBase ? appBase + "/login" : "#planos");
document.querySelectorAll("[data-start-link]").forEach((link)=>link.href=getStartUrl());
document.getElementById("year").textContent = new Date().getFullYear();
const menuButton = document.querySelector(".menu-toggle");
const menu = document.querySelector(".nav-links");
menuButton?.addEventListener("click",()=>{
  const open=menu.classList.toggle("open");
  menuButton.setAttribute("aria-expanded",String(open));
  menuButton.setAttribute("aria-label",open?"Fechar menu":"Abrir menu");
});
menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{menu.classList.remove("open");menuButton.setAttribute("aria-expanded","false");}));
let plans = [];
let cycle = "MENSAL";
function renderPlans(){
  if (!plans.length) return;
  plansNode.innerHTML=plans.map(p=>{
    const featured=Boolean(p.destaque);
    const price=cycle==="ANUAL"?p.precoAnual:p.precoMensal;
    const limitParts = [
      p.limiteEmpresas == null ? null : `Até ${escapeHtml(p.limiteEmpresas)} unidade(s)`,
      p.limiteUsuarios == null ? null : `Até ${escapeHtml(p.limiteUsuarios)} usuário(s)`,
    ].filter(Boolean);
    const modules=(Array.isArray(p.modulos)?p.modulos:[]).map(m=>labels[m]||m);
    const features=[...limitParts,...modules].slice(0,12);
    const trial=Number(p.trialDias)>0 ? `Teste de ${p.trialDias} dias, conforme condições do plano.` : "Confira as condições na contratação.";
    return `<article class="plan-card ${featured?"highlight":""}">
      ${featured?'<span class="plan-badge">MAIS DESTACADO</span>':""}
      <h3>${escapeHtml(p.nome)}</h3><p>${escapeHtml(p.descricao||trial)}</p>
      <div class="plan-price">${price==null?"Consulte condições":formatBRL(price)}${price==null?"":`<small>/${cycle==="ANUAL"?"ano":"mês"}</small>`}</div>
      <ul>${features.map(x=>`<li>${x}</li>`).join("")}</ul>
      <a class="btn ${featured?"btn-purple":"btn-dark"}" href="${escapeHtml(getStartUrl(p.slug))}">Escolher plano ↗</a>
    </article>`;
  }).join("");
}
document.querySelectorAll("[data-cycle]").forEach(button=>button.addEventListener("click",()=>{
  cycle=button.dataset.cycle;
  document.querySelectorAll("[data-cycle]").forEach(b=>{b.classList.toggle("selected",b===button);b.setAttribute("aria-pressed",String(b===button));});
  renderPlans();
}));
async function loadPlans(){
  if(!apiBase){plansNode.innerHTML='<div class="plans-message">Planos disponíveis em breve. Configure a URL pública da API para exibir o catálogo atualizado. <a href="#perguntas">Saiba mais</a>.</div>';return;}
  try {
    const response=await fetch(apiBase+"/saas/publico/planos",{headers:{"Accept":"application/json"}});
    if(!response.ok)throw new Error("http "+response.status);
    const data=await response.json();
    if(!Array.isArray(data.dados))throw new Error("unexpected response");
    plans=data.dados.filter(p=>p&&p.ativo!==false);
    if(!plans.length) {plansNode.innerHTML='<div class="plans-message">Nenhum plano está disponível para contratação neste momento.</div>';return;}
    renderPlans();
  }catch{
    plansNode.innerHTML='<div class="plans-message">Não foi possível carregar os planos agora. Tente novamente mais tarde ou acesse o sistema. <button id="retry-plans" class="btn btn-outline" type="button">Tentar novamente</button></div>';
    document.getElementById("retry-plans")?.addEventListener("click",loadPlans,{once:true});
  }
}
loadPlans();
