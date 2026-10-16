# PointVet M.5.30 — critérios técnicos da minuta de custódia, SOMENTE CI

## Objetivo

A M.5.29 identifica o estado dos pareceres declarados e as dez pendências de governança de comprovantes. A M.5.30 permite **ensaiar uma matriz de requisitos técnicos** e atribuir **áreas responsáveis propostas**, sem criar aprovações reais ou alterar o estado de qualquer devolução.

O usuário ainda escolherá o provedor do motor fiscal. **Não há motor, SDK, cálculo tributário, emissão, transmissão, XML, SEFAZ/prefeitura, documento fiscal ou operação de banco/PSP/TEF/maquininha.** Nenhum dado, imagem, URL, comprovante, CPF ou extrato de cliente é recebido.

## Contratos e limites

- `api/src/modules/pdv/pdv-unificado-minuta-custodia.contract.js`: `avaliarMinutaCustodiaM530` recebe somente um plano M.5.29 **não aprovado** e uma minuta de CI versionada, vinculada por organização, empresa, comanda e `codigoPlanoEsperado` SHA-256. Recusa minuta sobre plano antigo, CNPJ/empresa diferente, itens duplicados/ausentes, campos arbitrários ou referências que não sejam códigos sintéticos opacos. Exige dez controles exatamente iguais aos gates M.5.29, cada um com área proposta correta, `especificado: true/false` e `referenciaControle` sem texto livre. Ordena os controles e calcula SHA-256 `codigoMinuta` determinístico (não é assinatura digital nem evidência externa).
- As áreas são **propostas de responsabilidade técnica**, não designações de pessoas: `PRIVACIDADE`, `SEGURANCA`, `FINANCEIRO_FISCAL` e `OPERACOES`. Mesmo os dez controles marcados como especificados significam apenas **matriz técnica preenchida no ensaio**, não validação de documento, parecer jurídico, segregação de aprovadores efetiva ou homologação contábil/fiscal.
- `api/src/modules/pdv/pdv-unificado-minuta-custodia-sandbox.service.js`: `avaliarMinutaCustodiaSomenteSandbox` reaproveita a leitura autorizada M.5.29, com `NODE_ENV=test`, flag e banco descartável `pointvet_unified_ci` (URL e `SELECT current_database()`), isolamento financeiro M.5.7, versionamento M.5.27/28/29, sem nova escrita, tabela, rota HTTP ou worker. Não aceita corpo de arquivo/URL como argumento extra.

## Gates incondicionais

Mesmo com 10/10 controles técnicos especificados, o resultado mantém:

- `politicaAprovada=false` e `pessoasAprovadorasVerificadas=false`;
- `segregacaoPessoasHomologada=false` e `documentoExternoAutenticado=false`;
- `prazoRetencaoHomologado=null` (nenhum prazo legal arbitrado);
- `permiteUpload=false`, `permiteArmazenamento=false`, `permiteExportacao=false`, `permiteDescarteReal=false`;
- `permiteReembolso=false`, `permiteLancamentoFinanceiro=false`, `permiteOperacaoFiscal=false`, `habilitaCheckout=false`.

Seis aprovações/ações externas **seguem pendentes**: validação da política por responsáveis reais; confirmação da identidade e independência dos aprovadores; escolha fundamentada da base legal e retenção; ensaio dos controles e tratamento de incidentes em staging real; homologação contábil/fiscal por CNPJ; autorização expressa antes de qualquer armazenamento ou captura.

## Testes

- Testes puros: matriz parcialmente preenchida, 10/10 controles sem aprovação real, assinatura SHA determinística independente da ordem, minuta stale após mudança de `codigoPlano`, falsificação de empresa/escopo/controle, entrada com URL/bytes não permitida, referências inválidas e flags sempre desativadas.
- Integração PostgreSQL descartável: contexto financeiro autorizado e tenant, minuta inicial, invalidação automática após parecer M.5.28, ensaio de um controle proposto e nova invalidação após segunda devolução/dossiê alterado; sem escrita/auditoria de aprovação, sem efeitos econômicos/fiscais.
- Workflow `PointVet Unified PDV Foundation`: valida sintaxe e testes puros, build e Prisma, E2E PostgreSQL multiempresa/HTTP e restore/rollback **sintéticos**. **CI da implementação APROVADO:** SHA `5e3651b9e03232692f87debc073905e5e7c791df`, [Actions #38937659519](https://github.com/isaquesan7/sistema-pet/actions/runs/38937659519), `validate` + `isolated-postgres` **SUCCESS**. Revalidar separadamente o HEAD após esta atualização documental.

## Decisões reais futuras, não implementadas

Política de privacidade/custódia aprovada e versionada, responsáveis concretos e segregados, base e prazo de retenção por classe de documento fundamentados, requisitos de armazenamento seguro por organização e auditoria de acesso, tratamento de incidentes/descarte, comprovação humana real e regras fiscais por emissor. Só depois propor fluxo de captura e homologação em ambiente segregado, com aprovação explícita do usuário. PR #36 continua **DRAFT**; sem merge, deploy, staging/restore reais, alterações em `main`/Railway/Pet King ou checkout do PDV unificado.
