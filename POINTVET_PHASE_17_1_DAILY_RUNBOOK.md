# PointVet 17.1 — ativação segura do backup diário (plano)

## Validação concluída
- Cloudflare R2 privado `pointvet-backups`: upload cifrado confirmado.
- Restore `age` + `pg_restore` em PostgreSQL 18 isolado: 84 tabelas.
- Comparação de agregados essenciais restaurado vs. original: usuário informou resultados iguais em 12/10/2026.
- Worker Railway `pointvet-backup-worker`, `BACKUP_MODE=check`, `BACKUP_EXECUTION_ENABLED=NO`, sem cron.

## Pré-requisitos de ativação
1. Verificar backup do Railway e PITR ativos.
2. Configurar concessão SELECT futura para novas tabelas, identificando primeiro o owner de tabelas e o role que executa migrações; no PostgreSQL, `ALTER DEFAULT PRIVILEGES FOR ROLE <owner> IN SCHEMA public GRANT SELECT ON TABLES TO pointvet_backup;` só vale para objetos criados posteriormente **por esse role**. Verificar novos schemas e permissões por migration.
3. Definir retenção no bucket R2 com **Lifecycle** (exemplo inicial: 90 dias para `postgres/daily/`; recuperação de longo prazo requer estratégia distinta, idealmente cópias imutáveis e política contra exclusão maliciosa). Não adicionar delete diretamente ao worker. Excluir `checks/` após 7 dias, com regra separada.
4. Ativar **alertas de falha de deployment/cron** na Railway e alerta de ausência de backup confirmado em 26h por verificação externa. Um job cron retornando erro não deve passar despercebido. Alertas precisam ser testados.
5. Conferir política Cloudflare R2 token e rotação. Chave privada AGE continua apenas offline.
6. **Aprovado pelo responsável:** execução diária às 03:00 de Salvador (America/Bahia, UTC−3), cron Railway `0 6 * * *` em UTC; retenção de 90 dias para `postgres/daily/`. Aprovação da política não significa ativação técnica automática.
7. Atualizar serviço para uma versão controlada mais recente, somente após CI aprovar; `BACKUP_MODE=run`, `BACKUP_EXECUTION_ENABLED=YES` e `cronSchedule=0 6 * * *` no worker **após cumprir as verificações**.
8. Observar primeira execução agendada nos logs, verificar objeto no R2, realizar restauração periódica e registrar sucesso de backup.
9. Separar DEV de PROD antes de uso clínico em produção; revisar a LGPD e transferência internacional pela região Cloudflare.
## Não confundir
- Railway cron é agendamento de execução do worker e não fornece, sozinho, garantia de alerta nem retenção.
- Não iniciar cron antes de haver monitoramento e retenção suficientes.
- A validação anterior não prova que toda tabela futura será incluída.
