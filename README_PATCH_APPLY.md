# Como aplicar este ZIP — SaaS Foundation 2.0

Este ZIP já contém a migration `20261008010000_saas_foundation`. Ela ainda deve ser aplicada ao PostgreSQL do Railway.

## 1. Antes de tudo

1. Faça um **snapshot/backup** do PostgreSQL no Railway.
2. Preserve seu arquivo `api/.env` atual. Ele não está incluído no ZIP.
3. Não copie `node_modules` de outro computador; rode `npm ci` localmente.

## 2. Aplicar o patch

Na pasta `api`:

```powershell
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

> Use `migrate deploy` aqui porque a migration já está pronta no ZIP. Em alterações futuras do schema durante desenvolvimento, volte a usar `prisma migrate dev --name ...` para criar novas migrations.

## 3. Configurar a primeira organização

Confira `api/.env.example` e acrescente ao seu `.env` as variáveis de organização, mantendo suas credenciais reais apenas no `.env` local.

Depois rode:

```powershell
npm run db:setup-business
npm run dev
```

O script reaproveita a organização criada pela migration para os dados já existentes, configura a marca, garante os dois CNPJs atuais e vincula o administrador como proprietário.

## 4. Login novamente

Faça um novo login para receber o contexto de organização atualizado. Depois teste:

- `GET /api/auth/contexto`
- Header `Authorization: Bearer <token>`
- Header `X-Empresa-Id: <id-da-empresa>`

## 5. Testes recomendados

Leia `TEST_CHECKLIST_SAAS.md` para validar organização, espécies/raças, categorias, precificação, funcionários/ponto e pacotes.

## Observações

- O seed não cria mais espécies, raças, categorias, produtos ou serviços para novas organizações.
- Os 7 registros de espécies já existentes no banco atual são preservados e vinculados à organização migrada.
- O arquivo `api/prisma/schema.before-saas.prisma` é apenas uma referência do schema anterior ao patch.
