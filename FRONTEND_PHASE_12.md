# PetRise — Fase 12 — Ponto e fechamento mensal

## O que entrou

### Banco de horas e espelho mensal
- Cálculo mensal por funcionário e por CNPJ.
- Jornada prevista baseada nos horários cadastrados do funcionário.
- Total trabalhado, pausas, extras, atrasos/saídas antecipadas e faltas.
- Saldo do banco de horas da competência.
- Saldo anterior e banco acumulado usando o último fechamento anterior.
- Visão diária do espelho com as divergências encontradas.
- Datas futuras da competência atual não entram no cálculo.

### Divergências
O PetRise identifica automaticamente:
- falta em dia com jornada prevista;
- batida incompleta;
- sequência inválida de batidas;
- atraso acima da tolerância da jornada;
- saída antecipada acima da tolerância;
- registro de trabalho em dia sem jornada configurada;
- jornada atual ainda em andamento.

Batidas incompletas e sequências inválidas são consideradas críticas e bloqueiam o fechamento até correção.

### Aprovação de ajustes
- O botão de ajuste do espelho diário agora cria uma **solicitação pendente**.
- O horário original continua imutável no banco.
- Apenas ajustes `APROVADO` passam a valer no cálculo do ponto.
- Aprovação e rejeição guardam usuário, data e observação da análise.
- Ajustes anteriores à Fase 12 são migrados como `APROVADO`, preservando o comportamento que já existia.
- Uma competência fechada não aceita novas alterações até ser reaberta.

### Fechamento mensal
- Fechamento individual por funcionário.
- Fechamento de toda a competência.
- O mês em andamento pode ser acompanhado, mas não pode ser fechado antes de terminar.
- Fechamento bloqueado quando houver ajustes pendentes ou divergências críticas.
- Snapshot dos totais, divergências e espelho diário no momento do fechamento.
- Reabertura auditada com motivo obrigatório.
- Proteção de ordem cronológica: não é permitido reabrir uma competência antiga enquanto houver competência posterior fechada.

### Exportação
- Exportação CSV UTF-8 separada por CNPJ.
- Compatível com abertura no Excel em ambiente pt-BR.
- Inclui identificação do funcionário, previsto, trabalhado, extras, atrasos, pausas, faltas e banco de horas.
- O objetivo é entregar dados para folha/contabilidade; o PetRise não substitui o software contábil nesta fase.

## Novas permissões

- `ponto.aprovar_ajustes`
- `ponto.fechamento`

O seed atribui automaticamente as novas permissões aos cargos `Administrador` existentes.

## Migration

Nova migration:

`20261009013000_timeclock_monthly_close`

Ela:
- cria o enum `StatusAjustePonto`;
- adiciona workflow de aprovação em `ajustes_ponto`;
- adiciona banco de horas, divergências e snapshot do espelho em `fechamentos_ponto`;
- adiciona dados de reabertura auditável.

## Aplicação

Preserve `api/.env` e faça snapshot do PostgreSQL antes da migration.

```powershell
cd api
npm ci
npx prisma validate
```

Somente se o schema for validado:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Em outro terminal:

```powershell
cd admin-web
npm ci
npm run dev
```

## Checklist recomendado

1. Configure a jornada semanal de um funcionário.
2. Registre entrada, pausa, retorno e saída em alguns dias.
3. Em `Ponto > Bater ponto`, solicite a alteração de uma batida.
4. Abra `Ponto > Ajustes pendentes` e aprove a solicitação.
5. Confirme que o espelho passa a usar o horário aprovado.
6. Selecione uma competência encerrada em `Fechamento mensal`.
7. Abra o espelho mensal de um funcionário e confira previsto, trabalhado e divergências.
8. Tente fechar um funcionário com ajuste pendente ou batida incompleta e confirme o bloqueio.
9. Regularize as pendências e feche novamente.
10. Feche toda a competência.
11. Exporte o CSV.
12. Reabra o último fechamento informando um motivo e confirme que novos ajustes voltam a ser permitidos.

## Observações
- A jornada semanal cadastrada atualmente é a referência de cálculo. Versionamento histórico de mudança de escala pode ser adicionado posteriormente.
- Férias, atestados, folgas compensatórias e outros eventos de afastamento ainda não constituem uma folha de pagamento; eles podem ser evoluídos como ocorrências de RH em fase futura.
- O banco de horas do PetRise é um controle operacional. Regras sindicais, adicionais e cálculos trabalhistas devem continuar sendo tratados pela folha/contabilidade responsável.
