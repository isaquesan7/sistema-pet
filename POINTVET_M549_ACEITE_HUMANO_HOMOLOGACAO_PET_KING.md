# PointVet M.5.49 — Aceite humano do PDV de gestão (Pet King)

**Ambiente:** <https://pointvet-admin-staging-staging.up.railway.app> — projeto
`Pet King PDV Homologacao` (`staging`), sem vínculo com o PostgreSQL de produção.
**PR:** #36, ainda **Draft**. Não alterar `main`, a produção ou o estoque real.

## Antes de começar

1. Entrar **somente pela URL de staging**, com usuário fictício de homologação
   entregue ao proprietário por canal privado. Não reutilizar senha de produção.
2. Confirmar o aviso amarelo **HOMOLOGAÇÃO — dados de teste** na página de
   login e, após autenticar, no painel. Se o aviso não aparecer, **parar** e
   verificar `VITE_POINTVET_ENVIRONMENT=staging` no build do painel; não supor
   que o endereço por si só identifica o ambiente.
3. Confirmar a empresa atual no seletor. O cadastro de teste contém **Pet
   King** e **Pet King Banho e Tosa**, cada qual com seu CNPJ já reconhecido
   pelo proprietário. Não copiar tutores, vendas nem estoque de produção.
4. O flag HTTP `POINTVET_UNIFIED_MANUAL_CHECKOUT_ENABLED` está **OFF** e as
   allowlists vazias no staging fora de um ensaio autorizado. Não forçar
   fechamento, editar o banco ou reabilitar flags permanentemente.

## Roteiro de aceite visual (atendente + supervisor)

Marcar cada item somente depois de conferir na interface, registrando data,
operador e eventual falha sem dados pessoais de clientes:

- [ ] Login no staging com destaque visível, organização e empresa corretas.
- [ ] Alternar entre os dois CNPJs sem apresentar o catálogo/caixa da empresa
  errada (o isolamento das permissões foi testado por API, resta inspeção UI).
- [ ] Abrir PDV → simulação unificada, criar uma comanda somente com tutor e
  itens **fictícios** de staging.
- [ ] Selecionar ração a granel **R$ 15,00/kg** e informar **R$ 5,00**; a
  interface deve projetar **333 g** (balança física não conectada).
- [ ] Informar **333 g** diretamente e conferir o total aproximado
  **R$ 5,00**; validar eventual aviso de arredondamento em centavos.
- [ ] Inserir banho fictício de **R$ 10,00** no segundo CNPJ, sem misturar
  valores ou permissões entre as duas empresas.
- [ ] Conferir distribuição de **R$ 3,00 dinheiro + R$ 2,00 Pix** na primeira
  empresa e **R$ 10,00 transferência** na segunda, com os caixas corretos.
- [ ] Editar valor/quantidade após a conferência e confirmar que a prévia
  antiga é invalidada; pagamento não pode ser registrado silenciosamente.
- [ ] Com checkout manual OFF, fechamento real bloqueado com mensagem clara.
- [ ] Supervisor revisa as telas e assina este checklist antes de qualquer
  janela controlada de fechamento/estorno.

## Testes já executados via HTTPS — não confundir com aceite visual

Em 17/10/2026 foram verificados no próprio staging: fechamento manual em dois
CNPJs, 2 vendas, 3 pagamentos gerenciais, baixa no lote de **1.000 para 667 g**,
replay sem duplicidade, bloqueio de insuficiência de estoque e estorno integral
com devolução a **1.000 g**. O teste HTTP e seu relatório estão em
`POINTVET_M548_HOMOLOGACAO_PET_KING_RAILWAY.md`. **O fluxo comercial segue
OFF no staging**, aguardando o aceite humano; isso não substitui a vistoria
de telas nem autoriza operação comercial.

## Backup, recuperação e publicação — gates ainda abertos

- O restore completo em **PostgreSQL CI sintético descartável** passou; isso
  **não equivale** a restaurar um arquivo real criptografado do R2.
- Para restaurar backup real, aprovar expressamente **origem**, **destino
  descartável distinto do staging compartilhado**, gestão de acesso sob LGPD,
  descarte/retensão e janela. Depois registrar checksum, tempo de recuperação
  (RTO), ponto recuperado (RPO), consistência e rollback. Não copiar o banco
  comercial para este staging de fixture sintética por conveniência.
- Não ligar checkout na produção nem publicar o PDV até aceite humano,
  recuperação autorizada e decisão explícita do proprietário por CNPJ.
- O PointVet aqui é **PDV de gestão manual**; a emissão de notas, motor/provedor
  fiscal, TEF, PSP, balança e leitores físicos continuam **fora do escopo**.
  Cumprir obrigações fiscais/contábeis aplicáveis por procedimento externo
  validado antes de iniciar vendas comerciais.

### Registro para preenchimento pelo proprietário

| Campo | Preencher após a conferência |
| --- | --- |
| Data/hora UTC | — |
| Atendente | — |
| Supervisor | — |
| Resultado | PENDENTE |
| Falhas / evidências não sensíveis | — |
| Janela curta de novo fechamento/estorno autorizada? | NÃO |
| Publicação comercial / merge autorizados? | NÃO |
