# PointVet M.5.71 — Plano de homologação controlada (PR #38)

Data do preparo: 23/10/2026. Documento operacional; **não é autorização nem registro de implantação**.

## Estado verificado no Railway

Projeto isolado de homologação: `Pet King PDV Homologacao`, ambiente `staging` (não é Pet King DEV).
- API: serviço `pointvet-api-staging`, root `/api`, branch-base `feat/pointvet-20-1-unified-pdv-foundation`, commit publicado `2e48bde574c46ae7f09ea640318fca73fdceaf7b`, pre-deploy `npm run db:deploy`.
- Admin: `pointvet-admin-staging`, root `/admin-web`, branch-base, commit publicado `739e12dcb50d5c1774f0abdf83b2acb22316bd50`.
- PostgreSQL dedicado da homologação com volume persistente. Portal permanece separado e fora do patch M.5.71.
- Sem mudança staged no ambiente verificado. Os serviços acima não apontam para a branch da PR #38.

## Gates obrigatórios, nesta ordem

1. **CI do SHA final:** `validate` e `isolated-postgres` precisam estar verdes na PR #38, incluindo a migração `20261023234500_comandas_origem_cnpj` e o teste com dois CNPJs `pdv-comandas-cnpj.integration.test.mjs`. Não usar apenas aprovação anterior à troca do cache por empresa.
2. **Backup e restore:** confirmar snapshot do PostgreSQL **staging** antes da migração, teste de restore em instância descartável, hashes/horários e plano de rollback. Backup sintético no GitHub Actions não substitui essa evidência.
3. **Janela autorizada:** congelar temporariamente operações de homologação, identificar operador de teste e CNPJs já cadastrados; registrar commit/branch e flags atuais. Evitar revelar credenciais ou dados pessoais em logs/Issues.
4. **API primeiro:** apontar exclusivamente a API **staging** ao SHA M.5.71 após preparar rollback, executar pre-deploy (`npm run db:deploy`) UMA vez e verificar saúde, autenticação, Prisma e inventário de migrations. Não migrar banco da Pet King DEV ou de produção por engano.
5. **HTTP autorizativo:** testar usuário sem sessão (401), usuário sem empresa/sem `pdv.acessar` (403), e usuários com apenas um CNPJ. Exigir que GET lista/detalhe mostre só os itens/vendas do CNPJ selecionado. Troca de empresa deve invalidar cache e novos lançamentos usar caixa atual. Tutor da comanda anônima pode ser vinculado uma vez, mas nunca trocado por este fluxo.
6. **Admin depois:** apontar apenas o Admin **staging** ao mesmo SHA, executar smoke read-only inicial, confirmar status dos dois serviços e manter checkout unificado bloqueado a menos que gates financeiros independentes estejam aprovados.
7. **Teste humano e visual:** em 1366×768 e celular, testar a central, busca, filtros, abertura sem tutor (somente produto), adição serviço exigindo tutor/pet, quantidades inteiras e granel fracionado, detalhamento e valores por empresa, aba de caixa e retorno/reabertura de comanda. Testar venda individual/manual e cancelamento APENAS com registros de teste explícitos; conferir reversão de estoque/caixa por CNPJ.
8. **Aceite:** registrar evidência de cada cenário, divergências e aceite do proprietário antes de publicar fora do ambiente de homologação.

## Segurança e contingência

- **Nunca ativar TEF/PSP, integração bancária ou fiscal** como consequência da publicação de UX. O motor fiscal é uma fase independente; cobranças permanecem registradas manualmente.
- A migração de `empresaOrigemId` é aditiva e opcional. Comandas legadas sem evidência de origem ficam com `NULL` para evitar atribuição indevida; investigação manual é preferível a reclassificação automática.
- Em caso de falha no Admin, retornar o serviço staging ao pin anterior; se a API falhar, parar novas movimentações de teste e aplicar rollback de aplicação coordenado. **Não reverter migrações por DROP COLUMN automaticamente**; somente restaurar dados com backup, autorização e evidência técnica. Uma reversão de aplicação não reverte pagamentos externos declarados.
- Não utilizar a PR #36 diretamente como versão do Admin M.5.71: o contrato do novo PDV exige a API e a migração da PR #38.
- PR #38 deve permanecer Draft até aceite operacional; merge do histórico da PR #36 na branch de desenvolvimento não equivale a merge na `main`.

## Próxima decisão de implantação

Após os dois jobs do último CI estarem verdes e a evidência de backup staging ser revisada, submeter o patch de API+Admin **staging** com confirmação explícita de deploy. Não modificar Railway automaticamente apenas porque a implementação e testes estão verdes.
