import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  // O PetRise usa PostgreSQL remoto (Railway) durante o desenvolvimento.
  // Operações compostas como consulta + comanda podem fazer vários round-trips.
  // O padrão do Prisma para transações interativas é 5s, curto para esse cenário.
  transactionOptions: {
    maxWait: 10_000,
    timeout: 30_000,
  },
});

export default prisma;