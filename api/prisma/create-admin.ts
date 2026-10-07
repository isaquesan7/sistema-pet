import "dotenv/config";

import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada.");
}

if (!process.env.ADMIN_NAME) {
  throw new Error("ADMIN_NAME não configurado.");
}

if (!process.env.ADMIN_EMAIL) {
  throw new Error("ADMIN_EMAIL não configurado.");
}

if (!process.env.ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD não configurado.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const email = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const senhaHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 12);

  const usuario = await prisma.usuario.upsert({
    where: {
      email,
    },

    update: {
      nome: process.env.ADMIN_NAME!,
      senhaHash,
      status: "ATIVO",
    },

    create: {
      nome: process.env.ADMIN_NAME!,
      email,
      senhaHash,
      status: "ATIVO",
    },
  });

  console.log("");
  console.log("✅ Administrador criado/atualizado.");
  console.log(`ID: ${usuario.id}`);
  console.log(`E-mail: ${usuario.email}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("❌ Erro ao criar administrador:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });