import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import prisma from "./config/prisma.js";
import authRoutes from "./modules/auth/auth.routes.js";

import clientesRoutes from "./modules/clientes/clientes.routes.js";

const app = express();

// ======================================================
// SEGURANÇA
// ======================================================

app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ======================================================
// LOGS
// ======================================================

app.use(pinoHttp());

// ======================================================
// PARSERS
// ======================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ======================================================
// HEALTH CHECK DA API
// ======================================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "Pet King API",
    status: "online",
    timestamp: new Date().toISOString(),
  });
});

// ======================================================
// HEALTH CHECK DO BANCO DE DADOS
// ======================================================

app.get("/api/health/database", async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const especies = await prisma.especie.count();
    const permissoes = await prisma.permissao.count();

    return res.status(200).json({
      success: true,
      service: "Pet King API",
      database: {
        status: "connected",
        provider: "PostgreSQL",
        especies,
        permissoes,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// ROTA DO AUTENTICADOR
// ======================================================

app.use("/api/auth", authRoutes);

// ======================================================
// ROTA DE CLIENTES
// ======================================================

app.use(
  "/api/clientes",
  clientesRoutes
);

// ======================================================
// ROTA NÃO ENCONTRADA
// TEM QUE FICAR DEPOIS DE TODAS AS ROTAS
// ======================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Rota não encontrada.",
  });
});

// ======================================================
// TRATAMENTO GLOBAL DE ERROS
// TEM QUE SER O ÚLTIMO MIDDLEWARE
// ======================================================

app.use((err, req, res, next) => {
  req.log?.error(err);

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor.",
  });
});

export default app;