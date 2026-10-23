# PointVet M.5.52 — Correção da troca de CNPJ e teste de jornada na UI

**Data:** 20/10/2026 (America/Sao_Paulo). **Issue:** #37. **PR:** #36 (Draft).

## Defeito reproduzido na homologação

Em M.5.51, as chaves de cache da tela já eram segmentadas por organização e empresa, mas o seletor global em `AppLayout.jsx` chamava `navigate("/")` em toda troca de CNPJ. Ao alternar de Pet King Banho e Tosa para Pet King no PDV Unificado, o operador saía da comanda e voltava ao Dashboard. Logo, o aceite visual de permanência de comanda ainda **não estava concluído**, embora os contratos puros M.5.51 passassem.

## Correção mínima sem retrabalho

- O seletor de empresa preserva a rota **somente** se o operador está em `/pdv/unificado/simulacao`, o novo CNPJ pertence à mesma organização e possui `pdv.acessar`.
- Em todas as outras páginas, organizações diferentes, empresas desconhecidas ou sem essa permissão, permanece o comportamento anterior de navegar ao Dashboard.
- O workspace React já possuía chave por organização: ao permanecer na rota e mudar apenas a empresa, seu estado de rascunho continua; as consultas M.5.51 refazem o cache por empresa. Nenhuma alteração em serviços transacionais ou schema.
- Teste puro adicionado em `admin-web/tests/unified-context.test.mjs` cobre caminho, organização, permissão e fallback.

**Código final:** `b768d694c95e9ba332a0209b82b7a676147d0af4` (após commits `b1dbfff` e `10493db`). **GitHub Actions #39424381896:** jobs `validate` e `isolated-postgres` SUCCESS, incluindo build da UI. Testes locais M.5.51/M.5.52: 2 suítes aprovadas, `git diff --check` aprovado.

## Homologação técnica efetiva no Railway separado

- Projeto: `Pet King PDV Homologacao`; ambiente: `staging`; **somente** serviço `pointvet-admin-staging` pinado em `b768d694...`. Deploy `9bd2e2c5-8bf2-4a1d-b667-284cd409049f` **SUCCESS** em 20/10/2026; **4/4** serviços do staging online e nenhum pending work/alerta. API, PostgreSQL e portal não alterados; produção Pet King preservada.
- Conta **Operador Homologacao Pet King**, ambiente com banner explícito de dados de teste; dois CNPJs fictícios/registrados no staging exibidos.
- Reaberto rascunho sintético **#3** com tutor de homologação, banho R$ 10,00 em Banho e Tosa e ração R$ 15,00/kg na Loja. Alternância **Banho e Tosa → Loja → Banho e Tosa** manteve a URL do PDV Unificado, o tutor, os itens e o plano por empresa.
- Corrigido somente o peso da fixture de 300 g para **333 g**, total da ração **R$ 5,00**; rascunho #3 salvo como **versão 2**, sem venda. Pré-fechamento por CNPJ: R$ 10,00 Banho e Tosa + R$ 5,00 Loja = **R$ 15,00**.
- `Reservar operações por empresa` **aprovado**; edição de tutor/itens ficou bloqueada. Conferência manual: Banho e Tosa R$ 10,00 por transferência; Loja R$ 3,00 dinheiro + R$ 2,00 Pix, cada qual em seu caixa de homologação. `Conferir alocação (sem cobrar)` retornou `preConferenciaAprovada`; `Salvar preparação (sem vender)` criou snapshot de **duas operações**.
- Checkout continuou OFF: a tela só disponibilizou **declaração local (simulação, sem registro)**, sem botão de registrar venda. As caixas de "recebimento externo confirmado" não foram marcadas, pois **nenhuma transferência/dinheiro real ocorreu**. Não houve `Pagamento`, venda, baixa de estoque ou emissão fiscal nesse teste.

## Gates remanescentes e decisão necessária

1. Aceite formal do proprietário/supervisor da Pet King sobre a navegação, dados por empresa, reserva e conferência; este registro é uma **vistoria técnica de agente** e não substitui assinatura de operador/proprietário.
2. Janela autorizada para testar **checkout manual e estorno integral pela UI no staging exclusivamente com fixtures**: ativar temporariamente as flags/allowlists específicas, conferir ledger/baixa FEFO/estorno/replay e devolver flags a OFF. Requer autorização expressa, mesmo com API CI e HTTP M.5.48 já testados.
3. Restore de **backup R2 real** somente com autorização separada de origem, destino novo descartável, tratamento LGPD, medição RTO/RPO, retenção e rollback; não copiar produção ao staging de fixture.
4. Processo fiscal/contábil externo aplicável e aceite por CNPJ antes de qualquer piloto comercial; motor fiscal, banco/PSP/TEF, maquininha, balança e leitores físicos continuam fora da primeira entrega manual.

**Não houve** merge da PR #36, deploy/migração na `main` ou produção Pet King, mudança de flag comercial nem processamento real de dinheiro. Rascunho fictício #3 permanece reservado em staging para eventual inspeção posterior.
