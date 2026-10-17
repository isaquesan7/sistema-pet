# PointVet M.5.8 — conferência cruzada entre PDV, recebíveis e financeiro

**Objetivo:** impedir que a confirmação MANUAL de um repasse de cartão de crédito seja contabilizada indevidamente como nova receita recebida, saldo bancário, conciliação independente, pagamento aprovado ou entrada de caixa. Esta etapa acrescenta uma prova funcional de ponta a ponta em **PostgreSQL de CI descartável**, sem habilitar checkout do PDV Unificado.

## Comportamento esperado e verificado pelo teste

1. Uma comanda multiempresa finalizada gera uma venda própria para cada CNPJ, suas declarações manuais e parcelas. O crédito da empresa A totaliza R$ 180, em três parcelas de R$ 60. O relatório de faturamento reconhece a venda FINALIZADA separadamente; receitas REALIZADAS da empresa A são zero enquanto o Pagamento está PENDENTE.
2. O painel M.5.7 precisa encontrar a comanda de cartão **realmente finalizada no banco de teste**; lista e detalhe devem apresentar a empresa A e R$ 180 pendentes. A empresa B não recebe dados da A sem permissão `financeiro.gerenciar`, outra organização não pode consultar a comanda e o opt-out bloqueia a leitura.
3. Após M.5.5 registrar R$ 60 de repasse EXTERNO declarado por funcionário, o painel deve mostrar R$ 60 `conciliadoDeclarado` e R$ 120 pendentes, mas o **Financeiro legado** (`resumo`, `fluxo`, `pendentesConciliacao`, `listarContas`) deve permanecer inalterado: nada de novo `Pagamento.status=APROVADO`, `ConciliacaoFinanceira`, `BaixaFinanceira` ou movimento de caixa presumido.
4. Após o estorno integral da fixture de CI (com os comprovantes sintéticos de conciliação removidos somente no teste para permitir o estorno existente), a comanda deve constar como cancelada, parcelas como ESTORNADA e o faturamento finalizado cair de R$ 180 para zero na empresa A, sem fingir um pagamento recebido ou uma devolução bancária.
5. A bateria mantém os ensaios anteriores de permissão, cenários fiscais sintéticos, HTTP, backup/restore sintético e isolamento de CNPJ. O conjunto falha em caso de regressão.

## Arquivos

- `api/tests/pdv-unificado-integration.test.mjs`: ampliado com os novos cenários M.5.8, executado no step existente da pipeline `.github/workflows/pointvet-unified-pdv-foundation.yml`.
- Os serviços M.5.5 e M.5.7 e `api/src/modules/financeiro/financeiro.service.js` são exercitados diretamente, sem duplicar lógica financeira e sem alterar sua implementação ou os cálculos consolidados em produção.
- **Sem novas migrations**, endpoints de escrita, botões de cobrança/repasse, PSP, TEF, maquininha, emissão fiscal oficial ou consultas externas.

## O que esta etapa não resolve

A conciliação M.5.5 registra apenas a **declaração de uma pessoa**, não uma prova bancária independente. Ela não efetua a baixa contábil e, por projeto, não cria título, caixa nem movimentação monetária. A regra oficial de reconhecimento/baixa de cada parcela e eventuais divergências de adquirente/antecipação devem ser homologadas e implementadas separadamente, evitando dupla contagem.

Para publicar o PDV Unificado ainda são necessárias autorização de staging real segregado, validação de backup/restore real e rollback, fluxo completo de operações com dados sintéticos e acompanhamento fiscal/financeiro por CNPJ e município. O PR #36 continua **Draft** e o checkout unificado de produção permanece indisponível. Não tocar em `main`, Pet King, Railway, DNS, Resend ou bancos reais.
