# PointVet M.4D.2 — Auditoria encadeada e investigação manual de fiscal CI
Data: 14/10/2026. PR #36 DRAFT, somente banco PostgreSQL descartável pointvet_unified_ci.

## Escopo e barreiras
M.4D.2 acrescenta verificação da integridade do histórico simulado de uma venda-filha por CNPJ. Não é emissão fiscal, consulta SEFAZ/prefeitura, cálculo tributário, protocolo de cancelamento ou prova de autorização. Todos os status aceitos e cancelados são SIMULADOS. O código permanece sem rota HTTP e preserva DocumentoFiscal, Venda, Estoque, Caixa, backups e fiscal.service.js existentes. Nenhuma conexão de maquininha, TEF ou PSP e CREDITO_CLIENTE segue bloqueado no PDV.

## Componentes e esquema
- Migration aditiva somente CI: api/prisma/migrations/20261015044500_fiscal_ci_chained_audit.
- FluxoFiscalUnificadoCi agora possui integridadeRaiz, integridadeCabeca e integridadeContador; EventoFluxoFiscalUnificadoCi possui sequencia, hashAnterior e hashEvento, índice único (fluxoId,sequencia).
- Raiz SHA-256 da identidade técnica e snapshot completo do fluxo; hash por evento incorpora índice, hash anterior, chave de idempotência, emissor via fluxo, operador, tipo, estados e evidencia. Objetos são normalizados com ordem canônica de propriedades antes do hash, evitando divergências triviais por serialização JSONB.
- Verificador puro: api/src/modules/fiscal/fiscal-unificado-integridade-ci.contract.js. Rastreia cadeia inteira do estado PREPARADA_CI até o atual, recalcula hashes, confere contagem, ordem, estados, idempotência, motivos, simulação e cabeçalho final. Ausência ou corrupção de um evento, snapshot, raiz, contador, hash ou estado coloca o fluxo como NÃO CONFIÁVEL; novas mutações falham. Registros legados do CI sem raiz/hash não são completados automaticamente e permanecem não confiáveis.
- Serviço: api/src/modules/fiscal/fiscal-unificado-protocolo-ci-sandbox.service.js. Registra hashes e novo estado atomicamente na transação Serializable + lock por fluxo. Toda escrita, inclusive replay idempotente, confere primeiro a cadeia e a situação fiscal atual da VENDA FILHA. Novo diagnosticarFluxoFiscalSomenteSandbox faz consulta somente leitura sob as mesmas barreiras de organização, empresa, cargo, usuário ativo, módulo de permissão e banco CI; nunca autoriza envio.

## Investigação manual
- Quando o fluxo entra em INDETERMINADA_CI, a resolução por SIMULAR_CONSULTA_ACEITA ou SIMULAR_CONSULTA_REJEITADA passa a exigir um evento anterior REGISTRAR_INVESTIGACAO_MANUAL_CI; sem ele, falha. Em CONTINGENCIA_REVISAO_CI também é possível apenas registrar investigação interna, sem retomar envio, emitir ou cancelar documento.
- Investigação exige fiscal.gerenciar além de pdv.acessar e fiscal.visualizar na mesma empresa; motivo justificável (12–500 caracteres), referenciaInterna prefixada CI-, descrição detalhada, mesmo estado de entrada e saída e marcação explícita de nenhuma evidência oficial externa.
- A investigação NÃO confirma consulta externa, chave XML, recibo fiscal nem autorização. A consulta após a investigação continua SOMENTE SIMULADA: a futura homologação precisa de critérios de fonte externa, credenciais seguras, logs imutáveis confiáveis, protocolos verificáveis e regulamentação por UF/município.
- Respostas terminais continuam sem reenvio automático. Não se cria um endpoint de reprocessamento fiscal e não se modifica DocumentoFiscal legado.

## Testes e riscos residuais
- api/tests/fiscal-unificado-integridade-ci.contract.test.mjs: canonicalização SHA-256, raiz, evento/ordem, estado terminal, perda/alteração de evidência, cabeçalho divergente, investigação incompleta ou fora dos estados permitidos.
- api/tests/pdv-unificado-integration.test.mjs: duas Vendas filhas finalizadas no PostgreSQL 16 descartável, investigação exigida após timeout simulado, permissão fiscal.gerenciar, rollback da investigação, replay divergente, restaurar evidência e cabeçalho no teste, detecção de corrupção e recusa de nova escrita, isolamento por tenant/emissor, zero efeito em DocumentoFiscal/estoque/pagamento/caixa.
- Um encadeamento de hashes no MESMO banco NÃO é uma prova criptográfica inviolável contra pessoa com privilégio para regravar eventos E âncora. Produção futura requer retenção imutável fora do banco, controle de acesso, backup, rotação/verificação de chaves e auditoria independente. Este módulo não deve ser oferecido como sistema de notas fiscais.

## Continuidade
Ver CI do HEAD final e confirmar dois jobs SUCCESS. Atualizar PR #36 e Issue #37 com SHA e run.
Proximo gate M.5: staging isolado, restauração REAL e mensurada de backup, rehearsal de migrations/rollback, revisão das configurações fiscais por responsável técnico e canário controlado, sem publicação nem backfill em produção antes da aprovação explícita. Também é possível M.4D.3 para relatórios de incidentes/limites de auditoria, mas não substitui M.5 nem homologação fiscal externa.
