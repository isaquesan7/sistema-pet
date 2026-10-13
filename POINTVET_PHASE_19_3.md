# PointVet — Fase 19.3: Homologação operacional do onboarding SaaS

## Escopo e evidências
- Reutilizar portal comercial, Console Interno (organizações), central de suporte, assinatura e guia de seis etapas da 19.2.
- Suite automatizada `api/tests/onboarding-operational.contract.test.mjs`: contratos de rotas, validação, criação transacional, trial, módulos, segurança de acesso e isolamento de consultas por tenant/unidade.
- O teste de contrato NÃO comprova a execução ponta a ponta, a persistência real, o login pós-cadastro, nem a interface no navegador.
- Nunca executar cadastro experimental no banco de produção. Nunca empregar dados reais de clientes em ensaio.

## Checklist de homologação E2E (pendente de ambiente descartável)
1. Preparar PostgreSQL isolado, serviços/URLs de homologação e plano de teste. Confirmar que NÃO apontam para o PostgreSQL de produção; não copiar dados pessoais de produção.
2. Executar migrations e seed de permissões somente no banco isolado; registrar o resultado.
3. Acessar planos públicos e criar organização A com CNPJ/e-mail sintéticos válidos de teste. Confirmar organização, unidade, proprietário, assinatura e módulos contratados no banco de teste.
4. Repetir o cadastro com e-mail e CNPJ usados; confirmar rejeição sem registros parciais.
5. Autenticar proprietário A, selecionar unidade, abrir `/primeiros-passos`, conferir status real das seis etapas; cadastrar tutor, pet e item de catálogo e conferir progresso.
6. Criar organização B independente e validar: B não lê nem modifica registros de A; ID de unidade de A não é aceito na sessão de B; somente gestor acessa `/saas/ativacao`.
7. Validar trial, assinatura, limites e liberação/bloqueio dos módulos por plano, sem cobrar pagamento real.
8. Validar fluxo mínimo autorizado pelo plano: tutor → pet → catálogo → atendimento/serviço. Checar que inexistência de módulo contratado resulta em bloqueio correto.
9. Confirmar Console Interno (superadmin): organizações A/B, detalhes e status coerentes. Verificar proibição de acesso com usuário não superadmin.
10. Verificar saúde e última evidência REAL de backup/alertas sem executar backup manual, desligar cron ou disparar notificações artificiais.
11. Coletar logs, status dos endpoints, resultados dos testes e regressões; corrigir somente em branch e submeter novo PR.

## Condições de aprovação
- CI de contratos passa.
- Cenários E2E 1–11 executados com evidências e sem acesso ao banco real.
- Dados das organizações isolados, erros tratados e sem problemas bloqueantes.
- Backup, Resend, workers e dados clínicos de produção preservados.

## Estado
**Homologação parcial**: contratos automatizados disponíveis. E2E isolado, login real, fluxo clínico e checagem pós-deploy exigem evidências específicas antes de declarar a Fase 19.3 completa.
