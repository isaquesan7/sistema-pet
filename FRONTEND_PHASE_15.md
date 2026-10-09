# PetRise — Fase 15
## SaaS comercial, onboarding e administração da plataforma

A Fase 15 transforma a base multi-tenant do PetRise em uma camada comercial de SaaS. O objetivo desta fase não é substituir um gateway de cobrança real, e sim criar corretamente os conceitos de plano, assinatura, limites, trial, módulos contratados e administração interna da plataforma.

## 1. O que foi implementado

### Onboarding self-service
Nova rota pública no painel administrativo:

```text
/comecar
```

O fluxo permite:

1. escolher plano e ciclo mensal/anual;
2. informar a organização;
3. cadastrar o primeiro CNPJ;
4. criar o primeiro usuário administrador;
5. iniciar o trial definido no plano.

O primeiro usuário recebe o papel `PROPRIETARIO`, um cargo Administrador na primeira empresa e as permissões do sistema. O acesso aos recursos continua limitado pelos módulos efetivamente contratados no plano.

### Planos comerciais
Foram adicionados planos editáveis com:

- preço mensal e anual;
- duração do trial;
- limite de CNPJs;
- limite de usuários;
- limite de clientes;
- limite de pets;
- limite de funcionários;
- módulos contratados;
- ativo/inativo;
- destaque comercial e ordem de exibição.

A migration cria três planos iniciais apenas como configuração de partida:

- Essencial;
- Profissional;
- Completo.

Os nomes, preços, limites e módulos desses planos podem ser alterados no console interno da plataforma. Eles não constituem uma regra fixa de preço do PetRise.

### Assinatura da organização
Cada organização passa a possuir uma assinatura própria com os estados:

```text
TRIAL
ATIVA
INADIMPLENTE
SUSPENSA
CANCELADA
```

O PetRise bloqueia a operação normal quando a assinatura está suspensa, cancelada ou quando o trial terminou. A tela de assinatura continua acessível para permitir regularização.

`INADIMPLENTE` não causa bloqueio imediato nesta fase. Isso permite uma política comercial de tolerância antes de uma suspensão manual ou de uma futura automação de cobrança.

### Módulos contratados x habilitados
`ModuloOrganizacao` agora diferencia:

```text
contratado = o plano dá direito ao módulo
habilitado = o tenant decidiu manter o módulo ligado
```

Um tenant não pode habilitar pelo painel um módulo que não faça parte do plano atual.

Ao trocar o plano após pagamento, a matriz de módulos contratados é sincronizada automaticamente. Módulos removidos do plano são desabilitados.

### Limites de plano
A camada SaaS calcula uso atual da organização para:

- empresas/CNPJs;
- usuários;
- clientes;
- pets;
- funcionários.

Nesta fase os fluxos já existentes de criação de **clientes, pets e funcionários** validam seus limites. O Portal do Cliente também respeita os limites ao criar novo tutor ou pet.

Os limites de CNPJs e usuários já existem no modelo e no painel de assinatura; deverão ser aplicados também aos futuros fluxos administrativos de criação desses cadastros.

### Portal do Cliente e assinatura
O portal agora também respeita a situação comercial do tenant.

- portal exige módulo `PORTAL_CLIENTE` contratado e habilitado;
- organização suspensa/cancelada/trial expirado não mantém o portal operacional;
- clientes já autenticados também são revalidados em cada requisição protegida;
- cadastro de novo tutor e novo pet respeita limites do plano.

### Área "Plano e assinatura"
Nova rota do tenant:

```text
/assinatura
```

Disponível para `PROPRIETARIO` e `ADMINISTRADOR` da organização. Exibe:

- plano atual;
- status da assinatura;
- fim do trial;
- próxima cobrança;
- consumo dos limites;
- módulos contratados;
- opções de plano/ciclo;
- geração de fatura;
- histórico de faturas.

Em ambiente de desenvolvimento existe um botão de simulação de pagamento para testar o ciclo completo sem cobrança real.

### Console interno do PetRise
Nova rota:

```text
/plataforma
```

Somente usuários com `superAdmin = true` podem acessá-la. O console não depende de um CNPJ selecionado e permite administrar a própria plataforma PetRise:

- indicadores gerais;
- organizações/tenants;
- trials e assinaturas;
- status de assinatura;
- plano e ciclo;
- observações internas de suporte;
- planos comerciais;
- módulos e limites por plano;
- faturas SaaS;
- baixa/cancelamento manual de faturas.

O MRR do painel considera assinaturas mensais pelo preço mensal e assinaturas anuais pelo equivalente mensal (`preço anual / 12`).

## 2. Cobrança nesta fase

A arquitetura já possui `ProvedorCobrancaSaaS` para permitir integração futura com gateway recorrente.

No desenvolvimento:

```env
SAAS_BILLING_PROVIDER="development"
```

habilita o simulador de pagamento da assinatura.

Em produção, até existir um adaptador real de cobrança recorrente, use:

```env
SAAS_BILLING_PROVIDER="manual"
```

Assim não existe botão/fluxo que finja uma cobrança real. Uma fatura pode ser administrada manualmente pelo console interno do PetRise.

## 3. Migração

Nova migration:

```text
20261009050000_saas_commercial_onboarding
```

Ela adiciona:

- planos SaaS;
- módulos por plano;
- assinatura por organização;
- faturas SaaS;
- eventos SaaS;
- `superAdmin` em usuários;
- `contratado` em módulos da organização.

### Compatibilidade com organizações existentes
As organizações que já existiam antes da Fase 15 são migradas para:

```text
Plano: Completo
Status: ATIVA
Ciclo: MENSAL
Provedor: MANUAL
```

Isso evita interromper a Pet King ou outro tenant já existente durante a implantação.

Os módulos anteriormente existentes continuam considerados contratados após a migration.

## 4. Variáveis de ambiente

Adicione ao `api/.env`:

```env
SAAS_BILLING_PROVIDER="development"
PETRISE_SUPER_ADMIN_EMAIL="seu-email-administrativo@exemplo.com"
```

Não exponha o `.env` no Git.

Para ambiente de produção, substitua `development` por `manual` até a integração com o gateway real.

## 5. Aplicação da fase

Faça snapshot do PostgreSQL do Railway antes da migration.

Preserve seu `api/.env` e execute:

```powershell
cd api
npm ci
npx prisma validate
```

Somente se a validação retornar sucesso:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

Para transformar seu usuário administrativo atual no administrador interno da plataforma, configure `PETRISE_SUPER_ADMIN_EMAIL` e execute uma vez:

```powershell
npm run db:promote-platform-admin
```

Depois:

```powershell
npm run dev
```

No frontend:

```powershell
cd admin-web
npm ci
npm run dev
```

Faça logout/login novamente depois de promover o usuário, pois `superAdmin` precisa ser atualizado na sessão do navegador.

## 6. Rotas principais para teste

```text
http://localhost:5173/comecar
http://localhost:5173/assinatura
http://localhost:5173/plataforma
```

## 7. Roteiro recomendado de testes

### Tenant existente — Pet King
1. aplicar migration;
2. rodar seed;
3. confirmar que a Pet King continua acessando os módulos anteriores;
4. abrir `Plano e assinatura`;
5. confirmar plano Completo / status ATIVA;
6. conferir consumo dos limites.

### Super administrador
1. configurar `PETRISE_SUPER_ADMIN_EMAIL`;
2. rodar `npm run db:promote-platform-admin`;
3. sair e entrar novamente;
4. acessar `/plataforma`;
5. conferir organizações, planos e faturas.

### Novo tenant
1. abrir `/comecar` sem autenticação;
2. escolher um plano;
3. cadastrar organização, CNPJ e administrador;
4. concluir onboarding;
5. entrar com o novo usuário;
6. confirmar o status TRIAL;
7. conferir que somente módulos do plano aparecem como contratados.

### Cobrança de desenvolvimento
1. manter `SAAS_BILLING_PROVIDER="development"`;
2. entrar como proprietário do tenant;
3. abrir `/assinatura`;
4. gerar fatura para um plano/ciclo;
5. simular pagamento;
6. confirmar status ATIVA;
7. confirmar alteração dos módulos contratados;
8. confirmar atualização da sessão.

### Bloqueio comercial
1. pelo console `/plataforma`, marcar um tenant como SUSPENSA;
2. tentar abrir uma área operacional do tenant;
3. confirmar redirecionamento para `/assinatura`;
4. confirmar que o portal do cliente também fica indisponível;
5. reativar a assinatura e testar novamente.

## 8. O que propositalmente não foi implementado ainda

- cobrança recorrente real em cartão/Pix/boleto;
- webhook de gateway SaaS;
- emissão automática de cobrança por recorrência;
- e-mails comerciais de trial/vencimento;
- troca automática de status após período de tolerância;
- fluxo administrativo completo para criar CNPJs e usuários adicionais respeitando os limites já modelados.

Esses itens dependem da escolha do provedor de cobrança e das regras comerciais definitivas do PetRise.

## 9. Segurança

- o console `/plataforma` exige `superAdmin` no banco;
- `superAdmin` não é uma permissão editável pelo painel normal do tenant;
- rotas da plataforma não usam `X-Empresa-Id`;
- organizações continuam isoladas;
- a assinatura de um tenant não pode ser administrada por usuário de outro tenant;
- simulador de pagamento SaaS só funciona quando `SAAS_BILLING_PROVIDER=development`;
- o portal do cliente respeita status da assinatura e módulos contratados.
