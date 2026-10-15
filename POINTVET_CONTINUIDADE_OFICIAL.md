# UPDATE M.4C.3 — MIGRAÇÃO FISCAL ASSISTIDA REVERSÍVEL (14/10/2026)
**Implementado no PR #36 DRAFT apenas em banco CI**. Serviço fiscal-unidades-migracao-sandbox.service.js fornece prévia com fingerprint de snapshot da Empresa e contagens de históricos, vinculação assistida Empresa→EntidadeFiscal→UnidadeOperacional em transação Serializable, lock da Empresa, confirmação de gestor da organização + permissão fiscal.gerenciar e idempotência por solicitação. Não altera Empresa, cnpj único, vendas, caixa, estoque ou DocumentoFiscal. Auditoria registra antes/depois e IDs; mudança no cadastro entre prévia e aprovação BLOQUEIA; CNPJ verificado apenas no formato, não na Receita Federal. Reversão LOGICA desvincula e inativa a unidade importada sem deletar emissor/unidade/históricos; outra unidade permanece intacta; novas importações após reversão exigem tratamento manual. Código SOMENTE pointvet_unified_ci, sem HTTP, transmissão, maquininha, banco ou CREDITO_CLIENTE.

**CI:** teste novo pdv-unificado-fiscal-migracao.integration.test.mjs (permissões, tenant, snapshots, idempotência, concorrência, rollback de vinculação e reversão, preservação de históricos), mais todas as regressões anteriores. Verificar os dois jobs SUCCESS no HEAD final antes de afirmar homologação. [Especificação M.4C.3](POINTVET_M4C3_MIGRACAO_FISCAL_ASSISTIDA.md).

**Próximo:** M.4D integração fiscal apenas após matriz legal, CNPJ com documentação oficial, backfill assistido real multiunidade, aprovação e staging; M.5 restore testado/rollback/canário. PR #35 e main seguem não alterados. Sem deploy automático.

---

# UPDATE M.4C.2 — PREPARAÇÃO FISCAL SEGREGADA POR VENDA FILHA (14/10/2026)
**Realizado no PR #36 Draft, CI somente, produção intacta.** Contrato fiscal-unificado-venda.contract.js e serviço fiscal-unificado-venda-sandbox.service.js; venda filha FINALIZADA de Empresa/CNPJ com operação unificada CONCLUIDA, item/catálogo da própria empresa, tutor e organização conferidos, bloqueio se já há DocumentoFiscal. Escolha explícita NFE/NFCE para produto, NFSE para serviço, sem optar automaticamente por emissão/recibo. Desconto e acréscimo globais rateados separadamente por item usando centavos inteiros, BigInt e maior resto com desempate estável; somas da venda e grupos sempre idênticas. Snapshot da identidade fiscal da empresa e fingerprint determinístico, não persistido. Somente leitura transacional RepeatableRead no PostgreSQL CI, usuario ativo e permissões pdv.acessar + fiscal.visualizar. Sem rota HTTP, nota, XML, transmissão, autorização, pagamento/caixa/estoque ou API bancária. CREDITO_CLIENTE bloqueado; nenhuma integração de maquininha/PSP.

**Testes** contrato e integração ampliada de vendas-filhas M.3B em banco CI. [Primeiro CI #38662162537](https://github.com/isaquesan7/sistema-pet/actions/runs/38662162537) aprovou validate e isolated-postgres. Confirmar CI do HEAD da documentação após commit. **Próximo M.4C.3:** migração assistida da estrutura Empresa->EntidadeFiscal/UnidadeOperacional, snapshots e controle de permissão, sem retirar unicidade de CNPJ nem alterar emissão real. **M.5** staging, restore, rollback, canário, aceite explícito. Ver [detalhamento técnico](POINTVET_M4C2_PREPARACAO_VENDAS_FILHAS.md).

---

# UPDATE M.4C.1 — MATRIZ FISCAL MULTIEMPRESA + MODELO FUTURO MULTIUNIDADES (14/10/2026)
**Implementação feita no PR #36 DRAFT**, sem merge, deploy ou migração de produção. Migration aditiva 20261015013000_fiscal_entity_operational_units_foundation: EntidadeFiscal (organização/CNPJ) e UnidadeOperacional (várias unidades por emissor, apenas UMA ponte opcional a cada Empresa legada), FKs compostas de organização e índices UNIQUE. Empresa.cnpj @unique preservada. Unidade adicional não é operacional hoje.

**Código:** api/src/modules/fiscal/fiscal-unificado-planejamento.contract.js e fiscal-unificado-planejamento-sandbox.service.js. A prévia lê rascunho real só no PostgreSQL descartável pointvet_unified_ci, agrupa por empresa e classe fiscal, distingue produto (NFE/NFCE dependem de escolha) e serviço (NFSE depende de município), verifica catálogo/valor/tributação cadastrada/topologia e exige permissão pdv.acessar + fiscal.visualizar por TODAS as empresas. SEM nota, XML, Venda, estoque, pagamentos, caixa, transmissão, API pública ou alteração de fiscal legado.

**CI específico:** fiscal-unificado-planejamento.contract.test.mjs e pdv-unificado-fiscal.integration.test.mjs; verifica 2 empresas/3 grupos, 2 unidades sob um emissor/1 Empresa, rejeição cross-tenant via FK, no-op econômico, dados fiscais incompletos e permissões. [Documento detalhado](POINTVET_M4C_FISCAL_MULTIUNIDADES_ARQUITETURA.md). Verificar CI do HEAD após os commits de documentação antes de considerar concluído.

**Próximo M.4C.2:** preparação por Venda filha real, confirmação do tipo de documento e rateio de centavos, sem emissão. M.4C.3: migração assistida empresa→unidade, backup, permissões, fiscal por emissor. M.5: staging/restore/rollback/canário aprovado. NÃO integrar maquininha/PSP, nem habilitar CREDITO_CLIENTE. main, PR #35, backup e notificações intactos.

---

# UPDATE M.4B.3 — DEVOLUÇÃO CONTÁBIL CONCILIADA DE CRÉDITO, CI ISOLADO (14/10/2026)
**Código no PR #36 (Draft), sem merge, migração ou deploy.** A M.4B.2 exigia somente declaração do atendente para estorno de entrada pré-paga; a M.4B.3 agora **exige a conciliação contábil de SAÍDA já existente**, além da declaração. Não há integração com banco, Pix, máquina/cartão ou gateway. **Prova contábil lançada pela equipe não constitui confirmação independente da instituição financeira**.

## Implementado em M.4B.3
- Migration aditiva opcional `20261015001500_credit_refund_outbound_reconciliation` acrescenta `CreditoClienteMovimento.devolucaoConciliacaoId @unique` e FK a `ConciliacaoFinanceira`; nomes de relações distintos para crédito de ENTRADA versus devolução de SAÍDA, preservando legado. Migração só em PostgreSQL descartável de CI.
- Para **estornar uma ENTRADA de adiantamento**, `estornarCreditoCausalSomenteSandbox` exige `confirmouDevolucaoExterna=true`, `devolucaoConciliacaoId` da mesma empresa e conta financeira ativa, `ConciliacaoFinanceira` com `origem=BAIXA_TITULO` e `direcao=SAIDA`, baixa única e título financeiro `PAGAR/PAGO/OUTRO` do **mesmo cliente** marcado `DEVOLUCAO ADIANTAMENTO CLIENTE`, sem fornecedor, venda ou pagamento associados. Conciliação, baixa, título e estorno precisam ter valor idêntico, sem juros/descontos. **Um comprovante só pode ser consumido uma vez.**
- Estorno de `UTILIZACAO` **simulada** permanece operação puramente contábil, sem conciliação de devolução: evita emitir duplicidade financeira para um débito que não movimentou dinheiro. Nenhum estorno de estorno.
- Recalcula o saldo em centavos, impede estornar crédito já utilizado se o saldo restante for insuficiente, exige idempotência por solicitação/payload, grava fingerprint, referência causal, operador e evidências imutáveis; `Serializable`, lock do cliente, rollback e auditoria M.4B.2 preservados.
- `checarRazaoCreditoCausal` falha fechado para estorno de ENTRADA antigo sem `devolucaoConciliacaoId` e para reembolso indevidamente atribuído a UTILIZACAO; `conferirEvidenciasCreditoAtualizadas` verifica **também a prova de SAÍDA viva** em toda leitura de saldo e nova operação. Se direção/valor/conta/baixa/título foram alterados, `saldoConfiavel=false` e movimentos seguintes são bloqueados, sem inventar devolução.
- Testes de PostgreSQL descartável cobrem falta de documento de saída, conciliação com direção incorreta, título não pago, valor divergente, tentativa de usar conciliação de entrada, falha após gravação com rollback, replay exato, replay alterado, alteração posterior da fonte e nenhuma venda/pagamento/caixa/estoque/fiscal. Testes e compile em [CI #38657192556](https://github.com/isaquesan7/sistema-pet/actions/runs/38657192556): `validate` e `isolated-postgres` SUCCESS no commit de testes `f1dc3024606e74f6e704bf5d6567daf0be8691be`.

## Limites / próximos passos exatos
- **Não há endpoint HTTP de escrita** para crédito ou devolução. `CREDITO_CLIENTE` continua desativado no PDV Unificado e não é forma de pagamento. O fluxo de teste **não cria títulos, baixas, conciliações nem realiza transferências**; somente confere registros de contabilidade que a fixture CI preparou.
- Antes de qualquer produção: identificar conciliações efetivamente corroboradas por registros externos/bancários conforme processo da organização, política de autenticação e autorização de estorno com segregação de funções, trilhas antifraude e controle de documentos; desenhar vínculo de uso de crédito com venda única/idempotente e cancelamento.
- **Próxima M.4C:** contrato e matriz fiscal por venda-filha/emissor CNPJ, separação serviço/produto por município/UF, documentação de autorização/cancelamento/contingência, sem transmissão fiscal real em CI; solução para **mesmo CNPJ em várias unidades** (pessoa jurídica vs unidade operacional) com compatibilidade e migração planejada. **M.5:** restore de backup, staging, rollback, canário por tenant e autorização explícita. Não remover `Empresa.cnpj @unique` sem redesign.
- PR #36 permanece Draft, `main` preservada, produção da Pet King e backup/notificações intocados. Fonte de verdade: este arquivo + Issue #37 + PR #36, atualizado com HEAD exato após cada CI.

---

# UPDATE M.4B.2 — RAZÃO CAUSAL DO CRÉDITO PRÉ-PAGO EM CI (14/10/2026)
**Branch `feat/pointvet-20-1-unified-pdv-foundation` / PR #36 DRAFT**, sem merge, deploy, migração real, credenciamento bancário, maquininha ou PSP. **CREDITO_CLIENTE CONTINUA DESABILITADO COMO FORMA DE PAGAMENTO.**

## Implementação
- Migration aditiva `20261014235900_client_credit_causal_ledger`: `CreditoClienteMovimento` ganha `conciliacaoId @unique`, `reverteMovimentoId @unique`, `solicitacaoFingerprint`, `responsavelId`, `evidencia`. Campos opcionais preservam histórico legado; não transformar linhas históricas em crédito comprovado.
- `client-credit-ledger.contract.js`: calcula movimentos em **centavos exatos**, `ENTRADA` +, `UTILIZACAO` -, `ESTORNO` de entrada - e de débito + somente com vínculo causal único. Recusa saldo negativo, registros sem causa, anomalias, repetição e dados antigos não homologados. Consulta `creditLedger` continua **somente leitura**, `usoNoPdvHabilitado=false`, `lancamentosHabilitados=false` e saldo indisponível para históricas não comprovadas.
- `client-credit-ledger-sandbox.service.js` **não roteado em HTTP**: exige `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, `DATABASE_URL` banco exato `pointvet_unified_ci` e `SELECT current_database()` dentro de transação `Serializable`. Trava cliente `FOR UPDATE` e confere `financeiro.gerenciar`, vínculo ativo, organização/empresa/tutor, chave idempotente e fingerprint de payload.
- **Entrada exclusivamente mediante lastro contábil:** exige `ConciliacaoFinanceira` tipo `BAIXA_TITULO`, direção `ENTRADA`, mesma conta ativa/empresa, `BaixaFinanceira` única sem desconto/juros e `TituloFinanceiro` `RECEBER/PAGO/OUTRO` de **ADIANTAMENTO CLIENTE**, pertencente ao tutor e sem venda/pagamento associados, todos exatamente no valor do crédito. Uma conciliação só pode financiar um lançamento. Isso é **evidência contábil criada/conferida por operador, não extrato ou confirmação bancária independente**. Não registrar como "banco confirmou".
- `client-credit-evidence.service.js`: toda consulta e novo movimento checam o lastro **ATUAL**, inclusive direção/status/valor/conta/baixa/título; se a evidência for modificada, `saldoConfiavel=false` e todas as mutações sandbox são bloqueadas, até revisão.
- **Débito `UTILIZACAO` APENAS SIMULADO no banco descartável** para provar que saldos nunca ficam negativos em concorrência. Não cria venda, recebimento, pagamento, baixa, documento fiscal ou movimento de estoque e não equivale a pagamento. Estorno `ESTORNO` vincula exatamente uma entrada/débito; entrada de crédito exige `confirmouDevolucaoExterna=true` pelo operador. Isso **não dispara reembolso no Pix, banco ou maquininha**. Estorno impossível se o crédito correspondente já foi consumido e o saldo disponível não comporta reversão.
- **Auditoria** com operador, referência, valor/saldo anterior/posterior, motivo e fingerprint. Idempotência por solicitação/contexto/tipo; referências contábeis e estornos causais únicos no banco; falha parcial `Serializable` reverte movimento e auditoria.
- Testes `client-credit-ledger.contract.test.mjs` e `client-credit-ledger.integration.test.mjs` rodam no workflow de PostgreSQL 16 descartável: prova de origem, valor divergente, org/empresa cruzada, permissões, rollback, concorrência de depósitos/débitos, saldo negativo, crédito sem causa, reversão causal, devolução externa declarada, alteração de fonte, leitura fail-closed, ausência de efeitos sobre PDV/caixa/estoque/fiscal. **Sem dados da Pet King**.

## Próximo passo oficial
**M.4B.3/M.4C**: vincular origem ao comprovante verificável por instituição quando disponível; política de devolução efetiva com conciliação de saída e evidência; revisão de crédito quando há migração histórica; testes de segurança com múltiplas unidades/CNPJ. **Não ligar crédito como forma de pagamento ou endpoint de mutação à UI** sem revisão fiscal/financeira, confirmação do proprietário e homologação de staging, migrations, rollback e restauração (M.5). Fiscal por emissão individual por empresa/CNPJ, NF-e/NFC-e/NFS-e e modelo `EntidadeFiscal`/`UnidadeOperacional` ainda são gates.

## CI e governança
Base M.4B.2 concluída em [run #38648028746](https://github.com/isaquesan7/sistema-pet/actions/runs/38648028746) com `validate` e `isolated-postgres` SUCCESS. Revalidação de evidências e confirmação manual explícita adicionadas após, em commits `aa1726145d77d780a08149a67aefceff22797996` e `73c50e4c66803cb919a75391c58aab551f65937f`. **Verificar CI da HEAD documental antes de afirmar homologação final.** Continue sempre por Issue #37 + este handoff; PR #36 DRAFT e `main` inalterado.

---

# UPDATE M.4B.1 — CONVERSÃO ORÇAMENTO APROVADO → RASCUNHO PDV, SOMENTE CI (14/10/2026)
**Implementado na branch do PR #36, sem merge/deploy.** Schema e migration `20261014234500_quote_to_unified_draft`: ledger `ConversaoOrcamentoPdv` com **unicidade por orçamento e por comanda**, vínculos imutáveis item-orçamento/item-catalogo e snapshot auditado. Serviço `client-quote-pdv-conversion-sandbox.service.js` exige `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, banco exato `pointvet_unified_ci`, autorização financeira + PDV na empresa selecionada, orçamento aprovado e simulação em mesma transação `Serializable`. Lock na linha do orçamento; um rascunho real `Comanda.rascunhoUnificado` (somente no banco CI) e seus itens; nenhum `Venda`, `Pagamento`, `MovimentacaoCaixa`, `MovimentacaoEstoque`, `CreditoClienteMovimento`, `DocumentoFiscal` ou reserva. A operação falha integralmente sob erro injetado e não duplica em replay.
- Idempotência: quote `@unique`, comanda `@unique` e fingerprint do mapeamento; replay válido somente para rascunho ainda aberto, versão e itens idênticos, sem venda ou reserva. Conferência por *multiset* de itens, inclusive nomes/produtos repetidos, impede falsos replays após alterações silenciosas.
- UI: aba Orçamentos na ficha do tutor ganhou modal **“Conferir no PDV”** com pesquisa no catálogo, mapeamento de cada item e retorno de divergência. É **apenas prévia HTTP**; **não há endpoint público para a conversão sandbox**.
- O PDV Unificado é **opcional por organização** e a prévia HTTP agora recusa configuração desligada. Pet King será configurada apenas depois da homologação. O sistema **não integra maquininhas nem gateways de pagamento**.
- Testes específicos no CI validam concorrência, rollback, isolamento entre empresas/organizações, permissão financeira e PDV, replays, mapeamento divergente, rascunho adulterado, zero efeito sobre pagamentos/caixa/estoque/fiscal/crédito e build UI.
- [Execução prévia bem-sucedida #38646601224](https://github.com/isaquesan7/sistema-pet/actions/runs/38646601224) (service e migrations, `validate` e `isolated-postgres` SUCCESS). [CI #38646853605](https://github.com/isaquesan7/sistema-pet/actions/runs/38646853605) aprovou também a UI. **Verificar o CI do HEAD seguinte** após patch de revisão e docs; não declarar liberação de produção por estar verde em CI.

**PRÓXIMAS ETAPAS M.4B.2**: contrato/razão de crédito pré-pago com origens financeiras confirmadas, idempotência e concorrência, reversão causal sem fabricar saldo; UX de conversão eventual de orçamento em rascunho **apenas após nova autorização e testes de staging**, desconto distribuído e redução de divergência de preço mediante revisão explícita. Matriz fiscal por emissor/CNPJ/UF/município, autorização real e mesmo CNPJ/unidades continuam pendentes. **M.5**: staging, restauração de backup, rollback e canário. PR #36 **DRAFT**, PR #35 não mesclado, `main` não alterada.

---

# UPDATE M.4A — ORÇAMENTOS + CRÉDITO DE CONSULTA + PRÉVIA SEGURA DO PDV (14/10/2026)
O PR #35 (fundação de Orçamentos/Crédito) foi **adaptado por port seletivo**, não mesclado, para o branch PR #36. Modelo/migration `20261013213000_client_quotes_credit_foundation`, serviço/rotas de orçamentos, abas da ficha do tutor, carteira **read-only**, validação monetária e auditoria, testes de PostgreSQL CI. Não ocorre crédito no caixa. **Criação/aprovação NÃO geram venda, pagamento, estoque ou fiscal**. `CreditoClienteMovimento` não possui endpoint de escrita; `saldoConfiavel=false` se houver ESTORNO sem vínculo causal.
- Preflight `POST /api/clientes-financeiro/:clienteId/orcamentos/:id/preview-pdv` (dupla permissão financeiro + PDV) compara orçamento APROVADO a itens do catálogo selecionados explicitamente, preço, descrição e total. Exige desconto zero; bloqueia cross-company. **Não cria rascunho ou venda**, não desconta estoque nem faz fiscal. Falta interface de mapeamento e conversão idempotente (M.4B).
- **M.4 Fiscal:** o serviço fiscal legado prepara `NFE`/`NFCE`/`NFSE`/`RECIBO`, mas NÃO está ligado ao fechamento unificado sandbox; matriz fiscal por produto/serviço/UF/município, autorização real e cancelamento exigem homologação. Mesmo CNPJ entre unidades precisa separar entidade fiscal e unidade operacional; não retirar `Empresa.cnpj @unique` antes disso.
- [Arquitetura detalhada](https://github.com/isaquesan7/sistema-pet/blob/feat/pointvet-20-1-unified-pdv-foundation/POINTVET_M4_FISCAL_ORCAMENTOS_ARQUITETURA.md).
- **PRÓXIMO:** M.4B contrato de vínculo orçamento-catálogo, conversão somente para rascunho com idempotência; ledger de crédito confirmado, fiscal separado, modelagem multiunidades. M.5 staging + restore + canário. **Sem merge/deploy/migrations na Pet King**.
- **Validações:** [CI #38644158514](https://github.com/isaquesan7/sistema-pet/actions/runs/38644158514) concluiu `validate` e `isolated-postgres` com SUCCESS antes do incremento de prévia; [CI #38644487128](https://github.com/isaquesan7/sistema-pet/actions/runs/38644487128) identificou incompatibilidade do verificador de desconto zero. Correção `7ba418107c718cba3397012e03b5843ea7991428` disparou novo CI; confirmar run e resultado do HEAD **antes de afirmar aprovado**.

---

# HOMOLOGAÇÃO M.3C — ESTORNO MANUAL INTEGRAL, EXCLUSIVAMENTE EM CI (14/10/2026)
**Implementação M.3C comprovada**: [GitHub Actions #38640657139](https://github.com/isaquesan7/sistema-pet/actions/runs/38640657139), commit de implementação **`ad77b5f60b9c0fc2f72747ce5c2175feb386a263`**, jobs **validate** e **isolated-postgres SUCCESS**. A etapa inicial já passou em [run #38640412290](https://github.com/isaquesan7/sistema-pet/actions/runs/38640412290). **Somente branch PR #36 DRAFT; nenhuma migration, deploy ou merge em produção.**

## Entregue
- **Migration `20261014223000_unified_manual_closing_reversal`**: acrescenta status `ESTORNADA` nas operações-filhas e entidade imutável `EstornoFechamentoManualUnificado` **única por reserva**, com usuário, motivo, referência, confirmação e snapshot/fingerprint. Não altera histórico de pagamentos originais.
- **Contratos e serviço sandbox-only**: `pdv-unificado-estorno-manual.contract.js`, `pdv-unificado-estorno-manual-sandbox.service.js`. Sem endpoint HTTP, worker, provedor ou reembolso automático. Exige confirmação do atendente de devolução fora do sistema; é **declaração humana, não confirmação bancária**.
- **Estorno transacional `Serializable`**: trava comanda/caixas/estoque/lotes, valida permissão `pdv.cancelar_venda` em **todas** as empresas da operação, tenant, CNPJs, pagamento e versão. Em única transação marca `Pagamento.ESTORNADO`, parcelas `ESTORNADA`, `Venda.ESTORNADA`, operações `ESTORNADA`, comanda e itens `CANCELADA/CANCELADO`, reserva cancelada e preparação invalidada. Movimentos de estoque originais permanecem, novos movimentos de compensação vinculam-se ao registro único de estorno. Falha de qualquer empresa desfaz a operação inteira.
- **Financeiro e caixa**: bloqueia **qualquer documento fiscal** vinculado às vendas, parcelas `CONCILIADA` ou com `conciliadoEm`, título financeiro da venda/pagamento, conciliação existente, sessão fechada ou alteração não reconhecida de caixa. Para dinheiro, o fechamento legado já exclui o `Pagamento ESTORNADO`; movimento compensatório é `VENDA` **somente auditável**, não uma segunda saída `ESTORNO`. O sistema **não devolve dinheiro externamente**.
- **Testes PostgreSQL 16 descartável**: persistência única, idempotência, concorrência, recusa de outro tenant, permissão revogada, caixa fechado, parcela conciliada, título financeiro vinculado, rollback após falha de uma empresa, restauração de saldo e **lote**, dinheiro sem dupla baixa e nenhuma emissão fiscal. O workflow inclui novos testes unitários do contrato. Todos passaram no run acima.

## BLOQUEIOS E PRÓXIMO PASSO EXATO
**M.3C concluída somente em CI, NÃO LIBERA CHECKOUT.** Não há integração fiscal nem validação de devolução bancária real. Pagamentos manuais pressupõem comprovação do operador; recebíveis de cartão seguem sem conciliação externa automatizada. Mesmo CNPJ entre unidades permanece incompatível com `Empresa.cnpj @unique`. PR #35 de Orçamentos/Crédito ainda DRAFT. O PR #36 não sofreu deploy; backup de produção e notificações continuam intactos.

**Próxima M.4A:** revisar PR #35 contra HEAD de #36, modelar integração de Orçamentos ao perfil do tutor e PDV (CRUD + conversão idempotente sem faturamento), preservando `CREDITO_CLIENTE` desabilitado. Em paralelo, definir requisitos de emissão fiscal por empresa/CNPJ/tipo de produto/serviço e documentos autorizáveis, sem inventar regimes, provedores ou exceções legais. Em M.4B: ledger transacional para crédito pré-pago e compensações, testes multiempresa; **sem consumir crédito antes da homologação**. O suporte ao mesmo CNPJ exige modelo de unidades/pessoa jurídica, e M.5 requer staging, restauração de backup/rollback, revisão operacional e canário explicitamente aprovado. Não avançar para deploy/merge antes dos gates.

**Registrar após novo commit de docs:** o HEAD documental muda; confirmar novo CI de `validate` e `isolated-postgres` antes de declarar o HEAD homologado.

---

# HOMOLOGAÇÃO DO INCREMENTO M.3A + M.3B — 14/10/2026
**CI de implementação CONCLUÍDO COM SUCESSO**: [GitHub Actions #38638213355](https://github.com/isaquesan7/sistema-pet/actions/runs/38638213355), jobs **validate** e **isolated-postgres** SUCCESS no commit **`0a8f20cc33db2f0b4ae69638d961f9b972cce875`**. SHA anterior de implementação M.3B `ca53c06b8b93230725513b4e89afc2ba8d2f9f74`, M.3A `8e579407e925b92c11ee4dea44067c52a5bb87e1`.
- **Escopo demonstrado**: migration M.3A em PostgreSQL 16 descartável, schema Prisma, testes unitários, integração multiempresa com fechamento M.3B, pagamentos manuais, 3 parcelas de cartão pendentes, verificação de permissões, rollback injetado, concorrência e estoque insuficiente, além dos testes de fundação anteriores.
- **Limites**: sem HTTP/checkout real, sem emissão fiscal, sem PSP, sem baixa do crédito do cliente, sem conciliação/estorno financeiro ou repasse; cartão **não significa saldo de caixa disponível**. PDV legado permanece como estava. A implantação das migrations em produção está PROIBIDA nesta fase.
- **Próximo M.3C**: estorno/compensação auditável, proteção a parcelas já conciliadas, testes de estoque/lotes e recuperação de inconsistência; depois M.4 fiscal/Orçamentos PR #35 e mesmo CNPJ; M.5 backup, staging e canário com autorização.
- O **HEAD após este commit documental requer novo CI**: confirmar a execução exata antes de tratá-lo como homologado. PR #36 continua DRAFT.

---

# UPDATE M.3B — 14/10/2026 (implementação somente PostgreSQL CI)
- **Novo orquestrador de fechamento transacional sandbox**: `pdv-unificado-fechamento-manual-sandbox.service.js` executa `Serializable` com lock de comanda, caixa e estoque, permissão de todas as empresas e validação de pet/preço/snapshot antes da finalização; usa exclusivamente as linhas M.2 imutáveis e suas vendas-filhas ABERTAS. Repetição após commit confere vínculos; `pagamentoId @unique` impede consumo duplo.
- **Dinheiro**: `Pagamento APROVADO` + `MovimentacaoCaixa VENDA` auditável (não soma caixa duas vezes no fechamento legado). Pix/débito/transferência: declarados manualmente, sem PSP. **Cartão crédito**: `Pagamento PENDENTE` + N parcelas `AGUARDANDO_REPASSE`, sem inventar calendário de vencimento nem saldo bancário. Nada é enviado a gateway; nenhuma nota fiscal emitida.
- **Estoque**: baixa uma vez por produto da empresa; saldo protegido, lotes válidos e movimentos por `Venda`. Se uma empresa falhar, SQL desfaz **todos** os pagamentos, estoque, parcelas e alterações de status (injeção de falha CI).
- **Status**: Venda FINALIZADA e Comanda FECHADA **somente banco de testes CI**, não se confunde com autorização para produção. Serviço não é exportado por HTTP nem worker. **Estorno e conciliação de cartão permanecem PENDENTES** (M.3C/M.4), assim como emissão fiscal.
- **Teste CI**: adicionar casos PostgreSQL descartável de concorrência, replay, rollback parcial, cartão a receber, caixa sem dupla contagem, insuficiência de estoque e zero emissão fiscal. Conferir run do HEAD antes de afirmar sucesso.
- **Próxima etapa M.3C**: reversão auditada/idempotente de TODOS os efeitos de fechamento, inclusive parcelas pendentes/repasses e lote/estoque, sem estornar valores já conciliados automaticamente. Depois M.4 fiscal, Orçamentos/Crédito PR #35, modelagem mesmo CNPJ; M.5 backup/teste de restauração, staging e canário com autorização. **PR #36 continua DRAFT, não fazer deploy/merge nem migrations na Pet King.**

---

# UPDATE M.3A — 14/10/2026 (continuidade a partir da Issue #37)
- **Código implementado nesta branch, sem deploy**: novo contrato puro `pdv-unificado-fechamento-manual.contract.js` valida 1 venda-filho ABERTA por empresa, reserva e declaração M.2, empresa/CNPJ, chaves idempotentes, total exato em centavos, caixa, forma, nenhuma linha consumida duas vezes. Retorna somente plano, `podeEfetivarAgora=false`. Nenhuma rota pública ou lançamento.
- **Migração M.3A (somente CI descartável)**: `20261014210000_unified_manual_closing_ledger_foundation` prepara `LinhaRecebimentoManualUnificado.pagamentoId @unique` e `ParcelaRecebivelManualUnificado` única por linha/índice; todas inicialmente `AGUARDANDO_REPASSE`, sem datas fictícias e sem saldo bancário inferido. A criação efetiva de parcelas/pagamentos espera M.3B.
- **Cartão de crédito**: divisão determinística dos centavos em N parcelas, inclusive restos; crédito de cliente continua bloqueado. **Dinheiro físico**: PDV legado já soma `Pagamento(DINHEIRO, APROVADO)` em `fecharCaixa`; futuras movimentações `VENDA` são apenas auditoria, nunca `RECEBIMENTO` duplicado. Outras formas não viram saldo bancário sem conciliação.
- **Testes e CI**: novo teste unitário do contrato; workflow inclui checks e migração no PostgreSQL CI. **Aguardando CI do HEAD após commit** — não registrar SUCESSO antecipado.
- **PRÓXIMO M.3B**: orquestrador `Serializable` apenas no banco `pointvet_unified_ci`, revalidando preço/pet/acesso/caixa/estoque, consumindo cada `LinhaRecebimento...` uma vez, criando `Pagamento` e parcelas a receber, atualizando Venda/Comanda e baixando estoque em UMA transação; teste concorrência/rollback/estorno. Não expor HTTP, fiscal, PSP, crédito do cliente, merge ou deploy. M.4 e M.5 continuam gates.

---

# DECISÃO ATUAL DE PRODUTO — PAGAMENTOS MANUAIS, SEM MAQUININHAS/PSP

**14/10/2026 — SOBRESCREVE O PLANEJAMENTO ANTIGO DE INTEGRAÇÃO PSP NESTE ARQUIVO.** O usuário decidiu explicitamente: **não integrar adquirentes, gateways ou maquininhas na primeira versão**. No fechamento o atendente registra manualmente `DINHEIRO`, `PIX`, `CARTAO_DEBITO`, `CARTAO_CREDITO` ou `TRANSFERENCIA`, com caixa e registros financeiros por empresa/CNPJ. Comprovante, referência/maquininha são opcionais; cartão de crédito informa parcelas. Confirmação do atendente NÃO é confirmação eletrônica do banco e repasses/taxas podem ser separados. `CREDITO_CLIENTE` permanece bloqueado até ledger homologado do PR #35. **PSP deixou de ser impedimento do release. Não perguntar novamente qual maquininha/PSP o cliente usa.**

**[LEITURA OBRIGATÓRIA: POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md](./POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md)** — contrato, roadmap M.1–M.5 e bloqueios atuais. O código PSP/webhooks/outbox das fases 20.2.4B anteriores permanece apenas como **histórico de sandbox**, não é mais a estratégia de recebimento, não deve ser exposto em produção e não obriga integração de provedor.

**M.2 IMPLEMENTADA E TESTADA NO CI, SEM PRODUÇÃO. PRÓXIMA ETAPA OFICIAL: M.3**, fechamento transacional de vendas e registros manuais com caixa, estoque e auditoria por empresa, exclusivamente em sandbox primeiro. M.4 fiscal, estorno e integração Orçamentos/Crédito PR #35; M.5 backup, staging e canário. CNPJ compartilhado por mais de uma unidade ainda exige modelagem. PR #36 segue DRAFT, sem merge/deploy.

---

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

## 8H. Mudança de direção aprovada — recebimentos MANUAIS, Fase M.1
- **Decisão do responsável:** não exigir integração com maquininhas/gateways/PSP, pois os estabelecimentos usam vários terminais diferentes. Forma de pagamento declarada pelo atendente será registrada e contabilizada por empresa, sem integrar hardware.
- **Documento canônico complementar:** [POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md](./POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md), obrigatório para os próximos chats. Ele substitui os marcos de PSP real como bloqueio do release e contém roadmap M.1–M.5. Não remover histórico dos experimentos, apenas não continuá-los para PSP real sem novo pedido.
- **Código Fase M.1:** `api/src/modules/pdv/pdv-unificado-recebimento-manual.contract.js` — valida formas `DINHEIRO/PIX/CARTAO_DEBITO/CARTAO_CREDITO/TRANSFERENCIA`, total por empresa em centavos, sessão de caixa pertencente ao snapshot, parcelamento de crédito 1–24, confirmação explícita do atendente e referência opcional; fingerprint do conteúdo ligado à organização e reserva. Sem `Pagamento`, `Venda`, estoque ou fiscal criado.
- **Testes:** `api/tests/pdv-unificado-recebimento-manual.contract.test.mjs`, execução CI após instalar zod, cobrindo pagamento misto, cartão/parcelas, total, empresa, caixa, marca de confirmação, adulterações, crédito do cliente proibido e fingerprint.
- **Importante:** M.1 é apenas preparação; não afirmar que a contabilização financeira já funciona. Para M.2 criar registro durável, auditoria do atendente e unicidade; para M.3 efetivar pagamento e movimento de caixa da empresa na mesma transação com stock/fiscal segundo regra aprovada.
- **Outras pendências:** PR #35 Orçamentos/Crédito no perfil e PDV, fiscal segregado, suporte a mesmo CNPJ em várias unidades, testes de backup/restore, E2E e piloto.
- **CI/HEAD:** atualizar após última validação; não há autorização de deploy ou migration em produção nesta etapa.

## 8I. Fase M.2 — declarações manuais persistentes e auditáveis (14/10/2026)
- **Concluída na branch e CI**: [workflow #38634484538](https://github.com/isaquesan7/sistema-pet/actions/runs/38634484538), dois jobs `validate` e `isolated-postgres` SUCCESS no commit de código `25caf3435c28135aed3e5a6c87a191169f661084`. Commits documentais posteriores podem alterar o HEAD; verificar novamente.
- **Migration:** `20261014193000_unified_manual_receipt_declarations`, tabelas `registros_recebimento_manual_unificado` e `linhas_recebimento_manual_unificado`, unicidade `reservaId` e `(operacaoId, indice)`; declaração vinculada ao atendente, empresa via operação, sessão de caixa, parcelas e referência opcional.
- **Serviço isolado:** `api/src/modules/pdv/pdv-unificado-registro-manual-sandbox.service.js`, sem rotas HTTP e protegido pelo ambiente PostgreSQL CI. Cria declaração durável sob `Serializable`, lock de comanda, consulta de reserva/preparação, validação de autorização, status da operação, pet/preço/catalogo, valor, empresa, caixa e confirmação manual. Repetição idêntica retorna mesmo ID; alteração posterior é conflito.
- **Cancelamento da reserva** bloqueado após declaração manual: `REGISTRO_MANUAL_EXIGE_REVERSAO`, pois reverter registro feito após pagamento fora do sistema exige fluxo de estorno/ajuste auditável. O serviço M.2 **não** cria `Pagamento`, `MovimentacaoCaixa`, `Venda`, saída de estoque, crédito ou fiscal.
- **Testes integrados CI:** tentativas simultâneas, replay, valor/comprovante divergente, não confirmação, caixa de outra empresa, isolamento tenant, não cancelamento silencioso, zero lançamentos efetivos. Corrigido um erro de relação Prisma na validação; resultado final CI SUCCESS.
- **PRÓXIMA FASE M.3 (SEM PSP):** desenhar fechamento transacional em PostgreSQL isolado, com idempotência por venda/operação/registro e auditoria de atendente. Integrar `Venda.ABERTA→FINALIZADA`, `Pagamento`, movimentações e recebíveis por empresa; diferenciar cartão registrado do repasse efetivo; baixa de estoque/estorno/cancelamento com rollback e recuperação. Auditar efeitos atuais do legado (`criarVendaNoTx`), não chamar indiscriminadamente. Não abrir checkout público sem homologação e emissão fiscal legal.
- **Continuar obrigatoriamente:** PR #35 Orçamentos e Crédito do Cliente (ficha tutor e PDV), mesmo CNPJ em várias unidades, notas por emissor, backup/rollback e canário. A decisão [sem maquininhas/PSP](./POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md) tem precedência sobre todo planejamento PSP anterior.

## 9. Marcadores de status
- **IMPLEMENTADO NA BRANCH** ≠ **HOMOLOGADO** ≠ **EM PRODUÇÃO**.
- **CI VERDE** ≠ **liberação fiscal/pagamento**.
- **Preferência organização marcada** ≠ **checkout habilitado**.
- **Orçamentos/Crédito PR #35** ≠ **integrados ao PDV**.

> Se houver divergência entre este arquivo e o código/CI vivo, registrar a divergência aqui e tratar o código/CI como evidência; não seguir adiante às cegas.
