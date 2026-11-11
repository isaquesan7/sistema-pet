# PointVet — Planejamento proposto da Fase 17
## Estabilidade, recuperação e preparação para produção SaaS
Status: PLANEJAMENTO — não implementado. Base: main após PointVet 16.1.

## Evidências verificadas
- Railway Pet King DEV: API, admin, portal e PostgreSQL online na inspeção de 11/10/2026, sem alertas/falhas recentes retornados.
- API contém /api/health e /api/health/database, Helmet, CORS e rate limiting.
- Fase 16 já possui armazenamento privado, URLs assinadas, solicitação LGPD, exportação, anonimização e auditoria.
- O repositório possui CI para build do admin, build do portal, geração Prisma e verificação de sintaxe da API.
- Não foram localizados testes automatizados de integração/isolamento nem scripts próprios de backup e restauração exercitados no repositório.
- A implementação fiscal mantém adaptador oficial ainda não conectado (PROVEDOR_NAO_IMPLEMENTADO).
- Cobrança SaaS recorrente real permanece pendente; modo development/manual não substitui gateway.
- Não foi possível comprovar, apenas com essa revisão do repositório, a política efetiva de backup gerenciada pelo Railway ou execução de restauração.
- Essas conclusões são de auditoria estática e infraestrutura; não equivalem a pentest nem testes end-to-end.

## Escopo e ordem recomendados
### 17.1 — Backup/restore com recuperação comprovada (P0)
1. Inventariar política real de backups do PostgreSQL/volumes no Railway, credenciais e retenção sem expor segredos.
2. Definir RPO/RTO, cópias em destino isolado, retenção, criptografia e acesso mínimo.
3. Criar procedimento reversível para restaurar em banco temporário separado, nunca sobre o banco ativo.
4. Fazer restore de teste e verificar integridade referencial, contagens e acesso, com registro do exercício.
Critério: restauração demonstrada em ambiente isolado com checklist documentado.

### 17.2 — Testes críticos de negócio e segurança (P0)
1. Criar base de testes efêmera com pelo menos dois tenants e múltiplos CNPJs; sem reutilizar dados reais.
2. Testar autorização entre organizações para clientes, pets, prontuários, arquivos, estoque, PDV, relatórios e APIs administrativas.
3. Testar permissões/cargos, sessão expirada, assinatura bloqueada, limites por plano, onboarding e recuperação de erros.
4. Testar fluxos essenciais: PDV e cancelamentos, estoque, consultório, agenda e OS de banho/tosa, caixa e financeiro.
5. Rodar testes em CI com credenciais efêmeras e sem acesso ao banco de desenvolvimento.
Critério: suíte reproduzível, zero vazamentos intertenant, cenários críticos aprovados.

### 17.3 — Observabilidade e alertas (P1)
1. Revisar readiness/liveness; health do banco deve ser monitorado com autenticação/proteção apropriada.
2. Instrumentar erros estruturados e correlação por requisição sem registrar dados pessoais/segredos.
3. Monitorar disponibilidade, latência, CPU/memória, storage e filas/processamentos; configurar alertas testados.
4. Documentar runbook para incidentes, rollback e deploy.
Critério: alerta de falha simulado, diagnóstico e recuperação demonstrados.

### 17.4 — Arquivos e LGPD operacional (P1)
1. Validar upload, tamanho/MIME, URL temporária, revogação, organização correta, exclusão e políticas de retenção.
2. Integrar arquivos às telas de logo, fotos de pets, anexos clínicos e banho/tosa conforme lacunas confirmadas.
3. Testar solicitações LGPD e impedir acesso indevido e vazamento em arquivos e logs.
Critério: cenários completos e checklist jurídico/operacional para revisão humana.

### 17.5 — Preparação comercial, não implementar gateway sem decisão (P2)
1. Definir provedor de cobrança e fiscal homologado para regiões de atuação.
2. Criar plano de homologação para assinaturas, webhooks e documentos fiscais com ambientes separados.
3. Validar limites de empresas/usuários nos futuros cadastros e regras de suspensão/cobrança.
Critério: decisões técnicas e contratuais documentadas antes das integrações reais.

## Fora do escopo
- Não renomear petrise-api, petrise-admin, petrise-portal, PETRISE_* ou ArquivoPetRise.
- Não alterar banco, migrations ou ambiente Railway por causa do planejamento.
- Não migrar dados reais nem fazer restores sobre Pet King DEV.
- Não afirmar conformidade LGPD ou segurança absoluta sem validação especializada.

## Portões de entrega
Cada incremento: branch dedicada, diff revisado, CI aprovado, ensaio em ambiente isolado, teste manual e rollback claro, só então merge e deploy no Pet King DEV.
