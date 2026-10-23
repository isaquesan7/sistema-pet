# PointVet M.5.36 — Venda de ração a granel (gestão)

Data: 16/10/2026. Issue #37; PR #36 Draft. Requisito confirmado pelo proprietário: **balanças medem gramas inteiros**, atendente vende **por peso ou valor em R$**, sem integração fiscal, bancária, TEF ou maquininha.

## Contrato de uso

- Cadastrar a ração comercializada por kg como produto `QUILOGRAMA`; `precoVenda` significa preço de **1 kg = 1.000 g**. No estoque, quantidade `10.000` significa **10 kg**, e não dez sacos ou 10.000 kg. Outros produtos podem usar `GRAMA`, precificados **por grama**, respeitado o cadastro de preços com duas casas decimais.
- Na interface de comanda unificada, a unidade de estoque aparece no catálogo e nas linhas; para produtos cadastrados em `QUILOGRAMA` ou `GRAMA`, a atendente pode informar **peso em gramas inteiros** ou **valor desejado em reais**. A conversão em gramas inteiros é determinística.
- Exemplo: R$ 15,00/kg; pedido de **333 g** gera quantidade comercial/estoque `0.333` kg; total `round(1.500 centavos × 333 / 1.000)` = **R$ 5,00**; baixa final hipotética de `0.333 kg`. Por valor R$ 5,00, o peso inteiro mais próximo também é 333 g. Não prometer precisão de `333,33 g`: a balança definida pelo proprietário entrega gramas inteiros.
- Valor informado precisa ter centavos exatos e corresponder a uma quantidade inteira de gramas no preço cadastrado; se o valor for matematicamente irrepresentável (ex.: R$ 5,02 a R$ 15/kg), impedir simulação/salvamento da linha e solicitar ajuste de peso/valor. **Não criar desconto, sobrepreço implícito nem parcela de grama.**
- A API ignora cálculo/preço enviado pelo navegador, busca `precoVenda` e unidade autorizados do catálogo, limita quantidade a 3 decimais e, para unidade `GRAMA`, exige quantidade inteira. Produto por peso com total arredondado para R$ 0,00 também é bloqueado. Rascunhos reabertos recuperam a unidade atual do cadastro para exibir corretamente os gramas.
- Produto adicionado repetidamente mantém a agregação por mesmo catálogo/empresa, somando 1 unidade de estoque por adição, e limpa campos transitórios de entrada; serviços continuam separados por pet conforme M.5.35.

## Integridade de estoque, escopo e testes

1. Nenhuma migration necessária para balanças de 1 g: campos de estoque/comanda já possuem 3 decimais e `0.001 kg = 1 g`.
2. Rascunho e simulação **não** movimentam estoque. Somente o fechamento manual **interno do PostgreSQL descartável `pointvet_unified_ci`**, já existente na M.3B, abate `0.333 kg` com lock, transação serializável, lote FEFO e idempotência. Rotas HTTP reais não expõem esse fechamento; o motor fiscal e produção permanecem intocados.
3. Teste puro `api/tests/pdv-unificado-racao-granel.contract.test.mjs`: ambos os modos para 333 g/R$ 5,00, centavos incompatíveis, rejeição de fração de grama, limite, cadastro `GRAMA`, retomada de rascunho e guardrails.
4. Integração `api/tests/pdv-unificado-integration.test.mjs` no PostgreSQL descartável: busca de produto por kg, simulação, rascunho persistido, rejeição de 0,33333 kg e quantidade `GRAMA` não inteira, pré-fechamento, venda manual **apenas sandbox** de R$ 5,00, saldo/lote de `2.000` para `1.667` kg e movimentação de `0.333` kg, replay sem segunda baixa e nenhuma nova nota fiscal.
5. Build do admin e regressões legadas exigidos no workflow `PointVet Unified PDV Foundation`; registrar resultados do **HEAD exato** antes de homologar esta etapa como concluída.

## Restrições para o piloto comercial

- O sistema ainda precisa de revisão E2E por atendentes com balança e estoque real em staging autorizado; não existe checkout unificado operacional liberado no ambiente Pet King.
- A alteração da `unidade` de estoque de produto com histórico/rascunho passou a ser bloqueada pelo PATCH na [M.5.37](POINTVET_M537_INTEGRIDADE_GRANEL_ESTOQUE.md), ainda pendente de CI PostgreSQL remoto e prova de concorrência com criação simultânea do primeiro saldo. Uma futura conversão de unidade exige procedimento auditado independente.
- Inventário real, saldo insuficiente, lotes múltiplos, cancelamento/estorno parcial e movimentações concorrentes por grama precisam de regressão integrada no fluxo de gestão homologado antes do piloto.
- Motor fiscal **fora do escopo** desta fase; manter porta futura neutra. Nenhum merge, deploy, migração ou operação em banco/estabelecimento real é autorizado por este documento.
