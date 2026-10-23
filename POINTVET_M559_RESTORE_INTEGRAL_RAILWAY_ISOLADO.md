# PointVet M.5.59 — Restauração integral do esquema em PostgreSQL Railway isolado (20/10/2026)

## Resultado

**APROVADO — backup e restore reais do esquema PointVet com dados 100% sintéticos.** Executado no projeto Railway descartável `PointVet-DR-Sintetico-M558` (`11a9be9f-7635-4e74-96f9-0c48d77242c9`), ambiente interno chamado `production` pela Railway (não é o projeto Pet King comercial). A imagem de Postgres é a mesma família do staging: servidor PostgreSQL **18.6**; executor de restore `postgres:18-alpine`.

**Nenhum banco, cliente, CNPJ real, pagamento, instituição financeira ou serviço fiscal da Pet King foi acessado ou modificado.** As conexões dos executores foram restritas a `*.railway.internal`, ao ID exato do projeto descartável e ao banco `pointvet_unified_ci`. As rotinas sandbox mantiveram `NODE_ENV=test` e `POINTVET_UNIFIED_SALES_SANDBOX=1`. O código real do PointVet foi executado somente com suas fixtures ficcionais.

## Procedimento

1. No projeto temporário, criar `Postgres` com banco descartável `pointvet_unified_ci`; serviço  `5f6e9106-b165-49a3-94a6-9c9299cb1d5e`.
2. Executar `api/scripts/pointvet-m559-seed.mjs` com API Node 22, migrações Prisma completas e quatro suítes SQL existentes: PDV unificado, razão/crédito do cliente, fiscal multi-CNPJ e migração fiscal assistida. Dockerfile de teste agrega os módulos compartilhados `admin-web/src/lib`, sem build ou deploy dos apps comerciais.
3. Após o marcador de sucesso `M559_READY`, executar `api/scripts/pointvet-m559-full-schema-restore.sh` em cliente PostgreSQL 18. O executor usa `pg_dump -Fc`, cria **novo** banco de restauração sem sobrescrever fonte ou destino existente, executa `pg_restore --exit-on-error` e confere SHA-256.
4. Comparar fingerprints determinísticos de **cada tabela pública e seus registros**, índices, constraints, sequências, views, triggers e histórico `_prisma_migrations`. Validar estornos por venda, pagamento e peso de cada lote (incluindo 333 g) e um `BEGIN/UPDATE/ROLLBACK` na base restaurada.

## Evidências observadas em Railway

- Seeder: deploy `353bc77c-4058-4476-87c7-fcad54d58933`, `POINTVET_M559_SEED_SUCCESS`: **46 migrations**, 9 empresas sintéticas, **18 vendas**, **4 estornos**, 2 fluxos fiscais, 5 eventos fiscais e 3 movimentos de 0,333 kg. Todas as quatro suítes de integração foram aprovadas (`ok 1` em cada).
- Restore final: deploy `73bffdfa-bf63-47e2-ae09-bb0425cf6083`, marcador `POINTVET_M559_FULL_SCHEMA_RESTORE_SUCCESS`: **119 tabelas**, 46 migrations, 9 empresas, 4 estornos, `dump_bytes=491298`, `backup_seconds=0`, `restore_seconds=4`, prefixo SHA-256 `dc6308b896c65238`.
- O checksum completo foi verificado pelo executor (somente prefixo no log). Os fingerprints foram iguais; o estorno por lote, os pagamentos e a reversão transacional também passaram.
- A tentativa anterior de restore chegou a criar um destino isolado, porém interrompeu antes da validação por usar uma opção de `sha256sum` não compatível com BusyBox. O script foi corrigido e executado **em novo banco vazio** (`pointvet_m559_full_restore_v2`), sem apagar ou sobrescrever a primeira tentativa. Apenas a execução final conta como aprovada.
- O teste inicial do seeder revelou dependência de código compartilhado do Admin e build Prisma sem URL; resolveu-se somente na **imagem descartável do executor**, com URL fictícia de build sem contato ao banco. Não houve mudança no deploy normal da API/Portal/Admin.

## Código rastreável

- `api/scripts/pointvet-m559-seed.mjs` — pin inicial `92b87b57c839322fcd244b81e03dfb0cfe04a504`.
- `api/scripts/Dockerfile.m559` — build da fixture, com URL não operacional durante a geração Prisma; fix `4c3c7d3427525c314715d012bdad3a365a5a0b3f`.
- `api/scripts/pointvet-m559-full-schema-restore.sh` — restore com guardas e comparação integral, fix `cc1d8732296d521ec572033bff6171a2cb03dd48`.
- Todos esses arquivos permanecem somente na branch `feat/pointvet-20-1-unified-pdv-foundation`; PR #36 continua **DRAFT**.

## Descarte de recursos

Após captar os logs, foram removidos **exclusivamente** do projeto temporário:

1. Seeder `b88bbdac-1cf9-4441-a00a-308063e25261`.
2. Executor restore `525fe3bb-3485-44e7-9cc3-f1ec80c73fca`.
3. PostgreSQL `5f6e9106-b165-49a3-94a6-9c9299cb1d5e`.
4. Volume descartável `2d8a1f55-4e5b-4213-a783-e7c715237c14` com **somente dados sintéticos**; sua remoção é irreversível.

As consultas posteriores `railway_environment_status` e `railway_describe_environment` confirmaram **0 serviços, 0 volumes, 0 buckets, 0 trabalhos pendentes** no projeto de ensaio. Mantida a estrutura vazia. Pet King PDV Homologacao permaneceu **4/4 saudável** e Pet King comercial **8/8 saudável**, sem alterações.

## Limite do Gate 2 / próxima etapa

**Gate 2 avançou, mas permanece PARCIAL.** Esta execução restaura o **esquema real** com dados de teste, não backup de origem real e não volume representativo do crescimento da Pet King. O tempo de 4 segundos é do teste pequeno, não um RTO aprovado; não foi medido RPO de backups reais nem demonstrada recuperação de desastres de um incidente comercial.

Para publicação do PDV ainda faltam ensaio de volume/retenção/backup autorizado com origem e destino definidos, aceite de operadora e supervisão, regras fiscais/contábeis externas e aprovação nominal do canário. PR #36 segue Draft; checkout manual e contingência financeira permanecem OFF por padrão. Consulte [M.5.58](POINTVET_M558_RESTORE_SINTETICO_RAILWAY_ISOLADO.md) para a etapa anterior de esquema mínimo e [continuidade oficial](POINTVET_CONTINUIDADE_OFICIAL.md) para o quadro geral.
