# PointVet M.5.39 — devolução integral de ração a granel em múltiplos lotes FEFO

Data: 16/10/2026. Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) na [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36). A M.5.38 já foi validada no HEAD `71058cd0d8fa0fa9bc3d7fee211d384582c2ce97`, [Actions #38982308107](https://github.com/isaquesan7/sistema-pet/actions/runs/38982308107), ambos jobs `SUCCESS`.

## Regra operacional

- Preço: **R$ 15,00 por kg**. Venda por **R$ 5,00** gera **333 g = 0,333 kg**, descontados em milésimos de kg (gramas inteiros).
- Havendo lotes com validades diferentes, a baixa consome o mais próximo de vencer **que ainda seja válido**, passando ao próximo lote até completar a quantidade. Um lote vencido não entra na seleção.
- O **cancelamento integral manual** repõe a mesma quantidade em **cada lote originalmente utilizado**, inclusive se o lote venceu depois da venda. Não transfere o retorno para outro lote e mantém a trilha da baixa original.
- Se o saldo geral for suficiente, mas a soma dos lotes vendáveis não for, a operação **falha por inteiro**. Pagamentos declarados na transação, venda finalizada, baixa geral e baixas parciais dos lotes são revertidos pelo PostgreSQL.
- Repetir o fechamento ou cancelamento não movimenta o estoque de novo. No replay do cancelamento, cada saída precisa ter uma compensação única com **empresa, produto, lote, quantidade e ID da origem idênticos**; divergência de **1 g** bloqueia o replay para revisão.

## Alterações e evidências

1. `pdv-unificado-estorno-manual.contract.js` adiciona conferência pura **um a um** dos movimentos de saída/compensação, impedindo replay aceito apenas por contagens iguais com quantidades ou lotes trocados.
2. `pdv-unificado-estorno-manual-sandbox.service.js` passa a aplicar a conferência em replay e verifica que cada lote referenciado pertence ao produto vendido antes de restituir o saldo.
3. `pointvet-m539-fefo-estorno.contract.test.mjs` testa duplicidade, falta de compensação, troca de empresa/produto/lote, referência inválida e diferença de 1 g.
4. `pdv-unificado-integration.test.mjs`, no PostgreSQL **descartável** `pointvet_unified_ci`:
   - Lote vencido de **1 g**; lote válido anterior de **125 g**; lote válido posterior de **500 g**; saldo físico inicial **626 g**.
   - Tentar vender **626 g** falha, pois somente **625 g** estão em lotes válidos, com rollback integral.
   - Venda de **333 g** consome **125 g + 208 g**; sobra **1 g vencido + 292 g válidos**, saldo geral **293 g**.
   - Cancelamento com falha simulada reverte toda a transação; cancelamento normal repõe **125 g + 208 g** nos mesmos lotes e restaura o saldo **626 g**.
   - Fechamento e estorno repetidos são idempotentes. Alteração proposital de um movimento compensatório por **1 g** invalida o replay; após restauração do fixture de CI, volta a passar.
5. Workflow GitHub `validate` executa o novo contrato; `isolated-postgres` executa a integração real via PostgreSQL sintético, sem banco da Pet King.

## Limites e gates

- **Somente cancelamento integral** no serviço manual isolado; **não** implementa devolução parcial, troca, reembolso automatizado, autorização de cliente, comprovante real nem reentrada física na loja. O funcionário apenas declara a devolução externa; conferência operacional com o estoque físico permanece pendente.
- A baixa/estorno aqui é **prova de CI**, não checkout comercial liberado. Teste com a balança física de gramas inteiros, pesagem/etiquetagem, concorrência de vendas e devoluções reais, revisão contábil, staging segregado, backup/restauração/rollback reais e piloto opt-in continuam necessários, sob autorização específica.
- Não há motor/provedor fiscal, emissão de NF, SDK fiscal, PSP, TEF, banco, maquininha ou acesso à produção. A futura emissão permanece arquitetura separada; **o PDV de gestão é a prioridade**.
- PR #36 segue **Draft**, sem merge, deploy, mudanças em `main`, Railway ou banco Pet King. **CI da M.5.39 aprovado** no commit `663424a778f363f53fb9a5a8f49271e9c5847752`, [Actions #38983707144](https://github.com/isaquesan7/sistema-pet/actions/runs/38983707144), ambos jobs **SUCCESS**. Próximo teste de concorrência: [M.5.40](POINTVET_M540_CONCORRENCIA_BAIXA_GRANEL.md).
