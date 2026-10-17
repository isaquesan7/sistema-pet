# PointVet M.5.7 — consulta read-only de recebíveis de cartão na API e no Financeiro

**Escopo da entrega:** integrar a conferência de recebíveis de cartão da M.5.6 a rotas HTTP de leitura e a uma aba do Financeiro, mantendo o PDV Unificado **opcional**, **sem checkout real, sem conciliação financeira automática e sem alterar dados de produção**. Os commits permanecem no PR #36 Draft.

## API
- `api/src/modules/pdv/pdv-unificado-recebiveis-leitura.service.js`: verifica usuário, organização e empresa ativos, vínculo à organização/empresa, cargo ativo e permissão `financeiro.gerenciar`; exige `ConfiguracaoOrganizacao.pdvUnificadoHabilitado=true`. As consultas executam em transação PostgreSQL `RepeatableRead`; usam o contrato existente M.5.6 para validar todas as parcelas em centavos, auditoria por parcela conciliada e estados econômicos. **Apenas SELECT via Prisma**, nenhum método create/update/delete.
- `GET /api/pdv-unificado/recebiveis-cartao/comandas`: lista no máximo 20 comandas recentes da **empresa selecionada** que tenham linhas de cartão de crédito, sem dados pessoais de clientes ou outras empresas.
- `GET /api/pdv-unificado/recebiveis-cartao/comandas/:comandaId`: retorna total original, pendente, conciliado por declaração humana, estornado, e status por linha/parcela da empresa selecionada. Comanda de outro tenant é 404; integridade inconclusiva é 409 genérico (fail-closed, sem detalhes financeiros vazados). Respostas `Cache-Control: no-store`.
- Ambas as rotas exigem os middlewares existentes `autenticarUsuario`, `selecionarEmpresa`, `exigirModulo("PDV")`, `exigirPermissao("pdv.acessar")`, **mais** `exigirModulo("FINANCEIRO")`, `exigirPermissao("financeiro.gerenciar")` e o opt-in por organização. Nunca há rota POST/PATCH/PUT/DELETE de recebíveis/cartão.

## Interface
- `admin-web/src/components/UnifiedCardReceivablesPanel.jsx` e `admin-web/src/pages/FinancePage.jsx` adicionam aba **Repasses cartão** somente a operadores com `financeiro.gerenciar` e `pdv.acessar`.
- Verifica disponibilidade; se a preferência estiver desligada, mostra apenas aviso. Permite selecionar comanda recente e atualizar consulta, com estados de carregamento/erro, valor total original, pendente, repasse declarado e estornado. Não há botão de conciliar, creditar, receber, cobrar, estornar, baixar ou emitir nota.
- Usa query keys separadas por organização, empresa e comanda. O painel não altera o resumo financeiro legado nem a situação do pagamento; não duplica receita no caixa.

## Testes e limites
- `api/tests/pointvet-m543-http-checkout-barrier.integration.test.mjs`: integração HTTP Express real em `127.0.0.1` sobre Postgres **descartável CI**, cobrindo 401 sem login, 403 sem módulo financeiro, 403 sem permissão mesmo com módulo, 200 em listagem vazia após conceder ambos, 404 em comanda inexistente, 400 com ID inválido, empresa sem vínculo, revogação de permissão e opt-out. Verifica que não houve criação de Venda, Pagamento, Caixa, Estoque, Reserva, Crédito e DocumentoFiscal.
- Os testes de M.5.6 existentes continuam cobrindo efeitos econômicos reais **somente** no Postgres de CI, não na Pet King.
- A consulta HTTP **não confirma depósito bancário independente**. É um relatório de lançamentos e de confirmações declaradas por operador; não altera `Pagamento.status` nem cria uma `ConciliacaoFinanceira`. Recebimento real, fiscal oficial, crédito do cliente, multiunidades mesmo CNPJ, produção e canário continuam bloqueados. Não integra nenhuma maquininha/PSP/TEF.
- Staging REAL segregado com dados sintéticos, restore/rollback e homologação fiscal/financeira ainda precisam de aprovação externa e testes reais; CI verde não autoriza deploy ou merge.

**Próximo:** verificar `validate` e `isolated-postgres` no SHA final; corrigir qualquer falha. Registrar resultados na Issue #37 e PR #36 DRAFT. `main`, Pet King, Railway, DNS, Resend, backups reais e PR #35 permanecem intactos.
