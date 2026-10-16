> **M.5.3 — SMOKE E ROLLBACK APENAS CI:** API Express verdadeira executada exclusivamente em 127.0.0.1 e pointvet_unified_ci para GETs /api/health, /api/health/database, autorização negada no PDV e portal e 404, com contagens económicas/fiscais invariáveis. Checklist de SHA candidato/anterior e evidências reais de restore/rollback é NÃO EXECUTÁVEL. Mesmo marcado completo, não autoriza produção. **Ainda não há staging real verificado, DNS/SSL testado externamente, backup real restaurado nem rollback de release executado.** [M.5.3](POINTVET_M53_SMOKE_ROLLBACK_STAGING.md).

> **M.5.2 — PREPARAÇÃO CI / NÃO EXISTE STAGING VERIFICADO:** contratos puros impedem compartilhar projeto Railway/cluster e host PostgreSQL/banco/bucket/DNS com produção; exigem e-mail sink, webhooks e serviços externos desligados, somente dados sintéticos e PDV unificado/PSP/crédito/fiscal real desativados. Diagnóstico de canário declara sinal de PAUSA perante qualquer falha de segurança, divergência financeira/estoque, HTTP 5xx, latência, backup vencido ou alerta crítico, mas JAMAIS executa ação automática. Metadados e métricas são de teste, não evidência de infraestrutura; pending ambiente staging próprio, restore autorizado de backup real, métricas e DNS/TLS verificados, revisão humana/opt-in. [M.5.2 detalhada](POINTVET_M52_STAGING_ISOLAMENTO_CANARIO.md).

> **M.5.1 — ENSAIO EM CI NÃO É STAGING/PRODUÇÃO (14/10/2026):** script restaura de fato um dump de dados SINTÉTICOS num SEGUNDO PostgreSQL CI, compara todas as tabelas, índices, constraints, sequências e Prisma migrations e exercita rollback TRANSACIONAL do banco restaurado. Exige guardas de CI e não toca no backup real, banco/staging Railway ou produção. Checklist seguro por tenant mantém executarDeploy=false mesmo se todas as evidências forem autodeclaradas; ainda exige restore de backup real em staging, RTO/RPO, HTTPS, observabilidade, aprovação fiscal, rollback de deploy e opt-in explícito. [M.5.1 detalhada](POINTVET_M5_STAGING_RESTORE_PUBLICACAO.md).

> **M.4D.2 apenas no CI:** cadeia hash SHA256 de eventos simulados, conferência read-only por emissor e investigação interna obrigatória antes da consulta simulada de resultado indeterminado. Protege contra alterações não coordenadas no mesmo banco, mas não é trilha inviolável externa. Nenhuma emissão, autorização ou cancelamento fiscal real, nenhum PSP/TEF/maquininha, CREDITO_CLIENTE bloqueado. Para liberar produção ainda faltam: matriz fiscal revisada por CNPJ/UF/município, provedores legítimos, staging com restore real de backup, rollback, observabilidade, canário e autorização explícita. [M.4D.2](POINTVET_M4D2_AUDITORIA_INVESTIGACAO_MANUAL.md).

> **M.4D.1 SOMENTE CI:** intenção e eventos de protocolo SIMULADO por venda filha; nenhum DocumentoFiscal legado, XML, SEFAZ/prefeitura, autorização ou cancelamento legal. Indeterminação e contingência não reenviam automaticamente. Fluxo exige permissões fiscais específicas por empresa e snapshots consistentes; subjacente isolado em pointvet_unified_ci com flags de teste. Matriz fiscal, provedores e certificados, consulta real, staging, backup restore, canário e autorização expressa seguem pendentes. [Documento M.4D.1](POINTVET_M4D_SEGURANCA_FISCAL_CI.md).

> **M.4C.3 (somente CI):** prévia com snapshot de legado e fingerprint, aprovação ADMINISTRADOR/PROPRIETARIO com fiscal.gerenciar, importação por empresa serializada/auditada e reversão lógica que preserva todos os históricos; não habilita segunda unidade operacional, não remove Empresa.cnpj UNIQUE, não verifica CNPJ em registros externos e não cria documento fiscal. Sem endpoints públicos. Gates continuam: autorização fiscal por UF/município, migração/backfill real revisado, segregação operacional de unidades, M.5 restore/backups/rollback/canário. [Detalhes](POINTVET_M4C3_MIGRACAO_FISCAL_ASSISTIDA.md).

> **M.4C.2, somente CI:** a preparação fiscal por Venda FILHA concluída divide mercadoria/serviço e exige seleção NFE/NFCE ou NFSE; descontos e acréscimos globais são rateados em centavos exatos. Tudo é prévia com validação de acesso por empresa; **emissão/transmissão fiscal seguem SEMPRE bloqueadas**. Nenhuma rota pública, e nenhuma alteração no sistema fiscal legado. Empresa.cnpj UNIQUE e isolamento por tenant permanecem. Pendentes M.4C.3 migração, autorização fiscal real separada de pagamentos, M.5 staging/restore/canário. [Handoff M.4C.2](POINTVET_M4C2_PREPARACAO_VENDAS_FILHAS.md).

> **M.4C.1 somente CI:** modelos aditivos EntidadeFiscal e UnidadeOperacional permitem projetar vários locais sob um mesmo emissor, mas unidade adicional ainda não tem operação. Empresa.cnpj @unique preservada. Pré-matriz por empresa e por produto/serviço exige permissões em todos os emissores e sempre bloqueia emissão fiscal. Rateio, regras legais locais, migração de unidades e M.5 (staging, backup restore e canário) continuam pendentes. Detalhes: [M.4C fiscal e multiunidades](POINTVET_M4C_FISCAL_MULTIUNIDADES_ARQUITETURA.md).

> **M.4B.3 (14/10/2026), CI apenas:** estorno de ENTRADA exige declaração explícita de devolução externa **e** prova de conciliação contábil `SAIDA/BAIXA_TITULO` já existente, com título PAGAR/PAGO do tutor/empresa, valor exato e referência única. Toda consulta verifica fonte atual e bloqueia saldo quando a prova muda. **O PointVet NÃO devolve dinheiro, nem consulta banco ou maquininha**; a conciliação local não prova movimentação bancária independente. Sem endpoint HTTP para mover crédito e sem opção `CREDITO_CLIENTE` no PDV. Próximo M.4C fiscal/multiunidades, M.5 staging/restore/canário. Mais detalhes em [M.4B.3](POINTVET_M4B3_DEVOLUCOES_CONCILIADAS.md).

> **M.4B.2 (14/10/2026), ainda SOMENTE CI:** razão causal de crédito pré-pago com entrada lastreada em conciliação de baixa/título de adiantamento, idempotência, prova financeira revalidada na consulta, recusa de dados antigos não confiáveis, débito apenas simulado e estorno ligado à origem, com confirmação manual de devolução. **A conciliação local NÃO confirma banco automaticamente; nenhum dinheiro real sai ou entra pelo módulo.** Código está fora de rotas HTTP; `CREDITO_CLIENTE` continua indisponível no PDV. Gates restantes: evidência bancária verificável e tratamento de saída, fiscal real, múltiplas unidades de mesmo CNPJ, staging/restore/canário. Detalhes no handoff e arquitetura M.4.

> **M.4B.1 em CI (14/10/2026):** orçamento aprovado pode virar **um único rascunho** no banco descartável `pointvet_unified_ci`, mediante mapeamento de catálogo auditável; **sem endpoint HTTP de conversão**, venda, cobrança, crédito, estoque, nota fiscal ou liberação para Pet King. Replay idempotente, isolamento de empresas, rollback e aprovação na UI apenas de **prévia**. Próximo gate M.4B.2: ledger de crédito comprovado, fiscal real, mesmo CNPJ/unidades; M.5: staging/restauração/canário. PR #36 segue Draft. Veja [arquitetura M.4](POINTVET_M4_FISCAL_ORCAMENTOS_ARQUITETURA.md).

> **M.4A em validação CI:** base de orçamentos auditados e crédito somente consulta adaptada do PR #35 para PR #36; prévia read-only de orçamento aprovado no PDV exige preço, empresa e catálogo idênticos. **Não habilita conversão, crédito como pagamento, fiscal real ou implantação.** Arquitetura e próximos gates: [POINTVET_M4_FISCAL_ORCAMENTOS_ARQUITETURA.md](POINTVET_M4_FISCAL_ORCAMENTOS_ARQUITETURA.md). A correção de desconto zero ainda exige o CI do último HEAD.

> **M.3C validada exclusivamente em CI em 14/10/2026**: [workflow 38640657139](https://github.com/isaquesan7/sistema-pet/actions/runs/38640657139) (jobs `validate` e `isolated-postgres` **SUCCESS**, SHA `ad77b5f60b9c0fc2f72747ce5c2175feb386a263`). Estorno total manual com trilha imutável por reserva, concorrência/idempotência, compensação de estoque/lote e caixa, bloqueio de parcelas conciliadas e fiscal **somente no banco descartável**. **Não é estorno bancário ou fiscal real**. PR #36 DRAFT; faltam M.4 (fiscal, Orçamentos/Crédito PR #35, mesmo CNPJ/múltiplas unidades) e M.5 (staging, backup restaurável e canário). Sem merge/deploy/migrations na Pet King.

> **STATUS VALIDADO M.3A/M.3B EM 14/10/2026**: fechamento manual multiempresa **somente CI descartável**, [run 38638213355](https://github.com/isaquesan7/sistema-pet/actions/runs/38638213355) com `validate` e `isolated-postgres` SUCCESS, commit `0a8f20cc33db2f0b4ae69638d961f9b972cce875`. Houve pagamentos e estoque **apenas no banco temporário do CI**, não na Pet King. Não é checkout de produção: faltam **estorno/compensação, conciliação de recebíveis, fiscal, Orçamentos/Crédito PR #35, mesmo CNPJ/múltiplas unidades, restore do backup e canário**. PR #36 DRAFT; sem merge/deploy/migrations reais. O roteiro histórico abaixo não revoga este bloqueio.

> **DECISÃO MAIS RECENTE (14/10/2026):** Fechamento MANUAL, **sem integração com PSP, adquirente ou maquininha**. O registro da forma de pagamento e confirmação da atendente é suficiente como fluxo do produto; autorização eletrônica não é automatizada. Este aviso sobrescreve todos os itens PSP obrigatórios da tabela histórica abaixo. Fonte: [POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md](./POINTVET_DECISAO_PAGAMENTOS_MANUAIS.md). Os testes financeiros/fiscais, segregação por CNPJ e auditoria **continuam necessários**. Não tratar PSP, webhooks, split ou sandbox de adquirente como bloqueio de lançamento.

# POINTVET — GATES OFICIAIS DE PUBLICAÇÃO DO PDV UNIFICADO

> **M.5.30 (16/10/2026) — MINUTA NÃO É APROVAÇÃO:** a [matriz de critérios técnicos CI](POINTVET_M530_MINUTA_POLITICA_DOCUMENTAL_CI.md) pode registrar apenas **referências sintéticas de controles** em memória, vinculadas ao plano M.5.29 e às áreas propostas. Mesmo 10/10 especificados não significa política, assinatura, base legal, prazo de retenção, auditoria de comprovante ou liberação operacional. Sem rotas, arquivos, armazenamento/descarte, financeiro ou emissão fiscal; provedor fiscal permanece adiado.

> **M.5.29 (16/10/2026) — GOVERNANÇA SEM DOCUMENTOS REAIS:** o [plano de custódia/retenção CI](POINTVET_M529_GOVERNANCA_EVIDENCIAS_CI.md) avalia o estado de pareceres M.5.28 por versão do dossiê e lista dez decisões pendentes de privacidade, autenticação, retenção/descarte e revisão contábil/fiscal por CNPJ. Não cria prova, arquivo, prazo legal, autorização de upload/descarte, estorno, nota fiscal, checkout ou operação financeira. Somente consulta interna no PostgreSQL descartável; sem HTTP. Provedor/motor fiscal ainda não escolhido.

> **M.5.28 (16/10/2026) — PARECER DOCUMENTAL SÓ CI:** a [trilha de revisão](POINTVET_M528_REVISAO_DOCUMENTAL_DEVOLUCOES_CI.md) guarda apenas metadados simulados com segunda pessoa e SHA informado, sem receber nem verificar comprovante verdadeiro. A existência do parecer NÃO comprova devolução, não autoriza dinheiro/checkout/documento fiscal, nem conclui a revisão independente real. A futura cadeia de custódia LGPD/documental, validação humana, política fiscal por CNPJ, staging e restore reais permanecem obrigatórias e dependentes de autorização. Motor fiscal segue adiado.

> **M.5.27 (16/10/2026) — DOSSIÊ NÃO É PROVA:** o [dossiê de conferência independente](POINTVET_M527_DOSSIE_CONFERENCIA_DEVOLUCOES.md) organiza registros de devolução para futura análise de dois responsáveis, mas NÃO valida comprovantes, não registra revisão concluída nem comprova dinheiro fora do PointVet. Nenhum checkout, reembolso, lançamento contábil ou operação fiscal foi liberado. Captura de evidências reais/LGPD, revisão humana, staging e restore reais continuam gates sujeitos a autorização; provedor/motor fiscal continuam adiados.

> **DECISÃO 15/10/2026 — MOTOR FISCAL ADIADO:** a escolha do provedor fiscal cabe ao proprietário e está pendente. Manter arquitetura fiscal neutra ([M.5.26](POINTVET_M526_PORTA_FISCAL_NEUTRA.md)) e previews M.4C/M.4D sem emitir, cancelar, reservar números, gerar XML ou integrar serviços externos. **Não bloquear o desenvolvimento de módulos não fiscais por falta do motor**; a liberação comercial de operações que exigem emissão fiscal segue bloqueada até escolha, integração e homologação legítima, além dos demais gates. PSP/maquininhas também não são parte do plano de integração atual.

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
| Caixa/empresa | Alocação conferida por empresa, sem cobrar | Forma informada pelo atendente e recebimento efetivo atribuído à empresa/CNPJ correto; sem split do sistema |
| Formas manuais (sem PSP) | Interface registra débito/crédito/dinheiro/Pix/transferência por empresa, com confirmação e caixa | Contrato auditável de atendente, parcelas, comprovante opcional, lançamento único e estornos seguros |
| Operação durável | Snapshot, chave de fechamento e bloqueio de duplicidade | Registro transacional idempotente de pagamentos e movimentos de caixa sem PSP, recuperação e reprocessamento seguro |
| Fiscal | Fluxo pré-planejado sem emissão | Documento separado por emissor/tipo, testes UF/município, autorização fiscal |
| Estoque | Comanda não dá baixa em sandbox | Baixa/estorno únicos e conciliados por empresa |
| Mesmo CNPJ em unidades distintas | Decisão de modelo jurídico operacional/documentada | Migração segura da restrição `Empresa.cnpj @unique` com matriz de casos |
| Segurança de lançamento | CI, PostgreSQL staging, review, restore em staging | Canário, backup restaurável, rollback, alertas e suporte |
| PDV individual | Continua funcionando com preferência desativada | Regressão E2E e migração reversível de preferência |

## 3. Bloqueios absolutos no momento
1. **PR #36** em DRAFT, sem checkout real. PSP e maquininha NÃO são dependência nem pré-requisito do novo fechamento.
2. **PR #35** em DRAFT: integrar Orçamentos/Crédito do Cliente; não descartar a ficha do tutor.
3. Unidades que compartilham CNPJ ainda não são suportadas no modelo atual (campo `Empresa.cnpj @unique`).
4. Registros MANUAIS de cartão/dinheiro/Pix por empresa, comprovação pelo atendente, idempotência, auditoria, estornos e conciliação contábil ainda não homologados.
5. Documentos fiscais separados por empresa/tipo, regras legais e testes de emissão ainda não homologados.
6. Backup restaurável, teste de rollback, monitoramento, canário e integração `main` sem divergências ainda pendentes.

## 4. Sequência recomendada
**Gate A — Read-only preview/staging:** validar PR #36, migrations, segurança, testes E2E no staging e manter o modo `checkoutHabilitado=false`. Pode ocorrer antes das etapas fiscais reais.

**Gate B — Beta comercial controlada:** recebimentos MANUAIS individuais por empresa/CNPJ com comprovantes opcionais, declaração e auditoria do atendente, idempotência/controle de caixa, fiscal por emissor, estoque/estorno, integração Orçamentos/Crédito conforme escopo, canário apenas em lojas piloto. **Sem PSP.**

**Gate C — Lançamento amplo:** onboarding multi-CNPJ/múltiplas unidades, observabilidade operacional, atendimento a incidentes, experiência consolidada e regressão para tenants que mantêm PDV individual.

## 5. Estimativa e comunicação
**Não existe ETA tecnicamente validada.** Uma estimativa de calendário depende da definição do PSP, emissor fiscal, desenho do mesmo CNPJ, testes com usuários e disponibilidade de homologação. Em atualizações de status, publicar evidência: commit SHA, CI do HEAD, ambiente, teste de contingência e último gate aprovado — nunca porcentagem inventada.

**PRIORIDADE ATUAL**: fase M.2 do recebimento manual multiempresa: persistência auditável e idempotente por operação, usuário, caixa, forma, parcelas e valor. Depois M.3, efetivação transacional dos lançamentos e estoque por empresa. Não lançar fechamento real com base apenas em contrato de teste.

## 6. Protocolo de release
- Aprovar integração com `main` somente após reviews e CI do SHA HEAD.
- Homologar migrations aditivas em banco restaurado a partir de cópia saneada; avaliar locking e duração.
- Testar tenants com flag desligada, empresa única, múltiplos CNPJs, mesmo CNPJ quando suportado, funcionário com acesso parcial e CNPJ sem PSP configurado.
- Garantir backups, rollback sem perder dados, métricas e alarme para pendência de autorização, reprocessamento e divergência fiscal.
- Documentar incidentes e comunicação ao cliente; ativar por grupo e capacidade de desligar checkout sem destruir vendas existentes.

> **Proibido confundir publicação do PointVet já existente com liberação do novo PDV Unificado.** O atual PDV permanece operacional independentemente dos gates acima.
