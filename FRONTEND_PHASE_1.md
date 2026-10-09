# PetRise — Frontend Administrativo · Fase 1

Esta etapa substitui a tela padrão do Vite pelo primeiro shell funcional do painel administrativo PetRise.

## Entregue

- Identidade da plataforma **PetRise** separada da marca da organização/tenant.
- Login conectado a `POST /api/auth/login`.
- Sessão do navegador via `sessionStorage`.
- Seleção de empresa/CNPJ após o login.
- Troca de empresa pelo cabeçalho sem novo login.
- `Authorization: Bearer` e `X-Empresa-Id` adicionados automaticamente às chamadas Axios.
- Logout automático ao receber `401`.
- Aplicação de cores da organização (`corPrimaria`/`corSecundaria`) quando disponíveis.
- Menu lateral filtrado por permissões e módulos habilitados.
- Dashboard conectado à API.
- Listagem e busca reais de Clientes.
- Listagem e busca reais de Pets.
- Primeira tela de Configurações com leitura da organização.
- Placeholders navegáveis para PDV, Catálogo, Consultório, Banho e Tosa, Pacotes, Funcionários, Ponto e Financeiro.
- Layout responsivo para desktop, tablet e celular.

## Como executar

1. API:

```powershell
cd api
npm ci
npm run dev
```

2. Frontend:

```powershell
cd admin-web
npm ci
npm run dev
```

Por padrão o frontend usa:

```text
http://localhost:3000/api
```

Para mudar a API, copie `admin-web/.env.example` para `admin-web/.env` e altere:

```env
VITE_API_URL=http://localhost:3000/api
```

## Fluxo esperado

```text
/login
   ↓
login API
   ↓
/selecionar-empresa (quando houver mais de um CNPJ)
   ↓
Dashboard
   ↓
Clientes / Pets / demais módulos
```

## Observação de autenticação

A API já devolve `refreshToken`, mas ainda não existe endpoint de refresh. Nesta fase, o painel mantém a sessão na aba/janela usando `sessionStorage`. Quando o access token expira, o usuário retorna ao login. A rotação automática de refresh token deve ser implementada antes de produção.

## Próxima fase sugerida

1. Formulários completos de Cliente e Pet.
2. Configurações editáveis: organização, logo, cores, espécies, raças e categorias.
3. Catálogo visual: produtos, serviços e precificação.
4. Funcionários e ponto.
5. PDV.
