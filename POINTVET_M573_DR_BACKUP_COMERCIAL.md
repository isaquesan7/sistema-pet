# PointVet M.5.73 - recuperacao controlada do backup comercial (28/10/2026)

## Resultado da investigacao

O operador homologou em 28/10 o preflight M.5.72 de leitura da base comercial: 2 comandas, 1 mista e legitima da mesma organizacao, sem vendas, com itens e vinculos clinicos/banho, sem referencias cross-tenant; **nenhuma alteracao de dados**. A regressao sintética da PR #38 cobre a visibilidade por CNPJ mas NAO valida migracoes reais comerciais.

O servico Railway **Pet King DEV / production / pointvet-backup-worker**, ambiente de producao, usa branch independente `feat/pointvet-17-1-backup-foundation` no root `/backup-worker` (commit configurado `5994ca02296527fcb67fc738c0a26d88b429e0b7`). O script `backup-worker/scripts/backup-worker.sh` grava diariamente `pg_dump --format=custom --no-owner --no-acl | age -r <public recipient>` em objeto criptografado Cloudflare R2 privado, verifica tamanho remoto e emite evidencia/heartbeat. O cron do servico e `0 6 * * *` (03:00 Salvador). Logs lidos em 28/10/2026: **06:03:40 UTC**, upload, comprovacao de tamanho, evidencia aceita e heartbeat confirmados. **Isto nao prova leitura ou restauracao do arquivo comercial atual.** O ultimo ensaio local documentado na Fase 17.1 utilizou backup de **12/10**, com 84 tabelas; e historico antigo, nao substitui o presente gate.

## Material confiavel ja implementado

A branch independente da Fase 17.1 contem `backup-worker/scripts/restore-local.ps1` e `POINTVET_PHASE_17_1_RESTORE_DRILL.md`. Script aprovado anteriormente:
1. Recebe o objeto `.dump.age` **ja baixado privadamente do R2**, e a **chave privada AGE somente em arquivo do Windows**.
2. Descriptografa temporariamente, inicia `postgres:18-bookworm` em **Docker local sem publicar portas**, restaura com `pg_restore --exit-on-error --no-owner --no-acl`, verifica tabelas e contagens agregadas.
3. Remove container/dump temporario no `finally`. O script antigo nao compara todos os dados e nao executa migrations; deve servir como **primeira evidencia**, nao como unica prova para deploy.

Fonte do script: https://github.com/isaquesan7/sistema-pet/blob/feat/pointvet-17-1-backup-foundation/backup-worker/scripts/restore-local.ps1

## Operacao local sob autorizacao e custodia do proprietario

**NAO executar automaticamente neste patch.** Apenas operador autorizado com Windows confiavel e disco criptografado, Docker Desktop, age.exe e chave privada AGE offline. A chave privada, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, URLs DB, dump descriptografado e dados pessoais nunca podem ser enviados a GitHub/ChatGPT/CI, nem a um Railway DR de staging.

- No painel **Cloudflare R2**, abrir o bucket privado da Pet King, prefixo `postgres/daily/`, selecionar **o objeto de 28/10/2026 correspondente ao backup diario confirmado por logs** e baixar somente pela interface autenticada; nunca habilitar link publico. Nao pegar o arquivo de 12/10 para esta etapa. Validar nome, data e tamanho local sem divulgar a chave do objeto em posts.
- Garantir que a chave AGE que descriptografa o backup esteja em dispositivo local autorizado, nunca em pasta com sync automatico de nuvem. A chave publica `BACKUP_AGE_RECIPIENT` do Railway **nao pode** descriptografar o arquivo.
- Em pasta segura, obter a versao original auditada `restore-local.ps1` da branch 17.1 **sem fazer merge dessa branch no PDV**. Confirmar `Get-Command age.exe`, `docker version` e `Get-FileHash -Algorithm SHA256 -LiteralPath <arquivo-criptografado>` (nao compartilhar caminhos privados).
- Executar de PowerShell local com caminho do artefato cifrado, chave AGE e `age.exe` explicitados **apenas em variaveis/arquivos locais**:

```powershell
# Exemplo: substituir caminhos na maquina do responsavel, NUNCA colar credenciais no chat.
& ".\\restore-local.ps1" -EncryptedBackup $arquivoCifradoLocal -PrivateKey $arquivoChaveAgeLocal -AgeExe "age.exe"
```

- Verificar log local `RESTORE VALIDATED: N public tables` e `RECOVERED RECORD COUNTS: ...`. Os totais se referem ao instante do backup; comparar dados de producao somente com SELECT agregado read-only e respeitando a data. Registrar somente status, UTC, N tabelas, N migrations, SHA256 do **arquivo cifrado**, sucesso da limpeza e divergencias agregadas; nenhuma senha, chave, linhas, ID de cliente ou CNPJ.
- Se restauracao falhar, **nao** classificar backup como recuperavel, e parar a promocao. Apagar de forma segura arquivos temporarios conforme politica LGPD e manter maquina criptografada. Nao usar `railway volume restore` sobre fonte comercial nem reutilizar `steadfast-comfort` (DR de homologacao que ja contem dados).
- **Nao executar 26 migrations no container desse ensaio inicial** sem clone/auditoria independente e autorizacao especifica. A prova de decrypt/restore e apenas o primeiro subgate, seguida por ensaio de migrations sobre outro clone independente, snapshot de contagens, plano de rollback sem retorno automatico de schema, auditoria fiscal e canario.

## Gates comerciais ainda bloqueados

- Prova atual de recuperacao do backup AGE comercial: **PENDENTE**.
- Ensaio independente das 26 migrations da RC1 sobre clone comercial recuperado: **PENDENTE**.
- Autodeploy `main`/predeploy API `npm run db:deploy`: **nao tocar ate janela de publicacao validada**.
- Fiscal/contabil por CNPJ, canario restrito, monitoramento, aprovacao de corte: **PENDENTES**.
- A PR #38 permanece **DRAFT**. Nenhuma alteracao no Railway, R2, banco comercial, flags ou migracoes foi feita por este runbook.

