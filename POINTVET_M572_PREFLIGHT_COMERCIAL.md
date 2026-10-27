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

## Gates pendentes para release comercial

1. **DR comercial real:** demonstrar restauracao isolada do artefato de backup comercial aprovado (nao usar staging nem seu DR), validar controles de criptografia/retenção/LGPD. O ensaio `pg_dump` staging realizado nao prova o snapshot nativo nem o backup criptografado do worker comercial.
2. **Preflight M.5.72:** executar somente leitura em producao e analisar todos os bloqueadores. Sem dados de clientes nos relatorios.
3. **Migrações:** validar em clone independente do banco comercial todo o pacote de 26 migrations, com snapshots de contagens/invariantes e plano de rollback de aplicacao; migrations PostgreSQL nao sao revertidas automaticamente por rollback de API.
4. **Desacoplar deploy das migrations durante janela aprovada:** revisar o `preDeployCommand` atual `npm run db:deploy` no Railway antes de qualquer merge/deploy, sem mudar configuracao comercial agora.
5. **Canario e homologacao funcional de multi-CNPJ:** validar PDV tradicional, opcao unificada por tenant, taxas/repasses apenas gerenciais, cancelamentos, granel por R$/gramas, servicos inteiros, relatorios e segregacao dos dois CNPJs da Pet King.

**Gate de publicacao continua BLOQUEADO.** Nunca marcar `productionAuthorized=true` com base somente em preflight, CI ou DR de homologacao.
