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
