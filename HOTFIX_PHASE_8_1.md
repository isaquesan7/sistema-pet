# BichOne — Hotfix 8.1 (Consultório)

## Problema corrigido
Ao abrir um novo atendimento com serviço de consulta e lançamento automático em comanda, a operação executa várias consultas/escritas sequenciais dentro de uma transação interativa do Prisma. O timeout padrão é de 5 segundos. Usando o PostgreSQL remoto do Railway, a latência pode fazer a transação expirar e a API responder `Erro interno do servidor`.

## Correções
- Timeout global das transações interativas ajustado para `maxWait: 10s` e `timeout: 30s`.
- A criação do atendimento mantém apenas as escritas atômicas dentro da transação.
- A leitura completa do atendimento (includes de pet, comanda, prescrições etc.) passou para fora da transação.
- Tratamento explícito de erro Prisma `P2028`.
- Log de backend melhorado para próximos diagnósticos.
- Conversão de peso no frontend aceita separador decimal local.

## Banco de dados
Não existe migration nova.

## Aplicação
```powershell
cd api
npm ci
npx prisma generate
npm run dev
```

Em outro terminal:
```powershell
cd admin-web
npm ci
npm run dev
```

Teste recomendado: Consultório → Novo atendimento → selecionar tutor/pet → informar peso → selecionar Consulta → manter “Lançar consulta na comanda” marcado → Abrir atendimento.
