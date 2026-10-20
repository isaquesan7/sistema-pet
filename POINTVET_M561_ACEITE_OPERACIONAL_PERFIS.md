# PointVet M.5.61 — Matriz operacional de atendente e supervisor (20/10/2026)

## Propósito e alcance

Validar autorização por pessoa, organização e CNPJ nas telas/rotas do PDV unificado. Teste automatizado com contas **MEMBRO**, senhas fictícias, CNPJs fictícios, PostgreSQL descartável no GitHub Actions. **Não equivale a aceite humano da Pet King.** Não houve deploy, troca de flags Railway, pagamentos externos, notas fiscais ou alteração de dados reais.

Railway verificado após os testes: homologação Pet King **4/4 saudável**, comercial **8/8 saudável**, sem deploys nem pendingWork. Nenhuma feature flag foi modificada.

O código desta fase só amplia o teste já existente em api/tests/pointvet-manual-checkout-http.integration.test.mjs, executado em CI com trava exata da URL local pointvet_unified_ci, NODE_ENV=test e POINTVET_UNIFIED_SALES_SANDBOX=1. A API comercial continua fail-closed.

**CI aprovado:** [GitHub Actions #39460854679](https://github.com/isaquesan7/sistema-pet/actions/runs/39460854679), jobs validate e isolated-postgres concluídos com SUCCESS, inclusive teste HTTP de perfis e restauração de banco descartável. Commit de código 3f1ce919dfc267fed3e7c8347d15e3116bcd5016.

## Matriz de permissões exercitada em CI

| Perfil fictício | Acesso Loja | Acesso Banho/Tosa | Venda de gestão manual | Estorno integral |
| --- | --- | --- | --- | --- |
| Usuário limitado (MEMBRO) | pdv.acessar + pdv.cancelar_venda | Sem vínculo | **Negado** no fluxo multiempresa | **Negado** |
| **Atendente (MEMBRO)** | pdv.acessar | pdv.acessar | **Permitida somente** com 4 gates e confirmação explícita, em CI | **Negado**, sem pdv.cancelar_venda na Loja |
| **Supervisor (MEMBRO)** | pdv.acessar + pdv.cancelar_venda | Inicialmente pdv.acessar; depois recebe pdv.cancelar_venda | Não é necessário executar nova venda | **Negado** enquanto faltar permissão no segundo CNPJ; permitido só após 2 CNPJs e gate de contingência íntegro |

Casos exercitados pelo HTTP real:

1. Sem autenticação, acesso 401; perfil sem vínculo com o CNPJ selecionado recebe 403.
2. Atendente comum, vinculado às duas empresas: consulta catálogo, consulta o planejamento do rascunho e valida a divisão em dois CNPJs.
3. Checkout bloqueado com gate OFF, organização ausente da allowlist, CNPJ participante ausente, ou recebimento manual sem confirmação. O gate de estorno **nunca** libera checkout.
4. Com as autorizações habilitadas **somente dentro do processo do teste**, atendente comum registra a venda fictícia de R$15 (333 g de ração = R$5; banho = R$10), com R$3 dinheiro, R$2 Pix e R$10 transferência. Duas vendas-filhas, três pagamentos e autor auditável.
5. Pedido repetido não cria nova venda nem movimenta estoque novamente. Valores divergentes são recusados e falta de estoque faz rollback atômico.
6. Atendente não acessa histórico restrito nem executa estorno; supervisor sem pdv.cancelar_venda na segunda empresa também é recusado.
7. Supervisor **MEMBRO**, após autorização nas duas empresas, registra estorno integral apenas mediante declaração explícita de devolução **fictícia**; retornam 333 g ao mesmo lote, 3 pagamentos ficam estornados e o histórico é segregado.
8. Reenvio idempotente de estorno devolve a mesma operação; motivo divergente é recusado. Histórico de auditoria continua em modo somente leitura após gates OFF.
9. Documentos fiscais permanecem ausentes; nenhuma chamada bancária, PSP, TEF ou transferência externa.

## Aceite humano — ainda pendente (não preencher automaticamente)

- [ ] Atendente identificado por nome e cargo, conta não administrativa e acesso aprovado separadamente para cada CNPJ da Pet King.
- [ ] Supervisor identificado por nome e cargo, permissões para cancelar nos dois CNPJs verificadas; fluxo negado sem uma delas.
- [ ] Fluxo real da interface: encontrar tutor, incluir pet, lançar 333 g, serviço, salvar e reabrir comanda sem perdas ou alteração de CNPJ.
- [ ] Conferir visualmente preço, estoque, forma de pagamento, comprovante de declaração de recebimento externo, caixa correto e separação financeira.
- [ ] Validar mensagens de bloqueio quando o operador tenta cancelar/estornar sem permissão, ou quando o supervisor não confirma a devolução.
- [ ] Testar com dados somente fictícios e sem cobrar (simulação). Qualquer ativação temporária de checkout/estorno **na Pet King** exige escopo, janela e autorização humana específicos.
- [ ] Registrar protocolo, data/hora, participantes, evidências sem dados pessoais e eventuais falhas; comprovar flags OFF antes e depois do teste.
- [ ] Obter aceite expresso do proprietário/supervisor e decisão documentada de canário; não inferir aceite apenas por respostas HTTP.

Campos a registrar: organização/ambiente: ____ ; CNPJ(s) usados: ____ ; atendente: ____ ; supervisor: ____ ; data/hora: ____ ; versão/commit: ____ ; evidência: ____ ; decisão: PENDENTE.

## Segurança e publicação

Gate 2 **PARCIAL**; o ensaio M.5.60 de restore de 550 mil linhas é sintético e não prova RTO/RPO comercial. Motor fiscal, conciliação externa e aceites operacionais humanos continuam pendentes. Não ativar checkout manual ou contingência comercial até decisão nominal; manter PR #36 **DRAFT**, main e produção intactas.

Documentos relacionados: POINTVET_CONTINUIDADE_OFICIAL.md, POINTVET_M560_VOLUMETRIA_SINTETICA_RAILWAY.md e Issue #37.