# PointVet M.5.16 — fluxo operacional de repasses manuais (consulta guiada)

## Escopo

A M.5.16 prepara o fluxo operacional **sem abrir endpoints que executem baixa ou contralançamento em produção**. A diretriz confirmada pelo usuário é de **nenhuma integração com banco, maquininha, adquirente, PSP, TEF ou Open Finance**. O operador consulta o comprovante/extrato fora do PointVet e faz registros internos manuais, sujeitos a permissões e auditoria.

## Entregas

- `api/src/modules/pdv/pdv-unificado-fluxo-operacional.contract.js`: projeção pura dos eventos de cada pré-baixa com 4 etapas: `AGUARDANDO_SEGUNDA_CONFERENCIA`, `SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA`, `REPASSE_INTERNO_CONFIRMADO_MANUALMENTE` e `CORRECAO_INTERNA_REGISTRADA`. Cada etapa significa um **registro interno**, não comprovação bancária independente. Bruto, tarifa, antecipação e líquido exibidos exatamente em centavos.
- O contrato verifica organização, empresa, comanda, conta, referência, unicidade das preparações, status, valor bruto = tarifa + antecipação + líquido; recusa entradas órfãs, repasse anterior à segunda conferência, crédito em conta errada, débito parcial, múltiplas compensações, operador igual na correção e dados de outra empresa. Resultado permanece `integracaoBancaria=false`, `confirmacaoDisponivelNaTela=false` e `checkoutDisponivel=false`.
- `api/src/modules/pdv/pdv-unificado-fluxo-operacional.service.js`: consulta **read-only** registros M.5.10/M.5.11/M.5.13/M.5.14 após autorização M.5.7 (tenant, usuário ativo, PDV+Financeiro, `financeiro.gerenciar`, opt-in). Usa snapshot RepeatableRead; se houver mais de 50 preparações por comanda, falha fechado `M516_LIMITE_EXCEDIDO` em vez de mostrar status incompleto.
- Nova rota `GET /api/pdv-unificado/recebiveis-cartao/comandas/:comandaId/etapas`, sem POST/PUT/PATCH/DELETE, com `Cache-Control:no-store`. Discrepâncias retornam erro 409 genérico.
- `admin-web/src/components/UnifiedCardReceivablesPanel.jsx`: tabela guiada de etapas, valores, tarifas e antecipações por pré-baixa. **Não há campos ou botões para liquidar, corrigir, cobrar ou emitir nota**.
- Testes puros de todas etapas e rejeição de duplicidades, saldo incompatível e multiempresa; testes PostgreSQL completos percorrem pré-baixa, parecer, confirmação interna e correção sintéticas, comprovando também 403/404, opt-out e HTTP apenas leitura; workflow executa node checks, Prisma, build admin e integração com PostgreSQL descartável.

## Limites / requisitos antes de publicação

Esta entrega **não é a confirmação operacional efetiva em staging ou produção** e não substitui os serviços CI-only de escrita M.5.13/M.5.14. Não faz upload de extratos, não consulta bancos, não movimenta dinheiro, não altera `Pagamento`, venda, títulos, estoque, contas bancárias ou fiscal. Operações no Financeiro são contabilizações **internas**, mediante confirmação humana externa.

Gates restantes: homologação operacional segura da escrita (autorização, dupla conferência, tela de confirmação e contralançamento), política de tarifas/antecipações e estornos com consequências fiscais, staging **real segregado aprovado**, restore/rollback **reais** e piloto opt-in. Checkout comercial deve permanecer desativado, PR #36 continua DRAFT, `main` e produção Pet King ficam intactos.

**Status da M.5.16:** confirmar `validate SUCCESS` e `isolated-postgres SUCCESS` no SHA final antes de declarar conclusão.
