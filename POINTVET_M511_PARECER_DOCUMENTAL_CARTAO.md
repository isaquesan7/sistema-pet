# PointVet M.5.11 — segunda conferência documental dos repasses (apenas CI)

## Objetivo e limite

Completar o fluxo da M.5.10 com uma **segunda pessoa autorizada** avaliando documentação externa **declarada**, com rastreabilidade e unicidade. Isto NÃO é confirmação independente de depósito bancário: nenhum arquivo é recebido ou validado; o funcionário fornece somente uma referência e um hash SHA-256. O sistema não tem acesso a extrato de banco, maquininha, adquirente ou PSP. Mesmo com parecer registrado, **não há baixa de pagamento, crédito bancário, conciliação contábil ou permissão de publicar checkout**.

## Modelo e transação

- Migração aditiva `api/prisma/migrations/20261015200000_manual_card_review_ledger/migration.sql` cria `pareceres_pre_baixa_cartao_manual_unificada`, independente de títulos e saldos. O campo `preparacaoId` tem índice **UNIQUE** e FK com `ON DELETE RESTRICT`; o fingerprint do pedido de conferência também é único. `status` só aceita `CONFERENCIA_DOCUMENTAL_DECLARADA`, validado por CHECK SQL.
- `api/src/modules/pdv/pdv-unificado-parecer-documental.contract.js` calcula fingerprint determinístico a partir do SHA da preparação, identificador do conferente, referência e hash da evidência. Exige declaração explícita do operador e valida sintaxe de SHA e referência. Indica claramente `comprovacaoBancariaIndependente=false`, `baixaContabilAutorizada=false` e `conteudoDocumentoValidado=false`.
- `api/src/modules/pdv/pdv-unificado-parecer-documental-sandbox.service.js`: **trava tripla** `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1` e banco `pointvet_unified_ci` (confirmado por SELECT). Em transação `Serializable`, identifica e bloqueia a comanda via `FOR UPDATE`, reconsulta preparação M.5.10 de estado `PREPARADA_SEM_BAIXA` no tenant correto, conta bancária ativa da empresa, parcelas já marcadas `CONCILIADA` e sua auditoria humana M.5.5. Exige vínculo ativo, cargo com `financeiro.gerenciar` e que o conferente NÃO seja a pessoa que fez a preparação nem uma das pessoas que declararam a conciliação das parcelas. Confere a auditoria da M.5.10 e integridade do fingerprint.
- Registra **um** parecer e evento `Auditoria` na mesma transação. Repetir idêntica conferência da mesma pessoa é idempotente; qualquer mudança de hash, referência, pessoa ou empresa após o primeiro parecer é negada. O banco assegura unicidade sob concorrência; teste com duas solicitações simultâneas e replay.
- Sem rotas HTTP novas, UI de aprovação, upload de documento, comandos de escrita financeira, transação de venda, NFC-e, integração com PSP/TEF/maquininha ou acesso a produção.

## Testes e limitações

A suíte de contrato `api/tests/pdv-unificado-parecer-documental.contract.test.mjs` exercita validação/fingerprint. A integração `api/tests/pdv-unificado-integration.test.mjs` cria **outro usuário CI** na organização, exige permissão financeira da empresa A, rejeita autorrevisão, falta de vínculo, empresa B, falsa confirmação, falha transacional injetada; depois valida concorrência, replay, parecer único, auditoria única, imutabilidade de evidência e ausência de reconhecimento bancário. O teste remove apenas a própria fixture sintética antes da bateria separada de estorno M.3C; não existe exclusão em produção.

**Próximo gate depois de CI verde:** projetar o procedimento de homologação de comprovantes/extratos reais com autorização formal, evidências auditáveis e LGPD, tratamento financeiro de tarifas/antecipação e reversão pós-repasse. Staging segregado real, restore/rollback, fiscal multiemissor e piloto comercial exigem validação independente antes de publicar. PR #36 DRAFT; sistema principal e Pet King intactos.
