# PointVet M.5.24 — diagnóstico somente leitura de lacunas na conferência de devoluções externas

## Problema e distinção obrigatória
A plataforma separa três fatos **que não podem ser confundidos**:
1. **Repasse de cartão interno**: funcionário declara ter visto crédito fora do PointVet e, em CI, registra saldo líquido interno M.5.13.
2. **Devolução ao cliente declarada**: livro M.5.22 guarda uma afirmação humana sobre pagamento realizado externamente. M.5.23 reconstrói valores brutos declarados, saldo ainda SEM declaração e auditorias.
3. **Comprovação externa, recuperação de tarifa e tratamento fiscal**: requer extratos/comprovantes e análise de emissor/CNPJ por pessoas autorizadas. O PointVet **não tem essas provas** nem se conecta a banco, PSP, TEF, Open Finance, adquirente ou maquininha.

A M.5.24 mostra lacunas de conferência das informações disponíveis. **Não valida comprovantes anexados, não cria documento de conferência, não reconhece taxas recuperadas, não calcula competência contábil, não emite estorno fiscal e não registra reembolso.**

## Entregas
- Novo contrato puro `diagnosticarDivergenciasDevolucoesM524` em `pdv-unificado-diagnostico-devolucoes.contract.js`: compara os relatórios autorizados M.5.16 (etapas, bruto, tarifa, desconto por antecipação, líquido, versão financeira) com M.5.23 (origem por empresa, histórico, bruto sem declaração). Exige igualdade de organização, empresa, comanda, cardinalidade, referências, estado do repasse, valores em centavos, total das declarações e invariantes `bruto = tarifa + antecipação + líquido`; fail-closed `M524_...` em divergência.
- Produz **diagnóstico SHA-256 de consistência interna** com pendências explicitas: comprovantes externos não verificados, beneficiário/meio não conferidos, conferência independente pendente, histórico externo possivelmente incompleto, política fiscal por CNPJ não homologada, recuperação de taxas/antecipações não verificada e ausência de declarações externas. O hash não é prova bancária ou autorização financeira.
- Serviço `consultarDiagnosticoDevolucoesM524` reutiliza os dois serviços de leitura autorizados M.5.16 e M.5.23. As consultas têm snapshots read-only independentes; entre elas pode haver mudança concorrente. Os invariantes cruzados recusam divergências observáveis, mas **não substituem uma revalidação transacional de uma futura operação de escrita**.
- `GET /api/pdv-unificado/recebiveis-cartao/comandas/:comandaId/diagnostico-devolucoes` exige `pdv.acessar` + `financeiro.gerenciar`, módulo PDV/FINANCEIRO, usuário ativo, tenant/CNPJ, opt-in e `Cache-Control:no-store`; ID inválido 400, opt-out/sem acesso 403, comanda ausente 404, inconsistência 409. Nenhuma rota HTTP POST/PATCH/PUT/DELETE.
- `UnifiedCardReceivablesPanel.jsx` ganha painel legível por comanda/CNPJ com referências dos repasses e pendências, valores de taxas e antecipações informadas, totais internos declarados e hash abreviado. Atualiza com botão geral; divergências exibem erro em vez de uma recomendação falsa de reembolso. Não há botão operacional.

## Testes de homologação automatizada (somente CI)
- `pdv-unificado-diagnostico-devolucoes.contract.test.mjs`: reproduz R$60 bruto / R$1,20 taxa / R$58,80 líquido, devolução externa declarada de R$20, saldo sem declaração R$40 e avisos de documentação/taxas/fiscal. Inclui desconto de antecipação, repasse corrigido, ausência de declaração, outro CNPJ, etapa divergente, valores adulterados, falso estado bancário, referência/versionamento incompatível e totais divergentes.
- `pdv-unificado-integration.test.mjs`: consulta diagnóstico com dados efetivamente criados em PostgreSQL descartável, nos estágios sem repasse, após R$20, após R$20+R$40 e após contralançamento de correção interna; assertiva de permissões multiempresa e **nenhuma autorização de escrita**.
- `pointvet-m543-http-checkout-barrier.integration.test.mjs`: API real Express com permissão, opt-out, IDs inválidos, cross-tenant, POST/PATCH negado. Workflow CI executa build admin, contratos, migrações descartáveis, smoke HTTP e restore/rollback **sintéticos**.

## Limites e próximos gates
O sistema não atesta que o dinheiro realmente saiu ou entrou, não conhece obrigatoriamente todas as devoluções fora do PointVet nem tem política universal de nota fiscal/tributação/taxas por emissor. Mesmo com diagnóstico consistente, as pendências persistem. Requer validação fiscal/contábil por CNPJ e reconciliação documental externa por dois responsáveis antes de qualquer escrita comercial. Staging REAL segregado, backup/restore e rollback REAIS e piloto opt-in **somente mediante autorização específica**. PR #36 permanece DRAFT; nenhum merge, deploy, mudança em `main`, Railway ou produção da Pet King.

**Status de implementação: M.5.24 validada em CI** no SHA `763ac4a4b5cdd769f4d0d6c5be52eab404c532ba`, [Actions #38793040077](https://github.com/isaquesan7/sistema-pet/actions/runs/38793040077), `validate SUCCESS` e `isolated-postgres SUCCESS`. Confirmar CI do HEAD documental final. Esta aprovação automatizada não constitui homologação financeira, fiscal, bancária nem autorização para staging ou produção.
