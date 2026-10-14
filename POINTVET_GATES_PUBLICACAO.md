# POINTVET — GATES OFICIAIS DE PUBLICAÇÃO DO PDV UNIFICADO

> Arquivo de decisão: acompanhar junto de [CONTINUIDADE_OFICIAL](./POINTVET_CONTINUIDADE_OFICIAL.md) e da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37).  
> Estado em 14/10/2026: **NENHUMA LIBERAÇÃO DO CHECKOUT MULTIEMPRESA EM PRODUÇÃO**.

## 1. Definições — não confundir
**Preview/homologação:** interface, catálogo, comanda e preparação de venda sem movimento de dinheiro, estoque ou documento fiscal; preferir ambiente de staging separado. Feature flags desativadas por padrão.
**Beta comercial:** fluxo completo para um grupo pequeno de empresas/recebedores autorizados, PSP integrado quando aplicável, fiscal conforme exigências legais e plano de contingência/rollback testado.
**Lançamento geral:** suporte a organizações arbitrárias, CNPJs e múltiplas unidades, conciliação e relatórios, monitoramento, suporte e gestão de incidentes.

## 2. Critérios de aceite por área

| Área | Staging sem checkout | Beta comercial com dinheiro real |
| --- | --- | --- |
| Multi-tenant e acesso por empresa | Testes de papéis/revogação no backend | Auditoria de endpoints, tokens, acesso cruzado e credenciais |
| Comandas e rascunhos | Prisma migrations isoladas, preço/pet/estoque validados | Reserva e retry idempotentes mesmo após falhas/corridas |
| Orçamentos no perfil do tutor + PDV (PR #35) | CRUD e filtro de tutor, não gera venda ao aprovar | Conversão idempotente, valores/empresa/fiscal auditáveis |
| Crédito do tutor (PR #35) | Ledger só leitura, saldos e histórico consistentes | Razão transacional com conciliação, estorno, limites e bloqueio concorrente |
| Caixa/recebedor | Alocação conferida por empresa, sem cobrar | Dinheiro realmente recebido pela pessoa jurídica correta ou split homologado |
| PSP | Assinatura/callback/mock com dedup e simulação de timeout | Credenciais seguras, homologação do PSP, contratos e idempotência externa |
| Operação durável | Outbox no CI, revisão manual para status indeterminado | Worker isolado, leasing/fencing, consulta PSP antes de retry e reconciliação |
| Fiscal | Fluxo pré-planejado sem emissão | Documento separado por emissor/tipo, testes UF/município, autorização fiscal |
| Estoque | Comanda não dá baixa em sandbox | Baixa/estorno únicos e conciliados por empresa |
| Mesmo CNPJ em unidades distintas | Decisão de modelo jurídico operacional/documentada | Migração segura da restrição `Empresa.cnpj @unique` com matriz de casos |
| Segurança de lançamento | CI, PostgreSQL staging, review, restore em staging | Canário, backup restaurável, rollback, alertas e suporte |
| PDV individual | Continua funcionando com preferência desativada | Regressão E2E e migração reversível de preferência |

## 3. Bloqueios absolutos no momento
1. **PR #36** em DRAFT, sem checkout real, sem worker PSP ou webhooks de provedor real.
2. **PR #35** em DRAFT: integrar Orçamentos/Crédito do Cliente; não descartar a ficha do tutor.
3. Unidades que compartilham CNPJ ainda não são suportadas no modelo atual (campo `Empresa.cnpj @unique`).
4. Especificações PSP, split/recebedores, estados de autorização, comprovantes, estornos e conciliação ainda não homologadas.
5. Documentos fiscais separados por empresa/tipo, regras legais e testes de emissão ainda não homologados.
6. Backup restaurável, teste de rollback, monitoramento, canário e integração `main` sem divergências ainda pendentes.

## 4. Sequência recomendada
**Gate A — Read-only preview/staging:** validar PR #36, migrations, segurança, testes E2E no staging e manter o modo `checkoutHabilitado=false`. Pode ocorrer antes das etapas fiscais reais.

**Gate B — Beta comercial controlada:** PSP real ou pagamentos individuais por CNPJ com provas e conciliação, fiscal por emissor, operações antifraude/erro, estoque/estorno/Crédito e Orçamentos integrados, canário apenas em lojas piloto.

**Gate C — Lançamento amplo:** onboarding multi-CNPJ/múltiplas unidades, observabilidade operacional, atendimento a incidentes, experiência consolidada e regressão para tenants que mantêm PDV individual.

## 5. Estimativa e comunicação
**Não existe ETA tecnicamente validada.** Uma estimativa de calendário depende da definição do PSP, emissor fiscal, desenho do mesmo CNPJ, testes com usuários e disponibilidade de homologação. Em atualizações de status, publicar evidência: commit SHA, CI do HEAD, ambiente, teste de contingência e último gate aprovado — nunca porcentagem inventada.

**PRIORIDADE ATUAL**: Fase 20.2.4B.2, contrato PSP simulado com integridade, correlação por empresa/CNPJ/valor e comportamento seguro em status indeterminado. NÃO lançar cobranças reais com base apenas em um mock.

## 6. Protocolo de release
- Aprovar integração com `main` somente após reviews e CI do SHA HEAD.
- Homologar migrations aditivas em banco restaurado a partir de cópia saneada; avaliar locking e duração.
- Testar tenants com flag desligada, empresa única, múltiplos CNPJs, mesmo CNPJ quando suportado, funcionário com acesso parcial e CNPJ sem PSP configurado.
- Garantir backups, rollback sem perder dados, métricas e alarme para pendência de autorização, reprocessamento e divergência fiscal.
- Documentar incidentes e comunicação ao cliente; ativar por grupo e capacidade de desligar checkout sem destruir vendas existentes.

> **Proibido confundir publicação do PointVet já existente com liberação do novo PDV Unificado.** O atual PDV permanece operacional independentemente dos gates acima.
