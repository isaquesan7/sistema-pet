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

## Confirmação operacional — 12/10/2026
O responsável confirmou que salvou no painel Cloudflare R2 a regra de lifecycle `pointvet-daily-90d`, prefixo `postgres/daily/`, exclusão após 90 dias. A configuração foi previamente conferida por captura de tela; leitura por API Cloudflare ainda não realizada. Permanecem pendentes concessões futuras e alertas antes da ativação do cron.

## Notificações e heartbeat — configuração em progresso
- Usuário confirmou que salvou override Railway para projeto Pet King DEV com `Deployment Failed`, `Deployment Crashed`, `Deployment OOM Killed`, via Email & In-App.
- Novo suporte opcional `BACKUP_HEARTBEAT_URL`: somente após R2 reportar sucesso e HEAD confirmar o tamanho do backup cifrado, worker emite ping HTTPS para Healthchecks.io. A URL deve ser configurada secretamente **somente no Railway**, nunca em GitHub/chat.
- Configurar check do provedor externo: nome PointVet Backup Diário; cron `0 6 * * *` UTC; tolerância (grace) de **2 horas**, e integração de alerta por e-mail validada. Isso sinaliza falta de sucesso após 05:00 de Salvador, mais de 26 horas desde a execução anterior prevista.
- Heartbeat mede execução confirmada; **não** substitui teste independente de leitura/restauração nem prova por si só a existência de objeto em data posterior.
- Monitoramento ainda **não ativado**: usuário deve criar check e cadastrar `BACKUP_HEARTBEAT_URL` no Railway. Só então implantar o commit com suporte a heartbeat e ativar cron.

## Ativação técnica — 2026-10-12 UTC
- Responsável confirmou `BACKUP_HEARTBEAT_URL` no Railway. Verificada presença do nome da variável, sem leitura do valor.
- GitHub Actions para commit `b012e487510c105828c410809bcf2b20a23cd56e` aprovou build do worker, backup tools, integração de restore e validação 16.1.
- Serviço `pointvet-backup-worker` fixado no commit validado.
- Configurado `cronSchedule=0 6 * * *` (03:00 Salvador), `BACKUP_MODE=run`, `BACKUP_EXECUTION_ENABLED=YES`, `R2_PROBE_ENABLED=NO`, sem política de restart.
- Deploy Railway `8854862b-4f28-4b07-9d34-a4096e490b38` retornou status SUCCESS. Ainda falta observar o primeiro job agendado e verificar o recebimento do heartbeat no Healthchecks.io.
- Cloudflare R2 lifecycle 90 dias e notificações Railway foram confirmados pelo responsável. Confirmar que a integração de e-mail do Healthchecks.io está associada ao check e enviar ping de teste apenas no contexto apropriado, para validar entrega do alerta.
- Não considerar alertas externos comprovados até observar a execução e testar a notificação de falha/ausência.
