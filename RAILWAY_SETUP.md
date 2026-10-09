# PetRise — Railway Ready (Infra 15.2)

Esta atualização remove a necessidade de transportar arquivos `.env` entre computadores.

## Arquitetura Railway recomendada

No mesmo projeto Railway:

- `Postgres` — banco já existente.
- `petrise-api` — Node/Express/Prisma (`/api`).
- `petrise-admin` — React/Vite (`/admin-web`).
- `petrise-portal` — React/Vite (`/client-web`).

Os frontends recebem configuração em **runtime** via `/runtime-config.js`; alterar URL da API ou slug não exige editar `.env` local nem recompilar manualmente.

## Desenvolvimento local sem `.env`

Instale a CLI uma vez:

```powershell
npm i -g @railway/cli
railway login
```

Na raiz do repositório:

```powershell
railway link
```

Escolha projeto, ambiente e o serviço `petrise-api`.

Depois:

```powershell
cd api
npm run dev:railway
```

Para Prisma:

```powershell
railway run npm run db:status
railway run npm run db:deploy
railway run npm run db:seed
```

O `dev:railway` usa os segredos do Railway, mas força `NODE_ENV=development`, CORS local e simuladores locais.

Os frontends não precisam de `.env` para desenvolvimento local:

```powershell
cd admin-web
npm run dev

cd client-web
npm run dev
```

Defaults locais:

- API: `http://localhost:3000/api`
- organização do portal: `pet-king`

Para testar outro tenant no portal sem arquivo `.env`, abra:

`http://localhost:5174/login?org=slug-do-tenant`

## Produção / staging

Use `NODE_ENV=production`, `PAYMENT_PROVIDER=manual` e `SAAS_BILLING_PROVIDER=manual` até os gateways reais serem integrados.

Nunca coloque JWTs, `DATABASE_URL` ou tokens em variáveis `VITE_*` / `PETRISE_API_URL` de frontend.
