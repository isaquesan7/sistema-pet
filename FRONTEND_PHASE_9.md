# PetRise — Frontend Fase 9: Banho e Tosa

## Entregue
- Agenda diária do Banho e Tosa por CNPJ.
- Agendamento com tutor, pet, profissional, origem e múltiplos serviços.
- Cálculo automático da duração com base nos serviços cadastrados.
- Bloqueio de sobreposição de horários para o mesmo profissional.
- Check-in que converte o agendamento em Ordem de Serviço.
- Ordem de Serviço direta via API para encaixes/balcão.
- Integração com pacotes: crédito disponível pode ser usado no check-in.
- Serviços sem crédito são lançados automaticamente em uma comanda aberta do tutor.
- Kanban de produção: Aguardando → Banho → Secagem → Tosa → Pronto → Entregue.
- Ficha técnica persistente do pet para estética/comportamento.
- Fotos/anexos por URL com tipos Entrada, Antes, Depois, Lesão e Observação.
- Cancelamento de OS devolve crédito de pacote e cancela itens de comanda ainda não faturados.
- Proteção contra cancelamento da OS depois que um item já foi faturado.
- Auditoria para agenda, check-in, status e ficha técnica.

## Migration
Aplicar:

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma generate
```

Migration nova:

`20261008190000_grooming_operations`

## Teste recomendado
1. Selecione o CNPJ do Banho e Tosa.
2. Cadastre pelo menos um serviço do tipo SERVICO no catálogo e configure `duracaoMinutos`.
3. Cadastre/vincule um funcionário ao CNPJ do Banho e Tosa.
4. Abra Banho e Tosa → Novo agendamento.
5. Escolha tutor, pet, profissional, serviço e horário.
6. Tente criar outro horário sobreposto para o mesmo profissional: deve retornar conflito.
7. Faça check-in.
8. Se houver pacote compatível, escolha o crédito; caso contrário, deixe “Cobrar na comanda”.
9. Abra a aba Produção e avance as etapas.
10. Abra a OS e salve a ficha técnica do pet.
11. Adicione uma imagem por URL na seção Fotos e anexos.
12. Marque como entregue.
13. Confira a comanda no PDV ou o consumo do pacote.

## Observações
- A capacidade atual é de 1 atendimento simultâneo por profissional. A arquitetura permite evoluir para recursos/bancadas e capacidade maior por profissional.
- O upload binário de fotos não foi acoplado nesta fase; a estrutura aceita URL e fica pronta para integração futura com storage.
- O fluxo de pagamento antecipado do app será conectado na fase do Portal/PWA do cliente.
