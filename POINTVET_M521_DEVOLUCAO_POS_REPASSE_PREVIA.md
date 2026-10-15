# PointVet M.5.21 — prévia de devolução AO CLIENTE após repasse manual

## Distinção obrigatória

A correção de um repasse M.5.14 é uma **compensação de lançamento do saldo conciliado interno do PointVet**. Isso NÃO significa que o cliente foi reembolsado. Uma devolução de dinheiro ao cliente exige regras próprias: identificar recebimento, eventual reembolso parcial/integral anterior, referência da devolução externa, eventual recuperação de taxas e antecipações, operação fiscal e contábil correspondentes. **Nesta M.5.21 nada é efetivamente devolvido.**

O usuário estabeleceu que o PointVet **NÃO integra instituições bancárias, Open Finance, PSP, adquirentes, TEF ou maquininhas**. A consulta externa e eventual devolução são responsabilidade do estabelecimento e ficam FORA do sistema até uma homologação futura.

## Implementações
1. `api/src/modules/pdv/pdv-unificado-estorno-pos-repasse.contract.js`, contrato puro:
   - `planejarDevolucaoAposRepasseM521` avalia dados autoritativos de etapas M.5.16/M.5.19 por CNPJ/comanda, recusa duplicidades, valores incompatíveis, contas/status incoerentes e permite SOMENTE **simular** quando a entrada de repasse líquido estiver ativa; repasses pendentes ou já compensados são inelegíveis.
   - `simularDevolucaoAposRepasseM521` exige o `codigoRevisao` exato do cenário, confirmação expressa de que **recuperações de tarifas são hipóteses**, valor de devolução positivo menor/igual ao bruto, recuperação hipotética de tarifa menor/igual à tarifa original, recuperação hipotética da antecipação menor/igual ao desconto informado e soma de recuperações menor/igual ao valor de devolução. Trabalha em centavos inteiros, sem arredondamentos monetários implícitos.
   - Resultado diferencia **desembolso hipotético ao cliente** de **recuperações hipotéticas de tarifa e antecipação**. Exibe exposição caso ambas as recuperações realmente ocorram, sem inferir que algum dinheiro entrou ou saiu. Devoluções anteriores, tarifas extras, obrigações fiscais e saldos efetivos **não são verificados**; este cenário não constitui valor líquido a baixar no caixa.
2. Nova rota `GET /api/pdv-unificado/recebiveis-cartao/comandas/:comandaId/devolucao-previa`, com autorização financeira e PDV, tenant, opt-in, M.5.7/M.5.16 e `Cache-Control:no-store`. Retorna somente o plano de risco; **não recebe valores de simulação do funcionário nem aceita POST/PATCH/DELETE**.
3. `admin-web/src/components/UnifiedCardRefundDryRun.jsx`, integrado a `UnifiedCardReceivablesPanel.jsx`: simulador local por repasse ativo, com valor bruto hipotético de devolução, cenários de recuperação de tarifa e antecipação, confirmação da natureza estimativa e aviso obrigatório de que **devolver ao cliente ≠ contralançar a entrada interna M.5.14**. O botão `Simular impacto (não devolve nem salva)` faz cálculo só no navegador, **sem enviar os valores ao servidor**; ao trocar empresa, comanda, preparação ou versão financeira, os valores reiniciam.
4. `api/tests/pdv-unificado-estorno-pos-repasse.contract.test.mjs`: devolução integral R$120 bruto/2,40 tarifa/4,10 antecipação/113,50 líquido e devolução parcial, com cenários de retenção não recuperada/hipoteticamente recuperada, não autorização, reenvio de versões antigas, dados falsos, mistura de empresa e status. `api/tests/pdv-unificado-integration.test.mjs`: antes de repasse, após R$60 bruto/R$1,20 tarifa/R$58,80 líquido e após compensação interna, demonstra que prévia é inelegível sem entrada ativa, não cria despesa, reembolso, saldo ou venda, e que corrigir lançamento interno não marca cliente como reembolsado.
5. HTTP smoke `api/tests/pointvet-m543-http-checkout-barrier.integration.test.mjs` cobre autorização, opt-out, 400/403/404 e ausência de POST/PATCH, sem exposição dos serviços de escrita. Workflow isolado executa testes puros, build admin, PostgreSQL descartável, regressões fiscais e backup/restore SINTÉTICOS.

## Limites e próximas decisões

Não há comprovação de reembolso real ao cliente, recuperação real de taxas, autorização fiscal, título, `Pagamento` aprovado, caixa ou alteração do saldo interno. Sem histórico autoritativo de devoluções anteriores, **um segundo reembolso não poderia ser seguro**; a interface de simulação NUNCA deve se tornar endpoint de escrita sem um livro de devoluções com unicidade, idempotência, autorização por funcionário, validação transacional e conciliação contra estornos fiscais.

Requer homologação fiscal/contábil por emissor/CNPJ, regras de tarifas/antecipação em devoluções e autorização de staging REAL segregado e restauração real antes de qualquer liberação do checkout. PR #36 permanece DRAFT, produção da Pet King, `main`, Railway, DNS e bancos externos intactos.

**Validação necessária:** registrar CI `validate SUCCESS` + `isolated-postgres SUCCESS` para o SHA final em Issue #37 e PR #36, ou corrigir falhas antes de declarar concluído.
