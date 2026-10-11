# PointVet 17.1 — Backup e recuperação (primeira entrega)

**Status:** ferramentas e procedimento preparados; **não é comprovante de backup executado nem de restauração concluída**.

## Inventário verificado em 11/10/2026
- Projeto Railway: Pet King DEV; ambiente interno chamado `production`, usado como desenvolvimento.
- Serviço PostgreSQL: imagem `ghcr.io/railwayapp-templates/postgres-ssl:18`.
- Volume: `postgres-volume`, 5.000 MB, montado em `/var/lib/postgresql/data`.
- API, admin, portal e Postgres estavam online.
- Não foi possível verificar pela integração atual a existência/configuração de backups gerenciados nem uma restauração já testada. Verificar **Backups** no volume do Railway manualmente. Volume persistente **não** é backup.

## Objetivos antes de declarar 17.1 concluída
1. Confirmar backups nativos do Railway, retenção e frequência no dashboard.
2. Definir RPO/RTO e retenção, destino de cópia separado e criptografia.
3. Executar `pg_dump` e armazenar a cópia fora do serviço e fora do GitHub.
4. Restaurar em banco **vazio e separado**, dedicado a testes; nunca no Pet King DEV.
5. Verificar integridade, tabelas, usuários de teste, referências, e exportar evidências sem dados pessoais.
6. Agendar backup e teste periódico de restauração usando executor autorizado, secret manager, alertas e política de rotação.

## Ferramentas (execução manual controlada)
Requer Node.js >=20, `pg_dump` e `pg_restore` instalados (versão compatível com PostgreSQL 18).

```bash
# Configure BACKUP_DATABASE_URL apenas no ambiente seguro (nunca no código/chat/logs).
node scripts/backup.mjs ./private-backups/pointvet-YYYYMMDD.dump
pg_restore --list ./private-backups/pointvet-YYYYMMDD.dump
```

O comando produz arquivo customizado, hash SHA-256 e manifesto simples. O backup deve ser protegido e transferido para armazenamento externo seguro, com retenção adequada. O repositório ignora `private-backups/` e `*.dump`.

Para restauração, crie **previamente** banco temporário vazio denominado `pointvet_restore_...`, com usuário restrito. Configure as duas URLs em variáveis de ambiente locais; nunca imprima segredos.

```bash
# RESTORE_DATABASE_URL deve apontar para o banco vazio e diferente.
# RESTORE_TEST_CONFIRM deve conter exatamente o nome do banco de teste.
node scripts/restore-drill.mjs ./private-backups/pointvet-YYYYMMDD.dump
```

A ferramenta rejeita identidade de banco igual (host, porta e nome), nome fora do padrão ou confirmação incorreta. Uma restauração correta **não garante** consistência funcional; validar manualmente e remover as cópias de teste após o exercício.

## Segurança e limites
- Não executar automaticamente contra a base Railway sem janela e destino aprovados.
- Nenhuma migration/seed e nenhum restore em banco existente.
- Não colocar credenciais em comandos, PRs, logs, issues nem compartilhar dumps com terceiros.
- Em caso de erro os scripts evitam reproduzir mensagens do PostgreSQL que possam incluir detalhes de conexão.
- O armazenamento de backup separado, agendamento e comprovação de restore ainda são **pendências** desta fase.

## Ensaio automatizado com dados sintéticos
- GitHub Actions cria PostgreSQL temporário, gera dump de registros fictícios, verifica SHA-256, restaura em banco separado e confirma contagem de registros.
- Confirma que uma segunda restauração em banco já preenchido é rejeitada.
- Execução aprovada: https://github.com/isaquesan7/sistema-pet/actions/runs/38156625635
- Este ensaio NÃO restaurou o snapshot real da Pet King e NÃO valida ainda recuperação da base PostgreSQL 18 do Railway.
- No Railway Pro, o usuário confirmou visualmente um snapshot de volume, agendamento de backup e PITR habilitado. Um teste real de restauração desses backups permanece pendente em serviço/banco isolado.
