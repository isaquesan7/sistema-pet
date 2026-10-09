# PetRise — Fase 10 — Portal/PWA do Cliente

## Entregue

- Rebranding completo da plataforma para **PetRise**.
- `client-web` substituído pelo Portal do Cliente responsivo/PWA.
- Cadastro e login do tutor por organização/tenant.
- Vinculação automática com cadastro de cliente já existente por CPF/CNPJ, e-mail ou telefone.
- Sessão independente para clientes, com access/refresh token e opção de permanecer conectado.
- Cadastro e listagem de pets pelo próprio tutor.
- Catálogos de espécies e raças da própria organização.
- Agendamento online de Consultório usando os serviços configurados no CNPJ Loja/Consultório.
- Agendamento online de Banho e Tosa usando os serviços do CNPJ Banho e Tosa.
- Banho e Tosa entra em `AGUARDANDO_PAGAMENTO` e só muda para `CONFIRMADO` após aprovação da transação.
- Reserva temporária de 10 minutos (configurável em `PORTAL_RESERVA_MINUTOS`).
- Transações online e sessões do cliente persistidas no PostgreSQL.
- Simulador de pagamento **somente em desenvolvimento** para testar o fluxo sem cobrança real.
- Consulta da agenda do cliente, cancelamento quando permitido e acompanhamento do status do Banho e Tosa.
- PWA com `manifest.webmanifest` e service worker básico.
- Visual/branding do portal herda nome e cores da organização.

## Importante sobre pagamentos

A Fase 10 implementa toda a regra de reserva e confirmação condicionada ao pagamento. O simulador local existe apenas para desenvolvimento e não realiza cobrança.

Em produção, configure um gateway real e seu adaptador antes de liberar o agendamento pago. Enquanto não houver gateway real, o backend recusa a criação de cobrança em produção em vez de simular uma aprovação.

Variável atual:

```env
PAYMENT_PROVIDER="development"
```

## Nova migration

```text
20261008223000_client_portal
```

Ela adiciona:

- `sessoes_cliente`
- `transacoes_online`
- campos de reserva/pagamento no agendamento de Banho e Tosa
- origem e intervalo do agendamento online de Consultório

## Instalação

Preserve `api/.env` e acrescente as novas variáveis a partir de `api/.env.example`.

```powershell
cd api
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Em outro terminal:

```powershell
cd client-web
npm ci
npm run dev
```

O portal normalmente abrirá em `http://localhost:5174` se o painel administrativo já estiver em `5173`.

Crie `client-web/.env` com:

```env
VITE_API_URL=http://localhost:3000/api
VITE_ORGANIZACAO_SLUG=pet-king
```

Use o slug real da organização configurada no banco.

## Checklist rápido

1. Abrir o portal do cliente.
2. Criar conta de tutor.
3. Cadastrar um pet.
4. Agendar uma consulta.
5. Confirmar que o agendamento aparece no Consultório administrativo.
6. Criar um agendamento de Banho e Tosa.
7. Confirmar que ele fica `AGUARDANDO_PAGAMENTO`.
8. Em desenvolvimento, clicar em **Simular pagamento aprovado**.
9. Confirmar que o agendamento muda para `CONFIRMADO` no portal e no painel administrativo.
10. Verificar que o cliente não consegue acessar pets/agendamentos de outra organização.

## Próxima fase sugerida

**Fase 11 — Financeiro e Contas a Pagar/Receber**, incluindo fluxo de caixa gerencial, fiado/conta-corrente, despesas, categorias financeiras, conciliação e relatórios por CNPJ e por organização.
