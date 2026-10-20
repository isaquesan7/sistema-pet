# PointVet M.5.54 — Reabertura de venda concluída e estorno pela interface (20/10/2026)

## Resultado efetivamente observado
- Ambiente: projeto Railway **Pet King PDV Homologacao**, environment **staging**, banco PostgreSQL e operador **fictícios**. Projeto comercial/produção da Pet King não alterado.
- Venda unificada sintética da comanda **#3**, gerada nesta rodada: **R$ 15,00** em duas empresas/CNPJs; ração a granel **333 g = R$ 5,00** (dinheiro R$ 3,00 e Pix R$ 2,00 declarados) e serviço de banho **R$ 10,00** (transferência declarada).
- A UI confirmou as duas vendas-filhas `cmvgppqhl00041zscs9dbmw3j` e `cmvgppqhz00061zscrn6y9ldd`. Estoque do item sintético `STG-PDV-GRANEL-001`: **1,000 kg → 0,667 kg**, confirmado visualmente no módulo Estoque. Sem PSP, banco, dinheiro, hardware ou documento fiscal real.
- Problema revelado pelo ensaio: depois da venda, a comanda #3 não aparecia em **Rascunhos recentes** porque a consulta filtrava apenas `ABERTA`. Não havia forma de retomar o estorno pela UI após a navegação.

## Correção M.5.54
- Novo GET autenticado `/api/pdv-unificado/rascunhos-concluidos` para recuperar apenas comandas unificadas com estado `FECHADA`, conferindo tenant, empresas acessíveis e permissão `pdv.cancelar_venda`; **403** com gate de checkout manual desligado.
- UI: lista separada **Vendas unificadas concluídas — estorno integral**, reabertura read-only da venda finalizada e acesso ao formulário já existente de estorno por todas as empresas; operações concluídas bloqueiam edição de tutor, pet, peso e linhas.
- Teste HTTP PostgreSQL isolado garante visibilidade `FECHADA`, 403 com flags OFF e desaparecimento do histórico de pendentes depois do estorno; teste de contrato da UI reforça bloqueios.
- Código de implementação: `cec1c87e7e989564b5ed817e26b2b467209005e8` na branch `feat/pointvet-20-1-unified-pdv-foundation`. [Workflow #39431148784](https://github.com/isaquesan7/sistema-pet/actions/runs/39431148784): **validate SUCCESS** e **isolated-postgres SUCCESS**.
- Deploy staging API `6b030d27-6fc4-4406-8119-67239922d351` e admin `3fcb1931-9366-49b2-8b64-5236c39be8e8`, ambos **SUCCESS**.

## Limitação da homologação visual — não omitir
A janela temporária da API foi ligada **somente em staging** com uma organização sintética e dois IDs de empresa explicitamente autorizados; deploy `ce5bab61-7607-45d8-854d-72387b515fbc` SUCCESS. A UI exibiu **Fechamento manual** e o novo botão **Venda #3 · Tutor Ficticio Homologacao · estorno integral**, confirmando a recuperação pelo endpoint. Ao acionar a reabertura, a sessão do navegador automatizado passou a restringir a observação da página após a autenticação; **não houve confirmação visual da conclusão do estorno**. Não afirmar que vendas foram estornadas ou que a baixa foi revertida.

As três variáveis foram **restauradas a OFF**, listas vazias, apenas na API de staging:
- `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED=0`
- `POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS=""`
- `POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS=""`

Deploy final de segurança da API `c2466420-6b16-4ea4-b9ce-26754959a552` **SUCCESS**; os quatro serviços da homologação online. UI novamente indica **Simulação**, sem lista de vendas concluídas exposta; módulo Estoque confirmou saldo ainda **0,667 kg** (estorno NÃO concluído).

## Próximo teste operacional pendente
Em sessão humana de homologação, com autorização específica para nova janela controlada:
1. Reativar **apenas** os três gates de staging com allowlist da organização e das duas empresas fictícias e verificar saúde da API.
2. Abrir **Vendas unificadas concluídas → Venda #3**; revisar duas vendas-filhas e preparação.
3. Declarar o ajuste externo **fictício**, motivo explícito e referência de teste. Executar **estorno integral** e conferir estado `CANCELADA`, operações `ESTORNADA`, auditoria, pagamentos e saldo **1,000 kg**, sem gerar dinheiro ou documento real.
4. **Desligar** os três gates e validar a UI em modo Simulação; documentar aceitação e evidências.

O teste E2E em PostgreSQL descartável já valida o comportamento transacional integral, porém **não substitui** o clique humano com retorno visual completo. PR #36 permanece **DRAFT**, sem merge em `main`, produção, nota fiscal, integração bancária ou restore real do R2 (autorização separada).
