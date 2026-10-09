# PetRise — Fase 11 — Financeiro

## O que entrou

### Contas a receber e a pagar
- Títulos financeiros separados por CNPJ.
- Categorias financeiras compartilhadas dentro da organização.
- Cliente em contas a receber e fornecedor em contas a pagar.
- Vínculo opcional de conta a pagar com uma entrada de estoque.
- Parcelamento mensal automático de lançamentos manuais.
- Baixa parcial ou total, com desconto, juros, forma de pagamento, data e observação.
- Histórico de baixas e auditoria das principais operações.
- Cancelamento seguro de títulos manuais sem baixas.

### Fiado integrado ao PDV
- A forma `CREDITO_CLIENTE` passa a exigir cliente.
- Ao finalizar uma venda fiada, o PetRise cria automaticamente uma conta a receber vinculada ao pagamento e à venda.
- O PDV permite definir o vencimento do fiado; quando omitido, o backend usa 30 dias.
- Fiados antigos ainda pendentes são migrados para o novo financeiro automaticamente.
- Ao receber o fiado no Financeiro, o pagamento original da venda passa para `APROVADO` quando o título é quitado.
- Venda com fiado já recebido não pode ser cancelada sem regularização financeira prévia.

### Contas financeiras e conciliação
- Cadastro de contas por CNPJ: dinheiro, banco, carteira digital e outras.
- Saldo inicial e saldo conciliado.
- Fila de conciliação para:
  - pagamentos aprovados de vendas;
  - baixas de contas a receber/pagar;
  - pagamentos online aprovados do Portal do Cliente.
- Possibilidade de desfazer conciliação preservando o movimento de origem.

### Fluxo e visão gerencial
- Faturamento do período.
- Receitas realizadas.
- Despesas pagas.
- Saldo do período.
- Contas a receber e pagar em aberto.
- Valores vencidos.
- Formas de pagamento.
- Baixas por categoria.
- Visão por CNPJ.
- Visão consolidada da organização limitada aos CNPJs aos quais o usuário possui acesso financeiro.

### Caixa físico
- Baixa em dinheiro pode movimentar automaticamente a sessão de caixa aberta:
  - recebimento -> `RECEBIMENTO`;
  - pagamento -> `SANGRIA`.

## Migration

Nova migration:

`20261009000000_finance_operations`

Ela cria:
- `categorias_financeiras`
- `contas_financeiras`
- `titulos_financeiros`
- `baixas_financeiras`
- `conciliacoes_financeiras`
- enums financeiros

A migration também faz backfill dos pagamentos antigos em `CREDITO_CLIENTE` que ainda estejam pendentes e possuam cliente vinculado.

## Aplicação

Preserve `api/.env` e faça snapshot do PostgreSQL antes da migration.

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

## Checklist recomendado

1. Abra Financeiro > Cadastros e crie uma conta financeira, por exemplo `Banco principal`.
2. Crie categorias de receita e despesa.
3. Registre uma conta a pagar manual.
4. Faça uma baixa parcial e depois quite o saldo.
5. Registre uma conta a pagar vinculada a uma entrada de estoque.
6. No PDV, selecione um cliente e finalize uma venda usando `Fiado / conta do cliente`.
7. Confira o título em Financeiro > Fiado e em A receber.
8. Receba o fiado e confirme que o saldo é zerado.
9. Faça uma venda em PIX e confira o movimento em Conciliação.
10. Vincule o movimento a uma conta financeira.
11. Teste Visão geral por CNPJ e Consolidado.

## Observações
- Emissão fiscal continua para a fase específica de integração fiscal.
- O saldo das contas financeiras nesta fase é **saldo conciliado**, não importação automática de extrato bancário.
- Integração Open Finance/OFX/API bancária pode ser adicionada numa fase futura sem alterar a base de títulos criada aqui.
