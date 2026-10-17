# PointVet M.5.19 — identificação e atualização da versão financeira consultada

## Objetivo

A M.5.18 já exige fingerprint exato da preparação e do parecer documental, ID da conta interna, valor líquido e, no caso de correção, ID da entrada original na transação PostgreSQL isolada. A M.5.19 **leva a referência desses dados ao operador** na aba de treinamento do Financeiro, sem permitir que a interface altere lançamentos, nem confundir SHA interno com comprovante bancário.

## Entregas em código

- `api/src/modules/pdv/pdv-unificado-revisao-financeira.contract.js` gera referência SHA-256 determinística por organização, empresa, comanda, preparação, etapa, fingerprints da preparação e segunda conferência, conta, líquido em centavos e entrada original quando aplicável. Recusa versões inválidas, revisão ausente após etapa 2, entrada sem referência original, SHA inválido ou valores incompatíveis. A função `conferirRevisaoAtualM519` compara duas referências SEM autoridade para executar operações. O código de revisão **não comprova transferência bancaria** ou assinatura de terceiro.
- `pdv-unificado-fluxo-operacional.service.js` agora lê também o fingerprint do segundo parecer, diretamente do banco autoritativo na consulta em snapshot `RepeatableRead`; `pdv-unificado-fluxo-operacional.contract.js` projeta `revisaoFinanceira` para cada etapa no GET já autenticado de M.5.16.
- `pdv-unificado-intencao-manual.contract.js` (M.5.17) exige que cada plano do simulador traga referência válida e coerente com a conta, etapa, original e valor líquido. O simulador continua **sem salvar** e sem chamada a PSP, maquininha ou banco.
- Na aba **Financeiro → Repasses cartão**, `UnifiedCardManualDryRun.jsx` exibe o identificador da revisão e a conta financeira interna. O botão `Reconsultar versão financeira (sem salvar)` chama somente GET autenticado de M.5.17 via `UnifiedCardReceivablesPanel.jsx` e compara com o SHA visto pelo funcionário. Em caso de diferença, exibe alerta e **remonta o formulário com o código de versão atualizado**, descartando os valores/checkbox anteriormente digitados. Em caso de falha de rede/servidor, nunca mostra que os dados estão atuais. A mesma limpeza vale para alteração de CNPJ/comanda/preparação.
- A suite de contrato `api/tests/pdv-unificado-revisao-financeira.contract.test.mjs` valida SHA estável, todas as mudanças que invalidam a revisão e o fail-closed. Foram atualizadas as suites M.5.16/M.5.17 e o E2E `api/tests/pdv-unificado-integration.test.mjs`, que usa os valores de revisão retornados pelo PostgreSQL descartável diretamente nos comandos M.5.18 de confirmação/correção e comprova mudança de código após lançamento/contralançamento.
- Nenhuma migration nova, nenhum endpoint POST, nenhuma chamada de escrita no frontend e nenhuma alteração em `Pagamento`, venda, saldo bancário REAL, caixa ou fiscal.

## Limites e gates

O operador confere extrato/comprovante **fora do PointVet**; não existe vínculo/integracão com banco, Pix automático, Open Finance, PSP, TEF, adquirente ou maquininha. A referência SHA-256 é apenas um detector de dados internos obsoletos, **não uma assinatura bancária nem autorização para liquidar**. Mesmo que a interface revalide, futuras gravações M.5.13/M.5.14 só poderão acontecer após revalidação AUTORITATIVA no servidor dentro da transação `Serializable`; por enquanto esses serviços continuam CI-only, banco `pointvet_unified_ci`, sem HTTP público.

Antes de considerar o checkout publicável: aprovação explícita para staging REAL segregado, validações contábil/fiscal para tarifas, antecipação e estorno pós-repasse, política operacional de dois funcionários e contralançamento, backup/restore e rollback reais, monitoramento e piloto opt-in. PR #36 permanece Draft, sem deploy, merge ou mudanças à main, Railway ou produção Pet King.

**Prova da M.5.19:** os jobs `validate` e `isolated-postgres` do SHA final precisam estar SUCCESS; registrar link na Issue #37 e PR #36. Não considerar CI verde como homologação de produção.
