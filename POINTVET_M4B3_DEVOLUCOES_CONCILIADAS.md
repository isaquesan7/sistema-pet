# PointVet M.4B.3 — devoluções conciliadas de adiantamento
**Escopo:** somente PostgreSQL CI `pointvet_unified_ci`, `NODE_ENV=test` e `POINTVET_UNIFIED_SALES_SANDBOX=1`. A única rota pública continua `GET /api/clientes-financeiro/:clienteId/credito` **consulta**, nunca escrita.

## Diagrama de causa e prova
```
Cliente/Tutor (organização) + Empresa/CNPJ
  └─ Título RECEBER / ADIANTAMENTO CLIENTE / PAGO
      └─ BaixaFinanceira ENTRADA integral
          └─ ConciliacaoFinanceira (ENTRADA, BAIXA_TITULO)
              └─ CreditoClienteMovimento ENTRADA (único)
                  └─ CreditoClienteMovimento ESTORNO (único, valor inteiro)
                      ├─ confirma devolução EXTERNA: declaração do operador
                      └─ ConciliacaoFinanceira (SAIDA, BAIXA_TITULO, ÚNICA)
                          └─ BaixaFinanceira SAIDA integral
                              └─ Título PAGAR / DEVOLUCAO ADIANTAMENTO CLIENTE / PAGO
```
A tabela `CreditoClienteMovimento` ganhou `devolucaoConciliacaoId @unique`, nullable para compatibilidade. `reverteMovimentoId @unique` já impedia duas reversões da mesma causa. O livro de crédito não *produz* o fluxo financeiro acima: **exige que já exista como evidência no financeiro**, e faz validação ativa antes e depois de cada lançamento.

## Invariantes de implementação
- Toda ENTRADA está vinculada a uma só conciliação de entrada e título RECEBER/PAGO. Toda devolução de entrada está vinculada a uma conciliação DISTINTA de SAÍDA e título PAGAR/PAGO da mesma empresa/tutor.
- Não há devolução contábil associada a reversão de `UTILIZACAO` simulada; débito simulado não configura pagamento, e `ESTORNO` nunca possui retorno externo automático.
- Estornos antigos sem conciliação de saída tornam o saldo **não confiável**, a partir da nova lógica; exige análise/migração orientada e auditoria antes de poder habilitar uso.
- Conciliação de saída com valor, conta ou título modificado posteriormente invalida a confiança do saldo. Testes no banco isolado provam regressões; nada é transmitido ou estornado em sistemas externos.
- Não afirmar "reembolso realizado" apenas porque o operador declarou e a conciliação local existe. Para produção, exigir evidência bancária externa quando aplicável, segregação de funções e revisão financeira.
- Preserve o modo PDV unificado como opt-in por organização. Não implementar PSP de pagamento, nem alterar PDV individual, `main` ou dados reais.
## Handoff
Após validar ambos os jobs no HEAD documental, registrar SHA e run em Issue #37 e PR #36; avançar **M.4C arquitetura fiscal sem emissão**, incluindo matriz por emissor/CNPJ/UF/município e desenho `EntidadeFiscal`/`UnidadeOperacional`. Depois M.5: staging/restore/rollback e canário explícito. 
