# PointVet M.5.1 — Ensaio de Backup/Restore CI e Gates de Publicação

**Data:** 14/10/2026. **Somente branch PR #36 DRAFT; produção e main inalteradas.** Esta fase NÃO cria ambiente staging real, NÃO acessa backup de produção, NÃO faz merge, NEM realiza deploy ou migrations em ambiente operacional.

## O que foi implementado

1. api/scripts/ci-pointvet-backup-restore-drill.sh, executado no job isolated-postgres após os testes integrados M.3/M.4B/M.4C/M.4D. Garante GITHUB_ACTIONS=true, NODE_ENV=test, POINTVET_UNIFIED_SALES_SANDBOX=1 e DATABASE_URL exatamente igual ao PostgreSQL descartável pointvet_unified_ci (usuário CI/localhost); confirmação SQL do nome real do banco, fixture com >=2 empresas, >=2 vendas, >=2 fluxos fiscais CI e >=5 eventos.
2. O script usa clientes postgres:16 em Docker para produzir **pg_dump em formato custom** dentro do diretório temporário do runner. Confere tamanho e SHA256, cria **outro banco descartável, pointvet_restore_ci**, restaura a cópia de verdade com pg_restore --exit-on-error e compara fingerprint por linha de TODAS as tabelas públicas (normalizando ordem com to_jsonb), total de linhas, definições dos índices e constraints, valores de sequências. Confere o histórico de migrations com prisma migrate status no banco restaurado e ensaia BEGIN/UPDATE/ROLLBACK nele, provando que seu conteúdo se mantém idêntico ao original.
3. O backup contém EXCLUSIVAMENTE dados sintéticos de CI, NÃO é enviado como artefato nem para storage externo, e é removido ao final. Não contém senhas reais, dados reais de clientes, certificados ou chaves de produção. **Um restore de banco CI no mesmo host não mede RTO/RPO real nem valida recuperabilidade de backup remoto/R2**.
4. api/src/modules/plataforma/pointvet-m5-publicacao.contract.js + testes puros: checklist fail-closed por organização/empresa e SHA de commit. Requer staging isolado, restore **de backup real** com checksum e evidência revisada, migrations/rollback ensaiados, smoke API/PDV/portal, HTTPS válido, backups e alertas e-mails, métricas, matriz fiscal por CNPJ/UF/município, permissões, aceite opt-in do tenant e responsável/janela de rollback.
5. Mesmo quando todas as caixas do checklist são declaradas true, **publicacaoAutorizada=false** e **executarDeploy=false**: o contrato não valida evidências externas, não pode dar autorização; exige revisão/aprovação humana independente e execução de procedimento autorizado. CI verde ou restauração de cópia sintética nunca liberam produção. Operações com gateways/maquininhas, crédito do cliente no checkout, fiscal não homologado e unidades extras ainda não habilitadas são bloqueadas pelo checklist.

## CI e observações de segurança

- Workflow .github/workflows/pointvet-unified-pdv-foundation.yml: static bash -n, checks/testes M5 e, após todas as migrations/regressões PostgreSQL, execução do script de restore. O teste confere o conteúdo de tabelas inteiras, não só que o banco abre.
- Correções após primeiro run: pg_sequences usa increment_by no PostgreSQL 16, não increment. O script deve rodar totalmente verde no SHA FINAL para declarar M.5.1 concluída; registrar link do run em PR #36 e Issue #37.
- Não alterar fiscal.service.js, tabelas DocumentoFiscal de produção, integrações de banco/pagamentos, emissão, credenciais, nem ativar o PDV unificado. Preservar Empresa.cnpj UNIQUE, PR #35, backup e alertas Resend em produção.

## Plano M.5.2 — staging e restore REAL, sujeito a autorização

**Pré-requisitos:** obter ambiente staging 100% isolado (projeto/serviços/Postgres, credenciais, redes, fila, e-mails sem saída a tutores reais, domínio/test TLS separados e links seguros). Escolher com a pessoa responsável qual backup real autorizado será restaurado, com base legal, confidencialidade/LGPD e mascaramento de dados; confirmar criptografia, integridade, retenção e acesso mínimo. Nada disso foi executado nesta fase.

**Rehearsal no staging aprovado:** inventariar versão exata commit/migrations e backup existente; confirmar backup verificável independente (não só platform_backup_evidence), executar restore no Postgres staging SEM escrever no original e conferir todas as tabelas, FK/indexes, sequências, migrations, integridade de contas/tenants, conciliação, caixa, logs fiscais, anexos e storage externo. Medir tempo real de restauração RTO e idade do último ponto recuperável RPO; preservar IDs/clientes e regras fiscais sem emitir nada. Ensaiar rollback de release de código/flags, não confundir rollback de transação com reversão de migrations ou restauração em produção.

**Observabilidade/canário:** definir limites de erro 5xx, uptime API, DB, caudas lentas, duplicidade de venda, conflitos intertenant, eventos fiscais indeterminados, estoque negativo, divergência de caixa, integridade dos backups e entrega de alertas e-mails. Testar alertas, caminho de suporte, comunicação, janela de implantação e desligamento por organização. Preferir ativar apenas a organização escolhida com opt-in, PDV unificado opcional, mantendo PDV legado para todos os outros. Não integrar maquininha/PSP. Não usar crédito pré-pago como forma de pagamento. Não ligar emissão fiscal real sem autorização/validação tributária por emissor.

## Checklist humano para permitir publicação futura

Um responsável precisará conferir e aprovar, com evidência verificável: CI do mesmo SHA verde; ambiente staging isolado e restore real íntegro; backups automáticos e alertas preservados; SSL válido no domínio; permissões e LGPD; homologação fiscal ou comportamento fiscal legalmente permitido; dry-run e plano de rollback de aplicação/dados; smoke e telemetria; opt-in explícito por empresa/organização e janelas de canário. Publicação e migrations em produção **NÃO autorizadas** até nova decisão expressa.

## Continuidade exata

**Próxima M.5.2:** preparar o staging separado e fazer o restore real SOMENTE quando autorizados e disponíveis os requisitos, sem importar dados de produção automaticamente. Se não houver staging aprovado, reforçar em CI isolamento, auditoria e evidências sem afirmar publicação. PR #36 permanece DRAFT, Issue #37 guarda run/HEAD e próximas tarefas.


## Evidência do round-trip PostgreSQL 16: casts CHECK normalizados sem ignorar regras
Na primeira inspeção do ensaio, todas as linhas de todas as tabelas, índices e sequências já eram idênticos; quatro constraints CHECK de listas fixas tinham representação SQL equivalente porém distinta após o restore: a fonte usava `(ARRAY['X'::varchar])::text[]` e o clone usava `ARRAY[('X'::varchar)::text]`. O arquivo `api/scripts/ci-pointvet-canonical-schema.mjs` normaliza APENAS esses posicionamentos de casts equivalentes no texto de definição CHECK do PostgreSQL, enquanto preserva nomes, colunas, operadores, status aceitos, índice de todas as constraints e contagem total de 388 restraints. Mudança verdadeira no texto permitido ou na operação ainda produz hash distinto e aborta. Testes puros cobrem equivalência e divergências reais. A comparação de linhas comerciais, permissões, índices, sequências e migrações NÃO é relaxada; a normalização incide só na representação cosmeticamente reescrita de casts CHECK.


## M.5.2 — preparativos de segregação e canário, somente contratos CI
A M.5.1 efetivamente ensaiou pg_dump/pg_restore com dados sintéticos. A M.5.2 projeta os requisitos de uma infraestrutura verdadeiramente isolada, com contratos puros de identidade de staging vs production, rede/Postgres e storage exclusivos, e-mails sink, webhooks/gateways/fiscal offline, dados sintéticos e monitoramento de canário sem ativação. Ainda **NÃO ocorreu** criação de staging nem restauração de backup de produção. Detalhes: [M.5.2 — Staging e canário](POINTVET_M52_STAGING_ISOLAMENTO_CANARIO.md).
