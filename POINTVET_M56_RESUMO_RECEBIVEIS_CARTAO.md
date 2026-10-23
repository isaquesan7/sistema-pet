# PointVet M.5.6 — resumo financeiro de recebíveis de cartão, por empresa (SOMENTE CI)

**Marco funcional:** após o registro manual e a conciliação M.5.5, conferir exatamente quais parcelas do cartão de crédito continuam pendentes, quais têm declaração humana de repasse e quais foram estornadas, **sem presumir saldo bancário, sem transferir dinheiro e sem conciliar o pagamento completo automaticamente**.

## Implementação
- **Contrato puro:** `api/src/modules/pdv/pdv-unificado-resumo-recebiveis.contract.js` valida, por comanda e empresa, a correspondência de linha de cartão, `Pagamento`, venda filha, reserva, operação, registro, parcelas e eventos em `Auditoria`. Exige índices de parcela únicos e completos, soma exata em centavos, pagamento e linhas sem duplicidade, comprovante interno de cada declaração e ausência de conciliação em parcelas pendentes/estornadas. Falha fechado em qualquer divergência.
- **Serviço de leitura:** `api/src/modules/pdv/pdv-unificado-resumo-recebiveis-sandbox.service.js`, restrito a `pointvet_unified_ci`, verifica banco em tempo de execução e `NODE_ENV=test`/flag, exige vínculo ativo com a empresa e permissão `financeiro.gerenciar`, comanda do tenant e consulta em transação `RepeatableRead`. Não altera `Pagamento.status` ou qualquer outra tabela; não tem endpoint público.
- **Resumo:** valores `original`, `pendente`, `conciliadoDeclarado`, `estornado`; status da linha `AGUARDANDO_REPASSE`, `REPASSE_PARCIAL_DECLARADO`, `REPASSE_INTEGRAL_DECLARADO`, `ESTORNADO`. `provaBancariaIndependente=false` em todos os casos. Sem dados do tutor, login, cartão, extrato ou token no resultado.
- **Testes:** `api/tests/pdv-unificado-resumo-recebiveis.contract.test.mjs` cobre totalizadores, evidência faltante, auditoria órfã/duplicada, empresa divergente, estados econômicos, estorno parcial inválido e ausência de efeitos. O teste PostgreSQL `api/tests/pdv-unificado-integration.test.mjs` cobre comanda real sintética, três parcelas de cartão R$ 60, relatório antes/depois da conciliação de uma, isolamento por organização/empresa, pagamento permanecendo PENDENTE, e saldo de estorno integral após a limpeza deliberada da fixture de CI.

## Observações contábeis
- `conciliadoDeclarado` **não representa conciliação bancária independente**. Uma pessoa com permissão financeira informou ter conferido o repasse por meio externo. O PointVet não acessou banco/maquininha.
- Mesmo após todas as parcelas declaradas, este resumo **não modifica o status do Pagamento**, não cria `TituloFinanceiro`, `ConciliacaoFinanceira`, entradas de caixa nem eventos fiscais. O fechamento contábil e os efeitos de reconhecimento de receita precisam de uma etapa com regras aprovadas.
- A empresa B não enxerga as parcelas da empresa A. A comanda multivendedor pode ser conferida por empresa separadamente.
- O serviço permanece fora do HTTP e dos menus; uso interno CI. Não autoriza checkout, estorno real, crédito como pagamento, múltiplas unidades sob mesmo CNPJ, emissão fiscal oficial, PSP, deploy, canário, restore nem migração.

## Gates seguintes para o PDV publicar
Conferir CI exato do HEAD da branch; homologar financeiramente o efeito de parcelas conciliadas sobre relatórios, caixa e recebíveis **sem dupla contagem**; integrar rotas/painel de forma segura após revisão; staging REAL segregado aprovado com dados sintéticos, restore e rollback autorizados, matriz fiscal e piloto opt-in. **Não publicar somente com CI verde.** `main`, Pet King e PR #35 permanecem inalterados; PR #36 DRAFT.
