import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não encontrada no .env");
const email = String(process.env.PETRISE_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) throw new Error("Defina PETRISE_SUPER_ADMIN_EMAIL no .env antes de executar este comando.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new Error(`Usuário ${email} não encontrado. Faça o cadastro/login administrativo primeiro.`);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { superAdmin: true } });
  console.log(`✅ ${email} agora é administrador interno da plataforma PetRise.`);
} finally {
  await prisma.$disconnect();
}
