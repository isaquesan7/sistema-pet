# PointVet M.5.13 — homologação da conciliação FINANCEIRA MANUAL dos repasses

**Decisão funcional reafirmada em 15/10/2026:** o PointVet NÃO estabelece conexão com nenhuma instituição bancária, Open Finance, adquirente, maquininha, TEF ou PSP. O estabelecimento consulta seu banco fora do sistema e um funcionário autorizado **informa manualmente** a conferência de crédito no extrato. `ConciliacaoFinanceira` é o livro de saldos conciliados **interno** do PointVet, não um evento de transferência ou confirmação automática da instituição.

## Funcionalidade homologada no PostgreSQL descartável de CI

- Migração aditiva `20261015213000_manual_card_repass_finance_origin`: novo valor `REPASSE_CARTAO_MANUAL_UNIFICADO` em `OrigemConciliacaoFinanceira` — diferente de `PAGAMENTO_VENDA`, `BAIXA_TITULO` e `TRANSACAO_ONLINE`.
- `api/src/modules/pdv/pdv-unificado-repasse-manual-sandbox.service.js`: **somente** em `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1` e `pointvet_unified_ci` verificado dentro da transação. Exige `financeiro.gerenciar`, vínculo ativo da organização/empresa, confirmação manual `confirmouCreditoNoExtrato=true` e referência idêntica à pré-baixa.
- Transação `Serializable` bloqueia a comanda, reavalia os dados autoritativos de pré-baixa, parcelas, conta, parecer documental de outra pessoa e auditorias M.5.12. Falha fechado em qualquer divergência ou ausência de parecer. Não há acesso ou consulta a extratos reais.
- Registra **exatamente um lançamento de ENTRADA LÍQUIDA** em `ConciliacaoFinanceira` com `origem="REPASSE_CARTAO_MANUAL_UNIFICADO"`, `origemId=preparacaoId` e `contaFinanceiraId` da empresa. A unique constraint existente `@@unique([origem,origemId])` impede dupla conciliação; como prevenção adicional, o lock da comanda serializa requisições. A auditoria registra nome da origem, operador, referência declarada, bruto, tarifa, custo de antecipação e líquido **na mesma transação**; replay idêntico é idempotente, divergente é bloqueado.
- A entrada de **R$ 58,80 líquidos** após repasse de R$ 60,00 brutos e tarifa de R$ 1,20 eleva o `saldoConciliado` interno da conta em **R$ 58,80**, não R$ 60,00. Taxa/antecipação permanecem discriminadas na auditoria e no preparo: não se cria despesa paga fictícia.
- `api/src/modules/financeiro/financeiro.service.js` agora rejeita `desconciliar` genérico dessas entradas imutáveis e proíbe que `PAGAMENTO_VENDA` de crédito originado do PDV Unificado seja contabilizado novamente pelo valor bruto. A rota genérica de `conciliar` também não aceita criar origens manuais novas: somente serviço específico, ainda sem endpoint HTTP.
- Não atualiza `Pagamento.status` para APROVADO porque uma parcela repassada não quita necessariamente as demais. A venda FINALIZADA continua no faturamento uma única vez; o saldo conciliado da conta é **outra métrica**, não nova receita em `resumo.receitasRealizadas` nem nova entrada em `fluxo`. A política de competência/reconhecimento fiscal permanece um gate separado.

## Testes automáticos

`api/tests/pdv-unificado-integration.test.mjs` testa com PostgreSQL sintético, entre outros:

- Recusa confirmação faltante, empresa errada, referência incompatível e dossiê alterado.
- Injeção de falha após a criação para validar rollback financeiro e de auditoria.
- Duas chamadas simultâneas, uma única conciliação, replay imutável, auditoria única e saldo bancário interno acrescido apenas pelo líquido.
- Nenhuma duplicação de faturamento, receita realizada, `Pagamento`, caixa, `BaixaFinanceira`, títulos ou eventos fiscais.
- Proibição de exclusão pelo `desconciliar` genérico e do reconhecimento bruto pelo `conciliar` genérico.
- Limpeza direta **EXCLUSIVAMENTE na fixture CI**, antes dos testes independentes do estorno legado. Isso não corresponde a endpoint de produção e não autoriza apagar lançamentos financeiros reais.

## Limites da entrega e próximos passos

Esta etapa implementa e valida o lançamento **efetivo apenas no livro financeiro sintético do PointVet em CI**, baseado na confirmação de uma pessoa; ela não observa nem movimenta dinheiro bancário real. **Nenhuma conexão bancária é necessária ou planejada** para a publicação do PDV. Não foram introduzidos tela ou endpoints de confirmação de repasse, pois o checkout completo continua bloqueado.

Ainda faltam, antes de operar comercialmente: experiência de confirmação manual e permissão no front, regra de correção/contralançamento após depósito equivocado e estorno pós-repasse, compatibilização contábil de parcelas, tarifas e antecipações, conformidade fiscal por emissor/CNPJ, testes operacionais em staging **real segregado e aprovado**, backup/restore/rollback e piloto opt-in. CI verde não autoriza implantar em `main` ou produção Pet King.

**PR #36 permanece Draft; nenhuma alteração real em bancos, DNS, Railway, PSP, fiscal ou Pet King.**
