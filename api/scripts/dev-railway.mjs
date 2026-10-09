import { spawn } from "node:child_process";

// Railway continua sendo a fonte dos SEGREDOS (DATABASE_URL/JWTs), mas um
// `railway run` ligado ao serviço de produção também traria NODE_ENV=production.
// Para desenvolvimento local, sobrescrevemos somente valores não sensíveis.
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: "3000",
    CORS_ORIGINS: "http://localhost:5173,http://localhost:5174",
    PAYMENT_PROVIDER: "development",
    SAAS_BILLING_PROVIDER: "development",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
