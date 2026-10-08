import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log(`🐾 ${process.env.APP_NAME || "PET ERP API"}`);
  console.log("==========================================");
  console.log(`✅ Servidor online`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`❤️  http://localhost:${PORT}/api/health`);
  console.log(`🧪 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log("==========================================");
  console.log("");
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);

  server.close(() => {
    console.log("✅ Servidor encerrado.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));