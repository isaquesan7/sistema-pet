> **Estado técnico M.3C (14/10/2026):** já existe rotina de estorno manual transacional **somente em PostgreSQL CI descartável**, testada em [run 38640657139](https://github.com/isaquesan7/sistema-pet/actions/runs/38640657139). Ela exige confirmação humana da devolução/cancelamento externamente, registra auditoria por reserva e bloqueia parcelas conciliadas, fiscal e financeiro. **Não efetua estorno em maquininha, Pix ou banco nem autoriza produção**. Próxima etapa oficial M.4: Orçamentos/Crédito PR #35, fiscal e modelagem de unidades; depois M.5 staging, restore e canário.

# Ponto de decisão OFICIAL — recebimentos manuais no PointVet

**Data:** 14/10/2026. **Origem:** decisão explícita do responsável pelo produto no chat.

## 1. Decisão definitiva para o escopo atual

**Não integrar maquininhas, adquirentes, gateways, webhooks ou PSPs no fechamento da primeira versão comercial do PDV Unificado.** O atendente fará o recebimento fora do software na maquininha, banco ou presencialmente e registrará a forma de pagamento no PointVet, da mesma maneira que uma venda em balcão.

- Formas de pagamento: `DINHEIRO`, `PIX`, `CARTAO_DEBITO`, `CARTAO_CREDITO`, `TRANSFERENCIA`.
- O atendente marca que verificou o recebimento/aprovação na maquininha ou comprovante. O PointVet registra a **declaração manual**; não a confunde com confirmação automática do emissor/adquirente.
- Para crédito, informar opcionalmente **parcelas** (1–24 inicialmente); cartão de débito não é parcelado. Nome da maquininha, comprovante, NSU ou código de autorização podem ser campos **opcionais**, sem vinculação ao fornecedor; não registrar dados sensíveis de cartão.
- Venda com diferentes empresas/CNPJs: **valores e registros financeiros segregados por empresa, caixa, responsável e emissor fiscal**. A interface pode mostrar um valor total consolidado, mas o lançamento financeiro terá um valor por empresa, e a empresa responde por receber a sua parte no terminal/conta de sua titularidade. Não fazer split, não direcionar recebimento a outro CNPJ e não fingir autorização de maquininha.
- Sem exigência de cadastrar/selecionar maquininha. Vários estabelecimentos e vendedores podem ter adquirentes diferentes sem configuração no PointVet.
- Separar valor da venda e registro do pagamento feito pelo atendente do **repasse efetivo** do cartão, que pode acontecer dias depois e ter taxas. Não calcular taxas/repasse de um PSP supostamente conhecido; possível conciliação por extrato manual em incremento posterior.
- **`CREDITO_CLIENTE`** é diferente de `CARTAO_CREDITO`: crédito pré-pago do cliente só quando o razão/ledger seguro do PR #35 estiver integrado e validado. Orçamentos continuam necessários no perfil e PDV.
- Fiscal, estoque, permissões, conciliação por empresa, idempotência, estornos e backup **continuam necessários**. Retirar PSP não autoriza pular essas etapas.

## 2. Como será o fechamento

1. Atendente prepara uma comanda (pode abranger várias empresas) e o sistema separa itens, valores e CNPJs.
2. Seleciona o caixa da empresa e a forma efetivamente usada; se parcelado, informa quantidade; informa referência/comprovante se desejar.
3. Confirma manualmente que a cobrança aconteceu **fora do PointVet**. Se não confirmar, não concluir registro como recebido.
4. Backend revalida empresa, vínculo do usuário, itens, preços, snapshot, revisão, estoque e sessão de caixa, usando valores originais em centavos.
5. Numa transação idempotente, registra uma venda por empresa, `Pagamento` ligado à venda e caixa da mesma empresa, e seus lançamentos financeiros, sem duplicar. O estado de confirmação deve informar que foi registrado pelo atendente, não por PSP.
6. Registra auditoria de quem declarou, data, forma, parcelas e referência opcional. Lançamentos de cartão de crédito podem exigir competência/contas a receber, taxa/repasse ainda não comprovados.
7. Emissão fiscal por empresa/operação e baixa de estoque segundo política e lei aplicável; compensação de falhas e estorno auditados e testados antes do release.

## 3. Implementação incremental e bloqueios

- **M.1 — contrato de validação de recebimento manual:** `api/src/modules/pdv/pdv-unificado-recebimento-manual.contract.js`, CI de validação, sem efeito financeiro. Verifica total, CNPJ via snapshot, caixa, confirmação, parcelas e fingerprint. **Não cria `Pagamento`**.
- **M.2 — IMPLEMENTADO NA BRANCH, CI APROVADO:** tabelas `RegistroRecebimentoManualUnificado` (um registro por reserva, fingerprint e usuário criador) e `LinhaRecebimentoManualUnificado` (operação+índice únicos, forma, valor, caixa, parcelas, referência e horário). Serviço interno `pdv-unificado-registro-manual-sandbox.service.js` grava tudo numa transação serializável sem `Pagamento` nem movimento de caixa. Proíbe cancelamento silencioso da reserva quando já existe declaração; reversão auditada é requisito da M.3/M.4. Migration `20261014193000_unified_manual_receipt_declarations`; [CI 38634484538](https://github.com/isaquesan7/sistema-pet/actions/runs/38634484538) **validate + isolated-postgres SUCCESS**, commit de código `25caf3435c28135aed3e5a6c87a191169f661084`.
- **M.3 — PRÓXIMO, APENAS SANDBOX:** transação para efetivar as vendas-filhas, pagamento informado e movimento de caixa/financeiro e estoque por empresa, com unicidade/replay, auditoria, rollback e recuperação, permissão cruzada, revalidação de pet/preço/caixa, cartão a receber/parcelamento e plano de estorno. Ainda sem liberar rota pública nem alterar legado.
- **M.4 — fiscal/estorno e integração PR #35:** identificar os emissores e documentos corretos, auditoria e compensação; Orçamentos/crédito, testes de mesmo CNPJ e suporte ao cenário de várias unidades conforme modelo jurídico.
- **M.5 — staging + canário controlado:** homologação operacional com usuários, backups/restauração, métricas, modo unificado opcional por organização com flag de checkout separada. Deploy somente após aprovação.

## 4. O que muda em relação aos incrementos anteriores

O histórico de `20.2.4B` que menciona PSP, recebedor, webhook, HMAC, outbox e conciliação de adquirente **fica preservado somente como protótipo experimental de CI**; ele não é mais pré-requisito de lançamento nem destino da arquitetura de recebimento manual. **Não conectar/expor nenhum serviço PSP sandbox em produção.** Não apagar a história de commits nem migrations sem review/estratégia de migração; auditar e manter código desativado até eventual refatoração/limpeza.

**Não voltar a propor escolher um PSP ou uma maquininha como bloqueio para publicação.** Uma eventual integração futura será recurso opcional, mediante nova solicitação explícita do responsável pelo produto.

## 5. Status de implementação e CI

- PR #36 permanece DRAFT; pagamentos manuais ainda não fazem lançamento financeiro real. Registrar SHA e workflow do HEAD em `POINTVET_CONTINUIDADE_OFICIAL.md` / Issue #37 e no PR #36 após CI.
- PR #35 é dependência de Orçamentos e Crédito do Cliente, sem autorização de consumir crédito agora.
- Não houve merge ou deploy em produção autorizado com esta decisão.

## 6. Homologação M.2 e instrução precisa de retomada (14/10/2026)
- **CI de código:** [PointVet Unified PDV Foundation #38634484538](https://github.com/isaquesan7/sistema-pet/actions/runs/38634484538), jobs `validate` e `isolated-postgres` **SUCCESS** no commit `25caf3435c28135aed3e5a6c87a191169f661084`. Documentação posterior exige conferir CI de HEAD.
- **Prisma:** `RegistroRecebimentoManualUnificado` com `reservaId @unique`, `criadoPorId`, `fingerprint`, `status=REGISTRADO`; linhas com `@@unique([operacaoId,indice])`, `forma`, `valor`, `parcelas`, `referencia`, `sessaoCaixaId`, horário. Sem relação com `Pagamento` real.
- **Migration aditiva:** `api/prisma/migrations/20261014193000_unified_manual_receipt_declarations/migration.sql` testada em PostgreSQL descartável; NÃO aplicada em produção.
- **Serviço:** `api/src/modules/pdv/pdv-unificado-registro-manual-sandbox.service.js`, restrito a `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, banco `pointvet_unified_ci`. Nenhum endpoint público. Guarda snapshot e organização, revalida plano, preços/pet/caixa e permissões em todas as empresas, confirma forma/parcelas e registra declarações atomicamente.
- **Idempotência:** lock da comanda, transação serializável, `reservaId @unique`, `operacaoId+indice @unique`. Mesmo fingerprint retorna os IDs antigos; declaração diferente retorna `REGISTRO_MANUAL_DIVERGENTE`. Cancelar reserva com declaração registrada retorna `REGISTRO_MANUAL_EXIGE_REVERSAO`; não apagar nem reverter registro de forma silenciosa.
- **Teste integrado:** duas gravações simultâneas, replay, comprovante divergente, falta de confirmação, troca de caixa, vazamento para outro tenant, impedimento do cancelamento e ausência de `Venda`, `Pagamento` ou `MovimentacaoCaixa` novos.
- **Nenhum pagamento/estoque/fiscal real:** M.2 é auditoria da declaração. **M.3 precisa fechar transacionalmente as vendas, gerar `Pagamento` e movimento por caixa/empresa e lidar com devolução/estorno e confirmação do atendente.** Evitar contabilizar cartão como dinheiro disponível sem tratar recebíveis/repasse; suporte a várias parcelas deve respeitar o sistema financeiro.
- **Próxima tarefa:** abrir Issue #37, PR #36, este documento e `POINTVET_CONTINUIDADE_OFICIAL.md`; revisar `criarVendaNoTx` legado e `Pagamento`/`MovimentacaoCaixa`, projetar M.3 com testes de duplicidade, rollback e estorno e sem PSP. Manter Orçamentos/Crédito do Cliente do PR #35 no escopo.
