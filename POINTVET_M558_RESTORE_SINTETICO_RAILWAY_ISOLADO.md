# PointVet M.5.58 — Backup/restore em PostgreSQL Railway descartável (20/10/2026)

## Resultado

**APROVADO — exercício operacional de banco temporário com dados inteiramente sintéticos.** O comando de `pg_dump` gerou um arquivo em formato custom; `pg_restore` restaurou-o em um segundo banco vazio no mesmo servidor PostgreSQL isolado. Os invariantes de registros, índices, quantidade de restrições, sequências e operação fictícia de estorno foram comparados e coincidiram. **Não** é uma restauração de backup completo do banco PointVet nem um RTO/RPO operacional de um incidente real.

A proprietária autorizou criar um banco temporário isolado em 20/10/2026, com dados apenas fictícios, sem utilizar ou alterar a produção. Para evitar conexão acidental ao banco da Pet King, foi criado um **projeto Railway independente** chamado `PointVet-DR-Sintetico-M558` (projeto `11a9be9f-7635-4e74-96f9-0c48d77242c9`). O nome do ambiente gerado automaticamente pelo Railway nesse projeto foi `production`, mas **não corresponde** ao projeto comercial da Pet King.

## Escopo e proteção

- Infra temporária: PostgreSQL do template Railway (`ghcr.io/railwayapp-templates/postgres-ssl:18`, servidor **PostgreSQL 18.6**), instância temporária `f12733dc-4d38-4785-a536-3a336b580277`; job executor `7e2ddd77-5fd1-4e3e-a36b-7defeadb0a4f` com imagem `postgres:18-alpine`.
- O executor recebeu apenas referências internas de variáveis do serviço **Postgres do projeto temporário**. O script recusava `PGHOST` fora de `*.railway.internal`, exigia `RAILWAY_PROJECT_ID` exatamente igual ao ID explicitamente permitido e recusava nomes de banco já existentes.
- Apenas dois bancos recém-criados, `pointvet_synthetic_source` e `pointvet_synthetic_restore`; nenhum `DATABASE_URL` ou credencial da Pet King, nenhum dump enviado para fora do contêiner, nenhuma requisição à API comercial, nenhum pagamento, PSP, sistema fiscal ou e-mail.
- Script auditável e reutilizável: [`api/scripts/pointvet-railway-synthetic-drill.sh`](api/scripts/pointvet-railway-synthetic-drill.sh), primeiro commit `c9883632ff2ca5a4e3de1864aafb7305851ba5f7`. Verificado com `sh -n` localmente antes de publicar; execução real validou o script.

## Evidência da execução

Deploy executor `0ea02b49-a454-487e-93c5-841bd9c8d20b` no projeto temporário:

```text
2026-10-20T15:12:06.951Z POINTVET_DRILL_START: project=11a9be9f-7635-4e74-96f9-0c48d77242c9 source=pointvet_synthetic_source target=pointvet_synthetic_restore pg_version=18.6 (Debian 18.6-1.pgdg13+2)
2026-10-20T15:12:07.079Z POINTVET_DRILL_SUCCESS: dump_bytes=9414 backup_seconds=0 restore_seconds=0 table_count=4 company_count=2 sales=2 refunds=1 grams_refunded=333 sha256=fce430ee9bdb92d1
2026-10-20T15:12:07.079Z POINTVET_DRILL_SCOPE: PostgreSQL TEMPORARIO; sem acesso a bancos Pet King staging/producao
```

O SHA exibido é um **prefixo de 16 caracteres** do hash SHA-256 do arquivo; o script comparou o hash completo localmente antes de validar os dados. O dump continha quatro tabelas **criadas para o teste**: `empresas`, `produtos`, `vendas`, `estornos`; duas empresas com CNPJs artificiais (`000...0`, `111...1`), duas vendas fictícias (R$ 5,00 de 333 g + R$ 10,00 de serviço) e um estorno que restitui os exatos 333 g. O estoque lógico passou de 1.000 g para 667 g e retornou a 1.000 g. Não são tabelas exportadas do sistema real.

A granularidade de `date +%s` arredondou backup/restore da fixture mínima a **0 segundo**; os logs do Railway evidenciam a execução em menos de um segundo, mas **não** fornecem RTO de banco operacional nem RPO de backup armazenado. Não generalizar esse tempo para o PointVet real.

## Descarte completo dos recursos de teste

Após capturar o resultado, foram removidos **apenas** no projeto temporário:

1. Executor `7e2ddd77-5fd1-4e3e-a36b-7defeadb0a4f`.
2. Serviço PostgreSQL `f12733dc-4d38-4785-a536-3a336b580277`.
3. Volume `postgres-volume` `64503b74-d385-4560-bea5-8b49734daed7`, contendo somente fixture sintética. A eliminação do volume é permanente.

Leitura posterior de `railway_list_services` e `railway_environment_status` mostrou o projeto de ensaio **0 serviços, 0 pendingWork**, sem volume usado; a estrutura vazia do projeto permanece. Os projetos reais foram verificados separadamente após o descarte: **Pet King PDV Homologacao 4/4 saudáveis**; **Pet King DEV/produção comercial 8/8 saudáveis**, sem alterações.

## Limites e próximo gate

A M.5.57 já comprovou reimplantação de versões de aplicação. A M.5.58 comprova que o operador consegue montar e **executar** um ciclo real de `pg_dump`/ `pg_restore` na infraestrutura Railway com credenciais internas de um projeto descartável, dados fictícios, checksum e invariantes básicos de PDV multiempresa.

**Gate 2 do plano [M.5.47](POINTVET_M547_HOMOLOGACAO_OPERACIONAL_E_PILOTO.md) permanece PARCIAL:** falta restaurar, sob aprovação específica e destino segregado, um backup com o **esquema completo PointVet** e massa de dados sintética representativa, confirmar migrations, relações, histórico financeiro, políticas de acesso e integridade de lotes; aferir RTO/RPO realistas para volume significativo. O CI existente já exercita restore do esquema integral PostgreSQL 16, mas isso também não substitui aceite operacional. Nenhuma cópia de banco da Pet King ou dados pessoais é autorizada por este relatório.

**Publicação comercial ainda bloqueada** por aceite com atendente/supervisor, regras fiscais/contábeis e decisão nominal de piloto. PR #36 segue **DRAFT**; checkout/estorno de contingência não foram ativados neste trabalho.
