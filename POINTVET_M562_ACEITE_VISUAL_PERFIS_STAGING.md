# PointVet M.5.62 — Conferência de permissões e aceite visual no staging (20/10/2026)

## Resultado e limite da entrega

A interface do PDV Unificado agora possui um **painel somente de leitura exclusivo para homologação** (identificado por `VITE_POINTVET_ENVIRONMENT=staging`). Ele lê o usuário, organização e permissões `pdv.acessar` / `pdv.cancelar_venda` **de cada CNPJ da sessão já autenticada** e exibe separadamente os dois gates retornados pela API para **a empresa selecionada**: fechamento manual e estorno de contingência.

O painel **não concede acesso, não altera cargos, não simula ser outra pessoa, não executa vendas, não declara recebimentos, não ativa flags e não comprova por si só o aceite humano**. Autorizações continuam sendo verificadas pelo servidor em cada requisição, incluindo todos os CNPJs da comanda.

- Código de UI: `admin-web/src/components/UnifiedRoleAcceptancePanel.jsx`, helper `admin-web/src/lib/unifiedRoleAcceptance.js` e inclusão em `admin-web/src/pages/UnifiedPdvPreviewPage.jsx`.
- Teste com contas e empresas fictícias: `admin-web/tests/unified-role-acceptance.test.mjs`, executado explicitamente no job `validate` antes do build do Admin, além da suíte M.5.61 do PostgreSQL isolado.
- Ambiente de destino exclusivo: `Pet King PDV Homologacao / staging / pointvet-admin-staging`, URL verificada no Railway: https://pointvet-admin-staging-staging.up.railway.app/pdv/unificado/simulacao
- Projeto comercial da Pet King, `main`, API, PostgreSQL e Portal **fora do escopo** desta implantação de tela.

## Roteiro de duas sessões reais de teste — PENDENTE

Usar **somente contas de teste autorizadas** no ambiente de homologação, com dados de tutores/pets fictícios. Nunca usar o superadmin para substituir o aceite do atendente ou supervisor. Capturas não devem conter dados pessoais, senha, token ou CNPJ de cliente terceiro. A identidade/cargo efetivos devem ser confirmados por responsável humano; mostrar `superAdmin: false` não é prova de cargo MEMBRO.

### Sessão A — atendente

1. Autenticar com a conta designada ao atendente. Abrir `/pdv/unificado/simulacao`. Conferir o aviso de **HOMOLOGAÇÃO** e a nova seção **Homologação de perfis — M.5.62**.
2. Verificar os dois CNPJs da Pet King, acesso `pdv.acessar` em ambos, ausência de `pdv.cancelar_venda` no CNPJ onde o atendente não pode cancelar e que checkout manual e contingência aparecem como bloqueados para a empresa selecionada. Trocar CNPJ e conferir novamente; registrar duas capturas.
3. Selecionar apenas tutor/pet fictícios e usar `Validar e calcular sem cobrar`. Para artigo a R$ 15/kg, lançar 333 g deve calcular R$ 5,00 (a quantidade e o preço reais exibidos dependem do catálogo fictício da homologação). Verificar item/serviço distribuído por dois CNPJs, salvar e reabrir comanda fictícia e alternar CNPJ sem perder linhas.
4. Não pressionar ações que registrem venda ou estorno. O atendente não deve conseguir executar estorno integral nem consultar histórico restrito se não possuir a permissão exigida na empresa selecionada.

### Sessão B — supervisor

1. Encerrar a sessão anterior e autenticar com **conta de supervisor distinta**. Conferir a seção M.5.62 com permissões `pdv.cancelar_venda` nos dois CNPJs, caso tenham sido atribuídas pelo administrador; registrar evidência dos dois contextos.
2. Consultar apenas o **Histórico de estornos integrais** (somente leitura) onde permitido; não registrar nenhum novo estorno. Se a conta tiver permissão apenas em um CNPJ, tratar a lacuna como **bloqueio**, não como aprovação.
3. Conferir que o checkout e a contingência continuam bloqueados na API mesmo que uma permissão de cargo exista. A permissão exibida pelo painel não significa autorização de estorno multiempresa.
4. Registrar feedback de clareza, dificuldades, erros visuais e segurança das mensagens.

## Registro do aceite (a preencher pela Pet King)

- Ambiente e URL: Pet King PDV Homologacao, staging / https://pointvet-admin-staging-staging.up.railway.app/pdv/unificado/simulacao
- Versão implantada no Admin: **aguarda deploy e conferência**.
- Atendente, cargo e horário: **pendente**.
- Supervisor, cargo e horário: **pendente**.
- CNPJs de teste conferidos e condições de acesso: **pendente**.
- Evidências sem dados pessoais e problemas encontrados: **pendente**.
- Flags checkout/estorno OFF antes e depois: **pendente de releitura no início/fim do aceite**.
- Decisão humana: **PENDENTE — não inferir aprovação automática**.

## Pendências de liberação

Este painel viabiliza a inspeção visual de autorização, mas **não executa o aceite por usuários humanos**. Gate 2 permanece **PARCIAL** mesmo com testes CI verdes: ainda faltam aceite separado de atendente/supervisor, documentação de políticas RTO/RPO e recuperação real autorizada, obrigações fiscais/contábeis externas e decisão nominal de canário. PR #36 permanece DRAFT e sem merge. Checkout/reversão comercial OFF; sem TEF, PSP, banco ou motor fiscal.

Continuar a partir da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37), [matriz M.5.61](POINTVET_M561_ACEITE_OPERACIONAL_PERFIS.md) e [continuidade oficial](POINTVET_CONTINUIDADE_OFICIAL.md).
