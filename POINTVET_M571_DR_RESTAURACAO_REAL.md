# PointVet M.5.71 — execução supervisionada da recuperação lógica do staging

**Estado em 26/10/2026: ferramenta implementada e testes de segurança em CI; restauração do banco real ainda NÃO executada.** Isto não autoriza merge, migrations nem deploy comercial.

## Por que este procedimento existe
O backup nativo de volume do Railway foi criado pelo proprietário, mas não há evidência de restauração independente. A integração Railway do ChatGPT não permite listar/restaurar snapshots nem executar SQL remoto. O Postgres de `Pet King PDV Homologacao/staging` **não tem proxy TCP público** configurado. Não abrir o banco na internet como atalho nem clicar em **Restore** no volume de staging; este recurso restaura no mesmo projeto/ambiente e pode substituir o volume montado.

Já existe restauração integral **sintética** em CI (M.5.1 e M.5.59). Não repetir. O objetivo aqui é demonstrar que dados **reais do staging** podem ser copiados logicamente, restaurados e verificados em **outro projeto PostgreSQL vazio**, sem escrever na origem.

## Ferramenta e proteções
- `api/scripts/pointvet-m571-staging-drill.mjs` — execução manual somente; não há cron, endpoint HTTP, workflow de DR real nem hook de deploy.
- `api/src/modules/plataforma/pointvet-m571-dr-guard.contract.mjs` — recusa origem diferente do ID staging, destinos no mesmo projeto, no projeto comercial ou no projeto do ensaio sintético, URLs sem TLS, host coincidente e ausência de confirmação explícita.
- `api/tests/pointvet-m571-dr-guard.contract.test.mjs` — testes de recusa e `--preflight-only` (somente valores sintéticos; não abre conexão).
- Verifica `pg_control_system().system_identifier` de **ambas** as instâncias para impedir aliases do mesmo cluster; se o Postgres negar a função, **a operação falha fechada**.
- Verifica `current_database`, sessão da origem como `default_transaction_read_only=on`, versão maior igual e ausência de objetos públicos no destino antes de restaurar. O destino deve ser **novo, vazio e descartável**.
- Usa `pg_dump -Fc` na origem, grava arquivo temporário com permissões restritas, calcula SHA256, e usa `pg_restore --exit-on-error --no-owner --no-acl` **apenas no banco destino**. Compara lista de tabelas, todos os seus totais/checksums de linhas, contagem de índices, constraints, views, sequences, triggers, histórico de migrations Prisma e integridade das vendas estornadas, pagamentos e lotes. Apaga o dump temporário no encerramento.
- Só imprime indicadores agregados, SHA256 do dump e duração; **nunca imprime credenciais, URLs, registros individuais nem dados de clientes**. Em erro, não imprime o diagnóstico bruto do PostgreSQL.
- Identidades de projetos/serviços introduzidas por variáveis são **declarações do operador**. O operador deve comprová-las no Railway de forma independente; somente `system_identifier` é observado diretamente por conexão PostgreSQL. O comando também **não** prova que um snapshot nativo do Railway consegue ser restaurado; valida exclusivamente `pg_dump`/`pg_restore`.

## Pré-requisitos que ainda exigem operação autorizada

1. Responsável valida no dashboard que a **origem é exclusivamente** Railway projeto `9564acfc-1582-45d8-8ac3-f0bc2d998530` (`Pet King PDV Homologacao`), Postgres serviço `a8e97777-25dc-4fe0-b9b0-00effb9c951d`. **Nunca** `Pet King DEV / production` (projeto `aab52927-a8c1-4158-80bf-bd22af504e72`).
2. Provisionar sob autorização e política de custo/retenção um **NOVO projeto Railway exclusivo para DR staging**, com Postgres da mesma versão principal, banco vazio, acesso restrito e credenciais próprias. **Não usar** o projeto sintético `PointVet-DR-Sintetico-M558`, nem instalar dados de staging naquele ambiente.
3. Dispor de uma estação ou executor isolado com Node 22+, `psql`, `pg_dump` e `pg_restore` (cliente PostgreSQL da versão do servidor), e conectividade **privada/autorizada e criptografada** para origem e destino. O estágio atual **não possui TCP proxy público**. Não criar um proxy público de produção/staging por conveniência; se não houver transporte seguro para as duas conexões, o teste fica bloqueado.
4. Trabalhar em janela tranquila com nenhuma outra alteração de vendas durante a comparação. Se uma tabela mudar entre `pg_dump` e a conferência de origem, a validação deve falhar sem ser tratada como corrupção.
5. Usar somente variáveis de ambiente privadas para as duas URLs PostgreSQL, nunca colá-las no GitHub, ChatGPT, imagens ou logs. Para Bash, capturar valores sem gravá-los no histórico: `read -r -s POINTVET_DR_SOURCE_URL` e `read -r -s POINTVET_DR_TARGET_URL`; depois `export` das variáveis.
6. Conferir que usuário da origem pode ler o esquema inteiro e invocar `pg_control_system()`; usuário destino pode restaurar o banco vazio. Não tentar contornar falta de permissão elevando acessos comerciais.

## Comandos de operação (somente após infraestrutura pronta)

Executar a partir da pasta `api/`; definir as variáveis abaixo sem segredos em repositórios, trocando os IDs do **novo** projeto DR e serviço destino conforme Railway:

```bash
export POINTVET_DR_SOURCE_PROJECT_ID=9564acfc-1582-45d8-8ac3-f0bc2d998530
export POINTVET_DR_SOURCE_SERVICE_ID=a8e97777-25dc-4fe0-b9b0-00effb9c951d
export POINTVET_DR_TARGET_PROJECT_ID=ID_DO_NOVO_PROJETO_DR
export POINTVET_DR_TARGET_SERVICE_ID=ID_DO_NOVO_POSTGRES_DR
export POINTVET_DR_CONFIRMATION=I_AUTHORIZE_STAGING_READONLY_TO_FRESH_INDEPENDENT_DR
read -r -s -p "Source staging URL: " POINTVET_DR_SOURCE_URL; echo
read -r -s -p "Target DR URL: " POINTVET_DR_TARGET_URL; echo
export POINTVET_DR_SOURCE_URL POINTVET_DR_TARGET_URL
node scripts/pointvet-m571-staging-drill.mjs --preflight-only
```

O `--preflight-only` **não consulta os bancos**, portanto seu sucesso não comprova restauração. Depois de validar manualmente origem, destino vazio, custos, privacidade e acesso:

```bash
export POINTVET_DR_EXECUTION_APPROVAL=YES_FRESH_EMPTY_DR_DATABASE
node scripts/pointvet-m571-staging-drill.mjs --run-isolated-dr
unset POINTVET_DR_SOURCE_URL POINTVET_DR_TARGET_URL POINTVET_DR_EXECUTION_APPROVAL
```

**Atenção:** um `pg_restore` parcial em caso de erro deixa o banco destino incompleto; não repetir no mesmo banco. Descartar integralmente o destino parcial, auditar o erro privado e começar com um novo destino vazio. Não aplicar `DROP`, `CREATE` nem `Restore` na origem. Armazenar o resultado do teste somente em local privado e registrar na Issue #37 apenas data, IDs dos projetos/serviços (sem URL ou senha), versão, número de tabelas/migrations, hash SHA256, duração e sucesso/erro sanitizado. Descartar a instância DR conforme política de retenção/LGPD após análise.

## Gate final
Somente marcar **RECUPERAÇÃO LÓGICA REAL DO STAGING APROVADA** após execução com JSON `POINTVET_M571_DR_RESTORED_ISOLATED` e verificação humana do alvo. O teste NÃO certifica recuperação do snapshot de volume nativo, backup real comercial, conformidade fiscal, nem autorização para deploy. Ainda são exigidos controles de autodeploy `main`, revisão PR #36→#38, procedimentos fiscais externos e aprovação de janela/canário.

**Estado neste commit:** `preflight` sintético validado; nenhuma ligação a banco real foi feita por esta ferramenta.
