# BichOne — Frontend Fase 2

## Escopo concluído

### Clientes
- Cadastro real pelo painel.
- Edição do cadastro existente.
- Dados pessoais, contato, endereço e observações.
- Busca já existente preservada.
- Botões respeitam `clientes.criar` e `clientes.editar`.

### Pets
- Cadastro real com vínculo ao tutor.
- Espécie e raça carregadas dinamicamente da organização.
- Edição do pet.
- Alergias, doenças preexistentes, microchip, castração e observações.
- Peso inicial no cadastro.
- Lançamento avulso de peso com data, origem e observação.
- Botões respeitam `pets.criar` e `pets.editar`.

### Configurações
Nova área em abas:
- **Marca:** nome de exibição, logo por URL, cores, contatos, site, timezone e moeda.
- **Espécies:** cadastro e edição pelo administrador.
- **Raças:** cadastro vinculado à espécie e filtro por espécie.
- **Categorias:** categorias separadas entre PRODUTO e SERVIÇO, com categoria pai e ordem.
- **Módulos:** habilitação/desabilitação dos módulos da organização.

As alterações de marca e módulos também atualizam a sessão local do painel para refletir a mudança sem novo login.

## Novos componentes
- `src/components/Modal.jsx`
- `src/components/FormField.jsx`
- `src/components/InlineNotice.jsx`

## APIs utilizadas
- `POST/PATCH /api/clientes`
- `POST/PATCH /api/pets`
- `POST /api/pets/:id/pesos`
- `GET/POST/PATCH /api/pets/catalogos/especies`
- `GET/POST/PATCH /api/pets/catalogos/racas`
- `GET/PATCH /api/organizacao/*`
- `GET/POST/PATCH /api/catalogo/categorias`

## Como testar

API:
```powershell
cd api
npm ci
npm run dev
```

Painel:
```powershell
cd admin-web
npm ci
npm run dev
```

Abra `http://localhost:5173`.

### Checklist rápido
1. Entrar no BichOne e selecionar um CNPJ.
2. Criar um cliente e editá-lo.
3. Em Configurações > Espécies, criar `Cão` ou outra espécie.
4. Em Configurações > Raças, criar uma raça vinculada à espécie.
5. Criar um pet para o cliente.
6. Registrar um novo peso para o pet.
7. Criar categorias de Produto e de Serviço.
8. Alterar nome/cor da organização e confirmar que a interface reflete a mudança.
9. Testar habilitação/desabilitação de um módulo.

## Observação de validação
O código foi revisado e empacotado sobre a Fase 1. O ambiente de geração não conseguiu concluir uma instalação NPM completa a tempo para executar o build Vite; portanto execute `npm ci` + `npm run dev` no seu computador e, se houver qualquer erro de compilação, preserve o terminal e envie a mensagem completa para correção pontual.

## Próxima fase sugerida
**Frontend Fase 3 — Produtos e Serviços**:
- listagem por CNPJ;
- cadastro de produto/serviço;
- custo, preço, markup, margem e lucro em tempo real;
- características específicas de produto e serviço;
- histórico de preço;
- preparação visual de estoque.
