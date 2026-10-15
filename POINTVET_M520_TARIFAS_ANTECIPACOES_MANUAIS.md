# PointVet M.5.20 — discriminação de tarifas e antecipações de cartões manuais

## Diretriz funcional
O usuário confirmou que o **PointVet não tem e não precisa de conexão com instituições bancárias, Open Finance, adquirentes, maquininhas, TEF ou PSP**. O funcionário confere o extrato FORA do aplicativo e apenas registra manualmente o repasse na conta interna. O lançamento CI-only M.5.13 guarda **somente o líquido**; a correção M.5.14 guarda **um contralançamento líquido**, sem apagar o original.

Esta M.5.20 responde a um requisito de homologação contábil: **separar o bruto original, a tarifa informada e o desconto informado por antecipação, sem transformar desconto em nova despesa paga, imposto retido, receita ou pagamento aprovado automaticamente**.

## Implementado
1. `api/src/modules/pdv/pdv-unificado-discriminacao-tarifas.contract.js`: função pura `discriminarTarifasAntecipacoesM520` lê os estágios M.5.16 já validados por empresa e comanda, calcula valores em **centavos inteiros**, verifica `bruto = tarifa + antecipação + líquido`, `REPASSE_NORMAL` sem antecipação e `ANTECIPACAO` com desconto positivo, rejeita centavos inválidos, duplicidades, estado de entrada pendente, corrido e mistura de CNPJ, e confere o fechamento. Distingue:
   - **Pré-baixas preparadas**, inclusive pendentes/corrigidas: bruto, tarifa, antecipação e líquido previsto (informação histórica sem crédito no saldo interno).
   - **Repasses internos ativos**, que foram confirmados por funcionário e não compensados: bruto correspondente, retenções informadas e líquido ativo da conta interna.
   - **Movimentos internos**: soma de entradas líquidas, correções líquidas e efeito líquido. O repasse corrigido continua histórico na pré-baixa, porém deixa de compor os **totais ativos**; o débito reduz o efeito interno ao valor original.

2. `GET /api/pdv-unificado/recebiveis-cartao/comandas/:comandaId/discriminacao` é estritamente **somente leitura**. Reutiliza `consultarEtapasRepassesM516`, que revalida autenticação, vínculo org/empresa, PDV+FINANCEIRO, `pdv.acessar` e `financeiro.gerenciar`, organização opt-in, 50 preparações máximas ou fail-closed. IDs inválidos: 400; erros de integridade: 409 genérico; `Cache-Control: no-store`. POST não existe.
3. `admin-web/src/components/UnifiedCardReceivablesPanel.jsx` mostra a nova tabela **Composição dos repasses**, separando preparado versus repasses ativos, com bruto, taxas, antecipação e líquido, mais entradas/correções/efeito internos. O texto ressalta que **as taxas não são despesas pagas**.
4. `api/tests/pdv-unificado-discriminacao-tarifas.contract.test.mjs`: casos de normal, antecipação (R$120 bruto, R$2,40 tarifa, R$4,10 antecipação, R$113,50 líquido), compensação integral e recusa de alterações em valores, escopo/empresa, estágio e duplicidades. `api/tests/pdv-unificado-integration.test.mjs`: recálculo após preparação, repasse interno R$60 bruto/R$1,20 tarifa/R$58,80 líquido e contralançamento que zera efeito ativo, sem reclassificar preparação. `api/tests/pointvet-m543-http-checkout-barrier.integration.test.mjs`: rota com autenticação, opt-out, cross-tenant, 400/403/404, método POST inexistente. Workflow Actions valida o contrato, build admin, PostgreSQL descartável e backup/restore sintéticos.

## Regras contábeis ainda pendentes
Este relatório **não cria despesa, título a pagar, BaixaFinanceira, ConciliacaoFinanceira adicional, imposto, crédito fiscal, receita nova, aprovação de Pagamento, caixa, mudança no saldo real ou comprovante bancário**. É um **demonstrativo das retenções informadas pelo funcionário**; identificar a classificação por regime tributário/CNPJ/emissor, apropriação de despesas e tratamento de taxas em devoluções, antecipações e estorno pós-repasse exige homologação fiscal/contábil específica antes de escritas reais. Não reclassificar `resumo.receitasRealizadas` ou `fluxo` baseado apenas em declaração de repasse.

A escrita M.5.13/M.5.14 permanece CI-only sob guardas `pointvet_unified_ci`; a interface não disponibiliza baixa nem confirmação comercial. Sem integração financeira externa, staging REAL, restore real, deploy, migração em produção, merge ou mudança na main/Railway/Pet King.

**Gates:** validar `validate SUCCESS` e `isolated-postgres SUCCESS` no SHA final antes de declarar M.5.20 concluída; então planejar regras de competência/estorno pós-repasse e homologação em staging SEGREGADO apenas quando explicitamente autorizada. PR #36 fica DRAFT.
