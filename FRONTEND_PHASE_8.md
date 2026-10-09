# PetRise — Fase 8: Consultório Veterinário

Esta fase transforma o módulo **Consultório** em uma área clínica operacional, integrada a Clientes, Pets, Catálogo, Estoque, Comandas e PDV.

## Entregas

- Painel do consultório com fila diária e resumo de atendimentos.
- Abertura de atendimento por tutor/pet.
- Registro de peso no histórico do pet durante o atendimento.
- Início/finalização do atendimento com identificação do veterinário logado.
- Prontuário com:
  - queixa principal;
  - anamnese;
  - exame físico;
  - diagnóstico/hipóteses;
  - conduta;
  - observações internas;
  - temperatura, FC, FR, hidratação, mucosas e TPC.
- Prescrições estruturadas com múltiplos medicamentos e posologia.
- Carteira clínica de vacinas com fabricante, lote, validade e próxima dose.
- Registro de vermifugação e próximo reforço.
- Exames: solicitação, coleta/processamento, resultado, texto e URL de arquivo.
- Procedimentos clínicos vinculados ao catálogo.
- Documentos clínicos: receita, atestado, relatório, orientação e outros.
- Integração com **Comanda/PDV**:
  - consulta pode ser lançada na comanda ao abrir o atendimento;
  - exames/procedimentos podem ser lançados na mesma comanda;
  - o recebimento continua sendo feito no PDV do CNPJ responsável.
- Integração opcional com estoque para vacina/vermífugo:
  - baixa como `CONSUMO_INTERNO`;
  - FEFO automático para produtos controlados por lote quando o lote não for informado;
  - movimentação de estoque mantém referência à aplicação clínica.
- Auditoria das operações clínicas principais.
- Consultório indisponível no CNPJ explicitamente classificado como `BANHO_TOSA`; CNPJs `LOJA_CONSULTORIO` e `OUTRA` podem operar o módulo quando habilitado.
- O menu de Consultório/Banho e Tosa agora respeita também o tipo do CNPJ selecionado.

## Novas permissões

Além de `consultorio.acessar` e `consultorio.prontuario`, esta fase acrescenta:

- `consultorio.prescrever`
- `consultorio.vacinas`
- `consultorio.exames`
- `consultorio.documentos`

Execute o seed após a migration para sincronizar essas permissões com cargos Administrador existentes.

## Nova migration

`20261008130000_clinic_operations`

Cria:

- `atendimentos_clinicos`
- `prescricoes_clinicas`
- `prescricao_itens`
- `vacinas_aplicacoes`
- `vermifugacoes_aplicacoes`
- `exames_clinicos`
- `procedimentos_clinicos`
- `documentos_clinicos`
- enums `StatusAtendimentoClinico`, `StatusExameClinico` e `TipoDocumentoClinico`

## Aplicação

Preserve `api/.env` e execute:

```powershell
cd api
npm ci
npx prisma validate
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

## Roteiro de teste

1. Selecione o CNPJ **Loja + Consultório**.
2. Cadastre no catálogo um serviço de consulta, por exemplo `Consulta veterinária`.
3. Cadastre também serviços de exames, se desejar testar a integração com comanda.
4. Entre em **Consultório → Novo atendimento**.
5. Selecione tutor/pet, informe a queixa, peso e o serviço de consulta.
6. Marque `Lançar consulta na comanda` e abra o atendimento.
7. Clique em **Iniciar atendimento**.
8. Preencha sinais vitais, anamnese, exame físico, diagnóstico e conduta; salve.
9. Em **Prescrições**, registre um medicamento.
10. Em **Vacinas**, registre uma aplicação e um próximo reforço.
11. Se a vacina estiver cadastrada como produto com estoque, marque `Baixar estoque` e confirme a movimentação no módulo Estoque.
12. Em **Exames**, solicite um exame e marque `Lançar na comanda`.
13. Atualize o exame até `Resultado disponível` e informe um resultado.
14. Em **Procedimentos**, lance um serviço/produto adicional na comanda.
15. Em **Documentos**, registre um atestado ou relatório.
16. Finalize o atendimento.
17. Vá ao **PDV → Comandas** e confira consulta/exames/procedimentos pendentes para cobrança.
18. Troque para o CNPJ de **Banho e Tosa**: o menu Consultório não deve aparecer.

## Regras importantes

- Dados clínicos são sempre isolados por organização e pelo CNPJ que realizou o atendimento.
- A mesma ficha do tutor/pet continua compartilhada dentro da organização.
- O prontuário finalizado continua consultável e pode receber documentos/resultados posteriores; alterações estruturais devem respeitar permissões e auditoria.
- A baixa clínica de estoque é opcional porque uma aplicação pode representar consumo fracionado ou material já controlado por outro processo.
- Procedimentos cobrados na comanda só baixam estoque como **VENDA** no momento do fechamento da comanda pelo PDV.
- Vacinas/vermífugos com `Baixar estoque` utilizam `CONSUMO_INTERNO`; não registre o mesmo consumo duas vezes.
- Esta fase armazena documentos e exames por texto/URL. Upload de arquivos para storage será incorporado na evolução de anexos/portal.
