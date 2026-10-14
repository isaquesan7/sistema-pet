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
- **20.2.4 — PRÓXIMO INCREMENTO: Projeto e testes de venda transacional no sandbox**: só após 20.2.3 e design revisado. Reutilizar lógica de `api/src/modules/pdv/pdv.service.js`, mas **não chamar** `criarVendaNoTx` nem `fecharComandaEmpresa` indiscriminadamente, pois hoje criam venda FINALIZADA, pagamentos, recebível, baixas de estoque e disparam fiscal fora da transação. Criar orquestrador idempotente auditável com transações, estoque e recuperação sem duplicar.
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

## 9. Marcadores de status
- **IMPLEMENTADO NA BRANCH** ≠ **HOMOLOGADO** ≠ **EM PRODUÇÃO**.
- **CI VERDE** ≠ **liberação fiscal/pagamento**.
- **Preferência organização marcada** ≠ **checkout habilitado**.
- **Orçamentos/Crédito PR #35** ≠ **integrados ao PDV**.

> Se houver divergência entre este arquivo e o código/CI vivo, registrar a divergência aqui e tratar o código/CI como evidência; não seguir adiante às cegas.
