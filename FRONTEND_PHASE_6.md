# PetRise — Fase 6

## Escopo implementado

### PDV operacional por CNPJ
- Tela real de PDV no painel administrativo.
- Catálogo do CNPJ atual com busca por nome, SKU ou código de barras.
- Carrinho com produtos e serviços.
- Cliente opcional para venda balcão.
- Pet obrigatório quando o serviço estiver configurado com `exigePet`.
- Quantidade fracionada e desconto por item.
- Desconto geral e acréscimo.
- Múltiplas formas de pagamento na mesma venda.
- Histórico de vendas e detalhe completo.
- Cancelamento/estorno de venda com restauração automática do estoque.

### Caixa
- Cadastro de caixas por empresa/CNPJ.
- Abertura com valor inicial.
- Suprimento e sangria.
- Fechamento com valor contado, valor esperado e diferença.
- O PDV exige uma sessão de caixa aberta para finalizar vendas.

### Estoque durante a venda
- Produtos com controle de estoque sofrem baixa dentro da mesma transação da venda.
- Venda é bloqueada quando não existe saldo suficiente.
- Cada baixa gera `MovimentacaoEstoque` com saldo anterior/posterior e referência à venda.
- Cancelamento restaura o saldo e registra uma movimentação de `CANCELAMENTO`.

### Comandas multi-CNPJ
- A comanda é da organização/cliente e pode receber lançamentos de diferentes CNPJs.
- O usuário lança apenas itens pertencentes ao CNPJ atualmente selecionado.
- A visualização agrupa os valores de cada empresa.
- O fechamento é feito por CNPJ: cada empresa gera sua própria `Venda` e seus próprios `Pagamento`.
- Quando ainda existem itens de outro CNPJ, a comanda fica `PARCIALMENTE_FECHADA`.
- Quando todos os CNPJs fecham seus itens, a comanda passa para `FECHADA`.
- Cancelar uma venda oriunda de comanda reabre somente os itens daquela venda.

### Recebimento de pacotes
- Pacotes contratados na Fase 5 que ainda não possuem `vendaId` aparecem na fila do PDV.
- O recebimento cria uma venda no CNPJ proprietário do pacote.
- A venda é automaticamente vinculada ao `PacoteCliente.vendaId`.
- Cancelar essa venda desassocia o pacote para que possa ser recebido novamente.

## “Mantenha-me conectado”
A tela de login agora possui a opção **Mantenha-me conectado**.

### Ativa
- Sessão é armazenada de forma persistente no navegador.
- O access token continua curto (`JWT_ACCESS_EXPIRES`, recomendado 15–30 min).
- Quando ele expira, o frontend usa `/api/auth/refresh` silenciosamente e continua a operação.
- O refresh token da sessão persistente não possui expiração temporal.
- A sessão termina por logout, revogação da sessão, bloqueio do usuário ou troca dos segredos JWT.

### Desativada
- Sessão usa `sessionStorage`.
- O refresh token continua com `JWT_REFRESH_EXPIRES_DAYS`.
- Fechar a sessão do navegador remove o login local.

### Logout
`POST /api/auth/logout` marca `SessaoUsuario.revokedAt`, portanto um refresh token antigo não pode reutilizar a sessão depois do logout.

## Migration desta fase
Foi adicionada:

`api/prisma/migrations/20261008060000_remember_session/migration.sql`

Ela:
- adiciona `SessaoUsuario.lembrarConectado`;
- torna `SessaoUsuario.expiresAt` opcional para sessões persistentes.

Aplicar com:

```bash
cd api
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run dev
```

## Rotas novas de autenticação
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Rotas do PDV
- `GET /api/pdv/resumo`
- `GET /api/pdv/itens`
- `GET/POST /api/pdv/caixas`
- `GET /api/pdv/caixa/aberta`
- `POST /api/pdv/caixas/:id/abrir`
- `POST /api/pdv/sessoes/:id/movimentacoes`
- `POST /api/pdv/sessoes/:id/fechar`
- `GET/POST /api/pdv/vendas`
- `GET /api/pdv/vendas/:id`
- `POST /api/pdv/vendas/:id/cancelar`
- `GET/POST /api/pdv/comandas`
- `GET /api/pdv/comandas/:id`
- `POST /api/pdv/comandas/:id/itens`
- `DELETE /api/pdv/comandas/:id/itens/:itemId`
- `POST /api/pdv/comandas/:id/fechar`
- `GET /api/pdv/pacotes-pendentes`
- `POST /api/pdv/pacotes/:id/receber`

## Teste sugerido
1. Faça login com **Mantenha-me conectado** marcado.
2. Entre no CNPJ Loja/Consultório.
3. Em **PDV -> Caixa**, crie e abra um caixa.
4. Cadastre/garanta um produto com estoque e um serviço no catálogo.
5. Faça uma venda rápida com PIX ou dinheiro.
6. Faça outra venda dividida entre duas formas de pagamento.
7. Confira Histórico e detalhes da venda.
8. Crie uma comanda para um cliente e lance um item da Loja/Consultório.
9. Troque para o CNPJ Banho e Tosa, reabra a mesma comanda e lance um serviço daquele CNPJ.
10. Feche primeiro um CNPJ e confirme que a comanda fica **Parcialmente fechada**.
11. Feche o segundo CNPJ e confirme que ela passa para **Fechada**.
12. Cancele uma venda de teste e confira a restauração do estoque.
13. Se houver pacote sem venda, use **Receber pacotes** e confira o vínculo da venda.
14. Para testar renovação automática rapidamente, configure temporariamente `JWT_ACCESS_EXPIRES="1m"`, entre com Mantenha-me conectado e continue usando o painel após um minuto: não deve voltar para o login.
15. Clique em **Sair**, reabra o PetRise e confirme que a sessão foi encerrada.

## Observações
- O fechamento fiscal (NF-e/NFC-e/NFS-e) continua desacoplado e será conectado posteriormente às vendas.
- Lotes/validade e entradas de estoque terão uma fase própria mais completa.
- Para múltiplos terminais simultâneos, a próxima evolução do caixa será permitir selecionar explicitamente a sessão/terminal ativo em vez de usar a sessão aberta mais recente do CNPJ.
