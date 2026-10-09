# PetRise 16.0 — Segurança, LGPD e Arquivos

## Entregue nesta fase

- Railway Object Storage privado preparado para arquivos do tenant.
- URLs assinadas temporárias para leitura de arquivos privados.
- Upload controlado pelo backend com allowlist de MIME e limite configurável.
- Registro central `ArquivoPetRise`, isolado por organização e com referências opcionais a empresa, cliente e pet.
- Exportação LGPD do titular em JSON privado, com rastreabilidade da solicitação.
- Anonimização controlada do tutor, com revogação das sessões do portal e preservação dos históricos clínico, financeiro, fiscal e operacional.
- Trilhas de auditoria consultáveis pelo painel administrativo.
- Redação automática de chaves sensíveis (senha/token/secret/certificado) antes de persistir dados de auditoria.
- Política de retenção e contato LGPD configuráveis por organização.
- Novas permissões: `seguranca.auditoria`, `arquivos.gerenciar`, `lgpd.gerenciar`.
- Tela administrativa **Segurança e LGPD**.

## Migration

`20261009190000_security_lgpd_files`

## Variáveis Railway da API

As credenciais do bucket devem ser referências Railway, não valores copiados para `.env`:

- `STORAGE_PROVIDER=railway_s3`
- `STORAGE_ENDPOINT=${{petrise-files-dev.ENDPOINT}}`
- `STORAGE_BUCKET=${{petrise-files-dev.BUCKET}}`
- `STORAGE_REGION=${{petrise-files-dev.REGION}}`
- `STORAGE_ACCESS_KEY_ID=${{petrise-files-dev.ACCESS_KEY_ID}}`
- `STORAGE_SECRET_ACCESS_KEY=${{petrise-files-dev.SECRET_ACCESS_KEY}}`
- `STORAGE_URL_STYLE=virtual-host`
- `STORAGE_SIGNED_URL_TTL_SECONDS=300`
- `STORAGE_MAX_UPLOAD_MB=15`

## Implantação

Depois de publicar esta versão no GitHub:

```powershell
cd api
railway run npm run db:deploy
railway run npm run db:seed
```

O seed é necessário para inserir as três novas permissões e sincronizá-las com o cargo Administrador.
