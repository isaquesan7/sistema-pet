# PointVet M.5.5 — conciliação MANUAL dos repasses de cartão (somente CI)

**Objetivo funcional:** deixar de depender de `AGUARDANDO_REPASSE` indefinidamente nas parcelas de cartão geradas pelo fechamento manual multiempresa M.3B, **sem integração com maquininha, adquirente, PSP ou extrato bancário automático**.

## Implementação
- `api/src/modules/pdv/pdv-unificado-conciliacao-manual.contract.js`: exige declaração explícita de que o operador já conferiu o repasse EXTERNAMENTE, referência sanitizada, conta financeira, valor decimal em centavos exatamente igual à parcela, fingerprint SHA-256 determinístico.
- `api/src/modules/pdv/pdv-unificado-conciliacao-manual-sandbox.service.js`: serviço sem rota pública, operável **somente** em `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1`, URL `pointvet_unified_ci` e `current_database() = pointvet_unified_ci`. Restringe por organização, empresa e permissão `financeiro.gerenciar`; conta financeira ativa, bancária e da mesma empresa; operador com vínculo ativo; só parcelas reais de `CARTAO_CREDITO` atreladas a pagamento pendente, venda filha FINALIZADA, operação concluída, comanda unificada FECHADA e reserva válida.
- Em transação `Serializable`, bloqueia a comanda e a parcela na mesma ordem do estorno M.3C; atualiza `AGUARDANDO_REPASSE -> CONCILIADA` e grava `Auditoria` com operador, empresa, conta, referência externa e fingerprint na mesma transação. Repetir os mesmos dados é idempotente e não duplica auditoria; divergência de referência/conta/valor bloqueia.
- `api/tests/pdv-unificado-conciliacao-manual.contract.test.mjs` e cobertura na integração CI `api/tests/pdv-unificado-integration.test.mjs`: rejeitam conta de outra empresa, tenant estranho, valor divergente e declaração não confirmada; provam replay, auditoria única e ausência de novas `Pagamento`, movimentos de caixa/estoque e `DocumentoFiscal`. Estorno manual fica bloqueado para parcela conciliada. O reset temporário de parcela e auditoria existe **SOMENTE NA FIXTURE CI**, para cobrir o caso separado de estorno de cartão pendente; não há rotina de desconciliação pública.
- Não adiciona tabelas nem migrations; utiliza `ParcelaRecebivelManualUnificado.status`/`conciliadoEm` e a tabela de `Auditoria` existentes.

## Limites para lançamento
1. `CONCILIADA` significa **confirmação declarada por pessoa com permissão**, não comprovação bancária independente; não gera saldo ou conciliação bancária fiscalmente verificada. Exige política operacional e documentação do comprovante fora do PointVet.
2. Não marca o `Pagamento` como `APROVADO` automaticamente; a contabilidade/recebíveis e a regra de reconhecimento exigem validação de fechamento completo das parcelas. Sem crédito fictício.
3. Não realiza devolução por API; estorno de repasse conciliado requer tratamento financeiro específico.
4. Não existe endpoint HTTP nem interface deste serviço; apenas CI. Antes de liberar vendas em produção ainda faltam staging real aprovado, fluxos operacionais end-to-end, migração/rollback, conciliação financeira e fiscalização por CNPJ/município, revisão independente, e piloto opt-in. `CREDITO_CLIENTE` permanece bloqueado no checkout; `Empresa.cnpj @unique` mantida.
5. A política de pagamento **permanece 100% manual**, como solicitado. Maquininhas e PSP não são bloqueios para a primeira publicação.

**Não alterar a produção Pet King, Railway, DNS, backup real, fiscal, `main`, PR #35, nem liberar PR #36 do estado Draft.**
