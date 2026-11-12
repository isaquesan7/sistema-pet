# PointVet — PLANO MESTRE DE ENTREGA OPERACIONAL ATÉ 30/12/2026
**Versão:** 1.0 | **Aprovado como diretriz de prazo pelo proprietário:** 11/11/2026 | **Status:** EM EXECUÇÃO

> **PRAZO MÁXIMO INEGOCIÁVEL: 30/12/2026. META INTERNA DE ENTRADA EM OPERAÇÃO: 23/12/2026.** De 24 a 29/12 são reservados para contingências e correções; 30/12 não é data para começar a desenvolver. O prazo é uma meta obrigatória de gestão, **não uma promessa de sucesso técnico sem aceite**. Risco de atraso deve ser reportado imediatamente, com redução explícita de escopo não essencial.

## 1. Entrega que conta como "operacional"
O PointVet deverá estar em operação diária na **Pet King**, com dois CNPJs segregados financeiramente, cobrindo:
1. **Cadastros e acesso:** login, organizações, CNPJs, usuários, cargos/permissões, clientes, pets e catálogo.
2. **PDV inteligente:** central única de comandas; incluir/remover itens dos dois CNPJs com autorização; cancelados não aparecem nas telas (histórico auditável mantido); serviços inteiros e vinculados ao tutor/pet; produtos fracionáveis/granel, estoque, venda, caixa, cancelamento e fechamento conjunto sem duplicidade; receita/caixa/estoque/relatórios por CNPJ. Pagamentos declarados pelo atendente, sem integração bancária/TEF/PSP.
3. **Consultório:** fila/atendimentos, prontuário, histórico, vacinação, exames, prescrições, procedimentos, anexos/documentos disponíveis e envio correto de serviços à comanda.
4. **Banho e tosa:** agenda, check-in, ordem de serviço, execução/conclusão, funcionários, consumo de pacotes e integração à mesma comanda.
5. **Estoque e produtos:** entradas, inventário, ajustes, lotes/validades, custo/preço e baixa/estorno coerentes por empresa.
6. **Financeiro:** contas a pagar/receber, fiado/créditos de cliente, caixa, recebimentos declarados, estorno, fluxo de caixa e conferência por CNPJ.
7. **Agenda, relatórios e portal:** agendamentos sem conflito, indicadores gerenciais por empresa/consolidados, exportação básica e consulta/agendamento pelo cliente.
8. **SaaS e operação:** criação de segundo tenant de teste sem acesso aos dados Pet King, planos/permissões, recuperação de conta, backup/restore, monitoramento, logs de auditoria e procedimento de suporte.

**O que NÃO bloqueia o marco de 23/12:** integração com maquininhas, PSP, bancos e conciliação bancária automática; motor próprio de NF-e/NFC-e/NFS-e ou integração com emissor; aplicativo nativo; automações complexas de marketing; relatórios avançados e assinatura online automatizada da plataforma. **Importante:** obrigações fiscais e contábeis continuam existindo e devem ser atendidas por procedimento externo adequado até haver motor fiscal oficial.

## 2. Situação-base verificada em 11/11/2026
- Railway Pet King DEV, ambiente production: API, admin, portal e PostgreSQL **online**; backup/alerta por workers existentes. Serviço online **não comprova fluxo completo aceito**.
- M.5.75: catálogo/gestão mult CNPJ e ocultação de cancelados implementados, CI verde em 29/10; API/admin implantados com SHA `cc0158c44799471a27334710eb400f7e6133a41a` naquela data, mas **validação humana do fluxo e desbloqueio financeiro unificado ainda não registrados**.
- Existe **checkout manual unificado com gate explícito** por organização e empresas; não ativar globalmente. Release/PR #38 DRAFT, PR #36 fundação DRAFT e outras PRs legadas ainda não integradas à main. Evitar deploy automático acidental de main e reconciliação destrutiva.
- `ROADMAP_SAAS.md` lista vários módulos "concluídos" do ponto de vista de implementação. Para este plano, considerar **PENDENTE DE ACEITE OPERACIONAL** até testes reais comprovarem ponta a ponta.
- Risco: escopo amplo e poucas semanas. A estratégia será **integrar + corrigir o já implementado**, sem perpetuar etapas de auditoria ou refazer testes aprovados sem motivo.

## 3. Calendário fechado e resultados por semana

| Janela | Prioridade | Resultado exigido / critério de saída |
| --- | --- | --- |
| **11–15/11** | **S0 — inventário, estabilização e congelamento do MVP** | Matriz módulos x operações x status real; registrar bugs P0/P1 e dono; conferir release do Railway x GitHub; validar PDV M.5.75 em navegador; confirmar opções da Pet King e caminho de liberação manual; listar fluxos de teste. **Não iniciar novas funções P2.** |
| **16–22/11** | **S1 — PDV inteligente + estoque** | Comanda única com dois CNPJs, catálogo cruzado, inclusão/remoção, pagamentos declarados de uma compra mista com venda/caixa/baixa por CNPJ, estorno auditável, granel, lotes, fiado, relatórios básicos; testes de replay e falta de estoque; **aceite do operador do PDV até 22/11**. |
| **23–29/11** | **S2 — Consultório + Banho e Tosa** | Cliente/pet → consulta/procedimento/receita/histórico → comanda → caixa; agenda → banho/tosa/OS/pacote → mesma comanda → conclusão. Perfis distintos de atendente e veterinário testados. **Dois fluxos completos e aceitos até 29/11.** |
| **30/11–06/12** | **S3 — Agenda, pacotes e financeiro** | Calendários sem conflito, pacotes com consumo/saldo, vendas e cancelamentos refletidos no financeiro, contas, créditos, caixa e fechamento por CNPJ; correção de divergências entre PDV e financeiro. **Conciliação gerencial de amostra por empresa até 06/12.** |
| **07–13/12** | **S4 — Relatórios, portal e SaaS** | Relatórios essenciais, exportações, portal tutor (acesso e agendamento), onboarding de uma **organização fictícia independente**, planos, cargos, permissões, backup/monitoramento e erros visíveis com recuperação; revisão LGPD/acesso. **Sem cruzamento de tenant até 13/12.** |
| **14–20/12** | **S5 — homologação integrada e release candidate** | Testes E2E entre módulos, regressão, acessibilidade mínima, performance aceitável, restauração verificável, erro/rollback e aceite dos operadores em Pet King. **Congelamento de novas funcionalidades em 14/12; RC e aceite até 20/12.** |
| **21–23/12** | **S6 — entrada em operação assistida** | Implantar release pinada, revisar banco e saúde, testar comanda/venda/estorno/consultório/banho/agenda/caixa, acompanhar usuários reais e registrar aceite. **Meta oficial: PointVet operacional em 23/12.** |
| **24–29/12** | **Reserva / contingência** | Corrigir apenas P0/P1, estabilizar, recuperar serviço/dados se necessário; sem funcionalidades novas nem refatoração extensa. |
| **30/12** | **Prazo máximo** | Sistema operacional e aceito; publicar checklist final e pendências não bloqueantes separadas no backlog 2027. |

## 4. Regras de execução, classificação e decisões
- **P0 bloqueante:** perda/corrupção de dados, fechamento ou pagamento duplicado, mistura de receita ou estoque entre CNPJs, acesso cross-tenant, indisponibilidade de serviço, falha de backup sem recuperação conhecida. Não liberar produção com P0.
- **P1 essencial:** fluxo diário não completa (comanda, cliente, consulta, OS, agenda, estoque, caixa, relatórios mínimos, acesso). **Zero P1 aberto no aceite**, ou workaround validado e escrito + aprovação expressa do proprietário para pendência de impacto limitado.
- **P2 complementar:** melhorias cosméticas, relatórios avançados, automações, integrações externas; podem ser adiadas sem comprometer 30/12.
- **Regra de 24 horas:** bloqueio sem solução em um dia deve gerar registro de causa, alternativa concreta e decisão de escopo; não entrar em ciclo infinito de auditorias/testes redundantes.
- Cada entrega: **uma PR/commit identificável → teste local/CI apropriado → deploy controlado em serviços afetados → smoke sem dados sensíveis → aceite operacional**. Não publicar componente isolado que dependa de backend ainda não implantado. Conservar branch/sha pinados e rollback. Não duplicar motores existentes.
- Manter um só **quadro de status** na Issue mestre, atualizado no fechamento de cada janela: **Feito | Em validação | Bloqueado | Adiado**; marcar checkbox somente após evidência, não por código escrito.
- **Controle de escopo 06/12:** qualquer funcionalidade ainda não iniciada e que não seja P0/P1 sai da entrega de dezembro. **Congelamento absoluto 14/12:** só correção, homologação e contingência.
- Responsabilidade: **implementação/revisão técnica pela execução de desenvolvimento assistida; validação diária e aceite do proprietário/operadores da Pet King**. Não assumir uma equipe adicional nem inventar assignees. Aprovações necessárias para produção/finanças ficam identificadas por tarefa, e não podem ser inferidas do CI.

## 5. Testes finais mínimos (obrigatórios)
- [ ] Login, permissão de atendente/veterinário/administrador, isolamento entre 2 CNPJs e organização fictícia.
- [ ] Cadastrar cliente e pet, editar/consultar histórico, preservar vínculo.
- [ ] Comanda com produto do CNPJ A + serviço do CNPJ B; remover item, ocultá-lo da UI mas manter auditoria.
- [ ] Fechamento manual misto: registro consistente por empresa, sem venda em dobro, valores e formas de recebimento informados corretamente.
- [ ] Caixa, estoque, lotes/granel e financeiro idênticos aos itens por CNPJ; estorno integral reflete saldos.
- [ ] Consultório: cadastro → atendimento → exame/procedimento → histórico → cobrança.
- [ ] Banho e tosa: agendamento → OS → execução → pacote → comanda → cobrança.
- [ ] Agenda impede conflito de horários e identifica responsável.
- [ ] Financeiro: pagar/receber, crédito/fiado e relatório de fechamento em cada CNPJ.
- [ ] Portal: login do tutor, seus pets e agendamento, sem dados de terceiros.
- [ ] Backup recente acessível, restauração isolada demonstrada, procedimento de recuperação e rollback documentados.
- [ ] Health/API/admin/portal online; zero P0; lista de P1/P2 com aceite explícito.

**Aceite:** no mínimo os 12 cenários acima; evidência de fechamento dos P0/P1, operadores Pet King aprovando execução em operação real, responsável registrando data/versão no GitHub. O sucesso da CI isolada não é substituto.

## 6. Impedimentos que devem ser antecipados
1. **Fechamento unificado:** usar flag e allowlist **somente da organização Pet King e seus dois CNPJs**, depois de aceite de PDV/estoque/estorno; preservar obrigação de documentos fiscais externos.
2. **Código ainda em DRAFT:** integrar PRs com ordem de dependências; garantir que a release ativa do Railway não seja sobrescrita por `main` antigo. A main deve refletir a versão validada até a etapa de RC.
3. **Dados e acesso:** operar testes financeiros com venda de teste identificada, sem exposição de CPF/segredos; restaurar apenas em destino autorizado.
4. **Aprovação do operador:** agendar aceite PDV em 22/11, atendimento/banho em 29/11 e aceite geral em 20/12. Se não houver operador disponível, registrar bloqueio de negócio imediatamente.
5. **Disponibilidade e prazo:** do dia 11/11 ao prazo final são **49 dias corridos**; alvo 23/12 deixa 7 dias de contingência. Qualquer risco de não concluir o MVP precisa ser comunicado como tal, não mascarado com um novo patch.

## 7. Primeiros próximos passos do desenvolvimento
1. Auditar **status real de cada módulo pelo fluxo**, não pela quantidade de arquivos nem por nomes de fases "concluídas". Criar checklist de P0/P1 por frente.
2. Concluir teste operacional do PDV M.5.75 com Pet King; resolver opt-in, permissões e fechamento conjunto manual com dois CNPJs; conferir report/caixa/estoque e estorno.
3. Normalizar base de releases/PRs sem sobrescrever produção: `main`, PRs #35/#36/#38, release pinada, pipelines e deploys.
4. Executar sprints na ordem de dependências; registrar diariamente somente entregas e bloqueios de impacto no prazo.
5. Toda nova conversa sobre PointVet deve consultar **este plano e a Issue mestre** antes de criar novas fases. **Não recomeçar o planejamento ou voltar a M.5.x sem necessidade operacional.**

**Fontes de continuidade:** `ROADMAP_SAAS.md`, `POINTVET_CONTINUIDADE_OFICIAL.md`, Issue #37, PR #36 e PR #38. Este plano prevalece **quanto ao calendário, prioridades e corte de escopo**, sem alterar restrições técnicas de segurança, privacidade e integridade do banco.
