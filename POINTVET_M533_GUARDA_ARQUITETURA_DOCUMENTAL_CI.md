# PointVet M.5.33 — sentinela de isolamento documental (somente CI)

Data: 16/10/2026. Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) no [PR #36 DRAFT](https://github.com/isaquesan7/sistema-pet/pull/36).

## Objetivo

Adicionar um **teste automatizado de arquitetura**, não uma nova operação de negócio, para proteger o isolamento dos contratos documentais M.5.29–M.5.32. Enquanto a escolha de provedor, a política documental e as aprovações reais estiverem pendentes, o CI deve avisar caso o código seja conectado a HTTP, receba dependências de armazenamento/rede ou passe a escrever no banco.

O teste `api/tests/pdv-unificado-fronteira-documental.guardrail.test.mjs` percorre todos os arquivos JavaScript em `api/src`, monta um grafo das importações ESM estáticas e observa **oito módulos**: contratos puros e serviços sandbox de M.5.29, M.5.30, M.5.31 e M.5.32.

## Invariantes de falha no CI

| Verificação | O que torna o CI vermelho |
| --- | --- |
| Dependências fechadas | Alteração nas importações permitidas dos oito módulos sem revisão explícita da fronteira |
| Chamadores conhecidos | Outro módulo runtime passar a importar esses contratos/serviços, fora da cadeia interna M.5.29 → M.5.32 |
| Isolamento HTTP | Qualquer módulo documental passar a ser alcançável a partir de `app.js`, `server.js` ou de rotas Express do projeto |
| Efeitos colaterais | Chamada suspeita a escrita via `prisma`/`tx`, `fetch`, uso de arquivo/rede ou carregamento dinâmico nos oito módulos |
| Servidores e rotas | Registro de `router`/`app` HTTP diretamente na fronteira de custódia |

Para demonstrar que a proteção reage, o teste injeta **somente em cópias de strings na memória do runner** cinco regressões artificiais: importação estática do serviço M.5.32 por uma rota; importação de SDK S3; tentativa de `.create()` via Prisma; `import()` dinâmico de adaptador no serviço; e `import()` dinâmico da fronteira por uma rota. Cada cenário deve produzir pelo menos um alerta e nenhuma mudança no repositório ou no banco. Não conecta a AWS/S3 nem a nenhum serviço externo.

O teste permite exclusivamente as dependências já existentes para o contrato SHA-256 e para a cadeia de leitura com autorização M.5.7 no PostgreSQL descartável. A verificação negativa **não substitui revisão de segurança, análise de código, auditoria humana ou testes de integração**. Por usar análise estática delimitada à sintaxe ESM observada, não prova ausência de todos os caminhos possíveis de execução; é um alarme de regressão adicional. A suíte E2E atual permanece obrigatória no workflow.

## Critérios para uma mudança futura

Alterar a lista de importações, criar rota de captura ou passar a usar armazenamento real exigirá proposta/revisão específica, identidade/autorização, política de privacidade e retenção aprovada, classificação de dados e controles homologados. Não se muda esta sentinela para viabilizar um atalho sem resolver os gates humanos. O sistema mantém **upload, leitura de arquivo, exportação, descarte, restauração real, checkout e movimentação fiscal/financeira bloqueados**.

**Motor fiscal continua ADIADO até a escolha do provedor pelo proprietário.** Sem SDK fiscal, notas, SEFAZ/prefeitura, PSP, TEF, maquininha, Open Finance ou operação bancária. Sem deploy, merge, mudanças em `main`, Railway/Pet King, staging ou restore real. PR #36 continua Draft.
