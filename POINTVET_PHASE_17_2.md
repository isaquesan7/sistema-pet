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
