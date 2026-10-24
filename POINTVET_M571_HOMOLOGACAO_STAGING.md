# PointVet M.5.71 — Plano de homologação controlada (PR #38)

## Atualização do gate de backup — usuário confirmou criação (23/10/2026)

- **Backup manual criado:** o proprietário informou em conversa que concluiu a criação do backup do Postgres do ambiente staging. Registro é **declaração do operador**, ainda sem ID, timestamp, checksum, status de snapshot ou prova de restauração acessível ao conector. **Não afirmar snapshot verificado ou restauro aprovado.**
- **CI:** PR #38 código `c8cf2720d028325d08aff5a16313d32ed6165fe9` passou `validate` e `isolated-postgres` no [run #40043436413](https://github.com/isaquesan7/sistema-pet/actions/runs/40043436413); PR sem conflitos, Draft. Commit de documentação subsequente não mudou código.
- **Railway staging:** após o proprietário descartar o patch anterior, a API foi preparada novamente **sozinha**, com `connect_service_source(staged:true)` para o mesmo commit de código aprovado. `get_staged_changes` confirmou APENAS `pointvet-api-staging` no patch `1db185c6-760a-4578-98cd-bab8e9e9df51`; o Admin, Portal e PostgreSQL não aparecem nesse patch. API viva segue em `2e48bde574c46ae7f09ea640318fca73fdceaf7b`; Admin vivo segue em `739e12dcb50d5c1774f0abdf83b2acb22316bd50`. **NENHUM DEPLOY aplicado.**
- **Gate pendente e não automatizável pelo conector atual:** inspecionar a identificação/horário do backup nativo no painel `staging → Postgres → Backups` e demonstrar recuperação em destino separado, sem sobrescrever o volume original. O conector Railway não oferece métodos para listar/criar/restaurar snapshots e não executa comandos SQL arbitrários; a API aceita migrações automaticamente no predeploy, por isso ainda não deve ser publicada sem esse gate.
- **Não repetir M.5.59:** o ensaio sintético de dump/restore integral já foi aprovado; o gate específico é restaurabilidade de dados do staging, não necessidade de novo motor ou módulo. Para evidência com `pg_dump/pg_restore`, requer executor aprovado com acesso seguro à origem e destino isolado. Não expor dados pessoais ou dumps em GitHub, logs públicos ou respostas. **Não utilizar RESTORE no próprio banco staging** para testar, pois Railway pode substituir o volume montado.
- **Próxima operação quando houver evidência:** confirmar que patch contém somente API; aplicar **somente API** no staging, verificar predeploy Prisma e segurança de CNPJ; preparar Admin em patch separado após validação da API. Checkout multiempresa permanece fechado.

---

## Revisão operacional — 23/10/2026 (preparo sem deploy)

**CI confirmado no SHA de código `c8cf2720d028325d08aff5a16313d32ed6165fe9`:**
[GitHub Actions #40043436413](https://github.com/isaquesan7/sistema-pet/actions/runs/40043436413), `validate SUCCESS` e `isolated-postgres SUCCESS`. Inclui testes de CNPJ com PostgreSQL descartável. A PR #38 segue **DRAFT / mergeable clean**.

**Staging Railway inspecionado:** projeto `Pet King PDV Homologacao`, environment `staging`. Admin, API, Portal e PostgreSQL **4/4 online**, sem publicação nova. Foi preparado um patch não destrutivo de source, **não aceito nem implantado**, ID `1db185c6-760a-4578-98cd-bab8e9e9df51`. A API possui alterações pendentes para o commit M.5.71. O Admin foi devolvido aos mesmos valores de branch+commit publicados (M.5.70), **mas o Railway ainda exibe o recurso Admin no patch com campos idênticos**. Consequentemente, o patch **NÃO deve ser aceito como unidade**: pode rebuildar API e Admin simultaneamente, contrariando a implantação sequencial. Antes de qualquer deploy, descartar/limpar os campos do Admin no patch via Dashboard Railway; confirmar em `get_staged_changes` que resta **somente a API**. Não há ação de descarte granular na integração Railway disponível neste chat.

**Backup (ainda NÃO confirmado no PostgreSQL persistente):** Railway dispõe de snapshots nativos de volumes, mas a integração de Railway conectada neste chat não expõe comandos para criar/listar/restaurar esses snapshots. Caminho documentado:
1. Na interface Railway, selecionar projeto `Pet King PDV Homologacao` → ambiente `staging` → serviço `Postgres` → guia **Backups**. Conferir se já existe backup de volume recente e sua identificação e horário.
2. Antes da janela de migração, criar **backup manual do volume postgres-volume**. Registrar ID/horário e a operação de sucesso, sem copiar senhas, URLs internas ou dados pessoais no GitHub. Não clicar em **Restore** no banco original durante o teste.
3. Para validar restauração de forma independente, utilizar um banco destino **isolado** com dump/restore `pg_dump/pg_restore`, guardas de identidade da origem/destino, hashes e comparação de esquema/dados, preservando privacidade. O ensaio sintético anterior M.5.59 **não equivale** ao restore do staging; não reutilizar suas credenciais nem seus bancos, somente o processo testado.
4. Fazer o gate completo somente quando houver evidência de backup restaurável, janela de manutenção autorizada e os recursos do patch separados por etapa. A migração aditiva de `empresaOrigemId` roda no **pre-deploy da API** (`npm run db:deploy`). Admin só depois da API passar nos testes HTTP.

**IMPORTANTE:** o clique `Apply/Deploy` do patch atual (com API+Admin) **não foi autorizado**, não deve ser usado para "avançar" ou testar backup. API live continua pinada em `2e48bde574c46ae7f09ea640318fca73fdceaf7b`, Admin live em `739e12dcb50d5c1774f0abdf83b2acb22316bd50`.

Referências da documentação Railway: [Backups nativos](https://docs.railway.com/volumes/backups) e [Comandos PostgreSQL](https://docs.railway.com/cli/postgres).

---


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
