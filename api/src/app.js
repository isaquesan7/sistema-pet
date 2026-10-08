import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import prisma from "./config/prisma.js";
import authRoutes from "./modules/auth/auth.routes.js";

import clientesRoutes from "./modules/clientes/clientes.routes.js";
import petsRoutes from "./modules/pets/pets.routes.js";
import organizacoesRoutes from "./modules/organizacoes/organizacoes.routes.js";
import catalogoRoutes from "./modules/catalogo/catalogo.routes.js";
import funcionariosRoutes from "./modules/funcionarios/funcionarios.routes.js";
import pacotesRoutes from "./modules/pacotes/pacotes.routes.js";
import pdvRoutes from "./modules/pdv/pdv.routes.js";
import estoqueRoutes from "./modules/estoque/estoque.routes.js";
import consultorioRoutes from "./modules/consultorio/consultorio.routes.js";

const app = express();

const corsOrigins = (
  process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// ======================================================
// SEGURANÇA
// ======================================================

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origem não autorizada pelo CORS."));
    },
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
    service: process.env.APP_NAME || "BichOne API",
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
      service: process.env.APP_NAME || "BichOne API",
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
// ROTA DOS PETS
// ======================================================

app.use(
  "/api/pets",
  petsRoutes
);

// ======================================================
// FUNDAÇÃO SaaS / CATÁLOGO / RH / PACOTES
// ======================================================

app.use("/api/organizacao", organizacoesRoutes);
app.use("/api/catalogo", catalogoRoutes);
app.use("/api/funcionarios", funcionariosRoutes);
app.use("/api/pacotes", pacotesRoutes);
app.use("/api/pdv", pdvRoutes);
app.use("/api/estoque", estoqueRoutes);
app.use("/api/consultorio", consultorioRoutes);

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
  req.log?.error({
    err,
    code: err?.code,
    meta: err?.meta,
    method: req.method,
    path: req.originalUrl,
  }, "Erro não tratado na API");

  console.error("Erro não tratado na API:", {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    meta: err?.meta,
    stack: err?.stack,
  });

  return res.status(500).json({
    success: false,
    message: "Erro interno do servidor.",
  });
});

export default app;