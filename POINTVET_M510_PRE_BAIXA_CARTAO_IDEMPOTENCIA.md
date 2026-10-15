# PointVet M.5.10 — pré-baixa persistente e idempotente dos repasses de cartão (CI)

**Objetivo:** sair da prévia puramente matemática da M.5.9 e provar a persistência transacional e a prevenção de duplicidades, **sem registrar baixa financeira, sem confirmar extrato e sem liberar checkout de produção**. Toda execução é restrita ao PostgreSQL descartável `pointvet_unified_ci`; nenhum endpoint HTTP ou botão de liquidação foi criado.

## Estrutura de persistência (aditiva)

Migração `api/prisma/migrations/20261015193000_manual_card_presettlement_ledger/migration.sql` e schema Prisma adicionam duas tabelas novas, distintas do Financeiro oficial:

- `PreparacaoBaixaCartaoManualUnificada`: registra operador, organização, empresa, comanda, conta declarada, referência externa, data, valores bruto/tarifa/desconto de antecipação/líquido, SHA-256 do plano M.5.9 e snapshot. Seu **único estado** é `PREPARADA_SEM_BAIXA`; há uma restrição SQL de consistência das quatro quantias, um fingerprint único globalmente e referência externa única por empresa.
- `ParcelaPreBaixaCartaoManualUnificada`: associa parcelas à pré-baixa. `parcelaId` possui índice **UNIQUE** global: uma parcela nunca pode ser preparada duas vezes, mesmo sob referências de extrato diferentes ou requisições concorrentes. A operação inteira confirma ou desfaz por transação.

## Serviço M.5.10

`api/src/modules/pdv/pdv-unificado-pre-baixa-sandbox.service.js`, função `registrarPreBaixaCartaoSomenteSandbox`:

1. Exige `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1` e DATABASE_URL apontando a `pointvet_unified_ci`, e confirma `current_database()` na transação.
2. Bloqueia a comanda via `FOR UPDATE`, como os serviços de conciliação M.5.5 e estorno M.3C, e usa isolamento `Serializable`.
3. Confirma vínculo ativo do operador/empresa/organização, permissão `financeiro.gerenciar`, comanda unificada `FECHADA` do mesmo tenant e conta financeira do tipo banco ativa e pertencente à mesma empresa.
4. Reconsulta as parcelas reais e respectivas auditorias no **mesmo bloqueio transacional**. O resumo M.5.6 e a prévia M.5.9 são recomputados de dados autoritativos; não aceita resumo/fingerprint enviados pelo cliente.
5. Se já há referência da mesma empresa com fingerprint/parcelas idênticos e estado válido, retorna registro existente com `reutilizada=true`; se mudou valor, taxa, lista de parcelas, conta, data ou referência, recusa divergência. Se a parcela já está associada a outra pré-baixa, recusa; índices exclusivos do banco cobrem a corrida final.
6. Grava pré-baixa, vínculos e uma linha `Auditoria` de `PRE_BAIXA_CARTAO_PREPARADA_CI` **na mesma transação**, com injeção opcional de falha nos testes para garantir rollback.
7. Retorna explicitamente `creditouBanco=false`, `alterouPagamento=false`, `gerouConciliacao=false`, `gerouMovimentoCaixa=false`, `gerouTitulo=false`, `emitiuDocumentoFiscal=false`, `autorizadoEmProducao=false`.

M.3C bloqueia o estorno integral padrão caso alguma pré-baixa esteja registrada na comanda (`M3C_PRE_BAIXA_EXIGE_REVISAO`). Isso não executa devolução e não cria um caminho para excluir pré-baixas reais.

## Testes e limites

A bateria `api/tests/pdv-unificado-integration.test.mjs` em CI inclui falha simulada com rollback sem registro, conta de outro CNPJ negada, duas solicitações simultâneas, replay idempotente, referência alterada com mesma parcela proibida, referência igual com termos alterados proibida, auditoria única e estorno exigindo revisão. A fixture do teste apaga seus **próprios dados de CI** depois das assertivas para não quebrar os ensaios preexistentes de estorno ainda não conciliado; **não existe** endpoint de exclusão e esse reset nunca deve ser reproduzido em ambientes reais.

Esta M.5.10 **não comprova crédito bancário**. Continuam pendentes as políticas e o fluxo homologado de vinculação de extrato bancário real/dupla aprovação, eventual criação de títulos e conciliação financeira que não dobre receita, tratamento de taxas contábeis, antecipação, reembolso pós-repasse e documentação fiscal do emissor. Também estão pendentes staging segregado real autorizado, testes de recuperação/rollback reais e piloto opt-in. O PR #36 segue DRAFT; `main`, produção da Pet King, Railway, DNS e backups reais não devem ser alterados.
