# PointVet M.5.41 — conferência assistida de balança e etiqueta na prévia do PDV

Data: 17/10/2026 (UTC). Continuidade da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) e da [PR #36 Draft](https://github.com/isaquesan7/sistema-pet/pull/36), após a [M.5.40](POINTVET_M540_CONCORRENCIA_BAIXA_GRANEL.md), validada na [Actions #38985363892](https://github.com/isaquesan7/sistema-pet/actions/runs/38985363892) (`validate` e `isolated-postgres` SUCCESS).

## Objetivo e uso pelo atendente

A prévia existente aceita **peso em gramas inteiros** ou **valor em reais**, sempre com o preço unitário autorizado do catálogo e quantidade na unidade de estoque (kg ou g). Agora cada linha a granel contém uma seção expansível **“Conferir balança e etiqueta (assistido)”**:

1. O atendente monta a comanda pela entrada `Peso (gramas)` ou `Valor (R$)`, com produto e preço cadastrados previamente.
2. Faz a leitura de uma balança física **não conectada ao PointVet**, anotando apenas o número inteiro de gramas exibido. Se houver etiqueta com total em reais, pode digitar também aquele valor, em centavos.
3. A tela compara a leitura digitada **exatamente** com os gramas calculados na comanda e, quando informada, compara a etiqueta **exatamente** com o valor da comanda. Qualquer diferença — inclusive **1 g ou R$ 0,01** — mostra alerta; não se usa tolerância implícita.
4. O painel é **somente informativo e local**: não salva leitura, aprova pesagem física, altera a comanda, bloqueia o botão de salvar, cria venda, pagamento, movimento de estoque ou documento fiscal. Se a linha mudar, a comparação é recalculada e deixa de conferir se a leitura antiga divergir. Ao remover/recriar a linha, a leitura local é descartada.

## Exemplos concretos de aceite (cenários automatizados)

| Cadastro / operação | Comanda esperada | Leitura/etiqueta digitadas | Resultado |
| --- | --- | --- | --- |
| Ração R$ 15,00/kg, informar **333 g** | 333 g, **R$ 5,00** | 333 g / R$ 5,00 | Confere |
| Mesma ração, informar **R$ 5,00** | 333 g, **R$ 5,00** | 333 g / R$ 5,00 | Confere |
| Mesmo cenário | 333 g, R$ 5,00 | 334 g / R$ 5,00 | Divergência de +1 g |
| Mesmo cenário | 333 g, R$ 5,00 | 333 g / R$ 5,01 | Divergência de +1 centavo |
| Produto de R$ 10,00/kg, informar 1 g | 1 g, R$ 0,01 | 1 g / R$ 0,01 | Confere |
| Estoque na unidade GRAMA (R$ 2,00/g) | 4 g, R$ 8,00 | 4 g / R$ 8,00 | Confere, sem converter para kg |

Entradas como `333,3 g`, peso zero, negativo, fora do limite, etiqueta com três casas, campos inválidos e item inválido não recebem confirmação. O valor em reais é sempre arredondado para **centavos** pelas regras já existentes. R$ 5,00 a R$ 15,00/kg corresponde a **333 g** na quantidade inteira representável, não a uma fração de grama.

## Roteiro de homologação física futura (pendente, não executado)

- [ ] Separar organização e catálogo de teste com estoque **não produtivo**, duas referências de ração (unidade kg e g) e preço conhecido.
- [ ] Conferir a calibração vigente das balanças e a indicação em gramas inteiros com responsável da loja; sem controle remoto/dispositivo integrado.
- [ ] Rodar as seis situações acima com leitura física efetiva, idealmente com dois atendentes e verificação de etiqueta (se houver).
- [ ] Verificar manualmente que os alertas de 1 g e R$ 0,01 são compreendidos e que o atendente corrige o item antes de continuar.
- [ ] Testar duas frentes simultâneas, disponibilidade dos lotes FEFO, estorno/cancelamento e limites do estoque em **ambiente autorizado e isolado**; evidência de CI não substitui teste no local.
- [ ] Registrar responsáveis, data, equipamento e divergências em evidências aprovadas, sem guardar dados pessoais ou comprovantes reais nesta prévia.

## Fronteiras preservadas

O checkout do PDV Unificado segue **desativado**. Fechamentos e estornos executáveis da M.3–M.5.40 permanecem só no banco CI descartável `pointvet_unified_ci`. PR #36 fica **Draft**, sem merge/deploy. Não há motor/provedor fiscal, emissão de NFC-e/NF-e, conexão de balança, PSP/TEF/maquininha, migração ou intervenção no Pet King/Railway. O PointVet inicial é **PDV de gestão**; fiscal será projeto independente quando o proprietário escolher o provedor. CI da M.5.41 precisa ser verificado no SHA exato da publicação.
