# PetRise — Frontend Fase 4

## Escopo implementado
- CRUD visual de funcionários.
- Cadastro e edição de funções/cargos operacionais da equipe.
- Vínculo de funcionário a um ou mais CNPJs, com empresa principal.
- Dados trabalhistas básicos: matrícula, admissão, demissão, salário base e status.
- Jornada semanal por funcionário e por CNPJ.
- Ponto eletrônico com entrada, início de pausa, retorno e saída.
- Estado do ponto e bloqueio de sequências inválidas usando a API.
- Consulta do espelho diário por funcionário e data.
- Estimativa de tempo trabalhado e tempo em pausa no dia.
- Ajuste de ponto com preservação da batida original e motivo obrigatório.
- Backend ajustado para devolver jornadas na listagem de funcionários.

## Rotas utilizadas
- `GET/POST /api/funcionarios`
- `PATCH /api/funcionarios/:id`
- `GET/POST/PATCH /api/funcionarios/funcoes`
- `PUT /api/funcionarios/:id/jornadas`
- `GET /api/funcionarios/:id/ponto/status`
- `POST /api/funcionarios/:id/ponto/bater`
- `GET /api/funcionarios/:id/ponto/registros`
- `POST /api/funcionarios/ponto/registros/:registroId/ajustes`

## Teste sugerido
1. Criar uma função (ex.: Banhista).
2. Cadastrar um funcionário e vinculá-lo ao CNPJ de Banho e Tosa.
3. Abrir Jornada e configurar os dias/horários.
4. Ir para Ponto e registrar Entrada → Pausa → Retorno → Saída.
5. Consultar o histórico do dia.
6. Com permissão `ponto.gerenciar`, ajustar uma batida e confirmar que o original continua registrado.

## Sem migration nova
Esta fase usa as tabelas de RH/Ponto já presentes na SaaS Foundation 2.0.
