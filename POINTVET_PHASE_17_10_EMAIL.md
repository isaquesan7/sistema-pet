# PointVet 17.10 — Envio por e-mail (Resend)
- POST /api/plataforma/monitoramento/alertas/despachar-email autentica x-pointvet-alert-token antes do middleware JWT para trabalhadores confiáveis, sem expor segredos.
- Somente eventos reais da tabela platform_alert_delivery_outbox: incidentes persistidos; backup atrasado calculado da última evidência quando >26h. Ausência de evidência não gera e-mail crítico.
- Deduplicação por event_key. Estados AWAITING_CHANNEL (não enviado), QUEUED (envio iniciado), SENT (HTTP 2xx do provedor), FAILED (erro/resultado incerto). Não há retentativas automáticas para evitar duplicidade diante de respostas ambíguas.
- O envio permanece **DESATIVADO** até configurar quatro variáveis na API: RESEND_API_KEY, ALERT_EMAIL_FROM (domínio verificado), ALERT_EMAIL_TO (destinatário autorizado), ALERT_DELIVERY_TOKEN (segredo aleatório 32+ caracteres).
- Worker isolado: alert-mail-worker/Dockerfile com env ALERT_DELIVERY_URL=https://petrise-api-production.up.railway.app/api/plataforma/monitoramento/alertas/despachar-email e ALERT_DELIVERY_TOKEN, cron 0 * * * * UTC e restart NEVER.
- Configuração de remetente/destinatário deve ser deliberada; não copiar token em chats, arquivos GitHub ou logs. Não publicar serviço nem acionar endpoint sem autorização para começar envios.
- Resend 2xx é aceite do fornecedor, NÃO garantia de entrega na caixa de entrada. Métricas de entrega/webhooks ficam para próxima fase.
- Não altera serviços de backup/R2/worker nem agenda das 03h.
