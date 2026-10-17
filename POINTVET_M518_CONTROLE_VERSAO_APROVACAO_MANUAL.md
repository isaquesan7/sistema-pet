# PointVet M.5.18 — autorização manual atrelada à versão financeira exata

## Por que esta etapa foi necessária

O formulário M.5.17 faz apenas simulação local. Antes de homologar comandos de escrita, a confirmação manual NÃO pode confiar em dados financeiros vistos anteriormente no navegador. Um lançamento equivocado poderia ocorrer caso outro funcionário alterasse a preparação, a conferência documental, a conta interna ou o valor entre a leitura e a gravação. **Esta M.5.18 implementa esse gate no servidor**, ainda restrito ao PostgreSQL descartável do CI.

## Implementação (sem conectar bancos)

1. Contrato puro `validarComandoFinanceiroManualM518` em `api/src/modules/pdv/pdv-unificado-comando-financeiro.contract.js`, com valores em centavos inteiros e SHA-256 determinístico da identidade de cada comando.
2. **Confirmação:** solicitações ao serviço M.5.13 passam a exigir `fingerprintPreparacaoEsperado`, `fingerprintParecerEsperado`, `contaFinanceiraIdEsperada`, `valorLiquidoEsperado`, referência original e `confirmouCreditoNoExtrato=true`. Depois de bloquear a comanda e validar acesso financeiro/tenant, o serviço **reconsulta** a preparação e o parecer na MESMA transação Serializable, compara todos os valores e somente então poderá criar o lançamento líquido interno. Se qualquer valor mudar, recusa a operação; não usa dados do cliente como valor de crédito.
3. **Correção:** solicitações ao serviço M.5.14 exigem `fingerprintPreparacaoEsperado`, `contaFinanceiraIdEsperada`, `valorLiquidoEsperado`, `lancamentoOriginalIdEsperado`, confirmação explícita, referência de correção distinta e justificativa. Confere a entrada original e o saldo interno por empresa, antes de contralançar; operador da correção deve ser diferente do operador que confirmou o repasse.
4. Cada lançamento/contralançamento grava `fingerprintComando` na auditoria existente, **atomicamente** na mesma transação. Repetição idêntica com mesmo usuário permanece idempotente; replay divergente de registro existente não consegue alterar o histórico.
5. Teste puro `api/tests/pdv-unificado-comando-financeiro.contract.test.mjs` cobre identidade SHA, centavos, conta, parecer, organização/empresa, declaração externa, origem e regra de segundo operador. A suíte de integração `api/tests/pdv-unificado-integration.test.mjs` foi atualizada para usar o contrato e inclui tentativas negativas de preparação/parecer/valor/conta/lançamento original desatualizados antes dos ensaios de rollback, concorrência, replay e preservação da venda/financeiro. Workflow executa testes puros e PostgreSQL descartável.

## O que NÃO foi implementado

**Nenhuma conexão com bancos, adquirentes, maquininhas, PSP, TEF ou Open Finance.** O atendente/gestor verifica o pagamento fora do PointVet. O serviço registra uma declaração humana e um movimento de saldo *interno* do PointVet no CI isolado, não dinheiro transferido por ele. Não foi criada rota POST de confirmação/correção no servidor de produção nem botão de baixa na interface.

**A confirmação de extrato por funcionário não é prova bancária independente.** O fingerprint indica exatamente quais dados foram revisados, não autentica comprovantes. Valor bruto, tarifas e antecipação continuam regras a serem homologadas para competência fiscal/contábil por CNPJ. Corrigir o lançamento interno não substitui reembolso ou estorno externo. Checkout real segue bloqueado.

## Próximos gates

Validar `validate` e `isolated-postgres` SUCCESS no SHA final. Depois: apresentação segura da revisão/versão ao funcionário e fluxo de escrita homologado com autorização específica, políticas contábil/fiscal de tarifa/antecipação/estorno, staging REAL isolado (somente após autorização), restore/rollback real e piloto opt-in. Não efetuar deploy, merge ou mudança em `main`/Pet King, Railway ou backup real sem aprovação. PR #36 permanece DRAFT.
