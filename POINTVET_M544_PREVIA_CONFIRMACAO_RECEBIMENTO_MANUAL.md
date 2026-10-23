# PointVet M.5.44 — checklist declaratório do atendimento, sem fechamento

Data: 17/10/2026. Etapa após [M.5.43](POINTVET_M543_JORNADA_GRANEL_PAGAMENTO_MANUAL.md) da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37), na [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36).

## Objetivo operacional

Aproximar a prévia do PDV Unificado de uma venda comum: o atendente pesa a ração na **balança independente**, informa gramas inteiros ou reais, distribui o pagamento por empresa/CNPJ, prepara a divisão e confere **cada recebimento manual** separadamente. Exemplo: R$ 5,00 de ração a R$ 15,00/kg → 333 g; R$ 3,00 em dinheiro e R$ 2,00 em Pix, ambos conferidos pelo atendente. Não é preciso conexão com balança, leitores de códigos/QR, maquininha, banco, PSP ou TEF. Motor/provedor fiscal só será escolhido posteriormente pelo proprietário.

## Incremento seguro

- A consulta autenticada de **preparação existente** (`GET /pdv-unificado/rascunhos/:id/preparacao-execucao`) agora devolve **somente** as formas, centavos e caixa ligados a cada operação preparada, junto da versão. São campos da **distribuição imutável já salva**. A consulta mantém a autorização pré-existente por organização e todas as empresas, e nenhuma nova rota de execução foi introduzida.
- Após preparação `PREPARADA`, a tela mostra um checklist **local** por linha: forma, valor e caixa imutáveis; referência opcional até 120 caracteres; parcelas de 1 a 24 **somente** para cartão de crédito; checkbox individual de conferência externa do atendente. Dinheiro, Pix, débito e transferência têm parcela única.
- O botão **“Verificar declaração (sem registrar)”** só libera o resumo quando todas as formas estiverem explicitamente marcadas, o parcelamento for válido, a versão conferir e os valores salvos somarem exatamente os totais por empresa. Edits após a preparação da alocação não substituem os valores do snapshot autenticado.
- **Nada da declaração local é enviado à API ou armazenado**, incluindo confirmação e referência digitadas. O checklist não comprova recebimento real, não cria `RegistroRecebimentoManualUnificado`, `Pagamento`, `Venda`, movimento de caixa/estoque ou nota fiscal; não transforma a confirmação local em autenticação bancária.

## Evidências e próximos gates

`api/tests/pointvet-m544-declaracao-manual-ui.contract.test.mjs` valida o formato da declaração contra o **contrato existente do backend M.2**, exigência de todos os checkboxes, referências/parcelamento, adulteração de valor/caixa, versão inválida e ausência de rotas reais. O E2E de PostgreSQL isolado verifica que a consulta apresenta exatamente as linhas persistidas da preparação e não permite que o navegador invente novos totais. Build e CI (`validate` e `isolated-postgres`) devem passar no HEAD da PR.

**Ainda falta antes de oferecer fechamento operacional:** endpoint autenticado próprio com validação transacional dos registros manuais, permissões por empresa/caixa, idempotência, auditoria de atendente, estoque/estorno, reconciliação contábil e testes em staging autorizado, restore/rollback e piloto explícito. Não abrir a execução CI (`SomenteSandbox`) por HTTP; ela depende de isolamentos impossíveis de garantir apenas na UI.

**Escopo preservado:** PR #36 Draft; sem merge, deploy, habilitação de checkout, movimentação real na Pet King/Railway, integração física ou motor fiscal. Obrigações fiscais/contábeis aplicáveis dependem de processo externo apropriado antes de operação comercial.
