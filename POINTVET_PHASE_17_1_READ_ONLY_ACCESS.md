# PointVet 17.1 — Conexão de leitura para o primeiro backup real

**Estado:** worker R2 testado com payload sintético. Banco real ainda não conectado; backup diário desabilitado. O usuário deverá executar as etapas de preparação do usuário SQL com privilégios administrativos no Console do **Postgres original**.

## Antes da execução
1. Confirmar que há snapshot/PITR ativo e que o banco selecionado é o Postgres original.
2. Criar credencial dedicada e exclusiva para backup, com senha forte criada e guardada diretamente no gerenciador seguro do Railway. **Não compartilhar a senha no chat ou GitHub**.
3. O papel deve ter apenas `CONNECT`, `USAGE` nos schemas necessários e `SELECT` nas tabelas/sequências atuais e futuras. Fazer a concessão para cada schema da aplicação; permissões futuras são dependentes do papel criador dos objetos. Verificar se políticas RLS exigem configuração adicional e se a cópia inclui todos os dados pretendidos.
4. Montar `BACKUP_DATABASE_URL` como variável **somente do worker**, nunca do frontend. Usar conexão privada Railway e TLS conforme configuração do servidor.
5. Revalidar se `BACKUP_MODE=check`, `BACKUP_EXECUTION_ENABLED=NO`, e não configurar cron antes do primeiro teste controlado.

## Consultas para inspecionar papéis e schemas (somente leitura)
```sql
SELECT current_database(), current_user;
SELECT nspname FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema';
```

## Criação do papel (exemplo; revisão necessária para os schemas efetivos)
```sql
CREATE ROLE pointvet_backup LOGIN PASSWORD '<GERAR_E_INSERIR_APENAS_NO_CONSOLE>';
GRANT CONNECT ON DATABASE railway TO pointvet_backup;
GRANT USAGE ON SCHEMA public TO pointvet_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pointvet_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pointvet_backup;
-- Para objetos futuros, conceder ALTER DEFAULT PRIVILEGES FOR ROLE <criador>
-- somente após identificar os papéis responsáveis pelas migrations.
```

**Atenção:** adapte o nome do banco e os schemas a partir das consultas. Não execute esse exemplo sem revisar os nomes e sem conferir as políticas de RLS. Prefira criar a senha com operação segura diretamente no painel/console, sem registrá-la em comandos compartilhados.

## Critérios do primeiro backup
- Teste temporariamente `BACKUP_MODE=run` apenas em execução controlada e `BACKUP_EXECUTION_ENABLED=YES`; desative logo após.
- `pg_dump` sem erro, `age` sem erro, upload confirmado e tamanho conferido por HEAD.
- O arquivo deve aparecer como `.dump.age` sob `postgres/daily/` no bucket R2, sem acesso público.
- Verificar recuperação de uma cópia real em banco novo e separado antes de agendar a rotina diária.
- Nenhum objeto claro/dump sem criptografia deve ser enviado ou publicado.

## Primeiro backup real — resultado de 2026-10-12 UTC
- Verificação de permissões: 84 tabelas em `public`, todas com `SELECT` para `pointvet_backup`.
- Worker executou `pg_dump` em custom format com criptografia `age` antes do upload ao R2.
- Bucket: `pointvet-backups`; objeto: `postgres/daily/pointvet-20261012T021827Z-726-3784.dump.age`.
- AWS CLI reportou sucesso e HEAD confirmou comprimento idêntico ao arquivo cifrado local.
- Worker devolvido a `BACKUP_MODE=check`, `BACKUP_EXECUTION_ENABLED=NO`, `R2_PROBE_ENABLED=NO`; implantação concluída com log de pré-requisitos e nenhum acesso ao banco.
- **Pendente:** recuperar o objeto e ensaiar `age -d` + `pg_restore` em PostgreSQL isolado, comparando contagens e estrutura. Não agendar até validar recuperação. A chave privada deve permanecer fora do Railway.
- **Pendente:** evidência formal de retenção, notificações e cobertura de tabelas futuras.
