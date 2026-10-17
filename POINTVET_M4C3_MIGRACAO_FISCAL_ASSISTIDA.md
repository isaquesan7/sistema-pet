# PointVet M.4C.3 — Migração fiscal assistida e reversão lógica (somente CI)

**Estado:** implementado na branch do PR #36 DRAFT, sem rota HTTP, merge, deploy, migração de banco de produção ou alterações na Pet King. Data: 14/10/2026.

## 1. Objetivo e limites
Conectar uma Empresa LEGADA, sem modificar seus dados, a uma EntidadeFiscal e uma UnidadeOperacional já previstas na M.4C.1. Para reduzir riscos, o trabalho foi implementado em serviço isolado que só executa com NODE_ENV=test, POINTVET_UNIFIED_SALES_SANDBOX=1, DATABASE_URL apontando a pointvet_unified_ci E confirmação de current_database() na própria transação. A produção continua lendo Empresa, Empresa.cnpj @unique, Caixa, Venda, Estoque, DocumentoFiscal e papéis existentes.

**M.4C.3 não significa publicação do PDV unificado nem operação de múltiplas unidades com o mesmo CNPJ**. Uma unidade adicional sem ponte com a Empresa legada continua somente cadastro conceitual. Não há integração de maquininha/PSP, não há pagamento por CREDITO_CLIENTE, não há autorização fiscal, transmissão, criação ou cancelamento de nota.

## 2. Prévia e aprovação
Serviço: api/src/modules/fiscal/fiscal-unidades-migracao-sandbox.service.js

- planejarVinculoFiscalLegadoSomenteSandbox: só leitura. Exige usuário ATIVO, vínculo com a organização (PROPRIETARIO ou ADMINISTRADOR), vínculo ativo na empresa e permissão fiscal.gerenciar no cargo; valida Empresa ativa, mesmo tenant, CNPJ no FORMATO de 14 dígitos e identificação presente.
- Retorna snapshot estável sem PII dos clientes: organização/empresa, CNPJ, razão social, nome fantasia, inscrições, UF, município, versão de atualização da Empresa/configuração fiscal, quantidades de vendas, documentos fiscais, caixas, itens, usuários e movimentos de estoque, fingerprint SHA-256, proposta de código, alertas e bloqueio de operação fiscal.
- **CNPJ só validado quanto ao formato e vinculação:** este módulo NÃO confirma cadastro/regularidade perante Receita Federal, SEFAZ ou prefeitura. Conferência real do emissor permanece gate para produção.
- A execução vincularEmpresaLegadaSomenteSandbox exige codigo explícito (matriz ou outro nome autorizado), solicitacaoId idempotente e fingerprint exato apresentado na prévia; mudança em origem faz falhar M4C3_ORIGEM_ALTERADA_DESDE_REVISAO. Usar conta ADMINISTRADOR/PROPRIETARIO + fiscal.gerenciar, nunca apenas atendente PDV.
- Transação Serializable e lock FOR UPDATE na Empresa, seguida de nova leitura e verificação de origens, impedem dupla criação concorrente. Se EntidadeFiscal da mesma organização/CNPJ já existe, só é reutilizada se ativa e sua razão social corresponder; não reaproveita unit/código conflitante.
- Cria a entidade quando necessária e uma unidade vinculada 1:1 à Empresa original, sem alterar tabela empresas. Registra fingerprint, snapshot e IDs nos eventos de Auditoria ligados à organização, empresa e operador. Tentativa idêntica é idempotente; chave ou código divergente falha. Injeção de falha reverte entidade, unidade e Auditoria ATOMICAMENTE.

## 3. Reversão lógica e preservação do histórico
- reverterVinculoFiscalLegadoSomenteSandbox: exige administrador ativo com fiscal.gerenciar, solicitacaoId e motivo auditável com pelo menos 12 caracteres. Lock da Empresa e leitura do histórico de Auditoria; exige vínculo exatamente correspondente ao criado.
- NÃO APAGA EntidadeFiscal nem UnidadeOperacional e NÃO APAGA / MODIFICA Venda, DocumentoFiscal, Estoque, Caixa, Pagamento, usuários ou Empresa; apenas define empresaLegadaId = NULL e ativa = false NA UNIDADE DO VÍNCULO IMPORTADO, preservando os IDs e uma segunda auditoria para a reversão.
- Unidades adicionais sob o mesmo emissor, caso existam, permanecem intactas. Repetir a mesma reversão é idempotente; motivo ou chave divergente é bloqueado. Reimportação após reversão lógica é BLOQUEADA até revisão manual específica (não reativa silenciosamente vínculos antigos).
- Em caso de divergência entre cadastro atual e evidência auditada, interromper; não sobrepor manualmente dados fiscais legados. Eventos de Auditoria são trilhas da aplicação, não prova externa de imutabilidade criptográfica de banco; futura produção requer retenção e política antiviolação.

## 4. Testes e confirmação
Teste: api/tests/pdv-unificado-fiscal-migracao.integration.test.mjs, rodado no PostgreSQL 16 descartável após todas as migrations existentes. Verifica prévia, CNPJ e histórico de uma VENDA filha/DOCUMENTO fiscal pré-existentes, permissões de gestor da organização e fiscal.gerenciar, organizações diferentes, fingerprint inválido após edição, flag desativada, rollback injetado, chamadas concorrentes, replay/idempotência, chave/código conflitante, FK cross-tenant, falha simulada de reversão, reversão verdadeira preservando empresa e todos os registros históricos, impossibilidade de reimportação silenciosa, nenhum pagamento/estoque/caixa/fiscal criado. Também devem passar M.3/M.4B/M.4C.1/M.4C.2.

## 5. Gates posteriores
M.4C.4 ou M.4D: projetar pré-matriz de migração e BACKFILL EM LOTE com aprovação por empresa, revisão cadastral real do CNPJ, testagem de permissões/estoque/caixa em unidades distintas, confirmação do regime e parâmetros estaduais/municipais, registro de metadados de series/inscrições, migração de FKs somente quando justificável. Nenhuma alteração em dados históricos na M.4C.3.
M.5: staging com snapshot, RESTORE efetivamente ensaiado e mensurado, migração dry-run, backup/rollback, monitoramento, teste de continuidade e canário opt-in por organização. SEM mesclar PR #36 ou executar migrações reais sem aprovação explícita.

**Handoff:** consultar POINTVET_CONTINUIDADE_OFICIAL.md, POINTVET_GATES_PUBLICACAO.md, Issue #37, PR #36 e o CI do HEAD efetivo.
