# PointVet M.5.43 — jornada de venda a granel com pagamento manual misto (somente CI)

Data: 17/10/2026. Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37), dentro da [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36), após a M.5.42.

## Decisão de produto

A primeira versão do PointVet será um **PDV de gestão manual**. O atendente usa sua balança sem integração, escolhe o produto e digita o peso em **gramas inteiros** ou o valor em **reais**. Dinheiro, Pix, débito, crédito e transferência serão declarados pelo atendente; o PointVet não consulta nem confirma recebimentos em instituições externas. Conexão com balança, leitor de código de barras/QR, PSP/TEF e motor fiscal ficam **fora do escopo inicial**. A emissão fiscal pelo próprio PointVet só será considerada após escolha expressa de provedor. Antes de operação comercial, é necessário definir processo externo aplicável de regularização fiscal/contábil.

## Fluxo encadeado validado

O teste comportamental PostgreSQL `api/tests/pdv-unificado-integration.test.mjs` passa a exercitar a mesma comanda, de ponta a ponta, sem atalhos nos valores:

1. Catálogo: ração adulta a **R$ 15,00/kg**, estoque e lote inicial de **2,000 kg**. Uma venda anterior já consumiu 333 g, restando **1,667 kg**.
2. Entrada manual de **R$ 5,00** passa pelo mesmo `bulkFromAmount` usado no navegador, retornando **333 g / 0,333 kg / 500 centavos**. A API recalcula a comanda: **R$ 5,00**.
3. Reserva e pré-conferência usam o mesmo `previewManualAllocation` da UI com **R$ 3,00 em dinheiro + R$ 2,00 em Pix** no caixa aberto da empresa correta. Se faltarem **R$ 0,01**, a prévia e a preparação **no servidor** recusam prosseguir; nenhuma venda/pagamento/baixa é criada.
4. Preparação imutável e declaração de recebimento exigem confirmação explícita da atendente em **cada linha**. Uma forma sem confirmação é rejeitada sem registro parcial. Repetir a mesma declaração reaproveita o registro sem gerar pagamentos.
5. Somente o serviço **isolado do CI** cria a venda e efetiva as duas linhas de pagamento com trilha de dinheiro no caixa. A baixa transacional consome exatamente **0,333 kg** do lote, passando o saldo de **1,667 kg para 1,334 kg**. Repetir o fechamento não duplica pagamentos nem movimentos.
6. Cancelamento **integral**, condicionado à confirmação declarada de devolução externa, estorna os dois pagamentos e repõe exatamente **0,333 kg ao mesmo lote**, recuperando **1,667 kg**. Repetir o estorno não duplica devolução.
7. Durante todo o ensaio, **nenhum documento fiscal é emitido ou criado**.

## Restrições e próximo passo

- O fluxo acima é **um teste integrado do serviço existente**, não uma funcionalidade de checkout acessível via HTTP. A tela continua em modo de pré-conferência. O CI usa exclusivamente `pointvet_unified_ci`, `NODE_ENV=test` e a flag isolada; nenhum dado real da Pet King é utilizado.
- Para transformar o fluxo em **PDV manual operacional**, ainda é preciso projetar e homologar a ação autenticada de confirmar a venda, com proteção de concorrência, autorização por caixa/empresa, reconciliação, cancelamento, trilha de auditoria e plano de reversão. Ativar isso requer revisão e autorização separadas; não se presume que o teste já conceda essa autorização.
- Não houve conexão física com balança/QR/leitor, banco ou máquina de cartão; não houve SDK fiscal, emissão de notas, deploy, merge ou alteração na `main`/Railway/Pet King.

Critério de aceite técnico: GitHub Actions do **HEAD da PR #36** com `validate` e `isolated-postgres` concluídos em `SUCCESS`.
