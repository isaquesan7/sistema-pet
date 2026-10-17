# PointVet M.5.12 — diagnóstico de integridade após parecer documental

**Objetivo:** proteger o fluxo de pré-baixa M.5.10 e a dupla conferência M.5.11 contra alterações posteriores em parcelas, valores, conta, referência, documentos e auditorias, antes de planejar qualquer movimento financeiro. **Esta etapa não autoriza uma baixa contábil** nem comprova o crédito bancário.

## Implementação
- `api/src/modules/pdv/pdv-unificado-diagnostico-pre-baixa.contract.js`: contrato **puro, somente leitura** que confere estado da comanda, conta bancária ativa da empresa, vínculo de parcelas e valores, declaração M.5.5 e auditorias M.5.10/M.5.11. Reconstrói o fingerprint original M.5.9 usando organização/empresa/comanda, tipo, conta, referência, data, parcelas e centavos exatos. Recalcula a assinatura documental M.5.11 a partir da referência e do hash declarados pelo segundo usuário. Detecta inconsistências após a conferência.
- `api/src/modules/pdv/pdv-unificado-diagnostico-pre-baixa-sandbox.service.js`: consulta em snapshot PostgreSQL RepeatableRead no banco descartável `pointvet_unified_ci` com guardas CI, autorização `financeiro.gerenciar`, vínculo de organização/empresa e leitura de dados autoritativos da comanda, parcelas e auditorias. Sem rota HTTP.
- `api/tests/pdv-unificado-diagnostico-pre-baixa.contract.test.mjs`: testa dossiê coerente, parecer ausente e adulteração de valor, referência, hash, vínculo empresa, comanda, auditorias e status.
- `api/tests/pdv-unificado-integration.test.mjs`: usa o registro real sintético de pré-baixa e parecer M.5.11, testa diagnóstico e isolamento entre empresas, altera propositalmente um SHA da evidência e confirma reprovação; restaura a fixture de CI para prosseguir aos testes preexistentes.

## Sem liberação contábil

Mesmo quando a integridade interna estiver perfeita, o diagnóstico responde `comprovacaoBancariaIndependente=false`, `podeExecutarBaixa=false`, `podeAprovarPagamento=false`, `podeCreditarBanco=false`, `podeExecutarEstorno=false`, `podeEmitirFiscal=false` e `podePublicarPdv=false`. As dependências externas explícitas continuam sendo extrato bancário autenticado, política contábil/fiscal homologada, tratamento de estorno pós-repasse e staging/rollback reais autorizados.

**Limites:** hashes/documentos são declarações, não arquivos verificados ou extratos independentes. Nenhum título, `Pagamento`, `ContaFinanceira`, `ConciliacaoFinanceira`, caixa, estoque ou fiscal é alterado. Nenhuma chamada real a banco, maquininha, PSP, Railway, staging ou produção é feita. A M.5.12 não inclui deploy, merge nem publicação de checkout.

**Próximo:** confirmar o CI exato do HEAD para validação e integração PostgreSQL. Depois preparar homologação de extratos e comprovações bancárias reais, sem confundir declaração documental com efetivação financeira; execução em staging segregado só após aprovação própria. PR #36 segue Draft, Pet King/main preservados.
