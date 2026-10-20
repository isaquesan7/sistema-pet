# PointVet M.5.60 — volumetria sintética, backup e restore Railway (20/10/2026)

## Resultado / segregação

**APROVADO no exercício sintético. Gate 2 ainda PARCIAL.** Utilizado o esquema real do PointVet com 46 migrations num PostgreSQL 18.6 de projeto Railway descartável, separado da Pet King. **Nenhum cliente, pet, CNPJ, pagamento ou documento fiscal real foi acessado ou alterado.** O ambiente Railway recebe internamente o nome production, mas pertence exclusivamente ao projeto de teste PointVet-DR-Sintetico-M558 (ID 11a9be9f-7635-4e74-96f9-0c48d77242c9), ambiente 0eaad312-8da1-41da-9132-170dc41c5515.

Todos os scripts verificam o ID exato do projeto, o banco descartável pointvet_unified_ci, o endereço privado Railway e escopo de dados fictícios; proíbem reutilização e sobrescrita do destino de restauração. O seeder preserva NODE_ENV=test, POINTVET_UNIFIED_SALES_SANDBOX=1 e gates de checkout/contingência desabilitados.

## Procedimento executado

1. O seeder M.5.59 executou as 46 migrations Prisma e aprovou quatro suítes reais de integração (PDV multi-CNPJ, crédito do cliente, fiscal, migração fiscal). Fixtures: 9 empresas fictícias, 18 vendas, 4 estornos, 2 fluxos fiscais, 5 eventos e 3 movimentos de 0,333 kg. Deploy: 8e9c51bf-667b-454c-baae-4ec8be7ba8df.
2. Uma única transação de carga criou **550.000 registros fictícios** nas tabelas reais, com tutor/pet vinculados e vendas em **duas empresas sintéticas**; pagamentos PIX, dinheiro e cartão são exclusivamente registros simulados, sem provedores.
3. Após o marcador M560_READY, executou-se backup com pg_dump -Fc, checksum SHA-256, criação de banco **novo** pointvet_m560_full_restore e pg_restore --exit-on-error. A fonte foi preservada.
4. Foram comparados fingerprints determinísticos de **cada linha de todas as 120 tabelas públicas**, índices, constraints, sequências, views, triggers e histórico de migrations. Também se verificaram os 150.000 vínculos venda/pagamento, identidade de valores, dois CNPJs fictícios, os 4 estornos e pesos por lote de 333 g, e um BEGIN/UPDATE/ROLLBACK conferido novamente por fingerprint.

| Tabela real | Novas linhas |
| --- | ---: |
| clientes | 50.000 |
| pets | 50.000 |
| vendas | 150.000 |
| venda_itens | 150.000 |
| pagamentos | 150.000 |
| **Total** | **550.000** |

Loader Railway: 3b68ff4d-98ae-45bc-90a0-f6b39ff8bf79, marcador POINTVET_M560_VOLUME_SUCCESS, load_seconds=26, database_bytes=205764287, two_issuers=true.

## Evidências de restore

Executor final Railway: **9ee5038d-5d92-4bb8-ab7e-9ca59b76f45e**. Marcadores POINTVET_M560_RESTORE_ROW_CHECK_SUCCESS e **POINTVET_M560_LARGE_RESTORE_SUCCESS**.

| Métrica medida | Resultado |
| --- | ---: |
| Linhas sintéticas adicionadas | 550.000 |
| Tabelas públicas conferidas | 120 |
| Migrations concluídas | 46 |
| Estornos íntegros | 4 |
| Banco fonte no backup | 205.919.935 bytes |
| Banco após restore | 200.095.423 bytes |
| Dump compacto | 20.023.835 bytes |
| Tempo de pg_dump | **3 segundos** |
| Tempo de pg_restore | **14 segundos** |
| Prefixo checksum SHA-256 | 2418e49b22c74c08 |

Os tamanhos físicos dos bancos diferem normalmente após reconstrução; a prova de equivalência foi pelos dados, relações, objetos SQL, migrations e operações de estorno, não pelo tamanho em disco.

### Incidente de performance detectado e corrigido

Logo após a inserção em massa, a primeira checagem relacional de 150 mil pagamentos selecionou um plano de execução patológico, observável no pg_stat_activity por mais de 270 segundos. Não houve divergência dos dados. Foi cancelada **somente essa consulta no banco descartável**. Após ANALYZE das tabelas volumosas, a mesma associação devolveu as 150.000 linhas em menos de 30 segundos. Foi introduzido ANALYZE nos scripts para estabilizar o planejamento; o restore foi então reiniciado, com destino ainda inexistente, e **aprovado**. A primeira tentativa cancelada não conta como aprovação.

### Código reprodutível na branch oficial

- api/scripts/pointvet-m560-volume-synthetic.sh — versão corrigida no commit 4621dd5cba620b44f3a45fba86ab4cb4eb3be9be.
- api/scripts/pointvet-m560-volume-restore.sh — versão corrigida no commit 0fff61bcf009a8b9f21f7d290f16953e35792b70.
- Reutilizados o seeder e Dockerfile de M.5.59, sem mudança nos apps da Pet King.

## Descarte

Foram excluídos exclusivamente do projeto de teste: seeder 9166d690-82e6-492d-b4b5-10c35dcbd69f, loader 418f6d8b-e8c9-4b9c-9ce1-02bd2b074de9, restore 8591e047-2afd-4acd-a5f2-6c88e84d8af2, probe 0e049c2b-60da-4357-b556-528e232603bb, Postgres c8dc07d3-5bb4-4674-beca-88e8fcac36d1 e volume **inteiramente fictício** 79cebee8-c820-4034-9d10-fae9ca3776ab. A eliminação do volume é irreversível.

**Confirmação pós-limpeza:** Railway describe_environment e environment_status retornaram **0 serviços, 0 volumes, 0 alterações pendentes e 0 falhas**. A estrutura vazia do projeto descartável foi mantida. Os projetos externos não sofreram deploys: **Pet King Homologação 4/4 saudável** e **comercial 8/8 saudável**.

## Limites / próximos gates

**Gate 2 continua PARCIAL**: os tempos de 3 s e 14 s são exclusivamente da base sintética no Railway e **não representam RTO ou RPO de produção**. Não se restaurou backup real da Pet King nem se validou retenção, histórico de backup criptografado, janela de manutenção, incidente com usuários reais, emissão fiscal externa ou reconciliação bancária real. Para ensaiar backup comercial são necessárias autorização específica de fonte, destino, acesso e janela.

Antes de liberar PDV: aceite de atendente/supervisor; validação fiscal e contábil; aprovação nominal do canário. **PR #36 permanece DRAFT**, checkout manual e contingência OFF. Consulte POINTVET_M559_RESTORE_INTEGRAL_RAILWAY_ISOLADO.md e POINTVET_CONTINUIDADE_OFICIAL.md para histórico.
