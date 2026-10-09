# PetRise — Hotfix 15.1

## Motivo

O Prisma retornava `P3009` porque a migration `20261009013000_timeclock_monthly_close` ficou registrada como **failed** no PostgreSQL. Enquanto existir uma migration falha, `prisma migrate deploy` bloqueia todas as migrations posteriores.

`prisma generate` não corrige esse estado porque apenas regenera o Prisma Client; ele não altera o banco.

## Estratégia adotada

O hotfix **não altera a migration histórica** `20261009013000_timeclock_monthly_close`. Isso evita mudar o checksum de um arquivo de migration que pode já existir em outros ambientes.

Foi adicionado um reparador idempotente:

```bash
npm run db:repair-timeclock
```

Ele:

1. Mostra o log salvo pelo Prisma para a tentativa que falhou.
2. Cria apenas as estruturas da Fase 12 que estiverem faltando.
3. Preserva estruturas que já tenham sido criadas parcialmente.
4. Migra ajustes antigos para `APROVADO`, como previsto originalmente.
5. Confere colunas e chaves estrangeiras esperadas.
6. Não altera manualmente a tabela `_prisma_migrations`.

## Recuperação

Faça snapshot do banco no Railway antes da recuperação.

Na pasta `api`:

```bash
npm ci
npm run db:repair-timeclock
npx prisma migrate resolve --applied 20261009013000_timeclock_monthly_close
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npx prisma migrate status
```

Se o projeto estiver na Fase 15 e ainda não houver promovido o super admin:

```bash
npm run db:promote-platform-admin
```

Depois inicie normalmente:

```bash
npm run dev
```

## O que não fazer

- Não apagar linhas de `_prisma_migrations` manualmente.
- Não usar `prisma migrate reset` no banco do Railway, pois isso apaga os dados.
- Não marcar a migration como aplicada antes de executar o reparador.
- Não apagar a pasta `20261009013000_timeclock_monthly_close`.

## Migration nova

Nenhuma. Este hotfix corrige o estado da migration já existente sem reescrever o histórico dela.
