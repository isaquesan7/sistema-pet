# Checklist de teste — SaaS Foundation 2.0

Use sempre um token novo e o header `X-Empresa-Id` correspondente ao CNPJ em teste.

## 1. Infraestrutura

- `GET /api/health` -> 200
- `GET /api/health/database` -> `database.status = connected`
- `POST /api/auth/login` -> deve retornar `usuario.organizacoes` e continuar retornando `usuario.empresas`
- `GET /api/auth/contexto` -> deve retornar organização, empresa, cargo, módulos e permissões

## 2. Organização / branding

- `GET /api/organizacao/atual`
- `PATCH /api/organizacao/configuracao`

Exemplo:

```json
{
  "nomeExibicao": "Pet King",
  "corPrimaria": "#EC4899",
  "timezone": "America/Sao_Paulo",
  "locale": "pt-BR",
  "moeda": "BRL"
}
```

- `GET /api/organizacao/modulos`

## 3. Espécies e raças configuráveis

- `POST /api/pets/catalogos/especies`

```json
{ "nome": "Cão" }
```

- `POST /api/pets/catalogos/racas`

```json
{
  "especieId": "ID_DA_ESPECIE",
  "nome": "Golden Retriever"
}
```

- Validar que outra organização não consegue enxergar esses registros.

## 4. Categorias

- `POST /api/catalogo/categorias`

```json
{
  "tipo": "PRODUTO",
  "nome": "Medicamentos"
}
```

- Criar também uma categoria `SERVICO` como `Consultas` ou `Estética`.
- Testar subcategoria por `parentId`.

## 5. Precificação

- `POST /api/catalogo/calcular-preco`

```json
{
  "custo": 10,
  "markupPercentual": 50
}
```

Esperado: preço 15, markup 50%, margem bruta ~33,3333%, lucro bruto 5.

Depois teste:

```json
{
  "custo": 10,
  "precoVenda": 15
}
```

O resultado deve calcular automaticamente os mesmos indicadores.

## 6. Produto / serviço

- `POST /api/catalogo/itens` com `tipo = PRODUTO`
- `POST /api/catalogo/itens` com `tipo = SERVICO`
- Alterar custo/preço e conferir `historicosPreco` em `GET /api/catalogo/itens/:id`
- Validar conflito de código interno e código de barras dentro do mesmo CNPJ

## 7. Funcionários e ponto

- `POST /api/funcionarios/funcoes`
- `PATCH /api/funcionarios/funcoes/:id`
- `POST /api/funcionarios`
- `PUT /api/funcionarios/:id/jornadas`
- `GET /api/funcionarios/:id/ponto/status`
- `POST /api/funcionarios/:id/ponto/bater`

A batida aceita corpo vazio para usar a próxima ação sugerida ou um tipo permitido explicitamente:

```json
{ "tipo": "SAIDA" }
```

O status retorna `proximoTipo` e `tiposPermitidos`. O backend impede transições inválidas e registra qual usuário efetuou a batida.

- `POST /api/funcionarios/ponto/registros/:registroId/ajustes` deve criar histórico sem apagar a batida original.

## 8. Pacotes

- `POST /api/pacotes/modelos`
- `PATCH /api/pacotes/modelos/:id`
- `POST /api/pacotes/clientes`
- `POST /api/pacotes/clientes/itens/:itemId/consumir`

Validar:
- itens precisam pertencer ao mesmo CNPJ do pacote;
- não é possível consumir além do saldo;
- pacote esgotado muda para `ESGOTADO`;
- pacote fora da vigência é bloqueado;
- pacote vencido muda para `EXPIRADO` quando houver tentativa de consumo.

## 9. Isolamento multi-tenant

Esse é o teste mais importante antes de comercializar o sistema:

- cliente da Organização A não aparece na Organização B;
- espécie/raça da A não aparece na B;
- categoria da A não aparece na B;
- funcionário da A não aparece na B;
- usuário sem vínculo com a organização recebe 403;
- um CNPJ continua com vendas, caixa, estoque e fiscal separados dos demais CNPJs.
