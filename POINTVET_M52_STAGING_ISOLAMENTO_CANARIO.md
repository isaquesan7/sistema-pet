# PointVet M.5.2 — Plano de isolamento de staging, monitoramento e canário somente CI

**Situação:** preparado em branch e testado apenas com metadados fictícios. **Não foi criado ou acessado ambiente staging da Railway e não foi utilizado backup real.** Esta etapa NÃO executa deploy, migrations, restauração externa, envio de mensagens, nota fiscal ou movimentação financeira.

## 1. Mapa de isolamento (somente metadados sem credenciais)

Arquivos:
- `api/src/modules/plataforma/pointvet-m52-isolamento.contract.js`
- `api/tests/pointvet-m52-isolamento.contract.test.mjs`

O contrato recebe manifestos sanitizados com referências da organização e do ambiente esperado. Nenhuma URL PostgreSQL, segredo, certificado, password, API token ou chave pode ser incluído. A revisão é **comparativa e declaratória**, não consulta Railway/Hostinger/Resend/R2 nem comprova existência de recursos. Retorna fingerprint do checklist, pendências e sempre `stagingCriado=false`, `stagingValidadoRealmente=false`, `backupRealRestaurado=false`, `publicacaoAutorizada=false` e `permitirDeploy=false`.

Valida de maneira fail-closed, para referências enviadas manualmente:
- nome de ambientes distinto (`staging` / `production`), projeto Railway e environmentId distintos;
- isolamento completo de Postgres por cluster, hostname e databaseName. Um segundo schema ou database no mesmo cluster NÃO satisfaz a configuração segura estipulada nesta fase;
- bucket de objetos diferente, URIs HTTPS públicas de API, painel e portal distintas das de produção e umas das outras;
- envio de e-mails para **sink isolado** apenas (`sink-only`), webhooks externos desligados, provedor fiscal em simulador offline, pagamentos exclusivamente manuais e locais;
- somente dados sintéticos, nunca importar dados reais ou backup de clientes automaticamente; desabilitar emissão fiscal, crédito no checkout, PSP/TEF/maquininha, canário, rollout automático e PDV unificado por padrão;
- todos os flags experimentais explicitamente falsos. Qualquer metadado ausente ou perigoso causa pendência.

**Risco residual:** URLs e identificadores enviados pelo usuário não são provas autenticas da infraestrutura. Quando o staging existir, precisará de verificação externa presencial/supervisionada e inventário de contas, segredos, redes, plugins de backup e permissões. Nunca copiar produção diretamente sem autorização explícita e processo LGPD aprovado.

## 2. Diagnóstico de observabilidade para eventual canário (não operacional)

Arquivos:
- `api/src/modules/plataforma/pointvet-m52-canario.contract.js`
- `api/tests/pointvet-m52-canario.contract.test.mjs`

Contrato puro e read-only, alimentado por métricas declaradas, **sem ligação a sistemas de telemetria**, exige organização, lista explícita de empresas e SHA de 40 caracteres; nenhuma habilitação de feature flag ou deploy existe.

Amostra mínima ilustrativa para futura investigação controlada: pelo menos 100 requests durante 15 minutos, taxa de 5xx não superior a 0,5%, p95 de API até 1.200 ms e idade do backup inferior ou igual a 26 h. Limites zero para venda duplicada, fuga entre tenants, estoque inconsistente, divergência de caixa, evento fiscal não esperado, webhook externo e falha de alertas críticos. Qualquer métrica ausente, inválida ou fora dos limites é **`PAUSAR_AVALIAR`**, não sucesso silencioso.

Mesmo se métricas declaradas estiverem boas, o retorno é `AGUARDAR_APROVACAO_HUMANA`, nunca `publicacaoAutorizada`. Nenhuma medição real, rollout, monitoramento contínuo nem notificação foi ativado.

## 3. Gates obrigatórios para M.5.2 REAL

Antes de qualquer criação de recursos ou restauração real:
1. Aprovação explícita do ambiente de staging independente, projeto e Postgres separados, credenciais exclusivas, rede e storage segregados; bloqueio de webhooks/e-mails externos e testes com dados sintéticos;
2. Registro do SHA imutável candidato, responsáveis por operação/reversão e janela supervisionada;
3. Aprovação específica de qualquer backup REAL para restaurar fora da produção, revisão LGPD, segredo e retenção, plano de mascaramento, sanidade do checksum original e retenção da evidência sem expor dados ao CI;
4. Com ambiente staging autorizado: executar snapshot/restore real sem sobrescrever origem, medir RTO/RPO e atestar migrations Prisma, dados/índices/regras, storage externo, smoke API/PDV/portal, TLS e DNS;
5. Ensaio separado de rollback de **código e feature flag** (não confundir com rollback transacional do M.5.1), registro de evidência de canário, métricas verificáveis e alertas;
6. Só após revisão tributária/fiscal por CNPJ e UF/município, autorização administrativa e opt-in do tenant, discutir ativação seletiva do PDV. Nenhuma emissão fiscal real, PSP/TEF/maquininha nem `CREDITO_CLIENTE` antes de respectivos gates.

## 4. Estado de publicação

`PR #36` segue DRAFT e `main` preservada. As verificações sintéticas da M.5.2 são apenas PREPARAÇÃO técnica. A validação CI dos contratos não constitui homologação de staging, conformidade fiscal ou prontidão para publicar. Preservar backup e notificações do PointVet em produção.

**Continuidade posterior:** M.5.3 (quando o staging real estiver autorizado): inventário e provisionamento controlado, conferência independente das identidades e do domínio, smoke e restauração reais apenas sob aprovação. Sem infraestrutura aprovada, fortalecer testes CI dos gates sem usar dados de produção. Documento histórico complementar: `POINTVET_M5_STAGING_RESTORE_PUBLICACAO.md`.
