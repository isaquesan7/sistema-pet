# PointVet — Central de Auditoria da Plataforma (17.6)
Registro independente de `auditoria` por tenant. A Central registra somente mutações autenticadas do Console Interno: criação/edição de planos, alterações de assinatura e criação/liquidação/cancelamento de faturas.
- API: `GET /api/saas/plataforma/auditoria`, protegida por autenticação + `exigirSuperAdmin`, limite 100 e filtro de ação.
- Gravação best-effort após a resposta HTTP em `platform_admin_audit`: ator, ação, entidade, ID, resultado, status e horário. **Nunca armazena corpo de requisições nem segredos.**
- O registro não é transacional, não inclui alterações feitas diretamente no banco, não é retroativo e pode falhar sem bloquear uma operação comercial; estes limites devem permanecer documentados.
- Migração isolada, tabela global sem chave de organização; não altera a auditoria por tenant.
- Implantação somente após CI e validação do banco; serviços de backup/R2/cron não devem ser modificados.
- Próximas etapas: testes de controle de acesso 401/403, testes de mutação/autoria e estratégia fail-closed/transacional para operações críticas.
