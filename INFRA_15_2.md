# PetRise — Infra 15.2: Railway Ready

- Backend preparado para `railway run` e deploy Railway.
- `tsx` movido para dependência de runtime porque a API usa Prisma Client TypeScript gerado.
- `npm run build` da API executa `prisma generate`.
- `npm run env:check` valida segredos e bloqueia simuladores em produção.
- Frontends recebem `PETRISE_API_URL` e `PETRISE_ORGANIZACAO_SLUG` em runtime; `.env` local deixou de ser obrigatório.
- Servidor estático Node incluído para Railway, com fallback SPA e `/health`.
- Simulador SaaS agora também é bloqueado por `NODE_ENV=production`.
- `.railway/` e `.env` locais ignorados no Git.
- Nenhuma migration nova.
- `npm run dev:railway` reaproveita segredos do Railway, mas mantém comportamento local de desenvolvimento mesmo quando o serviço remoto usa `NODE_ENV=production`.
