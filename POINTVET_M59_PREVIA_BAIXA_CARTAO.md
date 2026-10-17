# PointVet M.5.9 — prévia auditável de baixa de cartão (sem baixa)

**Estado:** implementação e testes exclusivamente na branch Draft do PDV Unificado. Esta entrega **não credita conta bancária, não aprova Pagamento, não cria ConciliacaoFinanceira nem faz checkout real**.

## Regra de negócio incorporada

Uma venda finalizada no PDV não significa que a adquirente depositou o valor bruto do cartão. Antes de qualquer contabilização futura, é necessário separar:

- **Bruto:** soma EXATA das parcelas escolhidas, sempre dentro da mesma organização, empresa e comanda.
- **Tarifa do cartão:** desconto explícito, não presumido.
- **Custo de antecipação:** zero no repasse normal; valor positivo explicitamente informado na antecipação.
- **Líquido declarado:** bruto menos tarifas menos custo de antecipação; deve conferir exatamente em centavos.
- **Confirmação externa:** declaração da pessoa responsável, com referência de extrato, data e conta indicada. O PointVet **não verifica extrato ou propriedade da conta de forma independente nesta prévia**.
- **Parcelas:** só são elegíveis se estiverem `CONCILIADA` pela M.5.5; `AGUARDANDO_REPASSE` e `ESTORNADA` são rejeitadas. Mesmo uma parcela `CONCILIADA` continua uma **declaração humana**, não prova do depósito.

O contrato puro `planejarBaixaCartaoM59` (`api/src/modules/pdv/pdv-unificado-baixa-cartao.contract.js`) recebe a leitura previamente validada pela M.5.6, exige conta e referência sintaticamente válidas, parcelas não duplicadas, valor líquido positivo, soma segura, separação de empresa e data válida. Devolve as parcelas ordenadas, total bruto/tarifa/antecipação/líquido, SHA-256 canônico estável para os mesmos dados. Se os termos financeiros, referência, empresa, data ou parcelas diferirem, o fingerprint difere. Não existe persistência, idempotência em banco, checagem de extrato real nem garantia de que duas pessoas não consultem a mesma prévia separadamente.

## Testes

- `api/tests/pdv-unificado-baixa-cartao.contract.test.mjs`: exemplos de R$120 bruto, R$2,40 tarifa e R$117,60 líquido; antecipação R$4,10 adicional e R$113,50 líquido; referência inválida, ausência de confirmação, data impossível, moeda/valor inválidos, parcela duplicada, pendente, estornada e pertencente a outra empresa; fingerprint estável por permutação das parcelas e distinto por condições de operação.
- `api/tests/pdv-unificado-integration.test.mjs`: em PostgreSQL descartável, executa fechamento com cartão em 3×R$60, registra uma parcela `CONCILIADA` em M.5.5, lê o resultado M.5.7 e simula sobre ela um repasse normal de R$60 bruto → R$1,20 tarifa → **R$58,80 líquido**, além de antecipação com R$2,50 de custo e **R$56,30 líquido**. Rejeita simulação de parcela ainda pendente e bloqueia prévia depois de estorno. Regressões M.5.8 conferem que nenhuma destas consultas ou declarações cria caixa/receita bancária automática.
- Workflow `.github/workflows/pointvet-unified-pdv-foundation.yml` inclui verificações e executa tudo em conjunto com CI PostgreSQL isolado.

## Limites para publicação

**M.5.9 é prévia e validação de política, NÃO baixa financeira.** Não escreve em `Pagamento`, `BaixaFinanceira`, `ConciliacaoFinanceira`, `ContaFinanceira`, movimentos de caixa, estoque ou documentos fiscais. Não gera títulos, pagamentos ou comprovantes bancários; não tem rota HTTP nem tela. Não há integração com PSP/TEF/maquininha.

**Gates pendentes:** política formal para vincular prova externa e evitar duplicidade de contabilização, decisão sobre pagamentos parciais e estornos após conciliação, persistência/idempotência, autorização de operadores, testes end-to-end e cenário de desacordo de banco; revisão fiscal por emissor; staging segregado real autorizado; restore/rollback reais aprovados; piloto opt-in e liberação formal do checkout. PR #36 fica Draft e a produção da Pet King/main intacta.
