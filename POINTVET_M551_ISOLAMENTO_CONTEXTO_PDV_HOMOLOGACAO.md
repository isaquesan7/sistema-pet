# PointVet M.5.51 — Contexto da empresa e seleção do tutor no PDV Unificado

**Data:** 17/10/2026 (America/Sao_Paulo). **Issue:** #37. **PR:** #36, Draft.

## Aceite humano recebido

O proprietário da Pet King confirmou que, após M.5.50, os testes manuais de
**“Validar e calcular sem cobrar”** e **“Salvar rascunho”** funcionaram no
painel isolado de homologação. Isso valida **somente esses dois passos**, sem
comprovar reabertura, reserva, distribuição de recebimentos, restauração de
backup ou autorização de piloto comercial.

## Correção operacional

- As consultas da tela de PDV Unificado (disponibilidade, catálogo, tutor,
  pets, rascunhos, pré-fechamento, reserva, caixas, diagnóstico e preparação)
  passam a incluir **organização e empresa selecionadas** nas chaves do cache.
  O cabeçalho HTTP `X-Empresa-Id` já restringe a API; este ajuste impede que
  o painel reaproveite respostas da empresa anterior após alternar o contexto.
- Ao trocar de **organização**, o estado local do PDV é remontado, impedindo
  carregar itens de uma organização para a outra. Trocar de empresa **dentro
  da mesma organização** preserva a comanda em elaboração; dados remotos são
  consultados novamente e continuam submetidos às permissões do servidor.
- A reabertura de rascunho mantém o **tutor persistido** visível mesmo se o
  filtro da busca não o retornar. Digitar uma nova busca desfaz explicitamente
  a seleção antiga para evitar salvamento sob o tutor errado. Em reserva,
  tanto busca quanto escolha de tutor ficam bloqueadas. **Nova comanda**
  limpa seleção, busca e mensagens do formulário anterior.

Nenhuma mutation de vendas, estoque, caixa, fiscal ou meios de pagamento foi
alterada. Sem integração física de balança/QR, fiscal, TEF ou PSP.

## Regressões automatizadas

- Cache de mesma busca isolado por empresa e por organização.
- Tutor de rascunho preservado, sem duplicar opção no seletor.
- Comportamento explícito de limpar tutor ao pesquisar, de não editar tutor
  em reserva e de manter chaves das consultas escopadas.
- Contrato M.5.50 de cliente e payload da simulação e rascunho mantido.
- Build de homologação e lint dos arquivos tocados.

## Próximo aceite com o proprietário, SEM registrar venda

1. Abrir **Rascunhos recentes**, selecionar a comanda salva e confirmar tutor,
   serviço no CNPJ de banho, ração a granel e 333 g / R$ 5,00 no outro CNPJ.
2. Alternar contexto entre os CNPJs autorizados e conferir que catálogo,
   caixas e tutores não mostram dados antigos, sem perder a comanda da mesma
   organização. **Não trocar de organização com alterações não salvas**.
3. Confirmar pré-fechamento por CNPJ, depois **Reservar operações por empresa**;
   nenhum pagamento será processado nem o estoque movimentado.
4. Conferir somente a distribuição manual dos valores e a preparação,
   com o botão de venda real indisponível (`checkoutUnificadoDisponivel=false`).
5. Solicitar ao operador o resultado e registrar apenas evidências não
   sensíveis. O aceite completo de M.5.49 continua pendente.

## Gates de publicação ainda abertos

O teste CI de backup/restauração **sintético** não substitui o restore de
arquivo real do R2, que precisa de autorização separada, origem, destino
descartável, janela e controles LGPD, RTO/RPO e rollback. Não ativar checkout
na Pet King/produção, não efetuar merge de #36 e não implementar motor fiscal.
O PDV inicial é de gestão **manual**, com processo fiscal/contábil externo
aplicável antes de operação comercial.
