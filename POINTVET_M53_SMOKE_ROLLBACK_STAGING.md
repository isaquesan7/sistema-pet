# PointVet M.5.3 — Smoke real da API em CI e plano de rollback sem execução

**Estado:** Implementação apenas na branch do PR #36 DRAFT; sem merge, sem acesso a Railway, DNS real, dados de produção, Hostinger, backups reais, R2, gateway, provedor fiscal ou Resend. Data de referência: 14/10/2026. **M.5.3 REAL EM STAGING ainda NÃO concluída.** Os testes desta fase são exclusivamente locais e descartáveis.

## 1. Verificação read-only do Express completo com Postgres descartável

Arquivo `api/tests/pointvet-m53-local-smoke.integration.test.mjs`. Rodado no job `isolated-postgres` da pipeline `.github/workflows/pointvet-unified-pdv-foundation.yml`, após migrations e as regressões M.3–M.4D, antes do ensaio M.5.1 pg_dump/pg_restore.

- Bloqueia execução sem `GITHUB_ACTIONS=true`, `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1` e `DATABASE_URL` EXATAMENTE igual ao banco `pointvet_unified_ci` no localhost. Confere nome real do banco e usuário `pointvet_ci` no SQL.
- Importa a instância Express REAL `api/src/app.js`, cria listener somente em `127.0.0.1` na porta efêmera definida pelo sistema. **Não realiza chamadas a sites externos nem inicia servidor público.** Usa unicamente GET sem senha/token ou dados de clientes.
- Verifica `GET /api/health` 200 e payload do serviço, `GET /api/health/database` 200 com Postgres conectado e contagens de espécies/permissões, barreiras de autenticação `GET /api/pdv-unificado/disponibilidade` e `GET /api/portal/me` (401 sem sessão) e resposta 404 em rota inexistente, além do header Helmet `X-Content-Type-Options: nosniff`.
- Confere contagens ANTES e DEPOIS da smoke para organizações, vendas, pagamentos, documentos fiscais, estoque, fluxos e eventos fiscais CI. Toda alteração inesperada falha o job.
- **Não prova disponibilidade de API/Portal/Admin em staging ou produção; não verifica SSL/DNS real, storage, e-mail, desempenho nem usuários reais.** A UI React continua coberta somente pelo build no CI.

## 2. Pré-condições para reversão da aplicação (somente contrato PURO)

Arquivos:
- `api/src/modules/plataforma/pointvet-m53-rollback.contract.js`
- `api/tests/pointvet-m53-rollback.contract.test.mjs`

Exige tenant e empresas distintas, `commitCandidato` e `commitAnterior` **SHA completos, diferentes e explícitos**, referência e imagem de release anterior, rollback das flags por tenant, compatibilidade e histórico de migrations, restore **de backup real em staging**, plano de recuperação de dados, validação de direitos, operador de reversão, telemetria/alertas e canário circunscrito à organização.

Se ocorrer incidente do canário (p. ex. fuga de tenant, venda duplicada, divergência de caixa/estoque), recomenda `PARAR_E_INVESTIGAR`. Falta de evidência = `BLOQUEAR_PUBLICACAO`. Mesmo quando o checklist está totalmente marcado, solicita revisão humana e define `executarDeploy=false`, `executarRollback=false`, `executarMigration=false`, `autorizarProducao=false` e `restauracaoRealExecutada=false`.

**Rollback da M.5.1** foi apenas `BEGIN/UPDATE/ROLLBACK` num banco restaurado de testes: isso NÃO equivale a reverter software/flags/migrations reais. Nenhuma rotina para executar rollback ou apagar dados foi criada aqui.

## 3. Procedimento futuro M.5.4 sujeito a autorização específica

Antes de habilitar staging real: obter projeto Railway e cluster PostgreSQL fisicamente separados, tokens/segredos exclusivos guardados fora de GitHub, storage/buckets separados, e-mail sink, webhooks desativados, pagamentos manuais sem gateway, nenhum fiscal externo e dados SINTÉTICOS. Inventário das identidades e DNS; verificar HTTPS e certificado sem alterar DNS público, sistema de arquivos e autenticação em ambiente efetivamente implantado.

**Apenas após autorização distinta para dados reais**, selecionar snapshot/backup autorizado segundo LGPD, restaurar em staging com controle de acesso, cifragem e mascaramento, testar migrações, índices/dados/armazenamento e medir tempos reais RTO/RPO. Exercitar rollback de VERSÃO e flags em staging, testar alertas e monitorar observabilidade. Só posteriormente propor canário opt-in por tenant com aprovação expressa. Não ativar segundo CNPJ/unidade, crédito pré-pago no checkout, PSP/TEF/maquininha, fiscal não homologado nem remover `Empresa.cnpj @unique`.

## 4. Checklist de continuidade

Consultar na ordem: `POINTVET_CONTINUIDADE_OFICIAL.md`, `POINTVET_GATES_PUBLICACAO.md`, esta especificação, documento M.5.1/M.5.2, [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37), [PR #36 DRAFT](https://github.com/isaquesan7/sistema-pet/pull/36) e os dois jobs do CI do HEAD FINAL. A produção da Pet King, seus backups e notificações devem permanecer intocados.
