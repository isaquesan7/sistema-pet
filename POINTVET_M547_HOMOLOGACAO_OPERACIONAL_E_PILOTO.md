# PointVet M.5.47 — Caminho mais curto para homologar o PDV de gestão

**Escopo:** venda e estorno 100% manuais; nenhum motor fiscal, balança/leitor conectado, PSP, TEF, emissão ou estorno bancário. Branch PR #36 **Draft**. Este arquivo é um procedimento de execução e aceite, não uma autorização de deploy ou piloto.

## Situação objetiva dos quatro gates

| Gate | Evidência automatizada disponível | Evidência externa ainda necessária |
| --- | --- | --- |
| 1. Staging isolado | Contratos de isolamento M.5.2, smoke HTTP/TLS M.5.4.4, testes PostgreSQL descartáveis | Identidade real do projeto, serviços, banco, domínio, dados sintéticos e e-mail sink; autorização para criar/verificar ambiente |
| 2. Backup/restore/rollback | `ci-pointvet-backup-restore-drill.sh`: pg_dump/pg_restore PostgreSQL 16 para **outro banco CI**, dados e esquema inteiros, migrations, rollback de transação; agora confere vendas estornadas e compensações por lote | Restaurar backup **autorizado e não produtivo ou devidamente tratado** em staging independente, validar fonte/checksum/LGPD e medir RTO/RPO; ensaiar rollback da **aplicação** e flags |
| 3. Homologação dos atendentes | E2E HTTP completo: catálogo → comanda → pré-fechamento → reserva → conferência → preparação → venda → reabertura → estorno; dinheiro/Pix/transferência, dois CNPJs, 333 g, falta de estoque e repetição sem dupla cobrança | Atendente e supervisor executarem os cenários com dados fictícios em staging real, conferir caixa e inventário e assinarem aceite |
| 4. Piloto por CNPJ | Flags OFF por padrão, allowlists exatas, preferência por organização e permissão por CNPJ; kill switch simulado no E2E | CNPJs/organização escolhidos, responsável, janela, fiscal/contábil externo aplicável e autorização nominal para habilitar somente esse lote após gates 1–3 |

**Não marcar gates 1, 2 ou 4 como concluídos pela execução de CI.** A ausência de staging/backup e autorização é uma dependência externa, não uma falha de código. Gate 3 tem automação completa em CI, mas aceite humano ainda não ocorreu.

## 1 — Preparar staging segregado

O proprietário indica o projeto/ambiente dedicado, três URLs de API/admin/portal e quem pode operar; não copiar credenciais ou registros reais ao repositório/issue. Separar de produção: banco/cluster, storage, serviços, fila e e-mail sink. Dados **sintéticos**, comunicação externa/fiscal/PSP desabilitada e flags `POINTVET_UNIFIED_MANUAL_CHECKOUT_*` OFF. Registrar commit SHA completo da PR, hashes das migrations e responsáveis.

Com o staging identificado e autorizado, usar a ferramenta **já existente** (não criar uma segunda):

```sh
POINTVET_STAGE_COMMIT_SHA=<sha40> \
POINTVET_STAGE_API=https://api.staging-dominio-aprovado.tld \
POINTVET_STAGE_ADMIN=https://admin.staging-dominio-aprovado.tld \
POINTVET_STAGE_PORTAL=https://portal.staging-dominio-aprovado.tld \
POINTVET_STAGING_SMOKE_CONFIRM=STAGING_READONLY_APPROVED \
node api/scripts/pointvet-staging-readonly-smoke.mjs --run-readonly
```

Os endereços são placeholders: **não executar** com domínios fictícios/produção. O smoke verifica HTTPS, health, auth 401 e 404, mas sozinho não atesta segregação de recursos ou titularidade dos domínios. Fazer inspeção independente dos IDs reais sem imprimir segredos.

## 2 — Restaurar sem afetar produção

Antes de uma restauração real, aprovar a **origem exata** do backup e seu tratamento de dados (LGPD); confirmar destino novo e vazio, credenciais restritas, checksum original, acesso ao storage, retenção e procedimento de parada. Backup de produção não pode ser restaurado automaticamente em staging.

Executar pg_dump/pg_restore somente com operador responsável e alvo permitido; comparar tabelas, índices, constraints, sequências, migrations e relações entre empresas/caixas/vendas/estoques. **Medir tempo RTO** da recuperação e **idade RPO** da cópia, registrar evidência sanitizada; testar aplicação com a flag desligada. Fazer ensaio separado de retorno ao release anterior e da preferência `pdvUnificadoHabilitado=false`. Rollback de transação PostgreSQL do CI não substitui rollback de release/backup. O script CI é intencionalmente incapaz de escrever em Railway/staging/produção.

## 3 — Aceite operacional com duas pessoas

Em staging autorizado e com dados sintéticos, atendente e supervisor devem registrar data/versão/resultado de cada cenário abaixo. **Nenhum pagamento real nem nota fiscal** durante a homologação:

1. Abrir caixas corretos em dois CNPJs; selecionar tutor fictício, ração a R$15/kg e serviço de R$10 no outro CNPJ.
2. Digitar **R$5,00** de ração a granel; visualizar **333 g**, totalizar R$15,00 no conjunto; conferir lote/saldo inicial de 1,000 kg.
3. Dividir loja em **R$3 dinheiro + R$2 Pix**, outro CNPJ em **R$10 transferência**, marcar cada recebimento realizado externamente de forma *fictícia* no staging; confirmar fechamento único.
4. Conferir duas vendas-filhas, pagamentos no CNPJ correto, caixa e baixa exata **0,333 kg** no lote; nenhuma emissão fiscal. Reabrir comanda e comprovar que não surge segunda venda/cobrança.
5. Repetir o POST idêntico (idempotência); tentar valor divergente/usuário sem permissão (negativa); vender 0,900 kg com saldo 0,667 kg (rollback sem venda/pagamento/estoque parcial).
6. Registrar estorno integral **com devolução externa apenas simulada no ambiente sintético**; conferir duas vendas e três pagamentos estornados e lote/saldo restituídos a **1,000 kg**; repetir (não duplica) e tentar modificar motivo (conflito).
7. Desligar a flag/preferência de teste e demonstrar retorno ao PDV individual, sem afetar outra organização. Confirmar que comanda estornada não pode ser faturada de novo.

Se houver cartão conciliado, caixa já encerrado ou documento fiscal associado, **não forçar estorno**: o backend exige revisão manual. Anotar identidade do atendente/supervisor, status por cenário, screenshot sem dados reais, divergências, plano de reversão e aceite ou reprovação.

## 4 — Preparar e, só depois, autorizar piloto

O responsável registra: organização e lista exata de empresas/CNPJs, loja/unidade (mesmo CNPJ em múltiplas unidades excluído), quem aprova e quem reverte, versão/commit, janela, evidências assinadas dos gates 1–3, backup/alertas, rotina externa fiscal/contábil aplicável por CNPJ/UF/município, contatos de suporte e critérios de parada (erro HTTP, venda duplicada, estoque negativo, caixa divergente, ausência de backup ou erro de isolamento).

Somente **após autorização explícita adicional** definir `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED=1`, `POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS` e `POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS` restritos ao lote e preferência da organização. Sem aprovação, manter todos OFF. A reversão imediata para **novas vendas** é desligar o gate/preferência; **estornos de vendas já existentes precisarão de procedimento financeiro manual supervisionado se o gate for desligado**, porque a API de estorno também falha fechada. Verificar recuperabilidade antes de ativar canário.

Nenhum dos quatro itens dispensa obrigações fiscais/contábeis externas aplicáveis. A emissão de notas dentro do PointVet será outra fase, após escolha de provedor pelo proprietário.

## Regra de atualização da Issue #37

Anexar somente identificadores/URLs públicos e evidência sanitizada: commit SHA, Actions run, staging (sem segredos), versão de migrações, RTO/RPO, checklist assinado de operação, org/CNPJs autorizados e decisão explícita. Informar separadamente **CI aprovado**, **staging validado**, **operadores aprovaram** e **piloto autorizado** — nunca inferir os três últimos do primeiro.
