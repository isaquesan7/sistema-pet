# BichOne — Frontend Fase 5

## Escopo implementado
- Módulo visual completo de Pacotes.
- Duas visões: modelos reutilizáveis e pacotes contratados por clientes.
- Criação e edição de modelos FIXO/TEMPORARIO.
- Composição do pacote por produtos e/ou serviços do catálogo do CNPJ atual.
- Quantidade/créditos por item.
- Comparativo entre valor avulso, valor do pacote e economia oferecida.
- Validade em dias, vigência comercial, ativação e visibilidade futura no portal do cliente.
- Criação de pacote de cliente a partir de modelo.
- Criação de pacote PERSONALIZADO para um cliente/pet específico.
- Pacote opcionalmente vinculado a um pet ou disponível aos pets do mesmo tutor.
- Controle visual de saldo, créditos consumidos e progresso.
- Registro de consumo de créditos pelo painel.
- Histórico detalhado de consumos por item, pet, usuário e data.
- Expiração automática de pacotes vencidos ao consultar a carteira.
- Cancelamento de pacote ativo preservando o histórico.
- Filtros por status e pesquisa por pacote, cliente ou pet.
- Resumo de modelos ativos, pacotes ativos, créditos disponíveis e vencimentos próximos.

## Ajustes de backend desta fase
- `GET /api/pacotes/clientes/:id` retorna detalhes completos e histórico de consumo.
- `POST /api/pacotes/clientes/:id/cancelar` cancela pacote ativo sem apagar dados.
- Listagem de pacotes atualiza automaticamente `ATIVO -> EXPIRADO` quando a validade terminou.
- Modelos retornam contador de compras e dados de preço/categoria dos itens.
- Validação exige data inicial na criação de pacote do cliente.

## Rotas utilizadas
- `GET/POST /api/pacotes/modelos`
- `PATCH /api/pacotes/modelos/:id`
- `GET/POST /api/pacotes/clientes`
- `GET /api/pacotes/clientes/:id`
- `POST /api/pacotes/clientes/:id/cancelar`
- `POST /api/pacotes/clientes/itens/:itemId/consumir`
- `GET /api/catalogo/itens?ativo=true`
- `GET /api/clientes?limite=100`

## Teste sugerido
1. Cadastre ao menos dois serviços/produtos no catálogo do CNPJ atual.
2. Entre em **Pacotes -> Modelos** e crie `Pacote 4 Banhos`.
3. Defina 4 créditos de Banho e um valor inferior ao total avulso.
4. Entre em **Pacotes de clientes** e crie um pacote usando esse modelo.
5. Vincule o pacote a um cliente e, opcionalmente, a um pet.
6. Consuma um crédito e confirme a redução do saldo.
7. Abra os detalhes e confira o histórico de consumo.
8. Crie um pacote personalizado com itens diferentes.
9. Teste o cancelamento de um pacote ativo.

## Observação sobre pagamento
Nesta fase o BichOne administra o **contrato e os créditos** do pacote. A geração da venda, recebimento, comanda e vínculo automático com `vendaId` entram na fase de PDV, preservando a separação por CNPJ.

## Sem migration nova
A Fase 5 utiliza as tabelas de pacotes já presentes na SaaS Foundation 2.0.
