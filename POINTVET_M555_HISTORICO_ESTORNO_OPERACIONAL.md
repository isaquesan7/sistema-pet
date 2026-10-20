# PointVet M.5.55 — Histórico operacional de estornos integrais (20/10/2026)

## Entrega

Histórico **somente leitura** de estornos integrais concluídos no PDV Unificado, disponível na tela `/pdv/unificado/simulacao`, inclusive com o gate de **checkout manual OFF**. O recurso não reabre, cancela nem estorna vendas: expõe apenas informação operacional de transações já estornadas.

- API: `GET /api/pdv-unificado/rascunhos-estornados` (rota montada pelo módulo PDV unificado), com autenticação, autorização `pdv.cancelar_venda`, preferência `pdvUnificadoHabilitado` e isolamento por organização/empresas às quais o usuário tem acesso. **Não** exige o gate `checkoutManualHabilitado` porque é exclusivamente leitura.
- Dados exibidos: ID de auditoria, data/hora, número da comanda, tutor, total e valores por empresa. Sem exibir detalhes sensíveis adicionais ou dados fiscais.
- Lista limitada a registros recentes, ordenada por data decrescente e filtrada por acesso a todas as empresas participantes.
- Painel: seção **Histórico de estornos integrais**, sem ação de reabertura/estorno, com atualização de cache após um estorno confirmado.
- Teste de integração HTTP cobre lista antes/depois do estorno, autorização interempresa e acesso leitura com flag de checkout desligada; teste de contrato UI cobre os controles e a consulta.

## Homologação verificada

- Código da entrega: `9c6599ea4cc0d543c3304e928cfb7e582a27475c` na branch `feat/pointvet-20-1-unified-pdv-foundation`, PR #36 **DRAFT**.
- [GitHub Actions #39437943344](https://github.com/isaquesan7/sistema-pet/actions/runs/39437943344): **validate SUCCESS**, **isolated-postgres SUCCESS**.
- Ambiente exclusivo: Railway **Pet King PDV Homologacao**, environment **staging**; não é o ambiente comercial.
- Deploy API `1e14cd60-8f2c-4b2a-9f81-e21352db2954`: **SUCCESS**.
- Deploy admin `041d2e58-44b7-4d88-851f-1529fb84f21b`: **SUCCESS**.
- Checagem final Railway: **4/4 serviços online, 0 falhas reportadas**, sem alteração de portal/banco.
- O patch Railway alterou exclusivamente referências de código da API e do admin; **não** alterou variáveis. Permaneceram `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED=0`, `POINTVET_UNIFIED_MANUAL_CHECKOUT_ORG_IDS=` e `POINTVET_UNIFIED_MANUAL_CHECKOUT_COMPANY_IDS=`. Nenhuma venda real, PSP, banco, emissão fiscal ou dinheiro real envolvidos nesta etapa.
- **Ressalva**: a inspeção visual autenticada pós-deploy pelo navegador automatizado ficou bloqueada por proteção do estado de credenciais. Há evidência de teste HTTP/contrato, CI verde e implantação online, **mas não afirmar smoke visual concluído**. A tela precisa de aceite visual do operador habilitado no ambiente de homologação.

## Contexto funcional herdado de M.5.54

A venda sintética multiempresa da comanda **#3 (R$ 15,00)** já tinha sido concluída, reaberta e **estornada integralmente pela interface**, com reversão de estoque **0,667 → 1,000 kg**. O log de M.5.54 tem o adendo final comprovando esse resultado. A tela de histórico M.5.55 fornece visibilidade posterior sem novo checkout nem novo estorno.

## Próxima ação segura

1. Operador abre o painel de **homologação** já autenticado e confirma a seção **Histórico de estornos integrais**, especialmente a comanda fictícia #3, valor e empresas.
2. Em seguida registrar evidência do aceite na Issue #37; não reativar o checkout apenas para consultar histórico.
3. Manter PR #36 draft e produção intocada até verificação funcional e decisão formal de publicação.

## Segurança e limites

- Nenhuma migração de banco, novo pagamento, integração PSP, conciliação bancária externa ou motor fiscal.
- A rota não faz escrita e não enfraquece a política de fechamento manual.
- O recurso apresenta apenas registros das empresas autorizadas dentro da organização corrente, sem vazamento intertenant.
