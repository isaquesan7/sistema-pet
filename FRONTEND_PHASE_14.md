# PetRise — Fase 14 — Relatórios e Indicadores

## Objetivo
Transformar os dados já produzidos pelos módulos do PetRise em uma camada gerencial única, sem duplicar lançamentos nem criar um banco paralelo de BI.

A Fase 14 usa os dados operacionais existentes e respeita:
- organização/tenant;
- CNPJ selecionado;
- empresas às quais o usuário realmente possui acesso;
- permissão `relatorios.visualizar`;
- módulo `RELATORIOS`.

## O que entrou

### Nova área `Relatórios`
Nova rota administrativa:

`/relatorios`

Com abas:
- Visão geral;
- Vendas;
- Clientes;
- Operação;
- Estoque;
- Financeiro;
- Fiscal.

### Escopo multi-CNPJ
O usuário pode analisar:
- somente o CNPJ atualmente selecionado; ou
- a organização consolidada.

No consolidado, o backend inclui exclusivamente CNPJs da mesma organização aos quais aquele usuário possui vínculo ativo e a permissão `relatorios.visualizar`.

### Filtros de período
Presets:
- Hoje;
- Este mês;
- Últimos 30 dias;
- Este ano.

Também é possível escolher manualmente data inicial e final.

### Visão geral
Indicadores executivos:
- faturamento;
- quantidade de vendas;
- ticket médio;
- clientes atendidos;
- resultado financeiro;
- valor do estoque a custo médio;
- alertas de estoque;
- Consultório;
- Banho e Tosa;
- documentos fiscais.

O faturamento, vendas, ticket e clientes atendidos exibem comparação percentual com o período imediatamente anterior de mesma duração.

### Vendas
- faturamento e ticket médio;
- vendas canceladas/estornadas;
- itens vendidos;
- mix Produto x Serviço;
- receita por categoria;
- formas de pagamento;
- ranking de produtos e serviços;
- evolução diária;
- faturamento por CNPJ quando o escopo estiver consolidado.

### Clientes
- clientes ativos;
- novos cadastros no período;
- compradores no período;
- clientes recorrentes;
- taxa de recorrência;
- pets ativos;
- distribuição de pets por espécie;
- ranking de clientes por faturamento.

A taxa de recorrência considera como recorrente o cliente que comprou no período e já possuía ao menos uma venda finalizada anterior ao início do período.

### Operação
Consultório:
- total de atendimentos;
- finalizados;
- cancelados;
- status;
- origem;
- duração média dos atendimentos finalizados com horário de início e término.

Banho e Tosa:
- agendamentos;
- concluídos;
- faltas;
- cancelamentos;
- taxa de comparecimento;
- status;
- origem;
- agendamentos por profissional;
- duração média de OS com saída registrada.

Pacotes:
- situação atual dos contratos;
- quantidade de consumos no período.

### Estoque
- valor atual do estoque a custo médio;
- produtos controlados;
- produtos abaixo do mínimo;
- produtos zerados;
- lotes vencidos;
- lotes que vencem nos próximos 30 dias;
- movimentos de estoque no período;
- ranking dos principais alertas para reposição.

### Financeiro
- recebimentos baixados;
- pagamentos baixados;
- resultado financeiro realizado;
- contas a receber em aberto;
- contas a pagar em aberto;
- valores vencidos;
- composição por categoria;
- formas usadas nas baixas;
- quantidade de conciliações no período.

### Fiscal
- documentos criados;
- autorizados;
- pendentes/processando;
- erros/rejeições;
- taxa de autorização;
- valor autorizado;
- documentos simulados;
- distribuição por tipo e status.

### Exportação CSV
Exportações disponíveis para:
- vendas;
- clientes;
- estoque abaixo do mínimo;
- financeiro por categoria;
- fiscal por status.

Os arquivos usam `;` como separador e BOM UTF-8 para abrir corretamente no Excel em português.

### Dashboard principal
O dashboard inicial agora aproveita a Fase 14 para mostrar, quando o usuário possui acesso a Relatórios:
- faturamento do mês;
- ticket médio;
- resultado financeiro;
- alertas de estoque;
- contas vencidas;
- valor do estoque;
- documentos fiscais autorizados/pendentes.

Usuários sem permissão de relatórios continuam vendo o dashboard básico anterior.

## Backend
Novo módulo:

`api/src/modules/relatorios/`

Rotas:
- `GET /api/relatorios/painel`
- `GET /api/relatorios/exportar?tipo=vendas|clientes|estoque|financeiro|fiscal`

Parâmetros principais:
- `dataInicio=YYYY-MM-DD`
- `dataFim=YYYY-MM-DD`
- `escopo=empresa|organizacao`

## Banco de dados
**Não existe migration nova na Fase 14.**

Os relatórios são calculados sobre as tabelas já existentes. O módulo `RELATORIOS` e a permissão `relatorios.visualizar` já faziam parte da fundação SaaS.

## Aplicação
Preserve `api/.env`.

Backend:

```powershell
cd api
npm ci
npx prisma validate
npx prisma generate
npm run dev
```

Frontend:

```powershell
cd admin-web
npm ci
npm run dev
```

Não é necessário executar `prisma migrate deploy` por causa da Fase 14, pois o schema não foi alterado.

## Checklist recomendado
1. Entre com um administrador.
2. Abra `Relatórios`.
3. Teste `Hoje`, `Este mês`, `Últimos 30 dias` e `Este ano`.
4. Compare os totais de Vendas com o histórico do PDV.
5. Confira o mix Produto x Serviço.
6. Verifique o ranking de clientes.
7. Compare Consultório e Banho e Tosa com as agendas do período.
8. Verifique alertas de estoque mínimo e validade.
9. Compare o Financeiro com as contas/baixas do mesmo período.
10. Compare o Fiscal com a fila de documentos.
11. Exporte cada CSV.
12. Se houver mais de um CNPJ, alterne entre `CNPJ atual` e `Organização consolidada`.
13. Confirme que um usuário sem acesso a outro CNPJ não recebe os dados daquele CNPJ no consolidado.
14. Volte ao Dashboard e confira os novos indicadores mensais.

## Observações de interpretação
- Faturamento considera vendas `FINALIZADA` pela data `finalizadaEm`.
- Vendas canceladas/estornadas são mostradas separadamente e não entram no faturamento.
- Financeiro realizado usa as baixas efetivamente registradas, não simplesmente o valor das vendas.
- Valor de estoque usa o saldo atual multiplicado pelo custo médio atual.
- Clientes e pets são cadastros compartilhados no tenant, portanto a base ativa pertence à organização; rankings de compra respeitam o escopo de CNPJ do relatório.
- Indicadores operacionais dependem do correto preenchimento dos status e horários nos respectivos módulos.

## Validação feita no pacote
- `node --check` nos novos arquivos JS do backend e no `app.js`.
- Parsing dos JSX alterados com TypeScript em modo `--noResolve`.
- Varredura pela marca anterior sem ocorrências no projeto ativo.
- Schema Prisma não foi alterado nesta fase.
