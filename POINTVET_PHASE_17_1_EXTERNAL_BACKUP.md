# PointVet 17.1 — Backup independente: decisão e execução segura

## Objetivo
Complementar snapshot e PITR do Railway com **backup lógico criptografado fora da conta/projeto Railway**, validável mesmo se o workspace ficar inacessível. Nenhum dado real foi copiado por esta documentação.

## Requisitos antes de ativar
- Contratar/configurar armazenamento S3 compatível em **outra conta/provedor**, com acesso privado, versionamento e retenção documentada. Um bucket no mesmo projeto Railway não atende à independência requerida.
- Criar identidade de escrita com escopo mínimo para o prefixo de backup, sem permissão de apagar backups existentes; separar credenciais de leitura/restauração.
- Definir uma chave de criptografia assimétrica (ex.: `age`) sob custódia segura e plano de recuperação da chave; testar descriptografia usando uma segunda máquina autorizada.
- Definir RPO/RTO com responsável da Pet King e periodicidade/retenção. Proposta inicial: diário, 7 diários/4 semanais/3 mensais, com teste de restauração mensal.
- Garantir que logs, manifestos e relatórios não incluam connection strings, PII ou segredos.

## Fluxo técnico proposto
1. Em executor isolado e autorizado, criar dump lógico **somente leitura** com `pg_dump` versão compatível ao PostgreSQL 18.
2. Validar o arquivo com `pg_restore --list` e checar SHA-256.
3. Criptografar **antes de enviar** ao provedor externo. Preferir fluxo streaming sem persistir dump desprotegido; qualquer arquivo temporário deve estar em volume cifrado e ter limpeza garantida.
4. Enviar objeto cifrado com chave única por execução, política de retenção e verificação de upload (tamanho/hash).
5. Emitir apenas resumo (data/hora, sucesso, tamanho, hash do arquivo cifrado, versão do utilitário); configurar alerta se backup falhar ou se faltar execução esperada.
6. Em periodicidade definida, baixar e descriptografar em ambiente controlado, restaurar em banco isolado e conferir integridade.
7. Excluir ambientes temporários ao concluir, após registrar evidências.

## Proteções
- Jamais conectar a API PointVet a um serviço de recuperação.
- Nunca enviar dumps reais ao GitHub, ChatGPT, logs, chats ou CI.
- Não criar cópias públicas, nem deixar credenciais em variáveis de build exibidas por PR.
- Usar backups nativos e PITR do Railway como primeira camada, **não substituí-los**.
- Não programar execução automática até confirmar destino externo e material criptográfico.

## Evidências da Fase 17.1
- PITR do Railway habilitado e snapshot de volume criado, conforme painel fornecido pelo usuário.
- Restauração PITR criou PostgreSQL temporário com quatro contagens coincidentes com a origem (2 clientes, 1 assinatura, 1 atendimento clínico, 15 migrations).
- Serviço e volume temporários posteriormente eliminados; banco original e serviços permaneceram online.
- **Pendente:** armazenamento externo independente, rotina de upload cifrado, agendamento, primeira cópia externa e restauração dessa cópia.
