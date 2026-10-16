# PointVet M.5.29 — prévia de governança documental e retenção, SOMENTE CI

## Escopo e decisão

Esta etapa prepara a **lista de decisões de segurança, privacidade e custódia** para um futuro procedimento de conferência de comprovantes de devolução. **Não recebe, armazena, verifica, exporta nem elimina um documento real**. Os registros M.5.28 continuam sendo apenas hashes e referências **fornecidos por um conferente no ensaio**, sem autenticação independente. A M.5.29 **não transforma** esse parecer sintético em comprovação real.

O usuário decidiu aguardar a escolha do **provedor/motor fiscal**. Nenhum SDK, XML, cálculo tributário, documento fiscal, emissão, transmissão, banco, maquininha, PSP/TEF ou Open Finance é integrado nesta etapa.

## Componentes

- `api/src/modules/pdv/pdv-unificado-custodia-devolucoes.contract.js`: `planejarCustodiaDevolucoesM529` recebe o dossiê M.5.27 e os *identificadores estritamente necessários* dos pareceres M.5.28. Verifica tenant/empresa/comanda, campos e estados, unicidade, vínculos causais e quantidade de declarações. Distingue `SEM_PARECER_CI`, `PARECER_DECLARADO_NA_VERSAO_ATUAL` e `PARECER_DE_VERSAO_ANTERIOR`. Calcula `codigoPlano` SHA-256 vinculado ao código do dossiê e às revisões declaradas, **sem valor probatório externo**. Não devolve referência de comprovante, hash informado pelo usuário, conteúdo de documento, dados pessoais do tutor, extrato, conta ou meio de pagamento.
- `api/src/modules/pdv/pdv-unificado-custodia-devolucoes-sandbox.service.js`: `consultarPlanoCustodiaDevolucoesSomenteSandbox` é **somente leitura e sem rota HTTP**. Exige `NODE_ENV=test`, flag do sandbox e DB descartável `pointvet_unified_ci` verificada também com `SELECT current_database()`. Em única transação `RepeatableRead`, reutiliza autorização financeira, empresa/organização, opt-in M.5.7 e snapshot M.5.23/M.5.24/M.5.27. Lê metadados dos pareceres, confere trilha de auditoria/identidade/fingerprint e projeta o plano; qualquer inconsistência falha fechado.
- Sem nova migration, sem novo anexo, sem tabela de arquivo, sem endpoint, sem worker, sem alteração no backend financeiro ou UI comercial. O contrato **não registra prazos de retenção fictícios**: `prazoRetencaoDias`, `inicioContagemRetencao`, `dataDescarte`, finalidade aprovada e base legal definida são `null` até decisão legítima posterior. Não executa descarte ou coleta.

## Dez decisões explicitamente pendentes

1. Finalidade e base legal aplicáveis, por tipo de comprovante e operação.
2. Classes de informações estritamente necessárias e minimização.
3. Controle de acesso segregado e auditoria de todas as consultas.
4. Criptografia, chaves e gestão de credenciais.
5. Cadeia de custódia, procedência e verificação de autenticidade fora do PointVet.
6. Prazos legais/contratuais e marco inicial de retenção por categoria.
7. Descarte seguro, suspensão de eliminação quando houver obrigação de preservação.
8. Procedimento para direitos do titular e resposta a incidentes.
9. Revisão contábil e fiscal por CNPJ e tipo de devolução.
10. Staging segregado, restore/rollback e homologação com responsáveis reais.

Todos os pontos permanecem **pendentes**, mesmo quando existe parecer M.5.28 ligado ao código atual do dossiê. Um novo registro de devolução muda o dossiê: um parecer anterior é identificado como **histórico**, e não como revisão da nova versão.

## Barreiras incondicionais

O resultado mantém `politicaAprovada=false`, `cadeiaCustodiaRealDisponivel=false`, `conteudoDocumentoAutenticado=false`, `bancoVerificadoIndependentemente=false`, `permiteUpload=false`, `permiteArmazenamento=false`, `permiteExportacao=false`, `permiteDescarteReal=false`, `permiteReembolso=false`, `permiteLancamentoFinanceiro=false`, `permiteOperacaoFiscal=false` e `habilitaCheckout=false`.

Testes: contrato puro (retorno mínimo/redigido, ausência de prazo, flags desligadas, cenários com/sem parecer, revisão histórica, adulteração, cross-CNPJ e duplicidade) e integração PostgreSQL descartável (autorização, trilha de auditoria íntegra/adulterada, mudança de dossiê e zero efeito financeiro/fiscal). Workflow valida lint/contrato, regressões multiempresa/HTTP e backup/restore **sintético**. **CI da implementação aprovado:** `b3a7a27c0635b2363e00968f43b11482ea76d5c3`, [Actions #38934425893](https://github.com/isaquesan7/sistema-pet/actions/runs/38934425893), `validate` + `isolated-postgres` **SUCCESS**. O HEAD documental final exige nova verificação.

## Próximos gates — nenhum liberado

Validar requisitos jurídicos e documentais por organização, aprovadores e controle de acesso, políticas oficiais versionadas para retenção/descarte, desenho de armazenamento seguro com separação tenant e auditoria de acesso, ensaio de backup/restauração e eventual captura de comprovante **apenas após autorização específica**. O sistema não deve deduzir prazo legal nem aceitar como prova o SHA/identificador autodeclarado. PR #36 continua DRAFT; sem merge, deploy, staging real ou mudanças em `main`, Pet King, Railway e bancos reais.
