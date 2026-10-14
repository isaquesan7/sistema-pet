# PointVet — Orçamentos e Crédito do Cliente (fundação)

## Objetivos

**Orçamentos**: propostas comerciais separadas das vendas e contas a receber, identificadas por organização, empresa e tutor. Cada proposta possui itens com quantidade, preço, valor total, validade e estado (rascunho/enviado/aprovado/rejeitado/cancelado/expirado). Aprovação não gera recebimento, nota fiscal nem movimentação automática sem integração explícita com PDV.

**Crédito do cliente**: carteira pré-paga contabilizada por um razão imutável de entradas, utilizações e estornos. O saldo deve ser derivado de lançamentos validados, nunca atualizado diretamente num campo do tutor nem confundido com títulos financeiros a receber.

## Segurança e próximos incrementos obrigatórios
- Vincular todas as consultas e alterações à organização e ao CNPJ selecionado; validar pet pertencente ao tutor.
- Implementar endpoints de listagem de orçamentos e movimentações de crédito com permissões específicas.
- Criar orçamento em rascunho e editar itens apenas antes da aprovação, com cálculo monetário decimal no servidor e trilha de auditoria.
- Implementar autorizações de movimentações de crédito, prevenção de débito acima do saldo, idempotência e concorrência sob transação serializável.
- Integrar entradas de crédito a pagamentos realmente confirmados. Não criar "dinheiro" apenas pelo lançamento manual.
- Integrar utilização/estorno ao PDV com referências rastreáveis e regras de reversão; não permitir exclusão/edição do razão.
- Exibir filtros alinhados e relatórios imprimíveis na ficha do tutor.
- Homologar em PostgreSQL isolado, com testes de isolamento multi-organização e cenários de concorrência e estorno.
- Confirmar backup restaurável e plano de rollback antes de migrar o banco da Pet King.

**Estado desta branch:** estrutura Prisma + migração SQL aditiva somente. Não disponibilizar funcionalidades de lançamento ainda; NÃO mesclar/publicar até APIs, autorização e testes end-to-end estarem concluídos.


## M.4A — port para o ramo único em 14/10/2026
A base PR #35 foi transplantada **como código adaptado**, não mesclada. Controle de organização/empresa/tutor/pet, valores de centavos e milésimos, transação Serializable e Auditoria por criação/alteração. O crédito permanece leitura somente e `saldoConfiavel=false` em caso de ESTORNO sem vinculação causal. Não há baixa de crédito no PDV, uso de orçamento como venda, transferência de orçamento entre CNPJs, PSP ou fiscal. Código ainda não habilitado para produção. Próxima etapa é exigir vínculo item-orçamento/catálogo + revisão de descontos e segregação por empresa antes de permitir conversão para rascunho do PDV.


## Incremento M.4B.1 — transição do orçamento aprovado em rascunho isolado (14/10/2026)
O fluxo de desenvolvimento está em `api/src/modules/clientes/client-quote-pdv-conversion-sandbox.service.js` e migration `20261014234500_quote_to_unified_draft`. Mantém entidade de conversão única por orçamento, `Comanda.rascunhoUnificado=true`, vínculos dos itens e fingerprint; idempotente, serializável e trilha `Auditoria`. No painel, “Conferir no PDV” apenas pesquisa catálogo e mostra prévia, sem conversão. O único serviço de conversão exige CI isolado e **não está montado em rota HTTP**. Nada foi cobrado, nem foi emitida nota ou criado crédito. [Handoff](POINTVET_CONTINUIDADE_OFICIAL.md) e [arquitetura fiscal](POINTVET_M4_FISCAL_ORCAMENTOS_ARQUITETURA.md).


## M.4B.2 — Razão causal contábil de crédito (somente CI)
Existe migration `20261014235900_client_credit_causal_ledger`, contrato puro e serviço `client-credit-ledger-sandbox.service.js` sem rota pública. Apenas entrada com título de ADIANTAMENTO CLIENTE, baixa e conciliação de mesma conta/empresa/valor; uma conciliação só pode financiar um crédito. O saldo é revalidado contra as fontes vivas, rejeita históricos antigos sem lastro, e `ESTORNO` não é tratado genericamente como saque: vincula-se causalmente a ENTRADA ou UTILIZACAO; estorno da entrada exige confirmação de devolução externa. Debit `UTILIZACAO` existe só para testar concorrência no banco descartável — NÃO é compra no PDV. `saldoConfiavel` pode ser falso mesmo com saldo numérico calculado, se houve alteração de evidência. Nenhum provedor bancário/maquininha foi integrado. Próximos gates: operações financeiras de saída realmente comprovadas, crédito consumível associado a venda idempotente homologada, fiscal/multiunidades e staging/restore da M.5.
