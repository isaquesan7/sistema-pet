# PointVet M.5.27 — dossiê de conferência independente de devoluções, read-only

## Por que esta etapa existe
A M.5.23 mantém o livro de declarações humanas de devolução externa, a M.5.24 aponta divergências e pendências, e a M.5.25 garante que as fontes são comparadas em **um único snapshot PostgreSQL**. Faltava uma lista de trabalho **por declaração**, vinculada à origem e à versão interna, para permitir que uma segunda pessoa saiba exatamente o que conferir sem interpretar uma declaração como prova de pagamento.

## Entrega
- `api/src/modules/pdv/pdv-unificado-dossie-devolucoes.contract.js`: contrato puro `montarDossieDevolucoesM527` recebe **diagnóstico M.5.24 e histórico M.5.23 da MESMA leitura autorizada**. Recalcula o fingerprint do diagnóstico, confere tenant/empresa/comanda, estágio, número de declarações, referências únicas, IDs, usuário declarante, ordem causal, centavos, saldos bruto/declarado/restante, datas e totais. Origem adulterada ou fontes divergentes retornam `M527_*` e nenhum dossiê.
- Dossiê M.5.27 com SHA-256 interno sensível à versão/declaração, referência, valor e data, sem dados bancários de cliente nem motivo narrativo. Lista para cada declaração pendências concretas: obter comprovante externo, confrontar data/valor/referência/destinatário, verificar extrato fora do PointVet, designar **outro conferente** e encaminhar política contábil/fiscal por CNPJ. **Nenhuma ação é marcada automaticamente como concluída**.
- Serviço `consultarDossieDevolucoesM527` usa uma só transação `RepeatableRead` e reutiliza autorização M.5.7 + projeções M.5.16/M.5.23/M.5.24 via helper transacional M.5.25. A refatoração preserva o resultado e autorização da rota M.5.24 existente.
- Novo **GET** `/api/pdv-unificado/recebiveis-cartao/comandas/:comandaId/dossie-devolucoes`: mesma organização/empresa selecionada, opt-in PDV unificado, módulos PDV + FINANCEIRO, `pdv.acessar` e `financeiro.gerenciar`, `no-store`, ID válido; HTTP 400/403/404/409 conservador. Nenhuma rota POST/PATCH/PUT/DELETE, migration ou operação de escrita.
- `UnifiedCardReceivablesPanel.jsx`: tabela read-only com referência, valor, registro e orientações de conferência; aviso explícito de que **a plataforma não verificou nenhum comprovante**. Atualização respeita a consulta específica por empresa/comanda.

## Limites incontornáveis
**Dossiê é lista de conferência, NÃO é uma segunda conferência concluída.** O código interno e o hash não provam existência ou autenticidade de extrato, titular/destinatário, dinheiro efetivamente devolvido, restituição de taxas, enquadramento fiscal ou quitação. Sem upload, armazenamento, avaliação automática ou validação de comprovantes; sem anexar informações sensíveis novas. `permiteConcluirRevisao=false`, `provasBancariasValidas=false`, `permiteNovoReembolso=false`, `permiteLancamentoFinanceiro=false`, `permiteOperacaoFiscal=false` e `habilitaCheckout=false` invariáveis.

**Decisão fiscal mantida (15/10):** o provedor será escolhido pelo proprietário posteriormente. NÃO criar motor fiscal, adaptador, emissão, XML, número, assinatura, cancelamento ou impostos. M.5.26 permanece preparação neutra.

## Testes/aceite
- `api/tests/pdv-unificado-dossie-devolucoes.contract.test.mjs`: 0/1/2 declarações, R$20 e R$40 de R$60, hashing estável e versionado, obrigações sempre pendentes, falsificação, CNPJ, IDs/referências duplicadas, usuário, data, ordem/centavos e falsas aprovações.
- `api/tests/pdv-unificado-integration.test.mjs`: PostgreSQL descartável com declaração persistida e auditada, dossiê antes/depois de nova declaração, acesso cruzado negado, nenhum documento fiscal ou pagamento criado pelo dossiê.
- `api/tests/pointvet-m543-http-checkout-barrier.integration.test.mjs`: GET protegido, opt-out, cross-tenant, IDs malformados, métodos de escrita inexistentes e contagens econômicas estáveis.
- CI: `PointVet Unified PDV Foundation` em PR Draft, `validate` + `isolated-postgres` requeridos. **Status CI de implementação: pendente de execução.** Backup/restore do workflow é apenas SINTÉTICO.

## Próximos gates oficiais
1. Planejar com consentimento e revisão LGPD a coleta/guarda dos comprovantes reais com minimização, retenção e auditoria; verificação **humana por dois responsáveis diferentes**, sem depender de banco/maquininha integrado.
2. Revisão contábil/fiscal por CNPJ, incluindo tarifas e antecipações — sem implementar motor fiscal até escolha do provedor.
3. Staging REAL segregado, backup/restore e rollback REAL somente mediante autorização expressa; testes de regressão e piloto opt-in antes de publicação do PDV.

O PR #36 continua **DRAFT**; checkout desativado; `main`, Railway e produção Pet King intocados. Não houve conexão com banco, Open Finance, PSP, TEF ou maquininha nem deploy/merge.
