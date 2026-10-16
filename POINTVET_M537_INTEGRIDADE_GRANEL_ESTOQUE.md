# PointVet M.5.37 — Integridade da unidade e estoque fracionado

Data: 16/10/2026. Continuação da M.5.36 na Issue #37 / PR #36 Draft.

## Por que existe

Uma venda de ração de 333 g desconta `0.333` do saldo cadastrado em **quilogramas**. Trocar o campo `Produto.unidade` para `GRAMA` após registrar o lote, saldo ou comanda transformaria o significado da mesma quantidade sem conversão, podendo invalidar estoque, preços e histórico comercial. Também é essencial provar que faltar **apenas 1 g** impede a venda inteira, sem pagamento ou baixa parcial.

## Implementação

- No `PATCH /catalogo/itens/:id`, uma **mudança real** de unidade executa bloqueio SQL `FOR UPDATE` do produto e reconsulta a unidade sob transação `ReadCommitted` (ajuste M.5.38 para ver histórico confirmado enquanto esperava a trava), verificando histórico ligado ao produto e ao SKU: `EstoqueSaldo`, `LoteProduto`, `MovimentacaoEstoque`, `EntradaEstoqueItem`, `InventarioEstoqueItem`, `ComandaItem`, `VendaItem`, `ConversaoOrcamentoPdvItem`, `PacoteModeloItem` e `PacoteClienteItem`.
- Havendo qualquer vínculo histórico (inclusive saldo ou lote zerado), o PATCH retorna **409 `UNIDADE_ESTOQUE_EM_USO`** sem gravar nem a unidade, nem campos adicionais do mesmo PATCH, como preço. A alteração é permitida apenas para um produto sem histórico. Unidade já alterada por outro usuário retorna 409 e pede recarga.
- A UI de cadastro avisa que ração a granel precificada por quilo deve usar unidade `QUILOGRAMA` e explica a restrição após uso. Para mudar a apresentação de um produto em uso, abrir novo SKU e executar transferência de estoque conferida em processo próprio; **não converter saldos automaticamente**.
- A API não chama motor fiscal, emissão, PSP, caixa, lote ou movimento de estoque nesse PATCH. O fluxo de checkout unificado real permanece bloqueado.

## Evidências preparadas

1. `api/tests/pointvet-m537-unidade-granel.contract.test.mjs`: contrato puro, dez origens distintas de bloqueio, lock, revisão de versão e transação/erro 409.
2. `api/tests/pdv-unificado-integration.test.mjs`: PostgreSQL descartável; mudança `QUILOGRAMA → GRAMA` negada depois da venda e lote, preço do PATCH revertido, mudança permitida em SKU sem uso; tentativa de vender `1.668 kg` com saldo `1.667 kg` é negada por **1 g** e não deixa pagamento, venda finalizada, alteração de saldo/lote ou documento fiscal.
3. Build do admin, regressões de contrato e execução PostgreSQL do workflow `PointVet Unified PDV Foundation` necessários para marcar essa etapa como validada.

## Limitações e próximos gates

- A M.5.38 adiciona trancas compartilhadas aos gravadores conhecidos e casos reais de concorrência no PostgreSQL CI; para novas integrações/SQL direto, revisar as mesmas invariantes e considerar proteção física no banco antes do piloto.
- Verificar devolução, cancelamento e reentrada de porções em lote FEFO no fluxo de gestão com precisão 1 g e testes de concorrência.
- Checkout unificado real, staging, backup restaurado, piloto, merge/deploy e emissão fiscal continuam **não autorizados**. Motor fiscal futuro e independente; nenhuma integração bancária/maquininha.
- M.5.36 e M.5.37 foram publicadas na PR #36 e validadas no [CI #38980492036](https://github.com/isaquesan7/sistema-pet/actions/runs/38980492036); M.5.38 precisa de validação própria no HEAD publicado antes de ser marcada concluída.
