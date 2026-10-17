# PointVet M.5.4.4 — smoke HTTPS read-only de STAGING (não executado remotamente)

**Escopo:** código pronto para testar **posteriormente** endpoints do staging real, quando o ambiente for criado, segregado e autorizado. Esta entrega não cria Railway, DNS, infraestrutura, não acessa staging/prod, não envia e-mails, não restaura backup nem gera documento fiscal.

## Implementação
- `api/src/modules/plataforma/pointvet-m544-staging-smoke.contract.js`: valida SHA completo, três HTTPS origins separados e com marca de staging; bloqueia domínios base de produção `pointvet.com.br` / `petking.com.br`, URLs com usuário, senha, porta não padrão, caminho, query, IP/local e TLDs de documentação; exige IPv4 de resolução DNS pública antes de qualquer GET.
- Método de execução é **opt-in** com confirmação textual `STAGING_READONLY_APPROVED`. Bloqueia `NODE_TLS_REJECT_UNAUTHORIZED=0`. Sem seguir redirects nem enviar cookies/Authorization. `fetch`/TLS nativo do Node verifica certificado do endpoint (quando efetivamente executado).
- Faz GET read-only em `/api/health` (200), `/api/health/database` (200), `/api/pdv-unificado/disponibilidade` (401 anônimo), `/api/portal/me` (401 anônimo), rota inexistente (404), e HEAD nas raízes de admin/portal (200).
- Resposta somente com status por path, SHA e bloqueios de produção; nenhuma resposta do servidor, token, dados financeiros ou identificadores de clientes entra no relatório. Mesmo que o smoke passe, `autorizarProducao=false`, `executarDeploy=false`, `executarMigration=false`, `executarRestore=false`, `habilitarCanario=false`. Isto não garante que o host pertence à empresa — é preciso validar titularidade/identidade do ambiente e DNS fora da ferramenta.
- `api/scripts/pointvet-staging-readonly-smoke.mjs` é CLI **manual**, nunca invocada no GitHub Actions. `api/tests/pointvet-m544-staging-smoke.contract.test.mjs` usa DNS/fetch SIMULADOS, sem consultas de rede externa, testando autorização, SSL, DNS privado, bloqueio de domínio de produção, GET/HEAD sem headers secretos, 401/404, falhas e zero habilitação de checkout.

## Execução futura SOMENTE após autorização do ambiente
Exemplo de campos **não secretos**, fornecidos pelo operador com URLs de staging realmente aprovadas:

```sh
POINTVET_STAGE_COMMIT_SHA=<SHA-completo-validado> \
POINTVET_STAGE_API=https://api.staging-exemplo.tld \
POINTVET_STAGE_ADMIN=https://admin.staging-exemplo.tld \
POINTVET_STAGE_PORTAL=https://portal.staging-exemplo.tld \
POINTVET_STAGING_SMOKE_CONFIRM=STAGING_READONLY_APPROVED \
node api/scripts/pointvet-staging-readonly-smoke.mjs --run-readonly
```

O comando acima é ilustrativo; **não executá-lo com domínios fictícios nem de produção**. Sem as variáveis e a confirmação exata, falha fechado. Não desabilitar verificação SSL.

## Próximos gates
1. **Autorização distinta** para criar/verificar staging segregado Railway/PostgreSQL/storage com dados sintéticos, e-mail sink e webhooks desligados.
2. Executar esta ferramenta contra os endpoints reais aprovados, com revisão independente das evidências de DNS/certificado e identidade de serviços; verificar observabilidade e permissões em staging.
3. Restaurar backup REAL apenas com escolha formal da fonte, revisão LGPD, segurança e aprovação separadas; medir RTO/RPO; ensaiar rollback de release/flags.
4. Resolver limites de operação de crédito, fiscal legal por CNPJ/município e multiunidades antes da liberação comercial; piloto opt-in e autorização posterior. **Sem maquininha ou PSP**, conforme decisão manual.
5. PR #36 permanece DRAFT; não mergear em main nem habilitar checkout real a partir de CI verde.
