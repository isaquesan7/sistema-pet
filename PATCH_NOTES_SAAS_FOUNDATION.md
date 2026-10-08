# Patch — SaaS Foundation 2.0

Este patch transforma a base atual do sistema em uma arquitetura multi-organização (multi-tenant), mantendo a Pet King como a primeira organização, mas sem prender regras de negócio à marca Pet King.

## O que mudou

### 1. Organização / Tenant
- Novo modelo `Organizacao` acima de `Empresa`.
- Uma organização pode possuir vários CNPJs/empresas.
- `Cliente`, `ContaCliente`, `Especie`, `CategoriaItem`, `Fornecedor` e `Funcionario` passam a ser isolados por organização.
- Usuários agora possuem vínculo com organização (`UsuarioOrganizacao`) e continuam tendo cargos/permissões por empresa/CNPJ (`UsuarioEmpresa`).
- Configuração de marca por organização: nome de exibição, logo, cores, telefone, WhatsApp, e-mail, site, timezone, locale e moeda.
- Matriz de módulos habilitáveis por organização.

### 2. Cadastros veterinários configuráveis
- Espécies e raças deixaram de ser dados obrigatórios do seed.
- Novas organizações começam sem espécies/raças e podem alimentar o catálogo pela API/painel.
- Os 7 registros já existentes no banco atual são preservados e vinculados à organização migrada.
- Novas rotas permitem criar/editar espécies e raças.

### 3. Catálogo configurável
- Categorias agora pertencem à organização e possuem tipo `PRODUTO` ou `SERVICO`.
- Categorias podem ter categoria-pai (hierarquia/subcategoria).
- Produtos e serviços continuam vinculados ao CNPJ responsável pela venda.
- Adicionados custo de referência, preço, markup sobre custo, margem bruta e lucro bruto.
- Cálculo bidirecional:
  - custo + markup -> preço;
  - custo + preço -> markup, margem e lucro.
- Histórico de preço/custo (`HistoricoPrecoItem`).
- Produtos receberam marca, controle de lote e controle de validade.
- Serviços receberam opções de agendamento, exigência de pet e profissional.

> Importante: custo R$ 10 + markup 50% = preço R$ 15 e margem bruta 33,33%. O sistema guarda os dois conceitos separadamente.

### 4. Funcionários e ponto
- `Funcionario` agora é separado de `Usuario`.
- Funcionário pode ou não possuir login no sistema.
- Funções/cargos trabalhistas configuráveis por organização.
- Vínculo de funcionário com um ou mais CNPJs.
- Jornada semanal configurável.
- Batidas imutáveis: entrada, início da pausa, fim da pausa e saída.
- A API informa as próximas batidas permitidas e não obriga pausa quando a jornada permite saída direta.
- Cada batida registra também o usuário que efetuou o registro, quando aplicável.
- Ajustes de ponto não apagam o registro original: geram histórico de ajuste.
- Estrutura de fechamento mensal pronta para horas previstas, trabalhadas, extras, atrasos, pausas e faltas.

### 5. Pacotes
- Modelos fixos ou temporários por CNPJ.
- Pacotes personalizados por cliente/pet.
- Itens com quantidades/créditos.
- Histórico de consumo e saldo.
- Validação de vigência e expiração antes do consumo.
- O pacote pertence a um único CNPJ para manter separação fiscal correta.

### 6. Fundação fiscal
- Configuração fiscal separada por empresa/CNPJ.
- Configuração fiscal por produto/serviço.
- Estrutura para documentos fiscais (`NF-e`, `NFC-e`, `NFS-e` e recibo).
- Nenhum provedor fiscal foi integrado ainda; esta etapa apenas evita futura reconstrução do banco.

### 7. Auditoria
- Nova tabela de auditoria por organização/empresa/usuário.
- Configurações de organização já registram auditoria pela API.

## Rotas novas

### Organização
- `GET /api/organizacao/atual`
- `PATCH /api/organizacao/configuracao`
- `GET /api/organizacao/modulos`
- `PATCH /api/organizacao/modulos/:modulo`

### Espécies e raças
- `GET /api/pets/catalogos/especies`
- `POST /api/pets/catalogos/especies`
- `PATCH /api/pets/catalogos/especies/:id`
- `GET /api/pets/catalogos/racas`
- `POST /api/pets/catalogos/racas`
- `PATCH /api/pets/catalogos/racas/:id`

### Catálogo
- `POST /api/catalogo/calcular-preco`
- `GET /api/catalogo/categorias`
- `POST /api/catalogo/categorias`
- `PATCH /api/catalogo/categorias/:id`
- `GET /api/catalogo/itens`
- `GET /api/catalogo/itens/:id`
- `POST /api/catalogo/itens`
- `PATCH /api/catalogo/itens/:id`

### Funcionários / Ponto
- `GET /api/funcionarios/funcoes`
- `POST /api/funcionarios/funcoes`
- `PATCH /api/funcionarios/funcoes/:id`
- `GET /api/funcionarios`
- `POST /api/funcionarios`
- `PATCH /api/funcionarios/:id`
- `PUT /api/funcionarios/:id/jornadas`
- `GET /api/funcionarios/:id/ponto/status`
- `POST /api/funcionarios/:id/ponto/bater`
- `GET /api/funcionarios/:id/ponto/registros`
- `POST /api/funcionarios/ponto/registros/:registroId/ajustes`

### Pacotes
- `GET /api/pacotes/modelos`
- `POST /api/pacotes/modelos`
- `PATCH /api/pacotes/modelos/:id`
- `GET /api/pacotes/clientes`
- `POST /api/pacotes/clientes`
- `POST /api/pacotes/clientes/itens/:itemId/consumir`

## Novas permissões

O seed agora sincroniza as permissões novas e as concede automaticamente aos cargos chamados `Administrador`:

- `cadastros.gerenciar`
- `catalogo.visualizar`
- `catalogo.gerenciar`
- `funcionarios.visualizar`
- `funcionarios.gerenciar`
- `ponto.registrar`
- `ponto.gerenciar`
- `pacotes.visualizar`
- `pacotes.gerenciar`
- `fiscal.gerenciar`
- `organizacao.gerenciar`

## Aplicação do patch no banco atual

Antes de executar a migration, faça backup/snapshot do PostgreSQL no Railway.

Na pasta `api`:

```powershell
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

A migration já está pronta no ZIP; por isso a aplicação do patch usa `migrate deploy`. Para novas mudanças de schema durante desenvolvimento, use `prisma migrate dev --name ...`.

### Organização migrada

A migration cria uma organização de migração apenas se detectar dados já existentes. Todos os CNPJs, clientes, espécies, fornecedores e categorias existentes são vinculados a ela para não perder dados.

Depois atualize o `.env` usando o novo `.env.example` e rode:

```powershell
npm run db:setup-business
```

Isso renomeia/configura a organização, garante os dois CNPJs, vincula o administrador como proprietário e sincroniza as permissões.

## Seed

O seed não cria mais espécies nem raças. Ele contém somente dados estruturais do sistema (permissões e matriz de módulos). Isso é intencional para que cada pet shop alimente seu próprio catálogo.

## Compatibilidade

- `POST /api/auth/login` continua retornando `usuario.empresas` para não quebrar testes/cliente atual.
- Agora também retorna `usuario.organizacoes`, agrupando empresas por tenant.
- `X-Empresa-Id` continua sendo o contexto operacional principal.
- O middleware deriva a organização automaticamente da empresa e impede acesso entre tenants.

## Próxima etapa recomendada

Com esta fundação aplicada e testada, iniciar o painel React administrativo com:
1. Login e seleção de empresa;
2. Configurações da organização/branding;
3. Espécies e raças;
4. Categorias;
5. Produtos e serviços com calculadora de preço;
6. Funcionários e ponto;
7. Pacotes.
