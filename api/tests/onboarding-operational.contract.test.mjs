/**
 * PointVet 19.3 — non-destructive onboarding contract checks.
 * This suite reads repository source only. It never contacts Railway or PostgreSQL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const routes = source("../src/modules/saas/saas.routes.js");
const controller = source("../src/modules/saas/saas.controller.js");
const service = source("../src/modules/saas/saas.service.js");
const activation = source("../src/modules/saas/activation.controller.js");
const adminRoutes = source("../../admin-web/src/App.jsx");
const activationPage = source("../../admin-web/src/pages/ActivationPage.jsx");
const adminConsole = source("../../admin-web/src/pages/PlatformAdminPage.jsx");

test("public plan selection and rate-limited onboarding routes remain available", () => {
  assert.match(routes, /router\.get\("\/publico\/planos",\s*controller\.planosPublicos\)/);
  assert.match(routes, /router\.post\("\/onboarding",\s*onboardingLimiter,\s*controller\.onboarding\)/);
  assert.match(controller, /onboardingSchema\.safeParse\(req\.body\)/);
});

test("signup rejects duplicate emails, CNPJs and missing/inactive plans", () => {
  assert.match(service, /EMAIL_JA_CADASTRADO/);
  assert.match(service, /CNPJ_JA_CADASTRADO/);
  assert.match(service, /if\s*\(!plano\?\.ativo\)/);
});

test("tenant, company, owner and subscription are created in one transaction", () => {
  const start = service.indexOf("export async function criarOnboarding(");
  const end = service.indexOf("async function atualizarFaturasVencidas(", start);
  assert.ok(start >= 0 && end > start);
  const signup = service.slice(start, end);
  assert.match(signup, /return prisma\.\$transaction\(async\s*\(tx\)\s*=>/);
  for (const model of ["organizacao", "empresa", "usuario", "assinaturaSaaS"]) {
    assert.match(signup, new RegExp("tx\\." + model + "\\.create\\("));
  }
  assert.match(signup, /papel:\s*"PROPRIETARIO"/);
  assert.match(signup, /ONBOARDING_CONCLUIDO/);
});

test("trial and contracted modules are derived from the chosen plan", () => {
  assert.match(service, /plano\.trialDias\s*>\s*0\s*\?\s*"TRIAL"\s*:\s*"ATIVA"/);
  assert.match(service, /plano\.modulos\.some/);
  assert.match(service, /moduloOrganizacao\.create/);
});

test("activation is restricted to authenticated organization managers", () => {
  assert.match(routes, /router\.get\("\/ativacao",\s*autenticarUsuario,\s*selecionarEmpresaParaAssinatura,\s*exigirGestorOrganizacao,\s*activationProgress\)/);
  assert.match(activation, /prisma\.cliente\.count\(\{where:\{organizacaoId:id\}\}\)/);
  assert.match(activation, /prisma\.pet\.count\(\{where:\{cliente:\{organizacaoId:id\}\}\}\)/);
  assert.match(activation, /prisma\.itemCatalogo\.count\(\{where:\{empresaId:req\.empresa\.id\}\}\)/);
  assert.match(activation, /completed:steps\.filter\(s=>s\.done\)\.length/);
});

test("first-use guide is linked in the tenant app, and admin console already lists organizations", () => {
  assert.match(adminRoutes, /path="primeiros-passos"/);
  assert.match(activationPage, /\/saas\/ativacao/);
  assert.match(adminConsole, /\/saas\/plataforma\/organizacoes/);
  assert.match(adminConsole, /OrganizationDetailPage/);
});

test("onboarding and activation source never invoke a backup or email worker", () => {
  const joined = controller + activation;
  assert.doesNotMatch(joined, /resend\.emails\.send|backupWorker|cron\.schedule/);
});
