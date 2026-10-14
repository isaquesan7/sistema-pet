# POINTVET — CONTINUIDADE OFICIAL DE DESENVOLVIMENTO

> **LEIA ESTE ARQUIVO PRIMEIRO AO RETOMAR EM OUTRO CHAT.**  
> Projeto: `isaquesan7/sistema-pet` — PointVet (SaaS veterinário/pet shop).  
> Registro inicial: 14/10/2026. Atualizar em **cada incremento** com commit, testes, decisões, bloqueios e próxima ação.
> **Fonte da verdade:** estado atual da branch/PR no GitHub, schema, testes e deploys; não confiar apenas em resumos de conversas.

## 1. Onde retomar
| Artefato | Referência |
| --- | --- |
| Repositório | https://github.com/isaquesan7/sistema-pet |
| **Issue permanente de continuidade (LER PRIMEIRO)** | https://github.com/isaquesan7/sistema-pet/issues/37 |
| PDV Unificado — PR principal (DRAFT) | https://github.com/isaquesan7/sistema-pet/pull/36 |
| Branch PDV | `feat/pointvet-20-1-unified-pdv-foundation` |
| Orçamentos + Crédito Cliente — PR dependente (DRAFT) | https://github.com/isaquesan7/sistema-pet/pull/35 |
| Documento técnico anterior | `POINTVET_20_1_UNIFIED_PDV_FOUNDATION.md` |
| Este documento canônico | `POINTVET_CONTINUIDADE_OFICIAL.md` |
| Esquema de dados | `api/prisma/schema.prisma` |
| CI de homologação isolada | `.github/workflows/pointvet-unified-pdv-foundation.yml` |
| Testes de integração | `api/tests/pdv-unificado-integration.test.mjs` |
| Teste de migração | `api/tests/pdv-unificado-postgres.smoke.mjs` |
| Contratos | `api/tests/pdv-unificado-foundation.contract.test.mjs` |

**Importante:** Este arquivo está na *branch do PR #36*, ainda NÃO em `main`. Para localizá-lo em outro chat, abrir o PR #36/branch explicitamente. Não realizar merge/deploy só para publicar documentação.

## 2. Decisões de produto aprovadas — NÃO MODIFICAR SEM NOVA DECISÃO
1. **PDV Unificado opcional por ORGANIZAÇÃO**: `ConfiguracaoOrganizacao.pdvUnificadoHabilitado` padrão `false`. Algumas organizações continuarão usando exclusivamente PDVs individuais; Pet King deseja usar o unificado **depois da homologação**.
2. Uma comanda/cliente/pet podem reunir ração, consulta, banho etc. de empresas diferentes. Cada item pertence a uma empresa. Subtotais por empresa, total central só para UX.
3. Suportar **empresas que compartilham o CNPJ e empresas com CNPJs diferentes**, sem misturar estoque, receita, recebedor, caixa, fiscal, emissão de notas, centros de resultado ou permissões.
4. **Limitação encontrada:** `Empresa.cnpj @unique` impede múltiplas empresas com mesmo CNPJ. Não remover unicidade de maneira precipitada; modelar pessoa jurídica, estabelecimento/unidade e centro de resultado antes de implantar suporte completo. Um CNPJ pode ter mais de uma unidade operacional, mas responsabilidade fiscal depende da situação legal real.
5. Fiscal separado por emissor/operação: mercadorias NF-e/NFC-e e serviços NFS-e conforme situação legal. Decisão de não emitir só onde houver base fiscal válida; nenhum mecanismo de evasão.
6. Para diferentes CNPJs: pagamentos individuais por recebedor ou provedor compatível com split/contas de recepção, taxas e conciliação corretas. Não basta separar lançamentos no sistema.
7. Integrar **Orçamentos e Crédito do Cliente**:
   - Perfil do tutor: aba Orçamentos filtrada apenas pelo tutor, criar, listar, editar, aprovar/rejeitar e converter em comanda.
   - PDV: mesmo módulo compartilhado de orçamento, sem duplicar lógica; aprovar orçamento **não** faz venda nem pagamento.
   - Perfil do tutor: saldo e histórico de crédito. Crédito como forma de pagamento **apenas após razão, idempotência, concorrência e conciliação** testados.
   - PR #35 contém fundação ainda em DRAFT, migrações NÃO aplicadas. Revisar seu conflito de base/merge e adaptar ao PDV; preservar histórico.
8. Preservar PDV legado e dados de produção; rollout por feature flag de liberação independente da preferência. `preferencia=true` **não significa checkout habilitado**. Nenhuma implantação automática de migrações deste PR.

## 3. Estado confirmado antes do incremento atual
- Produção conhecida antes destas branches: PR #34, commit `af0e33540b3481ba0378c0137654f1a026bbbfb3` (verificar atualidade no GitHub e Railway ao retomar).
- PR #36 em DRAFT, várias rodadas de GitHub Actions aprovadas em PostgreSQL 16 **descartável**; nenhum merge/deploy para produção nestas etapas.
- Fase 20.1:
  - preferência por organização, catálogo protegido, tutor/pet, prévia sem financeiro;
  - `Comanda.rascunhoUnificado` e `versaoRascunho`, rascunho persistente e reabertura, controles de concorrência;
  - rotas legadas bloqueiam faturamento e ocultam rascunhos multiempresa.
- Preparação 20.2:
  - pré-fechamento de valores por empresa e detecção de alterações de preço/itens/pets;
  - plano deterministicamente derivado da comanda, SHA-256 por `org:comanda:versão:empresa`;
  - `ReservaFechamentoUnificado` e `ReservaOperacaoUnificada` com unicidade e auditoria de criador/cancelador, locking, cancelamento por permissão em **todas** empresas;
  - conferência de alocação financeira **read-only**, caixa da mesma empresa, valores em centavos, diagnóstico read-only de estados/links;
  - UI no simulador: rascunho, revisão, reserva/cancelamento, alocação de caixa **SEM COBRAR**.
- Endpoints existentes em `api/src/modules/pdv/pdv-unificado.routes.js`: disponibilidade, catalogo, simulacao, rascunhos GET/POST/PUT, pré-fechamento, plano, reserva GET/POST, cancelamento, caixas, conferência alocação, diagnóstico.
- **Nenhum fluxo novo cria `Venda`, `Pagamento`, `MovimentacaoEstoque` ou `DocumentoFiscal`.**

## 4. Arquitetura fiscal/financeira final desejada (ainda NÃO concluída)
`Organizacao` → `Comanda` → `ComandaItem(empresaId, itemCatalogoId, petId)` → reserva por revisão → operações-filhas por empresa (chave idempotente única) → venda/itens/estoque/recebimentos/caixa por empresa → documento fiscal pelo emissor; valores consolidados apenas para exibição.
As etapas externas (PSP fiscal/gateway) NÃO entram em uma transação SQL única: usar operação durável/outbox, identificador idempotente no provedor, callbacks verificáveis, reconciliação e compensação. Impedir confirmação prematura e reenvio sem consulta de estado.

## 5. ORDEM OFICIAL de implementação (não pular marcos)
- **20.2.3 — IMPLEMENTADA NA BRANCH, CI HOMOLOGADO**: preparação persistente das vendas-filhas sem executar; snapshot de alocações, itens e caixas por empresa, idempotência por reserva, fingerprint do conteúdo, travamento/revalidação em transação serializável e invalidação ao cancelar reserva. **Ainda não cria Venda, pagamentos, fiscal ou estoque.**
- **20.2.4A — IMPLEMENTADA + CI VERDE (SOMENTE SANDBOX):** registros de `Venda` e `VendaItem` em estado **ABERTA**, separados por empresa e vinculados à reserva, em transação serializável que desfaz tudo se uma operação falhar. Proteção tripla contra execução em produção (NODE_ENV=test, `POINTVET_UNIFIED_SALES_SANDBOX=1`, banco real `pointvet_unified_ci`). **Nenhum endpoint público e nenhuma autorização de venda/pagamento/fiscal/estoque.**
- **20.2.4B.1 — IMPLEMENTADA + CI VERDE (SOMENTE SANDBOX):** intenções de autorização segregadas por empresa e parcela, outbox persistente, deduplicação de eventos e simulação de autorização/recusa/incerteza; revalidação posterior às vendas abertas sem enfraquecer o bloqueio legado. Sem API pública, PSP, pagamentos ou fiscal.
- **20.2.4B.2A — IMPLEMENTADO, SANDBOX:** contrato de webhook simulado assinado HMAC com verificação de integridade, janela temporal, correlação por empresa/CNPJ, intenção, valor e evento idempotente. Sem PSP real, sem rota HTTP; CI isolado aprovado.
- **20.2.4B.2B.1 — IMPLEMENTADO + CI VERDE (SOMENTE SANDBOX):** prazo de lease durável na outbox, vencimento vira REVISAO_MANUAL sem reenvio, token da tentativa original preservado e eventos tardios válidos conciliáveis; sem PSP real.
- **20.2.4B.2B.2A — IMPLEMENTADO + CI VERDE (MOCK CI):** cadastro técnico de recebedor por empresa/CNPJ (inativo), evidência imutável de consultas simuladas e deduplicação por chave, sem PSP ou liquidação. Não habilita checkout.
- **20.2.4B.2B.2B.1 — IMPLEMENTADO E CI VERDE:** contrato neutro de consulta PSP com correlação estrita e fail-closed para todos os estados; validação adicional usando empresa, recebedor e valor reais do banco de CI, sem alterar financeiro.
- **20.2.4B.2B.2B.2 — PRÓXIMO / REQUER DECISÃO:** definir PSP real e estratégia por CNPJ vs split, conferir documentação oficial de assinatura/consulta/reembolso, credenciais segregadas e sandbox oficial; desenhar worker de conciliação com fencing e prova do provedor antes de alterar estados. Reutilizar lógica de `api/src/modules/pdv/pdv.service.js`, mas **não chamar** `criarVendaNoTx` nem `fecharComandaEmpresa` indiscriminadamente, pois hoje criam venda FINALIZADA, pagamentos, recebível, baixas de estoque e disparam fiscal fora da transação. Criar orquestrador idempotente auditável com transações, estoque e recuperação sem duplicar.
- **20.3 — Pagamentos multi-CNPJ**: recebedores e caixas corretos, split apenas com PSP compatível, callbacks, autorização, rejeição/estorno parcial, idempotência, conciliação. Não aceitar crédito sem ledger real.
- **20.4 — Fiscal multiempresa**: emissão por CNPJ e tipo de operação, NF-e/NFC-e/NFS-e conforme situação legal, regras por município/UF, obrigatoriedade, estados e recuperação; conferir com especialista fiscal.
- **20.5 — Orçamentos/Crédito**: revisar PR #35, resolver incompatibilidades/migrations, criar serviço único de orçamento entre perfil e PDV, conversão em comanda com chaves idempotentes, razão de crédito com saldos consistentes.
- **20.6 — Hardening e rollout**: multi-tenancy, CNPJs iguais e distintos, permissões parciais, concorrência 2+ sessões, fiscal, queda da API/PSP, backups restaurados, feature flag de checkout independente da preferência, canário Pet King, rollback seguro.

## 6. Regras de desenvolvimento e segurança
- Manter alterações na branch isolada e abrir/atualizar PR; NÃO commitar features direto em `main`, fazer deploy ou aplicar migrations em produção sem aprovação e validação prévia.
- Usar Prisma/PostgreSQL atuais, migrations aditivas, comentários e nomes semânticos. Não reconstruir arquivos a partir de trechos de busca.
- Cada novo estado persistente deve ter **chave de unicidade no DB**, revalidação por tenant/empresa, plano de rollback compatível com dados e testes em banco descartável.
- Nunca marcar sucesso de testes não rodados. Conferir workflow **do commit HEAD**, jobs `validate` e `isolated-postgres`, não workflow anterior.
- **Gate de execução financeira** fechado até testes abrangentes, homologação fiscal/PSP e autorização explícita; sem dados reais de Pet King durante desenvolvimento.
- Se o checkout legado apresentar risco por ver comandas unificadas, proteger imediatamente as rotas e endpoints antigos.
- Respeitar credenciais, tokens, backup, e-mails Resend e tenants existentes; não desativar notificações/backup por causa do PDV.

## 7. Antes de começar no próximo chat
1. Abrir PR #36, conferir HEAD/branch, CI atual, esquema, diffs e este arquivo.
2. Abrir PR #35 e determinar se Orçamentos/Crédito foram atualizados, merged ou sofreram conflito; NÃO presumir que foram concluídos.
3. Verificar `main` e deploys atuais (produção pode avançar enquanto chats estão separados).
4. Abrir `POINTVET_20_1_UNIFIED_PDV_FOUNDATION.md` e os módulos de serviço/rotas.
5. Continuar **na próxima etapa da seção 5**, fazendo testes unitários/integração em PostgreSQL descartável.
6. Atualizar **este arquivo, a issue #37 e a descrição do PR #36 ao final de cada incremento**, com HEAD, testes e próxima ação.

## 8. Registro de progresso (manter cumulativo)
| Data | Incremento | Estado |
| --- | --- | --- |
| 14/10/2026 | 20.1 — preferência, simulação e rascunho, testes | implementado na branch, CI isolado |
| 14/10/2026 | 20.2.1 — reserva idempotente por empresa e cancelamento | implementado na branch, CI isolado |
| 14/10/2026 | 20.2.2 — conferência caixa/alocação/diagnóstico read-only | implementado na branch, CI isolado |
| 14/10/2026 | 20.2.3 — preparação persistente de vendas por empresa | **implementado na branch; CI validate + isolated-postgres SUCCESS, run 38566501137 (commit c85a5ea9e15ca12e2a2b03e55b7a7da26ce3cad3)** |
| 14/10/2026 | 20.2.4A — Venda/VendaItem ABERTA em sandbox com rollback atômico | **CI SUCCESS — run 38571495511, commit 0c99dc2740f1427ab704d8756fe360289e0939e7; nenhum deploy** |
| 14/10/2026 | 20.2.4B.1 — intenções e outbox de autorização simulada por empresa | **CI SUCCESS — run 38574760665, commit e9f6304f29145649667d538e2235fa4e1a90a09e; nenhum deploy** |
| 14/10/2026 | 20.2.4B.2A — contrato webhook PSP simulado com HMAC e validação de recebedor | **CI SUCCESS — run 38587348284, commit b03903c8217fa7ae967a34f9ea65d1bc7a3177ab; nenhum PSP/deploy** |
| 14/10/2026 | 20.2.4B.2B.1 — lease/timeout seguro da outbox, quarentena e confirmação tardia | **CI SUCCESS — run 38591326888, commit ce29377e3f860d090a4bfb66840433c8c8824ff4; sem pagamentos/deploy** |
| 14/10/2026 | 20.2.4B.2B.2A — recebedores mock desativados + consultas de status auditáveis | **CI SUCCESS — run 38594976082, commit c6103b04e3f263dbf39fff141b2be97e46143285; sem gateway/deploy** |
| 14/10/2026 | 20.2.4B.2B.2B.1 — contrato neutro PSP, correlação por CNPJ/valor/chave e testes | **CI SUCCESS — run 38598976176, commit 3b7e425a9edf950cbe70da9ee3f8d52de82460b5; sem PSP/deploy** |

### Modelo de atualização de handoff por incremento
`Data; fase; branch; commit HEAD; arquivo(s); migration(s); testes com ID de run; limitações; riscos; ação exata seguinte; deploy/produção: NÃO`.


## 8A. Incremento 20.2.3 — estado exato e contratos
**Código implantado somente na branch, NÃO em produção.**
- Modelagem Prisma: `CriacaoPreparacaoUnificada` (1:1 por reserva, `reservaId @unique`), `StatusPreparacaoExecucaoUnificada` (`PREPARADA`, `INVALIDADA`), referência ao usuário criador, `fingerprint` SHA-256 e `snapshot Json` imutável.
- Migração aditiva: `api/prisma/migrations/20261014113000_unified_sale_preparation/migration.sql`.
- Serviço: `api/src/modules/pdv/pdv-unificado-preparacao.service.js` → `prepararExecucaoUnificada` e `consultarPreparacaoUnificada`.
- Endpoints (todos autenticados e condicionados à preferência): `POST /api/pdv-unificado/rascunhos/:id/preparacao-execucao` (mesmo corpo da conferência: `{versao,alocacoes:[{empresaId,sessaoCaixaId,pagamentos:[{forma,valorCentavos}]}]}`), `GET /api/pdv-unificado/rascunhos/:id/preparacao-execucao?versao=N`.
- Preparo ocorre em transação serializável, `FOR UPDATE` na comanda, valida tenant, versão, reserva ativa, autorização a **todas** empresas, planejamento preço/pet e soma/caixa. Compara reserva original com o plano atualizado. Grava snapshot só após todas validações.
- `fingerprint` usa reserva+versão+alocações normalizadas (ordem de empresas/pagamentos não altera hash); 2 chamadas com dados equivalentes retornam **mesmo ID**; payload diferente gera erro `PREPARACAO_DIVERGENTE` sem sobrescrever. Unicidade adicional no banco por `reservaId`.
- Cancelar reserva invalida a preparação na mesma transação, mas **não apaga** registros/histórico; nova reserva só após nova revisão da comanda.
- Tela `admin-web/src/pages/UnifiedPdvPreviewPage.jsx` expõe comando explícito "Salvar preparação (sem vender)" e visualiza seu estado; nada de checkout real.
- Testes: simultaneidade, idempotência de repetição, ordem indiferente, conflito de payload, zero venda/pagamento, invalidação ao cancelar; migrados num PostgreSQL descartável. **CI PR #36 run 38566501137: jobs `validate` e `isolated-postgres` SUCCESS no commit c85a5ea9e15ca12e2a2b03e55b7a7da26ce3cad3**.
- **Nota:** todo hash é sobre um plano de preparação, NÃO idempotência de cobrança no PSP. Ainda precisa de orquestrador de execução, conciliação e tratamento de efeitos externos.

### Especificação mínima da próxima Fase 20.2.4 — vendas reais em ambiente isolado
**Primeiro revisão arquitetural; não ativar endpoint financeiro público ou deploy.**
1. Ler `criarVendaNoTx`, `fecharComandaEmpresa` e `criarDocumentoAutomaticoVenda` do PDV legado; estes hoje fazem finalização, inserem pagamentos, baixam estoque e podem disparar fiscal. Proibido chamar esse fluxo diretamente com os rascunhos atuais.
2. Definir quando uma venda por empresa passa de intenção / aguardando autorização para `FINALIZADA` e quais pagamentos do PSP realmente foram confirmados. Uma comanda unificada deve ter 1 Venda por empresa e vínculo unívoco `ReservaOperacaoUnificada.vendaId`.
3. Criar serviços testáveis de orquestração que: recuperam snapshot 20.2.3, revalidam usuário/CNPJ/pet/preços/estoque/caixa dentro de TX, asseguram `chaveIdempotencia` única e protegem corrida. Não aceitar valores globais arbitrários do navegador.
4. Externalidades (gateway, NF-e/NFS-e, e-mails) devem usar outbox/estado persistido, nunca chamada de rede dentro de SQL transaction; em timeout consultar status pelo ID antes de repetir.
5. Testar: respostas repetidas, duas sessões concorrentes, falha antes/depois de commit, falha de uma empresa enquanto outra recebe, estornos/compensação, estoque único, CNPJs diferentes, tentativa de operação com acesso revogado, comprovante e nota fiscal independentes. Não marcar sucesso se apenas teste de schema/CI.
6. **Bloqueio absoluto**: não integrar crédito de cliente como pagamento antes da revisão do PR #35 e da consistência do razão; não habilitar emissão opcional irregular; não fazer deploy/merge antes de backup restaurável/rollback e canário aprovado.

### Protocolo de handoff obrigatório
Em cada continuação, antes de avançar: confirmar HEAD de PR #36 e PR #35, verificar divergência com `main` e CI **do HEAD**; depois fazer commit de código, esperar CI, atualizar esta seção com SHA/run/erros e próxima decisão, atualizar a issue #37 e o corpo do PR #36; nunca escrever "concluído" para etapa não homologada.

## 8B. Incremento 20.2.4A — vendas-filhas SOMENTE no sandbox
- **Arquivos:** `api/src/modules/pdv/pdv-unificado-venda-sandbox.service.js`, `api/prisma/schema.prisma`, `api/prisma/migrations/20261014140000_unified_sandbox_sale_state/migration.sql`, `api/tests/pdv-unificado-integration.test.mjs`, workflow CI.
- **Novo enum:** `StatusReservaOperacaoUnificada.VENDA_RASCUNHO`, que não significa venda confirmada. `Venda.status = ABERTA` para cada empresa; `VendaItem` associa linhas a itens da comanda. `ReservaOperacaoUnificada.vendaId` permanece único.
- **Serviço:** `criarVendasFilhasSomenteSandbox({organizacaoId,usuarioId,empresaId,id,versao,simularFalhaAposEmpresaId?})`. Não importado pelas rotas HTTP nem pela interface. Trava tripla: `NODE_ENV === "test"`, `POINTVET_UNIFIED_SALES_SANDBOX === "1"`, `DATABASE_URL` e `SELECT current_database()` exigem **`pointvet_unified_ci`**. Não trocar ou afrouxar esses gates.
- **Transação `Serializable`:** lock de comanda (`FOR UPDATE`), valida organização, versão, autorização de todas as empresas, reserva/preparação, itens/preços/pets, alocações por caixa, totais e chaves idempotentes. Um único commit cria todas vendas-filhas ABERTAS e seus itens; falha depois da primeira empresa provoca rollback integral.
- **Replay:** retorna as vendas-filhas previamente criadas se todas estão vinculadas e íntegras. Não cria duplicidade. Se existe ligação parcial/inconsistente, retorna erro e exige análise, nunca cria nova venda no escuro.
- **Testes CI:** fault injection após primeira empresa, zero vendas após rollback, concorrência de duas requisições, replay, vínculos por empresa, edição/cancelamento negados após vinculação, detecção de mudança de preço, zero `FINALIZADA`, zero `Pagamento`, zero movimentações de estoque, zero `DocumentoFiscal`. **Run 38571495511, jobs `validate` + `isolated-postgres` SUCCESS no commit `0c99dc2740f1427ab704d8756fe360289e0939e7`.**
- **Limites:** Esta etapa NÃO é fechamento real. Não há gateway, autorização de pagamento, outbox, emissão fiscal, conciliação, split ou consumo de crédito. O serviço não deve ser publicado ou exposto em produção. `Venda.ABERTA` no sandbox é apenas prova de integridade transacional.
- **PRs:** PR #36 DRAFT, PR #35 Orçamentos e Crédito permanece DRAFT (sem migrações em produção). Issue #37 é o índice do handoff.

### 20.2.4B — instrução exata de retomada
1. Ler `POINTVET_CONTINUIDADE_OFICIAL.md`, issue #37, PRs #35/#36 e confirmar CI/HEAD e `main`; revisar a lógica de checkout legado que registra pagamentos e estoque/fiscal.
2. Modelar uma máquina de estados por operação/venda/recebedor: `PREPARADA → AGUARDANDO_AUTORIZACAO → AUTORIZADA/RECUSADA/PARCIAL → CONCILIADA`, com estados concretos adequados, logs, auditoria e constraints. Não pular a autorização externa verificada.
3. Definir transação SQL + outbox/reconciliação para gateway e fiscal, sem chamadas externas na transação; tratar perda de resposta, webhook duplicado, mudança de credenciais/empresa e estorno. Exigir idempotência no PSP e ledger/caixa segregado.
4. Fazer testes em PostgreSQL descartável, sem habilitar endpoint de venda real. Para múltiplos CNPJs não implementar "pagamento único" antes de escolher/adaptar provedor split.
5. **Orçamentos e Crédito:** manter PR #35 no escopo; Orçamentos únicos no perfil e PDV, conversão idempotente; Crédito do Cliente só entra quando saldo/movimentos transacionais estiverem homologados.
6. Antes de qualquer merge/deploy: segurança multi-tenant, suporte a várias unidades mesmo CNPJ, backup/restauração e validação fiscal; preferência por organização continua opcional e NÃO é flag de checkout.

## 8C. Incremento 20.2.4B.1 — intenções e outbox duráveis, sandbox
**CÓDIGO IMPLEMENTADO SOMENTE NO PR #36, NÃO EM PRODUÇÃO. Não existe gateway PSP conectado.**

- **Novas tabelas/modelos**: `IntencaoAutorizacaoUnificada` (única por operação+índice e por chave), `OutboxAutorizacaoUnificada` (única por intenção, com token/estado/tentativas) e `EventoAutorizacaoSimulada` (chaveEvento única).
- **Migration**: `api/prisma/migrations/20261014153000_unified_auth_outbox_sandbox/migration.sql` (aditiva). Todos os campos continuam inertes enquanto não houver serviço autorizado de execução.
- **Serviço interno**: `api/src/modules/pdv/pdv-unificado-autorizacao-sandbox.service.js`. **Não importado por rotas, HTTP ou worker de produção**. Reutiliza as travas obrigatórias `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, banco `pointvet_unified_ci` verificado pela URL e em `SELECT current_database()`.
- `enfileirarAutorizacoesSomenteSandbox(ctx)`: trava a comanda, valida tenant/acesso em **todas** as empresas, versão, reserva/preparação, vendas-filhas ABERTAS, conteúdo imutável do snapshot contra itens atuais, preços, pets, caixas, totais. Cria atomicamente 1 intenção por componente de pagamento e 1 evento pendente de outbox por intenção. Repetição recupera mesmos IDs, divergência falha.
- **Atenção arquitetural:** não chamar `planejarFechamento` depois da criação de `Venda.ABERTA`, pois o pré-fechamento legado bloqueia corretamente rascunhos que já tenham vendas-filhas. A revalidação segura nessa etapa compara diretamente o snapshot imutável com `ComandaItem`, catálogo, pet, reserva, empresa e caixa no mesmo TX. **Não remover o bloqueio legado.**
- `reclamarOutboxSomenteSandbox(ctx)`: marca uma única intenção como `EM_SIMULACAO` com token/contador. Repetições **não reenviam nada**. `podeEnviar=false` em todas as respostas. Não há conexão com serviços externos.
- `registrarEventoSomenteSandbox(ctx)`: aceita unicamente resultados simulados `CONFIRMADA/RECUSADA/INDETERMINADA`, deduplica por `chaveEvento`, recusa eventos divergentes e resultados terminais conflitantes. `INDETERMINADA_SIMULADA` cria estado `REVISAO_MANUAL`, que poderá receber nova evidência sintética de resolução sem duplicar a operação. `CONFIRMADA_SIMULADA` **não é `Pagamento.APROVADO` e nunca finaliza `Venda`**.
- **Testes**: tentativas concorrentes de enfileiramento, replay, duplicação de claim, indeterminação → revisão manual → resultado final simulado, evento duplicado/contraditório, resultado recusado na outra empresa e zero efeitos financeiros/fiscais. **CI run 38574760665, jobs `validate` e `isolated-postgres` SUCCESS, SHA `e9f6304f29145649667d538e2235fa4e1a90a09e`.**
- Duas rodadas anteriores foram rejeitadas pelo CI: erro de sintaxe no teste e uso equivocado do pré-fechamento após a existência de vendas-filhas. Ambas foram corrigidas; a última rodada verde confirma o novo percurso.
- **Próxima etapa 20.2.4B.2:** contrato do PSP + autenticação/callbacks, multi-recebedores, persistência de autorização real, leasing com política de timeout que consulta status externo antes de novo envio, idempotência por PSP, reconciliação/estorno e testes de falhas parciais. Ainda sem habilitar pagamento real ou fiscal.
- **Dependência não esquecida**: PR #35 de Orçamentos + Crédito do Cliente, ainda DRAFT; o perfil do cliente e o PDV compartilharão o mesmo sistema de orçamentos, e Crédito apenas com razão seguro/conciliado.
- PR #36 permanece DRAFT. Não aplicar migrations, habilitar checkout, fazer merge ou deploy em Pet King sem revisão e autorização.

## 8D. Incremento 20.2.4B.2A — contrato criptográfico PSP simulado
- **Implementado:** `api/src/modules/pdv/pdv-unificado-psp-sandbox.contract.js`, sem registro em rota HTTP, gateway ou worker. Não gera pagamentos nem finaliza vendas.
- Contrato HMAC-SHA256 sobre timestamp + corpo JSON bruto, comparação constant-time (`timingSafeEqual`), janela de 300 s, rejeição de assinatura inválida/expirada, CNPJ numérico de 14 dígitos, intenção pela chave idempotente e empresa/organização corretas, valor em centavos igual ao da intenção e deduplicação de `eventoId`.
- **Não é implementação do webhook de um PSP real**: autenticação, assinatura e formatos deverão seguir documentação específica do provedor escolhido. O segredo é fornecido pelo teste; não foi persistido em arquivos, variáveis de produção ou banco.
- Testes em `api/tests/pdv-unificado-integration.test.mjs`: assinatura alterada, corpo adulterado, evento expirado, valor divergente, CNPJ/tenant incorretos, evento assinado de recusa e replay sem duplicidade, mantendo zero `Pagamento`/`Venda.FINALIZADA`/fiscal/estoque.
- **CI testado do commit `b03903c8217fa7ae967a34f9ea65d1bc7a3177ab`**: `PointVet Unified PDV Foundation` [run 38587348284](https://github.com/isaquesan7/sistema-pet/actions/runs/38587348284) `validate` SUCCESS, `isolated-postgres` SUCCESS. Commits documentais posteriores: verificar novamente HEAD e o CI ao retomar.
- **Gates de release**: novo [POINTVET_GATES_PUBLICACAO.md](./POINTVET_GATES_PUBLICACAO.md) define Preview/Staging, Beta Comercial e Release Geral com exigências fiscais, PSP/recebedor, Orçamentos/Crédito, suporte ao mesmo CNPJ, backup e rollback.
- **Próxima ação 20.2.4B.2B:** escolher PSP/estratégia de pagamentos (por CNPJ ou split homologado), modelar conta de recebedor por pessoa jurídica, autenticação real via secret manager, outbox worker com lease/fencing e consultar status antes de reenvio. Validar sandbox real PSP com webhook oficial; não abrir endpoint de checkout até revisão e homologação.
- **Orçamentos e Crédito do Cliente** continuam no PR #35 e não devem ser esquecidos; abas do tutor + PDV compartilhando módulo único e conversão de orçamento em comanda.
- **Publicação:** Nenhuma etapa de checkout do PR #36 em produção. `main` e Railway não alterados neste incremento. PR #36 e #35 seguem DRAFT.

## 8E. Incremento 20.2.4B.2B.1 — lease e timeout sem reenvio
- **Estado:** implementado na branch PR #36; testado somente em PostgreSQL descartável. Sem mudança de checkout, worker ou PSP em produção.
- **Schema Prisma:** `OutboxAutorizacaoUnificada.leaseExpiraEm DateTime?` e `motivoRevisao String?`, índice composto `[status, leaseExpiraEm]`; migration aditiva `api/prisma/migrations/20261014170000_unified_outbox_lease_reconciliation/migration.sql`.
- **Serviço:** `api/src/modules/pdv/pdv-unificado-autorizacao-sandbox.service.js`. `reclamarOutboxSomenteSandbox` grava prazo de 60 segundos, token e uma tentativa. Continua retornando `podeEnviar=false` em todas as situações; sem chamadas de rede.
- **Nova função:** `verificarExpiracaoOutboxSomenteSandbox(ctx)`, transação serializável + lock da comanda + escopo de organização e todas as empresas. Lease válido mantém `EM_SIMULACAO`. Lease vencido passa para `REVISAO_MANUAL` com `motivoRevisao=TIMEOUT_SEM_CONFIRMACAO`, **não** volta para `PENDENTE`, não cria outro token, não aumenta contador de tentativas e **não** inicia nova autorização.
- Se a tentativa antiga for verificada posteriormente por evento válido, o mesmo token pode resolver o estado `REVISAO_MANUAL` em `CONCLUIDO_SIMULADO`; o evento segue sujeito à assinatura/correlação/deduplicação existentes. `INDETERMINADA` marca `RESULTADO_INDETERMINADO`.
- **CI da implementação:** [GitHub Actions 38591326888](https://github.com/isaquesan7/sistema-pet/actions/runs/38591326888), ambos os jobs SUCCESS, commit de código `ce29377e3f860d090a4bfb66840433c8c8824ff4`. Testes conferem antes/depois do vencimento, múltiplas checagens, contador de tentativas imutável, consulta da tentativa anterior, evento assinado tardio e nenhum pagamento, venda finalizada, estoque ou fiscal.
- **Limitação relevante:** lease aqui é apenas marcação e quarentena de tentativa simulada; **não é worker real com fencing de múltiplos executores, consulta PSP ou reprocessamento autorizado**. Ainda não há PSP selecionado, webhooks de provedor oficial, split, recebedores ou estornos reais.
- **Próximo passo exato 20.2.4B.2B.2:** validar quem será o PSP ou se cada CNPJ terá POS/recebimento individual; desenhar esquema de contas por pessoa jurídica, credenciais no Secret Manager, algoritmos oficiais de assinatura, idempotency key junto ao PSP, consulta por ID antes de qualquer retry, reconciliação e estornos por empresa. Primeiro homologar em sandbox real, sem disponibilizar checkout público.
- **Dependências de release:** [POINTVET_GATES_PUBLICACAO.md](./POINTVET_GATES_PUBLICACAO.md), PR #35 Orçamentos/Crédito no perfil do cliente e PDV, suporte a unidades de mesmo CNPJ, notas segregadas e backup/rollback.
- **Sem merge/deploy/migrations na Pet King.** Documentação e Issue #37 precisam refletir este avanço; confirmar CI do último HEAD ao retomar.

## 8F. Incremento 20.2.4B.2B.2A — identificação e auditoria de recebedores simulados
- **Status:** código implementado e testado somente na branch PR #36. [Workflow 38594976082](https://github.com/isaquesan7/sistema-pet/actions/runs/38594976082): `validate` e `isolated-postgres` SUCCESS no commit `c6103b04e3f263dbf39fff141b2be97e46143285`. Commits documentais posteriores precisam de checagem de HEAD.
- **Banco/Prisma:** `RecebedorPspUnificado` com `empresaId @unique`, CNPJ, referência externa não sensível, `provedor = SIMULADOR_CI` e `ativo = false` por padrão; `EvidenciaConsultaPspSimulada` com `chaveConsulta @unique`, intenção, recebedor, resultado e referência da transação. Migração aditiva `20261014183000_unified_mock_receivers_status_evidence`.
- **Serviço:** `api/src/modules/pdv/pdv-unificado-recebedores-sandbox.service.js`, com trava `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, banco real `pointvet_unified_ci`. **Sem rota HTTP, worker ou credencial de PSP**.
- `registrarRecebedorMockSomenteSandbox`: valida organização, empresa ativa e CNPJ exato, exige referência `ci_mock_...`, só registra mapeamento inativo; replay com mesmos dados idempotente; divergência bloqueada. Não registra dados bancários reais.
- `registrarConsultaStatusMockSomenteSandbox`: exige usuário com acesso a **todas as empresas** da reserva, intenção na reserva correta, recebedor pertencente à mesma empresa/CNPJ, outbox em `REVISAO_MANUAL` e identificador de consulta único. Persistência imutável e deduplicação, erro para evento conflitante ou cruzamento entre organizações.
- **Limite essencial:** evidências de status **são simulações não verificadas pelo PSP** e NÃO alteram `IntencaoAutorizacaoUnificada`, `Pagamento`, `Venda`, estoque, fiscal ou o estado da outbox. `podeReenviar=false` e `liquidacaoConfirmada=false`. Nunca converter esta evidência em confirmação de dinheiro real.
- **Testes:** tentativa fora do ambiente, CNPJ errado, outra organização, recebedor trocado entre empresas, consulta de intenção fora de revisão, replay idempotente, conflito da mesma chave, ausência de mudança de status/financeiro. CI success.
- **Próxima ação exata 20.2.4B.2B.2B:** selecionar PSP e padrão para diferentes CNPJs, determinar recebedores e necessidade de split; obter contrato de idempotência e assinatura de webhook **do provedor escolhido**, integrar status query e conciliação em sandbox oficial com proteção contra dupla cobrança e prova assinada. Sem abrir checkout.
- **Pendências obrigatórias:** PR #35 Orçamentos e Crédito do Cliente no perfil do tutor/PDV, suporte a unidades de mesmo CNPJ (hoje `Empresa.cnpj @unique`), notas fiscais separadas, restauração de backup e piloto.

## 8G. Incremento 20.2.4B.2B.2B.1 — correlação PSP independente de provedor
- **Status:** implementado e homologado no CI isolado na branch do PR #36, NÃO em produção. [Workflow 38598976176](https://github.com/isaquesan7/sistema-pet/actions/runs/38598976176) com `validate` e `isolated-postgres` SUCCESS no commit `3b7e425a9edf950cbe70da9ee3f8d52de82460b5`.
- **Novo arquivo puro:** `api/src/modules/pdv/pdv-unificado-consulta-psp.contract.js` implementa `correlacionarConsultaPsp` e `validarCapacidadesPsp`. Validar provedor, empresa, CNPJ, identificador de recebedor, chave de idempotência, moeda BRL, valor em centavos, transação e status observado. Todas as respostas ficam `podeReenviar=false`, `podeFinalizarVenda=false`, `liquidacaoConfirmada=false`, inclusive status textual LIQUIDADA.
- **Consulta somente leitura e vinculada ao banco CI:** `conferirRespostaConsultaPSPMockSomenteSandbox` em `api/src/modules/pdv/pdv-unificado-recebedores-sandbox.service.js`. Revalida tenant/acesso em todas as empresas, intenção existente, outbox em REVISAO_MANUAL, recebedor inativo `SIMULADOR_CI` da mesma empresa/CNPJ e valor originalmente armazenado no PostgreSQL. Retorna apenas correlação técnica sem registrar pagamento, evidência, crédito ou confirmação externa. Não há HTTP nem gateway.
- **Testes:** `api/tests/pdv-unificado-psp-contract.test.mjs` contempla todos os 9 estados de consulta e rejeita falsificação de CNPJ/empresa/recebedor/valor/chave/provedor/moeda/status. Teste integrado contempla valores originados do banco, status textual LIQUIDADA que não confirma dinheiro, acesso negado a outra organização e preservação de REVISAO_MANUAL e pagamento ausente.
- **Gate permanente:** correlação não é autenticação, autorização PSP, captura nem liquidação. O modelo não marca recebimento efetivo, não permite retry nem liquidação automática e nunca expõe endpoint de checkout. Mesmo `validarCapacidadesPsp` com todas flags fornecidas retorna `checkoutHabilitado=false`.
- **Próximo incremento 20.2.4B.2B.2B.2:** solicitar decisão concreta do PSP ou estratégia de recebimento individual por CNPJ; usar documentação oficial do provedor escolhido para assinatura/autenticação, consulta de status e idempotência; testar sandbox oficial e worker com fencing/outbox; estornos, conciliação e tratamento de várias empresas. Sem acesso a credenciais PSP nem decisão de provedor, não criar integração real presumida.
- **PR #35:** continua DRAFT. Orçamentos no perfil do tutor e PDV compartilhado + Crédito do Cliente com razão/estornos são **pendências explícitas**; revisão necessária antes de implantação. Não transformar crédito pré-pago em forma de pagamento sem ledger transacional. 
- **Outros bloqueios de release:** mesmo CNPJ em múltiplas unidades (atual `Empresa.cnpj @unique`), fiscal segregado, backup/restauração e canário.
- **Sem merge, deploy ou migrações em produção.** Após este commit documental conferir novamente CI do HEAD.

## 9. Marcadores de status
- **IMPLEMENTADO NA BRANCH** ≠ **HOMOLOGADO** ≠ **EM PRODUÇÃO**.
- **CI VERDE** ≠ **liberação fiscal/pagamento**.
- **Preferência organização marcada** ≠ **checkout habilitado**.
- **Orçamentos/Crédito PR #35** ≠ **integrados ao PDV**.

> Se houver divergência entre este arquivo e o código/CI vivo, registrar a divergência aqui e tratar o código/CI como evidência; não seguir adiante às cegas.
