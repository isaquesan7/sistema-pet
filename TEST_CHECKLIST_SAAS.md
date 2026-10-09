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

## Fase 12 — Ponto e fechamento mensal
- [ ] Solicitação de ajuste fica pendente e não altera o horário efetivo antes da aprovação.
- [ ] Aprovação passa a aplicar o novo horário no espelho.
- [ ] Rejeição mantém a batida original.
- [ ] Competência fechada bloqueia novos ajustes.
- [ ] Fechamento é bloqueado com ajuste pendente.
- [ ] Fechamento é bloqueado com batida incompleta/sequência inválida.
- [ ] Banco anterior, saldo da competência e acumulado são coerentes.
- [ ] Fechamento individual funciona.
- [ ] Fechamento em lote funciona.
- [ ] Reabertura exige motivo e respeita ordem cronológica.
- [ ] CSV abre corretamente no Excel e mantém caracteres acentuados.

## 13. Fiscal

Após `npm run db:seed`, confirme as permissões `fiscal.visualizar`, `fiscal.gerenciar`, `fiscal.emitir` e `fiscal.cancelar`.

- `GET /api/fiscal/resumo`
- `GET /api/fiscal/configuracao`
- `PUT /api/fiscal/configuracao`
- `GET /api/fiscal/itens`
- `PUT /api/fiscal/itens/:id`
- `GET /api/fiscal/vendas`
- `GET /api/fiscal/vendas/:id/validacao?tipo=NFCE`
- `POST /api/fiscal/documentos`
- `POST /api/fiscal/documentos/:id/processar`
- `POST /api/fiscal/documentos/:id/cancelar`

Para teste de fluxo sem validade fiscal, use `ambiente = HOMOLOGACAO` e `provedorFiscal = development`. O retorno autorizado precisa estar marcado como `simulado = true` e sem chave fiscal oficial.

Em `PRODUCAO`, o provedor `development` deve ser rejeitado.

## 15. SaaS comercial e onboarding

- [ ] `GET /api/saas/publico/planos` funciona sem autenticação.
- [ ] `/comecar` cria organização, primeiro CNPJ, proprietário e assinatura TRIAL.
- [ ] CNPJ e e-mail já cadastrados são rejeitados.
- [ ] Novo tenant recebe somente os módulos contratados pelo plano.
- [ ] `Plano e assinatura` abre para PROPRIETARIO/ADMINISTRADOR e não para membro comum.
- [ ] Trial expirado redireciona a operação para `/assinatura`, sem deslogar o usuário.
- [ ] SUSPENSA e CANCELADA bloqueiam a operação normal.
- [ ] INADIMPLENTE continua acessível nesta fase até suspensão comercial.
- [ ] Simulador de pagamento só funciona com `SAAS_BILLING_PROVIDER=development`.
- [ ] Pagamento de desenvolvimento ativa a assinatura e sincroniza os módulos do plano.
- [ ] Módulo não contratado não pode ser reativado em Configurações.
- [ ] Limites de clientes, pets e funcionários impedem novas criações ao atingir o teto.
- [ ] Cadastro de tutor/pet pelo Portal também respeita os limites do plano.
- [ ] Portal exige `PORTAL_CLIENTE` contratado + habilitado e assinatura disponível.
- [ ] Usuário `superAdmin` acessa `/plataforma` sem depender de `X-Empresa-Id`.
- [ ] Usuário comum recebe 403 nas rotas `/api/saas/plataforma/*`.
- [ ] Console interno altera plano/status da assinatura e registra evento SaaS.
- [ ] Fatura manual pode ser criada, liquidada e cancelada conforme o estado.
- [ ] Tenant existente continua ATIVO no plano Completo após a migration.
