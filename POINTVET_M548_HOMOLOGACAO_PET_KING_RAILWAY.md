# PointVet M.5.48 — Homologação Pet King no Railway (17/10/2026 UTC)

**Escopo e decisão:** o proprietário autorizou usar a organização Pet King e os
dois CNPJs já cadastrados para testes. A implementação da PR #36 foi publicada
**somente em um novo projeto de homologação**, não no ambiente `production`.
O fechamento é de **gestão manual**; não há emissão fiscal, integração com
balança/leitor, PSP, banco ou TEF.

## Identidade e isolamento verificados

- Projeto Railway independente: `Pet King PDV Homologacao`
  (`9564acfc-1582-45d8-8ac3-f0bc2d998530`), ambiente exclusivo `staging`
  (`5fe41299-936f-4c6f-b034-92b71d67bf96`).
- API: <https://pointvet-api-staging-staging.up.railway.app>.
- Painel: <https://pointvet-admin-staging-staging.up.railway.app>.
- Portal: <https://pointvet-portal-staging-staging.up.railway.app>.
- PostgreSQL próprio, com serviço e volume separados do projeto `Pet King DEV`
  e do banco que atende `api.pointvet.com.br`.
- Fonte dos três serviços: commit
  `88728e950fe3e1210c49bff231d90fe1801fa948` da PR #36 (Draft),
  fixado por SHA. Não houve merge nem alteração da branch `main`.
- Organização `Pet King`, empresas `Pet King` e `Pet King Banho e Tosa`,
  com os CNPJs reais previamente cadastrados na produção, conferidos pela
  interface autorizada. Os números completos **não** são gravados neste
  relatório. Foram replicados apenas nomes/identificadores empresariais;
  **nenhum tutor, pet, produto, caixa ou pagamento real foi copiado**.
- Conta, tutor, produto e serviço de teste foram criados apenas no banco
  isolado. A conta técnica administrativa de bootstrap teve sua variável de
  senha removida do runtime após a inicialização. A rotina de predeploy foi
  devolvida a `npm run db:deploy`.

## Evidências HTTP e funcionais

Os sete probes HTTPS, sem desabilitar validação TLS, retornaram:

| Alvo | Resultado |
| --- | --- |
| API `/api/health` | `200`, JSON |
| API `/api/health/database` | `200`, JSON |
| API `/api/pdv-unificado/disponibilidade` sem token | `401`, JSON |
| API `/api/portal/me` sem token | `401`, JSON |
| API `/api/pointvet-m544-unknown-route` | `404`, JSON |
| Painel `/` (HEAD) | `200`, HTML |
| Portal `/` (HEAD) | `200`, HTML |

A CLI `pointvet-staging-readonly-smoke.mjs` não conseguiu resolver DNS (`EAI_AGAIN`)
na rede do executor. Os **mesmos sete alvos** foram aferidos individualmente
com `curl` através da saída HTTPS autorizada; não registrar a falha da CLI
como falha de aplicação nem como execução integral do script.

### Jornada executada em staging

1. Dois CNPJs autenticados, com módulos/roles separados; operador técnico de
   teste, tutor fictício, ração a granel `QUILOGRAMA` a **R$ 15,00/kg** e
   serviço de banho fictício a **R$ 10,00**.
2. Entrada fictícia de **1,000 kg** em lote exclusivo; abertura de um caixa
   por empresa, ambos com saldo de abertura R$ 0,00.
3. Rascunho com **0,333 kg** (equivalente gerencial arredondado a **R$ 5,00**)
   mais banho R$ 10,00: pré-fechamento sem pendências, total **R$ 15,00**,
   operação loja R$ 5,00 e banho R$ 10,00.
4. Reserva, conferência e preparação: loja **R$ 3 dinheiro + R$ 2 Pix**;
   banho **R$ 10 transferência**. Uma tentativa de fechamento com o gate OFF
   retornou acesso negado.
5. Em uma janela restrita ao **projeto staging e às duas empresas de teste**, o
   gate manual foi temporariamente ligado. Fechamento criou **duas vendas** e
   **três registros de pagamento manual**, sem documento fiscal. O lote/saldo
   passaram exatamente de **1,000 kg** para **0,667 kg**.
6. Repetição do mesmo fechamento retornou `reutilizada=true` e
   `estoqueMovimentado=false`. Novo rascunho de 0,900 kg com saldo disponível
   0,667 kg foi rejeitado e sua reserva cancelada.
7. Estorno **integral e fictício**, com declaração de acerto externo simulada:
   status `ESTORNO_REGISTRADO`, lote/saldo novamente **1,000 kg**;
   estorno repetido retornou `reutilizada=true` e indicou
   `houveRefundPorAPI=false`, `houveFiscal=false`, `houvePsp=false`.
8. Após os testes, a flag `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED` foi
   recolocada em `0` e as allowlists foram esvaziadas no staging. Confirmar
   o deploy **SUCCESS** e a resposta autenticada
   `modoEfetivo=INDIVIDUAL` / `checkoutUnificadoDisponivel=false`:
   **ambos verificados** após a reversão.

Os lançamentos de teste e o estorno permanecem na trilha de auditoria do
**staging**, não são transações comerciais ou pagamentos reais. A produção
mantém seus produtos e estoques originais; o item existente de ração embalado
em `UNIDADE` não foi convertido nem movimentado.

## Situação dos quatro gates oficiais

| Gate | Situação honesta | Pendência para piloto comercial |
| --- | --- | --- |
| 1. Staging segregado | **Executado**: IDs distintos, PostgreSQL isolado, serviços SUCCESS e probes HTTPS válidos | Verificação humana do painel, ambiente e destinatários de e-mail antes de replicar dados sensíveis |
| 2. Backup/restore/rollback | Backup de produção criptografado aceito em 16/10/2026 06:00 UTC; restauração CI descartável já passou | **Ainda não foi restaurado** um arquivo R2 real em destino seguro nem medidos RTO/RPO; não copiar produção sem plano LGPD/autorização |
| 3. Homologação operacional | **E2E HTTP real de staging executado**, incluindo granel, dois caixas, replay e estorno | Aceite visual/humano de atendente e supervisor, com checklist assinado |
| 4. Piloto controlado | **Simulação canário em staging executada**, kill switch ligado apenas durante o ensaio | Produção **não** habilitada; obter gates 2–3, plano fiscal/contábil externo e decisão explícita de deploy/merge/piloto por CNPJ |

**Nenhuma cobrança bancária, emissão fiscal ou integração física foi ativada.**
O projeto continua privado, a PR #36 continua **Draft**, e nenhuma rotina de
predeploy conecta-se ao banco de produção a partir da homologação.
