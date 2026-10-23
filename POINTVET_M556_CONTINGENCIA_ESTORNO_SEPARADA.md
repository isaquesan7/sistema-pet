# PointVet M.5.56 — Estorno de contingência com checkout desligado (20/10/2026)

## Resultado e motivação

A aceitação visual do histórico M.5.55 pela proprietária confirmou a consulta pós-estorno em homologação. Na revisão do piloto foi identificado um risco operacional: o **kill switch de novas vendas** também bloqueava estornos integrais de vendas registradas. Em um incidente seria impossível parar vendas novas e manter um canal restrito para corrigir vendas antigas sem reativar o checkout. M.5.56 resolve **essa separação de poderes** sem habilitar nenhum dos gates por padrão.

## Controles implementados

- `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED` e suas allowlists mantêm **exclusivamente** o controle de novas vendas.
- `POINTVET_UNIFIED_MANUAL_REVERSAL_ENABLED=1` + `POINTVET_UNIFIED_MANUAL_REVERSAL_ORG_IDS` + `POINTVET_UNIFIED_MANUAL_REVERSAL_COMPANY_IDS` formam um novo gate **independente**, que autoriza exclusivamente estorno **integral** de venda já concluída. Ausência, `0` ou allowlist incompleta negam.
- Na transação `Serializable`, a API reconsulta a preferência atual de PDV Unificado e exige que **todos os CNPJs** da comanda pertençam integralmente à mesma política (checkout OU contingência); não combina pedaços das duas allowlists.
- A requisição continua exigindo usuário autenticado, organização corrente, `pdv.cancelar_venda`, acesso a todos os CNPJs, motivo, confirmação explícita de devolução/acerto externo e validações econômicas/estado da venda.
- `POST /api/pdv-unificado/rascunhos/:id/fechar-manual` **continua bloqueado** com checkout OFF. O novo gate não autoriza novos recebimentos nem venda.
- `GET /api/pdv-unificado/disponibilidade` apresenta `estornoUnificadoDisponivel` separadamente da capacidade de checkout, e a UI lista vendas concluídas e permite somente estorno autorizado, exibindo aviso de contingência. Histórico M.5.55 permanece read-only.
- Nenhum estorno parcial, devolução de dinheiro por API, Pix/PSP/banco, nota fiscal, TEF/maquininha ou migração de banco nesta mudança.

## Evidências

- Código funcional: `82c6138e3569999ec4e4ad6a71d1a7101ca20735`, branch `feat/pointvet-20-1-unified-pdv-foundation`, PR #36 **DRAFT**.
- [CI #39441021591](https://github.com/isaquesan7/sistema-pet/actions/runs/39441021591) **validate SUCCESS + isolated-postgres SUCCESS**, incluindo compilação do painel, contratos de gates e integração HTTP com PostgreSQL descartável.
- No teste E2E isolado, checkout OFF permaneceu HTTP 403, allowlist de apenas um CNPJ recusou estorno de comanda com dois CNPJs, allowlist integral permitiu estorno integral já registrado, repôs **333 g** de estoque e preservou idempotência; sem documento fiscal ou refund bancário.
- Railway staging segregado: API `4fcf2a65-fa1d-40e1-b976-965c99cf39bd` e Admin `6bdce3d2-0124-4a4d-a5a8-c5085bbcf54c` **SUCCESS**; serviços saudáveis. Os três novos nomes `POINTVET_UNIFIED_MANUAL_REVERSAL_*` **não estavam configurados** no serviço API de staging antes do deploy e não foram incluídos no patch. Logo a contingência permanece **OFF**. Checkout manual anterior permanece em `0` com allowlists vazias; nenhuma venda/estorno de staging executada neste patch.
- Main e produção comercial da Pet King intocados. Sem merge, flags ON ou canário comercial.

## Próxima etapa e regra operacional

1. Não ativar contingência enquanto não houver uma venda concluída que precise legitimamente de estorno **e** autorização pontual do responsável.
2. Durante incidente após um piloto autorizado, primeiro parar novas vendas com checkout OFF. Sob aprovação separada, habilitar o novo gate **apenas** para a organização/CNPJs afetados e somente durante a janela supervisionada; confirmar devolução/acerto externo antes de registrar estorno, auditar e retornar a contingência a OFF.
3. Antes de liberar o piloto comercial, concluir as exigências restantes de [M.5.47](POINTVET_M547_HOMOLOGACAO_OPERACIONAL_E_PILOTO.md), especialmente recuperação/rollback operacional autorizados, aceite supervisor/atendente, regras fiscal/contábil externas e decisão formal de canário. O aceite visual da seção M.5.55 **não equivale a autorização de produção**.

A etapa é uma capacidade defensiva independente. Não alterar variáveis reais sem a escolha explícita da organização, empresas, responsável e janela.
