# PointVet M.5.38 — concorrência da unidade de estoque a granel

Data: 16/10/2026. Continuação da Issue #37 e PR #36 **Draft**, após M.5.36/M.5.37 aprovadas em [CI #38980492036](https://github.com/isaquesan7/sistema-pet/actions/runs/38980492036), jobs `validate` e `isolated-postgres` SUCCESS, HEAD `dae13cea4e6a3ce90832f07f0229f634a37c86d2`.

## Invariante operacional

Um registro de **0,333 kg** de ração precisa significar **333 gramas**, nunca 0,333 g. A troca de `Produto.unidade` só é válida antes do primeiro histórico dependente, mesmo que outra operação esteja criando esse primeiro registro simultaneamente.

## Mudanças

1. `travarUnidadesProdutos` obtém `SELECT ... FOR SHARE` do produto **antes** de ler a unidade/preço/saldo e escrever histórico. IDs únicos são ordenados para evitar deadlocks entre operações de múltiplos SKUs. `protegerUnidadeEstoque` segue adquirindo `FOR UPDATE` exclusivo antes de conferir dez fontes históricas.
2. O PATCH de mudança de unidade passa a usar snapshot PostgreSQL `ReadCommitted`, de modo que a contagem feita **depois de aguardar o FOR UPDATE** enxergue linhas confirmadas durante a espera. Manter `Serializable` sem retry nesse ponto poderia ler snapshot antigo, apesar da trava.
3. Escritores protegidos: rascunho multiempresa do PDV Unificado, entrada/ajuste/inventário de estoque, preparação de venda/comanda no PDV legado, procedimento clínico, modelos de pacote e conversão de orçamento no banco isolado CI. Sem mudar as rotas fiscais e sem ativar checkout do Unificado.
4. Entradas, ajustes e contagem de estoque não aceitam frações menores que **1 grama**: `QUILOGRAMA` admite até três casas decimais, `GRAMA` somente inteiro (zero permitido para contagem). Retorno HTTP 400 amigável no Estoque; falhas revertem a transação sem saldo parcial.

## Provas

- Contrato puro `api/tests/pointvet-m538-granel-concorrencia.contract.test.mjs`: locks únicos, ordenados, parametrizados; caminhos de escrita bloqueiam antes de consultar produto, e precisão de 1 g.
- PostgreSQL descartável `api/tests/pdv-unificado-integration.test.mjs`:
  - Escritor mantém `FOR SHARE`, cria primeira comanda de 333 g; PATCH concorrente aguarda, detecta uso e devolve `UNIDADE_ESTOQUE_EM_USO`.
  - Alteração de unidade possui `FOR UPDATE` antes do primeiro rascunho; rascunho concorrente com 0,333 da unidade `GRAMA` é recusado, sem linha residual (ou aborta com erro de serialização seguro).
  - Entrada de estoque 0,333 g após mudança para `GRAMA` é rejeitada e não cria cabeçalho, movimento nem saldo.

## Escopo e próximos gates

- Protege os gravadores mapeados neste marco; futuras escritas em tabelas de histórico devem **obrigatoriamente** reutilizar a trava no início da mesma transação. Antes de homologação real, revisar também importações externas/SQL direto e considerar proteção de banco (trigger/constraint) se forem habilitadas, sem presumir que só o helper cobre integrações futuras.
- Ainda faltam retorno/devolução/cancelamento por lote FEFO e concorrência de múltiplas baixas, além de operação assistida com balança física (gramas inteiros), staging segregado, restore/rollback reais e piloto autorizado.
- **Não é motor fiscal**: nenhum provedor/SDK, emissão XML, PSP, TEF, banco ou maquininha. PR continua Draft, checkout real do Unificado bloqueado; sem merge, deploy, mudanças em `main`, Railway ou Pet King.
- **CI desta M.5.38 aprovado:** HEAD `71058cd0d8fa0fa9bc3d7fee211d384582c2ce97`, [Actions #38982308107](https://github.com/isaquesan7/sistema-pet/actions/runs/38982308107), jobs `validate` e `isolated-postgres` **SUCCESS**. Próximo teste FEFO/estorno: [M.5.39](POINTVET_M539_ESTORNO_GRANEL_LOTES_FEFO.md).
