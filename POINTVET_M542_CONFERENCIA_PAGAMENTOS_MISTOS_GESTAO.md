# PointVet M.5.42 — pagamentos mistos manuais na prévia do PDV de gestão

Data: 16/10/2026 (horário de Brasília), continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) e [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36), após a [M.5.41](POINTVET_M541_CONFERENCIA_ASSISTIDA_BALANCA.md).

## Direção aprovada pelo responsável

A versão inicial do PointVet é **um PDV de gestão, manual**. O atendente pesa a ração em sua balança existente e digita **R$ 5,00** ou **333 g** no PDV para o produto cadastrado a **R$ 15,00/kg**. O sistema já calcula a quantidade correspondente e, quando o fechamento comercial for autorizado/homologado, deverá deduzir **0,333 kg** do estoque e registrar a venda e o recebimento declarado na empresa correta. A baixa transacional já foi demonstrada **somente no PostgreSQL CI**, sem endpoint de fechamento real. Não alegar que esse processo já está publicado.

**Não são requisitos de publicação do PDV de gestão:** conexão com balança, leitor de código de barras/QR, TEF, maquininha, PSP, API bancária nem motor/provedor fiscal do PointVet. Essas integrações são opcionais e futuras; a integração fiscal espera escolha expressa do proprietário. A operação deve observar o procedimento fiscal/contábil externo aplicável, antes de qualquer piloto autorizado.

## Incremento implementado nesta etapa

O componente de pré-conferência da comanda reservada deixa de restringir **uma forma de pagamento por empresa** e aceita **1 a 10 linhas de pagamento por empresa**, correspondendo ao contrato de alocação já suportado pelo servidor: dinheiro, Pix, cartão de débito/crédito e transferência, com pagamentos mistos. Essas linhas representam divisões do total, **não parcelamento de cartão de crédito**; este último continuará fora dessa tela até o contrato específico de registro manual.

- Exemplo: comanda Pet King de **R$ 50,00**, distribuída em **R$ 30,00 dinheiro + R$ 20,00 Pix**. A empresa Banho pode ter outro caixa e R$ 10,01 em Pix. Envia à rota preexistente `conferencia-alocacao` somente `empresaId`, `sessaoCaixaId`, `forma` e `valorCentavos` por linha; nunca aceita identificador CNPJ, total ou caixa de outra empresa como decisão do navegador.
- Validar os números **por centavos inteiros a partir de texto** (vírgula ou ponto como decimal), sem `Number(valor)*100` no formulário. Zero, negativo, dígitos de precisão inválidos, `1e3`, milhares com ponto, valores acima do limite e 1 centavo de diferença do total **bloqueiam o botão de pré-conferência/preparação**.
- Exigir caixa aberto e pertencente à empresa da reserva, usando opções carregadas do backend. Se não houver, não enviar a conferência. A API revalida autoridade, valor da reserva e abertura do caixa, independentemente da verificação local.
- Não introduzir registro de `Pagamento`, conta financeira, pagamento confirmado pelo atendente, parcelas de cartão, comprovante, estoque, emissão fiscal, callback de PSP, checkout ou outra rota. A preparação imutável existente permanece separada e sem execução.

## Testes e limites

- `api/tests/pointvet-m542-pagamentos-manuais-ui.contract.test.mjs`: dois CNPJs, múltiplos pagamentos, valor positivo e centavos, falta de caixa/caixa cruzado, soma divergente por 1 centavo, 0/11 linhas, forma proibida e interface sem rota real de checkout.
- `admin-web/src/lib/unifiedManualAllocation.js`: helper puro sem I/O, retorno claro de pendências e payload de pré-conferência.
- Build/lint admin e regressões antigas do PDV de gestão devem passar; GitHub Actions `validate` e `isolated-postgres` precisam ser verificados no commit publicado.
- A tela é uma **simulação**: ainda não apresenta botão de finalizar a venda, nem é um caixa em produção. Antes da publicação comercial permanecem testes E2E reais do fechamento manual, auditoria/segurança, estoque/FEFO/estornos, caixa, conciliação e restauração/rollback e processo fiscal/contábil externo aplicável por CNPJ, sem integrar um emissor agora.

**Imutável no escopo:** PR #36 Draft, `main`, Railway, Pet King e produção não alterados; sem merge, deploy, ativação de checkout, aplicação de migrations reais ou integração física/fiscal.
