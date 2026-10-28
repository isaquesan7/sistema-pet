# PointVet M.5.72 — preflight comercial das comandas (27/10/2026)

## Estado, escopo e proibicoes

- A recuperacao **logica** de 118 tabelas e 48 migrations de **homologacao** foi aprovada em 27/10/2026, no projeto DR separado `steadfast-comfort` (registro da Issue #37). Isso NAO comprova restauracao de backup da producao.
- Producao comercial: projeto Railway `Pet King DEV`, id `aab52927-a8c1-4158-80bf-bd22af504e72`, ambiente `production`, Postgres service `4b4bf25e-83d1-4e4e-80a7-198bdbf03d99`.
- API comercial `petrise-api` segue `main` e possui `preDeployCommand: npm run db:deploy`. **Qualquer nova implantacao da API pode tentar aplicar migrations automaticamente.** Nao fazer merge, alterar Railway, deploy, seed, reset, restore ou restart comercial como parte desta auditoria.
- As PRs #36 e #38 continuam DRAFT. A comparacao `main...`branch do PDV` contem **26 migrations novas**, das quais `20261023180000_comandas_sem_cliente` altera dados legados e torna `comandas.organizacaoId` obrigatorio.

## Risco concreto de compatibilidade

A migration `20261023180000_comandas_sem_cliente` deriva a organizacao de cada comanda por `comandas.clienteId → clientes.organizacaoId` e **aborta** caso sobre algum registro sem organizacao derivavel. A migration posterior `20261023234500_comandas_origem_cnpj` tenta identificar `empresaOrigemId` por itens, vendas, clinica e banho/tosa; a origem nao inferivel permanece `NULL`. Comandas historicas que envolvam mais de um CNPJ ou comandas abertas sem nenhuma referencia precisam de revisao de visibilidade/escopo antes da implantacao.

Foi implementado um script de preflight **somente leitura**:

- `api/scripts/pointvet-m572-prod-readonly-audit.mjs` — CLI com modos `--config-only` e `--inspect-readonly`.
- `api/scripts/pointvet-m572-prod-preflight.sql` — um unico `WITH ... SELECT json_build_object`, apenas agregados; nao traz IDs, nomes, senhas ou dados pessoais.
- `api/src/modules/plataforma/pointvet-m572-preflight.contract.mjs` — guarda de projeto/servico/porta e interpretacao conservadora de riscos.
- `api/tests/pointvet-m572-prod-readonly-audit.contract.test.mjs` — testes puramente sinteticos, CI; nao conecta a banco real.

Resultados auditados: contagem de comandas, orfaos de tutor/tenant, conflitos entre tenant do cliente e empresa nos itens/vendas/clinica/banho, comandas historicas com varios CNPJs, comandas abertas sem CNPJ dedutivel, historico Prisma incompleto e indicios de schema previamente migrado. **Qualquer anomalia bloqueia a conclusao de que os dados estao prontos.** Um resultado limpo **nunca libera automaticamente deploy**.

## Execucao supervisionada no Windows (sem alterar dados)

Somente quando o operador estiver diante do painel Railway, conferir pessoalmente que o `railway link` aponta para o projeto **Pet King DEV / production** e **Postgres comercial**, NUNCA para o banco DR nem para staging. O projeto DR com dados reais de homologacao precisa continuar protegido; nao reutilizar para backup comercial.

Na janela PowerShell A (pasta diferente das usadas para DR):

```powershell
New-Item -ItemType Directory -Force "$HOME\pointvet-prod-audit" | Out-Null
cd "$HOME\pointvet-prod-audit"
railway link
# Selecionar Pet King DEV > production > Postgres
railway connect Postgres --tunnel-only --port 55434
```

Deixar o tunel SSH ativo. Em outra janela PowerShell B, atualizar apenas o checkout local do projeto:

```powershell
cd "$HOME\pointvet-dr\repositorio"
git switch feat/pointvet-m5-71-pdv-comandas
git pull --ff-only origin feat/pointvet-m5-71-pdv-comandas
cd .\api
$env:POINTVET_PROD_PREFLIGHT_PROJECT_ID = "aab52927-a8c1-4158-80bf-bd22af504e72"
$env:POINTVET_PROD_PREFLIGHT_SERVICE_ID = "4b4bf25e-83d1-4e4e-80a7-198bdbf03d99"
$env:POINTVET_PROD_PREFLIGHT_URL = Read-Host "Cole a URL LOCAL privada da producao (porta 55434)"
node scripts/pointvet-m572-prod-readonly-audit.mjs --config-only
node scripts/pointvet-m572-prod-readonly-audit.mjs --inspect-readonly
```

**A URL deve conter usuario e senha corretos, host 127.0.0.1, porta 55434, banco correto e TLS `sslmode=require` (ou omitido, porque o modo TLS padrao do script e `require`).** A URL e as credenciais sao segredos: jamais incluir em imagem, issue, resposta do ChatGPT ou GitHub. A captura via `Read-Host` fica visivel no terminal; nao tirar screenshot dessa linha. Se o usuario quiser captura oculta, pode configurar por prompt seguro local antes de executar.

O `--config-only` NAO abre banco. O `--inspect-readonly` usa `PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=120000`, `psql -X -w`, e somente uma consulta SQL estaticamente armazenada no repositorio. Seus IDs de projeto/servico sao **declaracoes do operador**: PostgreSQL nao comprova identidade Railway com essas variaveis. A auditoria nao executa `pg_dump` nem `pg_restore`.

Apos uso:

```powershell
Remove-Item Env:POINTVET_PROD_PREFLIGHT_URL -ErrorAction SilentlyContinue
Remove-Item Env:POINTVET_PROD_PREFLIGHT_PROJECT_ID -ErrorAction SilentlyContinue
Remove-Item Env:POINTVET_PROD_PREFLIGHT_SERVICE_ID -ErrorAction SilentlyContinue
```

Encerrar a janela do tunel. So compartilhar JSON agregado ja sem segredos. Em caso de `POINTVET_M572_AUDIT_BLOCKED`, NAO corrigir dados em producao sem analise e backup restauravel comprovado.


## Diagnostico seguro da falha psql (28/10/2026)

Se o operador receber `POINTVET_M572_AUDIT_BLOCKED: psql falhou`, isso **nao** prova anomalia nos dados nem autoriza alterar esquema. A CLI agora executa o mesmo SQL **somente leitura** mas usa `psql -v VERBOSITY=verbose` apenas internamente para extrair um **codigo seguro**, sem imprimir stderr, URLs, nomes de clientes, credenciais ou SQL bruto. Os codigos possiveis incluem `PSQL_NAO_ENCONTRADO`, `TUNEL_OU_REDE`, `AUTENTICACAO`, `TLS_CONEXAO`, `SQLSTATE_42P01_TABELA_AUSENTE`, `SQLSTATE_42703_COLUNA_AUSENTE`, `SQLSTATE_42501_PERMISSAO_SQL` e `PSQL_STATUS_NAO_ZERO`.

No Windows: confirmar `Get-Command psql` e `Test-NetConnection 127.0.0.1 -Port 55434`, sem copiar logs com credenciais; conferir o `railway link` no painel para Pet King DEV > production > Postgres. Na segunda janela, atualizar a branch Draft com `git pull --ff-only` e repetir somente `node scripts/pointvet-m572-prod-readonly-audit.mjs --inspect-readonly` depois de confirmar que as variaveis privadas ainda estao definidas. Compartilhar apenas o codigo seguro ou o JSON agregado. **Nao usar `psql` manual com SQL de escrita, `db:deploy`, `migrate`, `git merge` ou rede publica** para resolver erro de preflight. O resultado `SQLSTATE` e diagnostico, nao a prova final.


## Correcao SQLSTATE 22021 no Windows (28/10/2026)

O operador executou o preflight em Windows, `--config-only` passou e `--inspect-readonly` retornou `SQLSTATE_22021_ERRO_POSTGRES`, sem resultados de dados. O PostgreSQL utiliza este SQLSTATE para sequencia de bytes invalida para a codificacao (tipicamente UTF-8). Foi identificada **uma ocorrencia de Unicode U+2014 (travessao) no comentario inicial** do arquivo `pointvet-m572-prod-preflight.sql`, transmitido ao `psql` pelo argumento `-c`. A conversao Windows da linha de comando pode codificar tal caractere como byte CP1252, inconsistente com UTF-8 no servidor. E uma causa plausivel, nao demonstracao definitiva sem repetir a leitura.

**Alteracoes sem impacto economico:** substituido o travessao por hifen ASCII no SQL; CLI falha preventivamente caso texto SQL contenha caracteres nao ASCII; contrato classifica 22021 como `SQLSTATE_22021_CODIFICACAO_INVALIDA`; novo teste de regressao executado pelo workflow CI. O SQL continua sendo **somente SELECT de agregados**, com `default_transaction_read_only=on`, sem migrations, DDL/DML, deploy ou alteracao de dados.

**Operador:** com tunel privado de producao na porta local `55434` e variaveis privadas ainda configuradas, atualizar a mesma branch com `git pull --ff-only` e repetir apenas `node scripts/pointvet-m572-prod-readonly-audit.mjs --inspect-readonly`. Compartilhar somente JSON agregado ou codigo seguro, nunca SQL bruto, senha, URL ou dados pessoais. Resultado limpo nao autoriza producao; anomalias requerem analise e clone isolado.

## Gates pendentes para release comercial

1. **DR comercial real:** demonstrar restauracao isolada do artefato de backup comercial aprovado (nao usar staging nem seu DR), validar controles de criptografia/retenção/LGPD. O ensaio `pg_dump` staging realizado nao prova o snapshot nativo nem o backup criptografado do worker comercial.
2. **Preflight M.5.72:** executar somente leitura em producao e analisar todos os bloqueadores. Sem dados de clientes nos relatorios.
3. **Migrações:** validar em clone independente do banco comercial todo o pacote de 26 migrations, com snapshots de contagens/invariantes e plano de rollback de aplicacao; migrations PostgreSQL nao sao revertidas automaticamente por rollback de API.
4. **Desacoplar deploy das migrations durante janela aprovada:** revisar o `preDeployCommand` atual `npm run db:deploy` no Railway antes de qualquer merge/deploy, sem mudar configuracao comercial agora.
5. **Canario e homologacao funcional de multi-CNPJ:** validar PDV tradicional, opcao unificada por tenant, taxas/repasses apenas gerenciais, cancelamentos, granel por R$/gramas, servicos inteiros, relatorios e segregacao dos dois CNPJs da Pet King.

**Gate de publicacao continua BLOQUEADO.** Nunca marcar `productionAuthorized=true` com base somente em preflight, CI ou DR de homologacao.

## Resultado real comercial e triagem multi-CNPJ (28/10/2026)

O operador executou `--inspect-readonly` no Windows apos a correcao de encoding, **sem writes**. Resposta agregada:
- `POINTVET_M572_PROD_PREFLIGHT_BLOCKED`, `auditedReadOnly=true`, `commercialDeploymentAuthorized=false`, identidade Railway independente **nao comprovada pelo SQL**.
- 2 comandas; 0 sem tutor/tenant; 0 referencias intertenant em itens/vendas/clinica/banho; 1 com **mais de uma empresa/CNPJ**; 0 abertas sem empresa inferivel; 0 migrations incompletas e 22 concluidas.
- Unico bloqueio reportado: uma comanda legada com multiplos CNPJs, cuja origem exige revisao antes da migracao. Isso **nao equivale** a fraude, corrupcao ou perda de dados.

Revisao de codigo da PR #38: a migration ja aplicada no staging `20261023234500_comandas_origem_cnpj` afirma que origens ambiguas permanecem nulas, mas na pratica escolhe o primeiro item, venda ou atendimento. **Nao editar/regravar SQL de migrations ja aplicadas no staging** sem procedimento formal de checksum/upgrade; nem consertar links no banco comercial. A verificacao foi ampliada com segundo modo **somente leitura**, sem dados pessoais:

```powershell
# Na mesma janela que tem variaveis privadas e tunel do Pet King DEV/production
cd "$HOME\pointvet-dr\repositorio"
git switch feat/pointvet-m5-71-pdv-comandas
git pull --ff-only origin feat/pointvet-m5-71-pdv-comandas
cd .\api
node scripts/pointvet-m572-prod-readonly-audit.mjs --inspect-multicnpj
```

`--inspect-multicnpj` usa o mesmo vinculo declarado a Pet King DEV, a mesma porta privada 55434, SSL e `PGOPTIONS` read-only. Executa **apenas** `api/scripts/pointvet-m572-multicnpj-readonly.sql`, composto de WITH/SELECT de agregados, sem `id`/CPF/CNPJ pessoal em resultado. Contabiliza comandas mixtas em um unico tenant ou em varios, com itens, vendas, atendimentos clinicos/banho, abertas ou nao, e possivel empresa clinica/banho sem item/venda (invisivel pela regra atual do PDV legado se `empresaOrigemId` nao apontar para ela). O resultado `POINTVET_M572_MULTICNPJ_REVIEW_REQUIRED` **nunca libera deploy automaticamente**. Compartilhar somente JSON agregado. Se alguma empresa ficar invisivel, revisar ACL por empresa e migracao em clone com CI antes de agendar release.

O SQL de migracao de staging nao foi modificado; revisar eventual correcao prospectiva apos observar o diagnostico, preservando os 2 historicos. Continuam pendentes DR do backup comercial real, ensaio de 26 migrations em clone, controle do predeploy `npm run db:deploy`, fiscal externo separado por CNPJ e canario restrito.


## Parecer de compatibilidade para a comanda mista (28/10/2026)

**Nova evidencia real M.5.72, sem dados pessoais, via `--inspect-multicnpj`:** `multiCompanyComandas=1`, `sameTenantComandas=1`, `crossTenantComandas=0`, `withItems=1`, `withSales=0`, `withClinical=1`, `withBath=1`, `openComandas=1`, `nonOpenComandas=0`, `withClinicalBathOnlyCompany=0`. `auditedReadOnly=true`; `commercialDeploymentAuthorized=false`; `projectIdentityIndependentlyVerified=false` (IDs declarados, nao atestacao SQL/Railway). Resultado `POINTVET_M572_MULTICNPJ_REVIEW_REQUIRED` esperado.

**Conclusao tecnica limitada:** a unica comanda mista e da mesma organizacao, esta aberta e ainda sem venda vinculada. As duas atividades de clinica e banho e tosa possuem cobertura por itens ou venda nas respectivas empresas segundo o diagnostico por empresa; nao foi observada divergencia intertenant. O uso de um unico numero de comanda para dois CNPJs e **permitido no negocio** e nao implica corrupcao. `empresaOrigemId` e uma **ancora de origem/visibilidade**, **nunca fonte unica da titularidade de itens, pagamentos, estoque ou tributos**. Para PDV legado, `escopoComandaEmpresa` exige `organizacaoId` e `empresaOrigemId OU item OU venda`; lista e detalhe filtram itens/vendas por empresa. Empresa B tambem e visivel se tem item, independentemente da ancora de empresa A. Os vinculos clinicos e de banho permanecem nas respectivas tabelas, sem os mover de CNPJ.

**Teste adicionado na PR #38 DRAFT:** ampliado `api/tests/pdv-comandas-cnpj.integration.test.mjs` para simular **mesma comanda, duas empresas, itens de ambos, atendimento clinico em A, ordem de banho e tosa em B, sem venda**. O teste verifica acesso de A/B apenas a seus itens, negacao intertenant, e continua permitindo enxergar ambos os CNPJs com ancora de origem nula ou A. Roda somente no PostgreSQL descartavel do CI, nao em producao.

**Gates nao removidos:** evidencia agregada nao inspeciona todos os detalhes de itens ativos/cancelados nem executa as 26 migrations sobre dados comerciais. A migration de origem ja aplicada em staging nao e reescrita; a selecao do primeiro item como origem nao pode ser interpretada como direito de apropriar receita de outros CNPJs. Antes de merge, exige-se clone independente derivado do backup comercial REAL e ensaio completo das migrations, com contagens por empresa, historicos e visibilidade; resultado de CI verde nao substitui prova. DR comercial, controle de predeploy, fiscal externo por CNPJ e canario controlado continuam pendentes.

