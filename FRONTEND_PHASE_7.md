# PetRise — Fase 7: Estoque Operacional

Esta fase transforma o estoque estrutural das versões anteriores em um módulo operacional completo, separado por CNPJ.

## Entregas

- Painel **Estoque** no menu administrativo.
- Resumo por CNPJ: produtos controlados, sem estoque, estoque mínimo, lotes vencidos/a vencer e valor de estoque pelo custo médio.
- Consulta de produtos com saldo, estoque mínimo, custo médio, lotes e status.
- Cadastro e edição de fornecedores da organização, vinculados ao CNPJ atual.
- Entrada de mercadoria com fornecedor, documento, data, itens, custo, lote e validade.
- Atualização do custo médio ponderado na entrada e recálculo de markup/margem do item sem alterar o preço de venda.
- Histórico de entradas e cancelamento com reversão de quantidades.
- Ajustes de estoque: positivo, negativo, perda, consumo interno e devoluções.
- Inventário físico com snapshot do saldo, contagem por produto/lote e ajuste automático ao concluir.
- Trilha completa em `movimentacoes_estoque`.
- PDV atualizado para produtos controlados por lote: baixa FEFO (primeiro lote válido a vencer) e restauração do mesmo lote no cancelamento da venda.
- Lotes vencidos não são selecionados automaticamente em vendas.

## Nova migration

`20261008073000_stock_operations`

Cria:

- `entradas_estoque`
- `entrada_estoque_itens`
- `inventarios_estoque`
- `inventario_estoque_itens`
- enums `StatusEntradaEstoque` e `StatusInventarioEstoque`

## Aplicação

Preserve `api/.env` e execute:

```powershell
cd api
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Em outro terminal:

```powershell
cd admin-web
npm ci
npm run dev
```

## Roteiro de teste

1. Cadastre um produto em **Produtos e serviços** com controle de estoque.
2. Se desejar testar lote, marque `controla lote` e `controla validade`.
3. Entre em **Estoque → Fornecedores** e cadastre um fornecedor.
4. Em **Entradas**, registre uma entrada do produto.
5. Confirme o novo saldo e o custo médio em **Estoque**.
6. Faça uma venda no PDV e confirme a baixa de estoque.
7. Para produto com lote, confirme em **Movimentações** qual lote foi utilizado.
8. Registre um ajuste/perda e confira o histórico.
9. Inicie um **Inventário**, informe a quantidade contada em todos os itens e conclua.
10. Confira os ajustes de inventário em **Movimentações**.
11. Cancele uma venda de teste e confirme a restauração do estoque/lote.

## Regras importantes

- Estoque e movimentações pertencem sempre ao CNPJ atual.
- Fornecedor pertence à organização, mas é vinculado ao(s) CNPJ(s) com que trabalha.
- Produtos com controle de lote exigem lote nas entradas e ajustes manuais.
- Produtos com controle de validade exigem validade na entrada.
- Uma entrada concluída não é editada; em caso de erro, é cancelada e registrada novamente, preservando auditoria.
- Inventário concluído não é editável.
- O preço de venda não é alterado automaticamente quando o custo muda; o PetRise recalcula markup, margem e lucro para o preço atual.
