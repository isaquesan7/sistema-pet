# PointVet M.5.40 — concorrência na baixa de ração a granel, até o último grama

Data: 16/10/2026 (horário de Brasília). Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) / [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36), após a M.5.39 aprovada no commit `663424a778f363f53fb9a5a8f49271e9c5847752`, [Actions #38983707144](https://github.com/isaquesan7/sistema-pet/actions/runs/38983707144), `validate` e `isolated-postgres` SUCCESS.

## Problema

Duas comandas diferentes e dois caixas distintos podem tentar vender a mesma ração enquanto restam poucos gramas no estoque. Travas de sessão de caixa, isoladamente, não bastam porque os caixas são independentes. O sistema precisa preservar saldo e lote de forma atômica, sem duplicar venda ou pagamento manual.

## Regra e implementação

1. Cada fechamento continua **somente** no banco PostgreSQL descartável `pointvet_unified_ci`, em **uma transação `Serializable`**. O saldo do produto é travado por `FOR UPDATE` e sua baixa exige `quantidade >= total`. O lote FEFO também é atualizado condicionalmente com saldo suficiente. Qualquer falha reverte todos os pagamentos, venda, movimentos de caixa e estoque daquela transação.
2. Adicionado `executarComRetrySerializableM540`: em conflito PostgreSQL/Prisma `P2034` ou erro de consulta SQL de trava `P2010` **exclusivamente com SQLSTATE `40001` (serialização) / `40P01` (deadlock)** — que implicam **rollback da transação inteira** — refaz a operação por no máximo **três tentativas totais**, sempre reconsultando comanda, reserva, caixa, preço, saldo e lotes. O código SQL é lido de metadados explícitos ou, no Prisma 7 com driver que não expõe `meta.code`, do envelope exato gerado pela própria consulta raw; texto arbitrário ou códigos SQL desconhecidos não passam. Não repete pagamentos externos ou operações fora da transação: não existem neste serviço.
3. Erros de **estoque insuficiente**, permissão/caixa, entrada inválida, divergência, falha simulada, outros SQLSTATEs ou banco indisponível **não** provocam nova tentativa automática. Se esgotar o limite de conflitos transacionais, o erro é devolvido para tratamento seguro do operador; nunca ignora a proteção condicional.
4. Soma de frações em milésimos de unidade deve permanecer inteiro seguro antes de qualquer baixa; valores impossíveis abortam.

## Testes

- Contrato puro `pointvet-m540-concorrencia-granel.contract.test.mjs`: duas abortagens `P2034` e sucesso na terceira tentativa; abortos `P2010` com SQLSTATEs específicos e recusa dos demais; limite de tentativas; erros sem repetição; presença de transação `Serializable`, locks e atualizações condicionais no serviço.
- Integração PostgreSQL CI (`pdv-unificado-integration.test.mjs`), com **duas comandas, caixas diferentes e mesmo SKU/lote**. Preparar **sequencialmente** as reservas independentes antes da corrida impede confundir conflitos do registro inicial com a baixa; uma terceira transação segura o lock do saldo durante a largada dos **fechamentos simultâneos**:
  - **2 g em lote FEFO / 2 vendas simultâneas de 1 g:** ambas devem finalizar, depois de esperar ou repetir uma transação abortada; saldo e lote terminam em **0 g**, com exatamente **2 movimentos**; os replays não baixam novamente.
  - **1 g em lote FEFO / 2 vendas simultâneas de 1 g:** apenas uma pode finalizar. A outra termina em `M3_ESTOQUE_INSUFICIENTE` após reconsultar o estoque; o único grama é deduzido uma vez, há só **1 pagamento** e **1 movimento** adicionais, sem documento fiscal.
  - Preço de fixture **R$ 10,00/kg**, de modo que **1 g = R$ 0,01** sem ambiguidade de arredondamento; balança continua em gramas inteiros.

## Limites

- Este código é exclusivamente o caminho interno de **fechamento manual de CI**, ainda sem rota de checkout real do PDV Unificado. A proteção para estoque concorrente no produto/FEFO não dispensa testar inventário, recebimentos, devoluções e integração com o estoque legado sob carga real.
- Homologação assistida com balanças físicas (gramas inteiros), conferência de etiqueta/precificação, duas frentes simultâneas, cancelamento físico, revisão contábil, staging segregado, backup/restauração e rollback reais continuam gates pendentes sob autorização específica.
- Não há integração de motor/provedor fiscal (que aguarda escolha do proprietário), emissão de NF, PSP, TEF, banco, maquininha, deploy ou alteração da produção. PR #36 segue **Draft**; `main`, Railway e Pet King intocados.
- **CI desta M.5.40 deve ser verificado após publicar o commit exato**, nos jobs `validate` e `isolated-postgres`.
