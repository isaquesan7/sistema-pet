# M.4D.1 — Segurança fiscal simulada por venda filha e emissor

**Estado:** PR #36 DRAFT, SOMENTE CI. 14/10/2026. Nenhum deploy, transmissão, emissão, cancelamento fiscal oficial, XML ou alteração no fiscal legado.

## Implementação
Novas tabelas CI: FluxoFiscalUnificadoCi e EventoFluxoFiscalUnificadoCi (migration 20261015031500_unified_fiscal_ci_protocol). Guardam intenção de preparação por Venda filha, empresa e classe, fingerprint SHA256 e trilha de eventos. A FK da empresa usa (organizacaoId,empresaId); a FK da venda usa (empresaId,vendaId); combinação de emissor cruzado é rejeitada pelo banco. Uma intenção por (vendaId,classe), um evento por (fluxoId,chaveEvento). CHECK SQL limita estados e tipos. DocumentoFiscal existente e fiscal.service.js/rotas NÃO foram alterados.

Serviço: api/src/modules/fiscal/fiscal-unificado-protocolo-ci-sandbox.service.js. Só funciona com NODE_ENV=test, POINTVET_UNIFIED_SALES_SANDBOX=1 e nome real de banco pointvet_unified_ci. NÃO TEM ENDPOINT HTTP. Preparação lê o snapshot da M.4C.2 na mesma transação Serializable, exige venda FINALIZADA, operação unificada concluída, autorização de fiscal por empresa, item compatível, grupo sem pendências, ambiente HOMOLOGACAO, escolha NFE/NFCE/NFSE, série configurada. Exige usuário ativo, vínculo ativo na organização/empresa e cargo da MESMA empresa; permissões pdv.acessar, fiscal.visualizar e fiscal.emitir. No evento de cancelamento SIMULADO exige fiscal.cancelar. Travas FOR UPDATE na venda/fluxo, idempotência por SHA256, evento com motivo 12–500 caracteres. Revalida fingerprint da fonte fiscal em todo evento. Falha/rollback não cria intenção ou evento parcial.

## Máquina de estados — SOMENTE SIMULAÇÃO
- PREPARADA_CI → ACEITA_SIMULADA_CI, REJEITADA_CI, INDETERMINADA_CI ou CONTINGENCIA_REVISAO_CI, mediante evento local e motivo.
- INDETERMINADA_CI → ACEITA_SIMULADA_CI ou REJEITADA_CI SOMENTE por evento de CONSULTA SIMULADA explícita, ou → CONTINGENCIA_REVISAO_CI por suspensão manual. **Nunca reenvia automaticamente**.
- ACEITA_SIMULADA_CI → CANCELADA_SIMULADA_CI SOMENTE por cancelamento simulado com fiscal.cancelar.
- REJEITADA_CI, CANCELADA_SIMULADA_CI e CONTINGENCIA_REVISAO_CI são terminais; mudanças e reenvios indevidos são recusados.
- Os estados ACEITA_SIMULADA_CI / CANCELADA_SIMULADA_CI não demonstram aprovação, protocolo ou cancelamento oficial perante SEFAZ, prefeitura ou provedor. Contingência não emite notas em contingência.

## Testes obrigatórios
- api/tests/fiscal-unificado-protocolo-ci.contract.test.mjs: eventos aceitos/recusados, terminais, indeterminação sem reenvio, contingência, autorização/cancelamento não oficiais, falha de plano fiscal ou ambiente PRODUCAO.
- api/tests/pdv-unificado-integration.test.mjs: duas Vendas filhas reais FINALIZADAS no PostgreSQL CI, CNPJ distinto, preparação concorrente com replay idempotente, conflito de solicitação, tenant/empresa errada, permissão insuficiente, rollback de escrita, alteração de série fiscal bloqueada, indeterminação/consulta/aceite/cancelamento SIMULADOS para uma venda, contingência separada para outra. ZERO mudança em DocumentoFiscal, pagamentos, vendas, caixa ou estoque.
- Todas as regressões M.3, M.4B e M.4C devem permanecer verdes no HEAD do PR.

## Pendências e gates
Não há homologação tributária por CNPJ/UF/município nem contato externo. Antes de lançar: validar matriz fiscal com responsável habilitado, inscrição e ambiente, certificados seguros, séries e numeração, escolha legal de NF-e/NFC-e, regras NFS-e por prefeitura, provas de autorização e cancelamento com XML/protocolo válidos, controles de contingência, consulta após timeout, segurança e antirreplicação. Projeto não integra PSP nem maquininhas/TEF; crédito pré-pago segue bloqueado no PDV.

**Próximas etapas:** M.4D.2 robustez de consulta/reconciliação manual e evidência contra adulteração, sem supor homologação; M.5 staging, restore real de backup, rollback, canário e permissão explícita antes de publicar. Documentação e estado no Issue #37 / PR #36.

## M.4D.2 — auditoria encadeada e investigação manual (somente CI)
Foi estendida a máquina de estados M.4D.1 para exigir evento interno auditado com fiscal.gerenciar antes de CONSULTA SIMULADA após indeterminação, além de permitir somente relatório não resolutivo durante contingência. Raiz/hash de cada evento/cabeça de fluxo e estado são rechecados; adulteração ou desaparecimento do histórico bloqueia mutações inclusive replay, e existe diagnóstico read-only por emissor. **Sem garantias antiviolação por administradores de banco; sem transmissão fiscal, certificado, XML, protocolo oficial, nota ou cancelamento fiscal real.** Leia [M.4D.2](POINTVET_M4D2_AUDITORIA_INVESTIGACAO_MANUAL.md).
