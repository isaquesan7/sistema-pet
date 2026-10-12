# PointVet 17.2 — Central de Monitoramento (primeira entrega)
- Nova aba **Monitoramento** no Console Interno, restrita pelo roteamento de superadministrador.
- Endpoint `GET /api/plataforma/monitoramento/resumo` protegido por `autenticarUsuario` e `exigirSuperAdmin`.
- Checagens em tempo real: API responde e PostgreSQL `SELECT 1`, sem exposição de segredos.
- Backups, infraestrutura Railway e segurança aparecem como **Não verificado** até integração com fontes auditáveis reais, sem dados fictícios nem estado verde indevido.
- Atualizar manualmente por `Verificar agora` e atualização automática a cada minuto.
- Sem alteração de `pointvet-backup-worker`, cron diário, PostgreSQL schema ou secrets.
## Próximas etapas
1. Registro histórico de backup via canal autenticado e auditável, com backend próprio e migração versionada.
2. Histórico e alertas R2/Healthchecks/Railway com credenciais **somente no servidor**, nunca no navegador.
3. Página de ocorrências, filtros e exportação, testes de autorização e end-to-end.
4. Publicar somente após revisão CI e aprovação, sem modificar serviço de backup já operacional.

## Histórico real — integração preparada, ainda não ativa em produção
- Migração `20261012120000_platform_backup_evidence`: metadados de objeto cifrado, horário, tamanho, origem e status, sem dados clínicos nem segredos.
- Endpoint autenticado para superadmin `GET /api/plataforma/monitoramento/backups` retorna até 90 evidências.
- Endpoint de ingestão `POST /api/plataforma/monitoramento/backup-evidence` requer token forte exclusivo via header `x-pointvet-backup-token`, validado no backend com comparação de tempo constante. Insere apenas metadados validados, sem sobrescrever registros.
- No PR #4 (branch de backup worker), envio de evidências opcional após confirmação R2 HEAD. Essa integração **não está no commit atualmente implantado no Railway**.
- Para habilitar no futuro: merge/testes das duas branches, executar migração, cadastrar o MESMO segredo aleatório forte `BACKUP_EVIDENCE_INGEST_TOKEN` somente nas variáveis privadas da API e worker no Railway (nunca chat/GitHub/frontend), configurar `BACKUP_EVIDENCE_API_URL` apontando ao endpoint HTTPS da API, atualizar o commit fixado do worker, testar com backup controlado e verificar a lista no painel.
- Enquanto não integrado, a interface mostra estados vazios e não apresenta o backup de 12/10 como evento ingerido. Jamais fabricar dados históricos.
- Não modificar cron nem segredos da execução atual durante preparação.

## Publicação controlada — sequência obrigatória
1. Rodar CI do PR #5 e revisar migração SQL em ambiente isolado.
2. Aplicar migração versionada da tabela `platform_backup_evidence` em DEV **antes** de conectar o worker.
3. Publicar frontend e API juntos. Confirmar que somente superadmin vê a Central de Monitoramento e que o endpoint de leitura responde vazio sem erro.
4. Gerar segredo aleatório forte fora do chat (mínimo 32 bytes), cadastrar `BACKUP_EVIDENCE_INGEST_TOKEN` **somente** nas variáveis privadas dos serviços `petrise-api` e `pointvet-backup-worker`. Criar a URL `BACKUP_EVIDENCE_API_URL` no worker apontando ao endpoint HTTPS privado de ingestão.
5. Atualizar o worker para commit validado da branch Fase 17.1 **somente após** API pronta. Não alterar `cronSchedule=0 6 * * *` nem a criptografia. Confirmar que não há nova execução inesperada.
6. Testar uma execução controlada ou aguardar próximo cron; confirmar no R2, logs, Healthchecks e histórico do painel.
7. Verificar rota sem token: 401; token incorreto: 401; leitura sem superadmin: 403. O endpoint com token só é válido quando ambos os segredos estão instalados.
8. Limitar token ao canal de ingestão, prever rotação e revogação. A ingestão declara resultado autenticado do worker, não prova leitura independente do objeto em R2.
9. Se o histórico falhar, preservar cron, R2 e heartbeat existentes; reverter apenas o recurso novo.
