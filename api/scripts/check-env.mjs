const production = process.env.NODE_ENV === "production";

const requiredAlways = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const requiredProduction = [
  "JWT_CLIENT_ACCESS_SECRET",
  "JWT_CLIENT_REFRESH_SECRET",
  "CORS_ORIGINS",
];

const missing = [
  ...requiredAlways,
  ...(production ? requiredProduction : []),
].filter((name) => !String(process.env[name] || "").trim());

if (missing.length) {
  console.error(`[PetRise] Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  process.exit(1);
}

for (const secret of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_CLIENT_ACCESS_SECRET", "JWT_CLIENT_REFRESH_SECRET"]) {
  const value = String(process.env[secret] || "");
  if (value && value.length < 32) {
    console.error(`[PetRise] ${secret} deve ter pelo menos 32 caracteres.`);
    process.exit(1);
  }
}

if (production) {
  const paymentProvider = String(process.env.PAYMENT_PROVIDER || "manual").toLowerCase();
  const billingProvider = String(process.env.SAAS_BILLING_PROVIDER || "manual").toLowerCase();

  if (paymentProvider === "development") {
    console.error("[PetRise] PAYMENT_PROVIDER=development é bloqueado em produção. Use manual até integrar um gateway real.");
    process.exit(1);
  }

  if (billingProvider === "development") {
    console.error("[PetRise] SAAS_BILLING_PROVIDER=development é bloqueado em produção. Use manual até integrar cobrança recorrente real.");
    process.exit(1);
  }
}

console.log(`[PetRise] Ambiente validado (${production ? "production" : "development"}).`);
