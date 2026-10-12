# PointVet 17.1 — Ensaio local de recuperação do backup real

## Objetivo
Recuperar o arquivo cifrado já armazenado no R2 usando a **chave privada somente no Windows do responsável**, e restaurar o dump em um **PostgreSQL 18 isolado em Docker local**. Nenhum dado ou chave privada é enviado ao Railway/GitHub/ChatGPT. Não publicar resultados com dados pessoais.

## Pré-requisitos
- Windows com PowerShell, `age.exe` e **Docker Desktop** instalado e em execução.
- Arquivo privado `pointvet-backup-key.txt` guardado localmente. **Nunca fazer upload da chave privada**.
- Baixar **manualmente** do Cloudflare R2 (bucket privado `pointvet-backups`) o objeto:
  `postgres/daily/pointvet-20261012T021827Z-726-3784.dump.age`
- O download do R2 deve preservar o arquivo cifrado, sem torná-lo público. Não criar links públicos ou tornar o bucket público.
- Obter o script `backup-worker/scripts/restore-local.ps1` da branch da Fase 17.1.

## Execução
Com a pasta de trabalho e caminhos locais corretos, no PowerShell:

```powershell
.\restore-local.ps1 -EncryptedBackup 'C:\CAMINHO\pointvet-20261012T021827Z-726-3784.dump.age' -PrivateKey 'C:\CAMINHO-SEGURO\pointvet-backup-key.txt' -AgeExe 'C:\CAMINHO\age.exe'
```

O script: valida ferramentas, descriptografa temporariamente **no Windows local**, cria um PostgreSQL 18 Docker sem publicar portas, restaura, conta tabelas do schema public, remove contêiner e dump temporário em bloco `finally`.

## Precauções
- Como o dump descriptografado contém dados reais, usar disco criptografado (BitLocker/Device Encryption) e máquina confiável, sem sincronização automática da pasta temporária.
- Arquivo de dump apagado ao fim normalmente não implica eliminação forense; manter criptografia integral do disco.
- A imagem `postgres:18-bookworm` será baixada pelo Docker se ainda não estiver local.
- Se a restauração falhar, **não** classificar o backup como recuperável nem habilitar cron.
- Depois da restauração bem-sucedida, fazer comparação das contagens críticas com uma consulta de leitura no banco original: clientes, assinatura SaaS, atendimento clínico e migrations. Não enviar dados pessoais nos prints.
- O teste pode exigir ajustes se houver roles/extensões específicas; não adaptar com direitos administrativos no banco original.

## Estado
Script de restauração preparado no GitHub. Ainda **não executado** na máquina do usuário. Restore drill com backup real é pendência aberta; agendamento de backup continua desativado.
