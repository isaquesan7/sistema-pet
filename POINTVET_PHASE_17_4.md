# PointVet 17.4 — incidentes de infraestrutura

- Tabela `platform_service_incidents` armazena períodos de falha e recuperação por serviço, com apenas um incidente aberto por serviço.
- `POST /api/plataforma/monitoramento/incident-observations` recebe verificações de um coletor independente, autenticado pelo segredo `MONITOR_INGEST_TOKEN`. Nunca colocar esse segredo no frontend ou no repositório.
- `GET /api/plataforma/monitoramento/incidentes` exige superadministrador; dados pessoais e segredos são omitidos.
- `monitor-worker/collect.mjs` verifica endpoints HTTPS fixos de admin e portal, com limite de tempo, e envia observações.
- **A coleta recorrente ainda NÃO está ativada.** Não confundir ausência de incidentes com comprovada disponibilidade contínua.
- Não usar o backup worker para coleta de incidentes; a execução diária de backup precisa permanecer independente.
- Publicação segura: testar migração, merge, conferir deployments; criar serviço Railway separado com Node.js, cron em UTC de no máximo 1 vez por hora, segredo compartilhado com API e URL privada de ingestão HTTPS; testar um ciclo e observar incidentes reais ou dados sintéticos apenas em ambiente isolado. Nunca gerar incidentes sintéticos no DEV real.
- Sem notificações de incidentes nesta etapa; alertas devem ser introduzidos após calibração de falsos positivos e configuração de canal apropriado.
