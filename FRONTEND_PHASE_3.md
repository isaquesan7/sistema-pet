# PetRise — Frontend Fase 3

## Escopo desta fase

A Fase 3 transforma **Produtos e serviços** em um módulo operacional do painel administrativo e corrige a regressão identificada na criação de categorias da Fase 2.

### Correção incluída — Categorias

Na Fase 2 o formulário de nova categoria referenciava uma variável JavaScript inexistente (`tipo`) antes de enviar a requisição. Isso fazia o navegador exibir `tipo is not defined` e a API nem chegava a ser chamada.

A criação agora envia explicitamente o tipo selecionado no painel (`PRODUTO` ou `SERVICO`) e continua permitindo categoria pai, ordem, descrição e edição.

## Produtos e serviços

Rota do painel:

- `/catalogo`

A tela respeita o CNPJ/empresa atualmente selecionado e as permissões:

- `catalogo.visualizar`
- `catalogo.gerenciar`

### Recursos implementados

- abas de Produtos e Serviços;
- busca por nome, código interno/SKU ou código de barras;
- filtro Ativos / Inativos / Todos;
- categorias dinâmicas da organização;
- cadastro e edição;
- ativação/inativação sem apagar histórico;
- custo de referência;
- preço de venda;
- markup sobre custo;
- margem bruta;
- lucro bruto unitário;
- cálculo bidirecional no formulário:
  - custo + markup => preço;
  - custo + preço => markup;
- histórico das últimas alterações de precificação ao editar um item.

### Produto

Campos específicos:

- unidade;
- marca;
- estoque mínimo;
- controla estoque;
- controla lote;
- controla validade.

### Serviço

Campos específicos:

- duração estimada;
- permite agendamento;
- exige pet;
- exige profissional;
- gera comissão;
- percentual de comissão.

## Markup x Margem

O PetRise diferencia os dois indicadores:

- **Markup** = lucro / custo;
- **Margem bruta** = lucro / preço de venda.

Exemplo: custo R$ 10,00 e preço R$ 15,00:

- lucro bruto: R$ 5,00;
- markup: 50%;
- margem bruta: 33,33%.

A API continua sendo a fonte autoritativa para o cálculo e grava os valores calculados no histórico de preço.

## Banco / migrations

Esta fase **não exige nova migration**. Ela utiliza as entidades de catálogo e histórico já introduzidas na SaaS Foundation 2.0.

## Como testar

1. API:

```powershell
cd api
npm ci
npm run dev
```

2. Painel:

```powershell
cd admin-web
npm ci
npm run dev
```

3. Teste a correção:

- Configurações → Categorias;
- selecione Produtos;
- crie `Rações`;
- selecione Serviços;
- crie `Consultas`.

4. Teste o catálogo:

- Produtos e serviços → Produtos → Novo produto;
- use custo 10 e markup 50: o preço deve ir para 15;
- altere o preço para 20: markup deve ir para 100 e margem bruta para 50;
- salve;
- edite o item e confirme o histórico de precificação.

5. Repita em Serviços e valide duração, agendamento e comissão.

## Observações

- Produtos/serviços continuam separados por CNPJ/empresa.
- Categorias pertencem à organização e podem ser reutilizadas pelos CNPJs da mesma organização conforme o tipo.
- O módulo fiscal permanece preparado no backend, mas sua interface será implementada em fase posterior.
