# PointVet M.5.32 — negação de acesso documental por desenho (somente CI)

Data: 16/10/2026. Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) no [PR #36 DRAFT](https://github.com/isaquesan7/sistema-pet/pull/36).

Validação da implementação: commit `27754f2879b40bb19012c557269f01e7f20cb232`, [Actions #38961163793](https://github.com/isaquesan7/sistema-pet/actions/runs/38961163793), `validate` + `isolated-postgres` **SUCCESS** em CI efêmero. A atualização documental posterior requer nova validação do HEAD.

## Propósito

Preparar o ponto de decisão de acesso a **futuras** evidências, com comportamento **deny-by-default**. Não é autenticação, autorização de usuário, sistema de permissões real, repositório de evidências ou tokenizador. É uma prévia sintética do que *não* pode ser feito enquanto as decisões e implementações necessárias não existirem.

M.5.32 depende da [fronteira M.5.31](POINTVET_M531_FRONTEIRA_ARMAZENAMENTO_CI.md), que depende da minuta M.5.30, plano M.5.29 e dossiê documental M.5.27/M.5.28. Nenhum contrato ou dado de produção é modificado.

## Operações futuras e negação obrigatória

| Operação hipotética | Bloqueio adicional à política, provedor e segurança ausentes |
| --- | --- |
| `CAPTURAR_DOCUMENTO` | Classificação e captura sem autorização |
| `LER_CONTEUDO` | Nenhuma leitura de conteúdo autorizada |
| `EXPORTAR_DOCUMENTO` | Destinatário e exportação não autorizados |
| `DESCARTAR_DOCUMENTO` | Prazo de retenção e eventual suspensão por litígio não homologados |
| `RESTAURAR_DOCUMENTO` | Procedimento real de recuperação não homologado |

**Todas as operações retornam `autorizado:false`, inclusive se a M.5.31 tiver 10/10 controles PLANEJADOS.** Zero controles implementados, zero homologados, nenhuma pessoa autenticada, nenhuma permissão real verificada. Não emite capacidade, token, URL assinada ou autorização de upload, leitura, exportação, descarte, restore, checkout, reembolso ou fiscal.

O campo `papelHipotetico` só admite `OPERADOR_CI`, `CONFERENTE_CI`, `AUDITOR_CI` e `SEGURANCA_CI`; **não** representa uma identidade, vínculo RBAC real nem afirma que cada papel terá acesso futuro. A seleção verdadeira de papéis, segregação humana, finalidade, base legal, retenção e exceções só ocorrerá após decisão e autorização expressa.

## Contrato e validação

- `simularAcessoEvidenciaM532` recebe a saída exata da M.5.31 e solicitação com sete campos fechados: versão `M5_32_DECISAO_ACESSO_EVIDENCIA_CI_V1`, organização, empresa, comanda, código SHA esperado da fronteira, operação da lista e papel hipotético. Recalcula SHA da fronteira, confere seus dez controles, escopo e proibições; rejeita conteúdo, bytes, URL, usuário real, dados de documento e campos adicionais. Seu código SHA `codigoDecisao` é **fingerprint de uma decisão negada**, nunca chave de acesso ou atestado real.
- `consultarDecisaoAcessoEvidenciaSomenteSandbox` chama M.5.31, que usa a cadeia de autorização de leitura M.5.30/29/27/M.5.7; execução somente com `NODE_ENV=test`, flag CI e PostgreSQL descartável `pointvet_unified_ci`. Sem endpoint HTTP, escrita em banco, migração, SDK ou integração de storage.
- Testes puros verificam as cinco operações em quatro papéis hipotéticos (20 combinações sempre negadas), estado com controles parcialmente planejados, adulteração de matriz/flags/SHA, entradas indevidas, identidade, tenant e CNPJ. E2E PostgreSQL CI valida rejeição cross-tenant, descarte ainda negado, impossibilidade de receber arquivo e invalidação de prévia após parecer M.5.28 e alteração de dossiê.

## Gates inalterados

Antes de qualquer acesso documental real, seriam necessários política/base legal/retenção por categoria e tratamento de litígio aprovados, aprovadores e segregação verificáveis, definição real de papéis/escopos, provedor e adaptador avaliados, chaves e criptografia, antimalware, trilha de auditoria de conteúdo, resposta a incidente/restore testados em staging autorizado, homologação humana e autorização explícita para captura de arquivos e produção. **Nada disso é homologado neste exercício.**

O **motor fiscal continua adiado até a escolha do provedor pelo proprietário**. Sem SEFAZ/prefeitura, notas, PSP/TEF/maquininha/banco/Open Finance, checkout, movimentação financeira, upload de comprovantes, staging/restore real, merge, deploy ou alteração em `main`, Pet King e Railway. O PR permanece Draft.
