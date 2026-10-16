# PointVet M.5.34 — Retomada confiável da comanda do PDV de gestão

## Produto e fronteira

A primeira entrega do PDV Unificado é **gestão**, não um emissor fiscal. A integração futura com NF-e/NFC-e/NFS-e continua atrás da porta neutra M.5.26, sem escolha de provedor. A decisão de não construir o motor fiscal agora **não impede o planejamento e a homologação do PDV de gestão**. Não se presume dispensa das obrigações fiscais aplicáveis às operações comerciais, a serem tratadas por processo externo adequado enquanto não houver emissão integrada.

## Problema corrigido

O botão **Rascunhos recentes** reabria a comanda montando nomes de produto, empresa e exigência de pet somente a partir dos até 100 itens devolvidos pela **busca atual** do catálogo. Se o operador tivesse filtrado outra palavra ou o catálogo mudasse, via “Item do catálogo” e “Empresa vinculada”, sem o preço gravado. Isso confundia a conferência mesmo quando o backend havia salvo os dados corretamente.

## Contrato de gestão

- `listarRascunhos` mantém a verificação de empresa autorizada para **todas** as linhas antes de revelar qualquer detalhe. Retorna para cada linha autorizada o identificador persistido, `descricao` e `valorUnitario` do snapshot da comanda, nome da empresa sob o vínculo atual e flag `exigePet` apenas para orientar a interface. Não precisa do resultado do campo de busca.
- `rehydrateUnifiedDraft` repõe nome, empresa, preço salvo, quantidade e pet das linhas ativas. Linhas canceladas não reaparecem na edição.
- A UI identifica **valor salvo** e mostra códigos de pendência do pré-fechamento em linguagem operacional (preço alterado, pet inválido/obrigatório, item indisponível ou valor inconsistente). Se houver edição local não salva, oculta o pré-fechamento antigo, evitando passar uma conferência obsoleta como atual.
- A **autoridade para preço, acesso e disponibilidade** continua sendo `simularComanda` e `conferirPreFechamento` no servidor. O snapshot na UI é histórico, não liberação de preço ou fechamento.
- Não há nova rota, migration, gravação financeira, venda, estoque, crédito, provedor fiscal, checkout real nem mudança do comportamento legado.

## Testes

1. Contrato de reidratação em `api/tests/pdv-unificado-retomada-comanda.contract.test.mjs`: duas empresas, serviço com pet, rascunho cancelado ignorado, nomes e preços persistidos sem catálogo da busca atual, UI ligada à função e mensagens de pendência.
2. Integração no PostgreSQL **descartável** `api/tests/pdv-unificado-integration.test.mjs`: retomada de comanda de duas empresas com nome/valor/quantidade e snapshot imutável à renomeação posterior do catálogo, sem criar venda ou pagamento.
3. Build `admin-web` e workflow de CI da PR #36. Verificar `validate` e `isolated-postgres` do **SHA exato**; smoke real depende de staging específico autorizado.

## Gates que permanecem

PR #36 e PR #35 Draft; revisão de integração de orçamentos por escopo, crédito como pagamento desligado, mesmo CNPJ/múltiplas unidades fora do lote inicial, execução de pagamentos manuais no PDV Unificado ainda protegida somente em CI, homologação humana de caixa/estoque/estorno, processo fiscal-contábil externo aplicável por CNPJ, staging isolado, backup real restaurado, rollback, métricas e piloto autorizado. Nenhum merge, deploy ou alteração em `main`/produção/Railway.
