# PointVet M.5.53 — Identificador de suporte e ensaio controlado de gate (20/10/2026)

**Estado do trabalho:** a preparação operacional e a segurança do staging foram homologadas; o botão que **grava a venda** e o **estorno** ainda não foram acionados nesta sessão. Não confundir prévia de recebimento com transação efetiva.

## Entrega de código

- Branch da PR #36 (Draft): `feat/pointvet-20-1-unified-pdv-foundation`; commit `388a307a739b7916aa9518c59e48ab7691b3d012`.
- Configurações da organização mostram seu identificador de suporte em texto somente de leitura, viabilizando allowlist do checkout sem inspeção de credenciais.
- GitHub Actions **PointVet Unified PDV Foundation** `39427440538`: **SUCCESS**, inclusive testes com PostgreSQL isolado.
- Somente serviço `pointvet-admin-staging`, projeto `Pet King PDV Homologacao`, ambiente `staging`: deployment `6ffcf089-f23e-4165-9ca2-7b8abf94e6df` **SUCCESS**. Produção Pet King: 8/8 serviços saudáveis, nenhum deploy ou banco alterado.

## Jornada visual de staging

- Organização sintética `cmvbsu42u00021zlhf7ot9846`, Loja `cmvbsu43h00041zlhugbo5h6k` e Banho e Tosa `cmvbsxix3000347lboku1np2m`, IDs lidos da interface autenticada. CNPJs e credenciais não reproduzidos aqui.
- Comanda sintética **#3, versão 2, reservada**: granel 333 g = R$ 5,00 (Loja) e banho = R$ 10,00 (Banho e Tosa). Preparação imutável de duas operações: Loja R$ 3,00 dinheiro + R$ 2,00 Pix no caixa fictício; Banho R$ 10,00 transferência em outro caixa fictício.
- Saldo do produto `STG-PDV-GRANEL-001` observado pela UI: **1 QUILOGRAMA antes e depois** do ensaio; nenhuma baixa feita neste ensaio.
- Janela temporária **apenas na API de staging**: `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED=1`, `ORG_IDS` restrita a `cmvbsu42u00021zlhf7ot9846` e `COMPANY_IDS` restrita aos dois IDs acima. API deployment `14f72a46-011f-4a3f-8afe-94f8bc9168cd` **SUCCESS**. Pela UI, o título mudou de **Simulação** para **Fechamento manual**.
- Três referências preenchidas com texto explícito de teste (`STAGING FICTICIO - sem ... real`); três marcadores de conferência local assinalados; validação local das três formas concluída. **Não houve clique em “Confirmar recebimentos e registrar venda”**, pois essa ação grava lançamentos financeiros e demanda confirmação pontual do usuário. Também **não houve estorno**.
- As três flags foram devolvidas a `0` / listas vazias; API deployment de reversão `41d1a412-6398-4c84-9eb5-1dd591a0dda1` **SUCCESS**. A UI autenticada voltou a **Comanda multiempresa — Simulação**, checkout indisponível. Staging 4/4 saudável; produção 8/8 saudável.

## Continuação exata

1. Obter confirmação pontual para acionar registro sintético de R$ 15,00 + estorno integral na comanda #3 exclusivamente no staging, sem dinheiro, fiscal, PSP ou transferência real.
2. Habilitar flags temporariamente **com os mesmos IDs** e conferir resposta de disponibilidade. Após a venda, validar duas vendas e três pagamentos gerenciais, estoque 1,000 → 0,667 kg, caixas separados, idempotência; registrar estorno integral com motivo/referência **explicitamente fictícia**, validar estoque e ledger revertidos.
3. **Restaurar imediatamente** as três flags OFF/vazias e validar deploy SUCCESS + UI Simulação; documentar evidências em Issue #37/PR #36. Não ativar produção, não fazer merge, não restaurar backup R2 REAL sem autorização independente.

Esta alteração permanece em **PR #36 Draft**, fora de `main`; a homologação não equivale a aceite comercial, fiscal ou financeiro.
