# PointVet M.5.57 — Ensaio controlado de retorno e restauração da aplicação em staging

**Data:** 20/10/2026 (horários UTC nas evidências Railway; BRT = UTC−03:00).  
**Status:** APROVADO para **reinstalação de release da aplicação**; **NÃO** substitui restauração de backup PostgreSQL nem autoriza piloto comercial.  
**Rastreamento:** Issue #37, PR #36 (**DRAFT**), branch `feat/pointvet-20-1-unified-pdv-foundation`.

## Contexto e fronteiras

Ensaio autorizado na **Pet King PDV Homologacao**, projeto Railway `9564acfc-1582-45d8-8ac3-f0bc2d998530`, ambiente `staging` (`5fe41299-936f-4c6f-b034-92b71d67bf96`), sem acessar nem modificar a produção comercial (projeto `aab52927-a8c1-4158-80bf-bd22af504e72`). Foram utilizados builds anteriores **já existentes** com `railway_redeploy(deploymentId)`, em vez de alterar origem GitHub, CNPJ, variáveis ou configuração de serviços.

Os releases diferem apenas em código de API/painel sem novas migrations entre M.5.55 e M.5.56:

- M.5.55: SHA `9c6599ea4cc0d543c3304e928cfb7e582a27475c` — histórico read-only de estornos integrais.
- M.5.56: SHA `82c6138e3569999ec4e4ad6a71d1a7101ca20735` — gate de estorno emergencial independente do checkout.

A API possui `preDeployCommand: npm run db:deploy` na configuração de staging. **Não executamos nenhum restore ou migração manual e não houve mudança de migration entre os dois releases**; o ensaio não oferece evidência de integridade pós-restore de um backup real.

## Evidência cronológica — Railway

| Etapa | Serviço | Deployment criado | SHA | Resultado | Concluído (UTC) |
|---|---|---|---|---|---|
| Estado inicial | API | `4fcf2a65-fa1d-40e1-b976-965c99cf39bd` | M.5.56 | SUCCESS | 14:43:28 |
| Estado inicial | Admin | `6bdce3d2-0124-4a4d-a5a8-c5085bbcf54c` | M.5.56 | SUCCESS | 14:43:44 |
| **Retorno** | API | `c460ccdc-c248-47c8-bebc-685979e8ce5d` | **M.5.55** | **SUCCESS** | **14:54:38** |
| **Retorno** | Admin | `33aa868b-ab65-4993-83e3-18f3bf3eb6ab` | **M.5.55** | **SUCCESS** | **14:52:57** |
| **Restauração atual** | API | `f876d2ea-dfe8-4308-bd3b-5876707d2d5b` | **M.5.56** | **SUCCESS** | **14:56:12** |
| **Restauração atual** | Admin | `35f99077-7cfd-445d-ae76-cf70c333c74f` | **M.5.56** | **SUCCESS** | **14:57:05** |

- Antes do ensaio: staging **4/4**, sem erro, sem patch pendente. Produção **8/8** saudável.
- Depois do retorno M.5.55: API, Admin, Portal e Postgres **4/4 online**, 0 falhas e 0 pendingWork.
- Depois da restauração M.5.56: **4/4 online**, 0 serviços com problemas, 0 failures e 0 pendingWork; Portal e Postgres mantiveram seus deployments originais. Em produção, **8/8** saudáveis e nenhum pendingWork, deployments comerciais inalterados.
- Lista de deployments conferida após restauração: SHA da API e do Admin **igual a M.5.56**; source original já estava pinado nesse SHA e não foi alterado no ensaio.
- Tempo entre início do primeiro redeploy (14:51:56) e **ambos os serviços saudáveis no release anterior** (14:54:38): cerca de **2min42s**. Retorno de ambos ao release atual, iniciado às 14:54:53, concluído às 14:57:05: cerca de **2min12s**. São tempos observados de aplicação/build/implantação em staging, **não equivalem a RTO de um incidente real**, nem medem RPO.

## Gates e isolamento

- Nenhum `railway_set_variables`, `connect_service_source`, mudança de preferência multi-CNPJ ou ativação de funcionalidade foi feito.
- No serviço API de staging, os três nomes preexistentes `POINTVET_UNIFIED_MANUAL_CHECKOUT_*` permanecem configurados, com valores **redigidos pela integração Railway**. Registros anteriores da M.5.56 confirmavam checkout OFF/allowlists vazias; como não houve alteração de variáveis, não há indício de reativação, mas o valor vivo não foi relido nesta execução.
- As três variáveis `POINTVET_UNIFIED_MANUAL_REVERSAL_*` **continuam ausentes** do serviço API de staging; portanto o novo gate de estorno de contingência permanece OFF por padrão.
- Não foi executada venda, estorno, pagamento, operação fiscal, alteração de CNPJ, recuperação de banco, cópia de credenciais ou importação de dados reais.
- O status SUCCESS inclui os healthchecks configurados pelo Railway (`/api/health` na API e `/health` no Admin). O ensaio **não incluiu teste funcional autenticado pós-retorno** nem teste independente de HTTP externo. As baterias de integração HTTP/PG da M.5.56 seguem documentadas na [M.5.56](POINTVET_M556_CONTINGENCIA_ESTORNO_SEPARADA.md).

## O que o ensaio prova — e o que falta

**Aprovado:** capacidade de reinstalar o código anterior da API e Admin no staging isolado e depois restaurar os dois serviços para M.5.56, com ambos os pares de deployments SUCCESS e ambiente saudável, sem mutação deliberada de configuração ou variáveis.

**Ainda pendente do Gate 2 em [M.5.47](POINTVET_M547_HOMOLOGACAO_OPERACIONAL_E_PILOTO.md):** prova de **pg_dump/pg_restore de backup autorizado não produtivo (ou saneado conforme LGPD)** em alvo isolado, verificação de checksum, esquema, migrações, dados e consistência, medição de RTO/RPO, e ensaio específico da preferência de PDV Unificado e do kill switch. Testes de restore isolados em CI **não** substituem esse aceite operacional. O restore de um banco real exige autorização e definição formal de origem, alvo e responsável.

**Também pendente para publicação:** aceite de atendente e supervisor nos fluxos de caixa/estoque, tratamento fiscal/contábil externo, aprovação nominal do piloto e decisão explícita de ativação de gates, por organização e CNPJ. **PR #36 permanece DRAFT; sem merge, rollout comercial ou habilitação de pagamentos.**

## Próximo passo recomendado

Manter M.5.56 saudável com flags OFF. Solicitar à proprietária a definição/autorização de um **backup de teste adequado à LGPD e banco de destino isolado**, para completar a parte de dados do Gate 2, ou avançar primeiro no aceite humano do Gate 3 sem novas vendas reais. Não restaurar backups reais automaticamente.
