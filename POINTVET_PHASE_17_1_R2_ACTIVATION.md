# PointVet 17.1 — Ativação do worker externo R2

## Estado confirmado
- Serviço Railway `pointvet-backup-worker` criado no projeto Pet King DEV.
- Variáveis R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY cadastradas, mas **pendentes de aplicação (staged)** na inspeção de 11/10/2026.
- Sem deployment/source; **nenhum backup enviado** ao R2.
- Backup/PITR nativo do Railway já habilitado e restauração PITR testada.

## Próximos portões
1. Usuário aplica alterações de variáveis no Railway ("Deploy" / "Apply changes") sem afetar API/Postgres.
2. Configurar criptografia client-side antes de enviar. Recomendado: age com chave pública no worker (`BACKUP_AGE_RECIPIENT`) e chave privada custodiada **fora do Railway** em cofre seguro, com cópia de recuperação offline. Nunca colocar a privada no Railway, GitHub ou ChatGPT.
3. Implementar worker separado em branch controlada, com `pg_dump` compatível ao PostgreSQL 18, stream cifrado, upload S3 R2 e alerta de erro. Configuração de URL somente via referência segura do Railway e conta de acesso leitura, com restrições adequadas.
4. Testar ponta a ponta com base sintética e bucket de teste antes de habilitar acesso ao Postgres real.
5. Criar cron diário, verificar um backup cifrado real e ensaiar restauração em banco isolado usando a chave offline.
6. Configurar retenção, limitação de despesas e alertas.

## Não fazer
- Não adicionar `DATABASE_URL` da API ao worker antes de passar os testes.
- Não imprimir segredos, nem salvar dumps reais no repositório.
- Não fazer upload de dump em claro.
- Não apagar objetos existentes ou alterar o volume original.
