# PointVet — Fase 20.1 / Fundação do PDV Unificado

## Decisão de produto
- A ativação será **opcional por organização** (não global por plataforma).
- Preferência `ConfiguracaoOrganizacao.pdvUnificadoHabilitado`, padrão `false`. Essa preferência **não liga o checkout** antes da homologação.
- O PDV atual permanece inalterado. `GET /api/pdv-unificado/disponibilidade` informa o modo efetivo INDIVIDUAL e as empresas acessíveis ao funcionário, sem mutações.
- Na Pet King: a intenção aprovada é utilizar o PDV unificado **quando o fechamento for homologado**. Não ativar fechamento multiempresa ou split antes de testes.

## Auditoria inicial do esquema existente
- `Comanda` já associa tutor e itens; `ComandaItem` já referencia `empresaId`, `itemCatalogoId` e `petId`. Reutilizar essas estruturas no desenho futuro, não duplicar comandas.
- `Venda` e `Pagamento` já estão vinculados a empresas. Preservar lançamentos, caixa, histórico fiscal e estoque por empresa.
- `Empresa.cnpj` está definido com `@unique` global: **impede representar múltiplas empresas/estabelecimentos com o mesmo CNPJ hoje**. Antes de suportar efetivamente esse cenário, revisar cuidadosamente a diferença entre estabelecimento, pessoa jurídica e centro de resultado, sem remover unicidade de modo irrefletido.
- `selecionarEmpresa` valida vínculo com a empresa ativa e a organização; qualquer busca multiempresa precisa revalidar autorização por empresa e seus módulos/permissões próprios.
- O modelo inicial do PR #35 prevê Orçamentos e Crédito do Cliente. Não mesclar enquanto não houver integração com o PDV unificado, migração isolada e testes financeiros.

## Próximas entregas, sem impacto na Pet King
1. Modelagem do grupo de fechamento multiempresa em branch própria, vinculando vendas individuais a uma mesma comanda existente.
2. Consultar itens reais das empresas autorizadas, filtrados por empresa e permissão (sem conferir acesso com base somente na organização).
3. Endpoint somente rascunho de comanda: valida cada item/catalogo/pet/empresa, impede totais enviados pelo navegador; sem cobrança ou estoque.
4. Testes de separação entre CNPJs iguais/diferentes e centros de resultado, inclusive acessos parciais e alteração de vínculo durante a operação.
5. Conciliação separada por recebedor, idempotência, compensação parcial e documentos fiscais obrigatórios.
6. Integrar Orçamentos (PR #35) na comanda unificada e apenas depois habilitar o razão de Crédito como pagamento validado.
7. Homologar em banco descartável, testar backup e recuperação e liberar por flag de rollout independente da preferência da organização.

**Não efetuar deploy dessas migrations na Pet King até a trilha de homologação.**

## Incremento 20.1.2 — Rascunho multiempresa persistente (branch)
- Reutiliza `Comanda` e `ComandaItem` existentes, com `rascunhoUnificado` (padrão false) e `versaoRascunho`.
- `POST /api/pdv-unificado/rascunhos` salva preços recotados, origem/empresa e pet validado dentro da mesma transação serializável.
- `PUT /api/pdv-unificado/rascunhos/:id` exige versão exata, refaz cálculos e permissões, substitui apenas itens de rascunho; conflito gera HTTP 409.
- `GET /api/pdv-unificado/rascunhos` retorna somente rascunhos cujas empresas sejam todas acessíveis.
- As rotas antigas de editar/remover/fechar comandas bloqueiam explicitamente `rascunhoUnificado` e a listagem/contagem antiga não exibe esses rascunhos.
- Os novos campos e validações exigem migration testada e rollback planejado; não mesclar sem homologação PostgreSQL isolada.
- Nem essa nova comanda nem sua atualização executam pagamento, venda, estoque, nota fiscal ou split.
- **Orçamentos e Crédito do Cliente permanecem no PR #35**, devendo ser integrados ao mesmo catálogo/comanda antes do fechamento multiempresa.

## Incremento 20.2.1 — Reserva idempotente do plano (sem venda)
- `ReservaFechamentoUnificado` persiste 1 conjunto por `comandaId + versaoRascunho`, com chave única no PostgreSQL e estado `RESERVADA / CANCELADA`.
- `ReservaOperacaoUnificada` persiste 1 operação por empresa, valor próprio, chave SHA-256 única e `vendaId` opcional único para vínculo futuro; `vendaId` não é preenchido nesta fase.
- POST `/api/pdv-unificado/rascunhos/:id/reservar` aceita **somente** `versao`; todos os valores, CNPJs e chaves são gerados no servidor.
- As operações são gravadas atomicamente numa transação `Serializable`, após lock de linha na comanda, validação de autorização em todas as empresas e checagem do preço atual. Repetir a mesma reserva retorna os mesmos IDs. Corridas serializáveis podem exigir que o cliente tente novamente ao receber HTTP 409.
- Enquanto uma reserva está ativa, o serviço de rascunho bloqueia edição. O PDV tradicional já bloqueia faturamento desses rascunhos.
- GET `/api/pdv-unificado/rascunhos/:id/reserva?versao=N` consulta o estado com isolamento organizacional e permissão em **todas** as empresas da comanda.
- POST `/api/pdv-unificado/rascunhos/:id/cancelar-reserva` exige `pdv.cancelar_venda`, versão e motivo; cancela apenas reservas sem venda vinculada, preservando registros e chaves para auditoria. Para reservar novamente, é necessário atualizar a comanda e criar nova revisão.
- **Nenhuma reserva cria Venda, Pagamento, DocumentoFiscal ou MovimentacaoEstoque.** O checkout segue desativado. Isto prepara idempotência futura, mas não implementa adquirência, split, conciliação, impostos nem NFC-e/NFS-e.
- Testes de integração CI criam duas empresas e validam reserva simultânea, replay, unicidade, bloqueio da edição, cancelamento repetido e recuperação via nova revisão, tudo em PostgreSQL descartável.
- **Pendências de homologação:** backup/restore e rollout reversível, auditoria completa de eventos e rastreabilidade além dos IDs de criador/cancelador já persistidos, CNPJ compartilhado entre estabelecimentos, regras financeiras e fiscais, e integração do PR #35 de Orçamentos e Crédito do Cliente.

### Revisão de permissão para cancelamento
O cancelamento exige **pdv.cancelar_venda em cada empresa** com uma operação na reserva, além da validação por organização e do vínculo ativo. A reserva registra `criadoPorId`, `canceladoPorId`, horário e motivo do cancelamento. Em teste isolado, a revogação dessa permissão em apenas uma das empresas impede o cancelamento do grupo inteiro; restaurada a permissão, todas as operações são canceladas atomicamente sem apagar suas chaves.

## Incremento 20.2.2 — Conferência de alocação e recuperação sem execução
- Novo serviço `pdv-unificado-preparacao.service.js`, sem chamadas para `venda.create`, `pagamento.create`, estoque ou fiscal.
- POST `/api/pdv-unificado/rascunhos/:id/conferencia-alocacao`: exige a reserva válida, alocação **para cada empresa**, sessão de caixa ABERTA e pertencente à mesma empresa, totais iguais aos valores da reserva em centavos e formas de pagamento explicitamente permitidas. Registra apenas um resultado de conferência na resposta; não registra pagamento no banco.
- GET `/api/pdv-unificado/rascunhos/:id/caixas-disponiveis`: devolve somente caixas abertos das empresas que participam da reserva acessível ao operador.
- GET `/api/pdv-unificado/rascunhos/:id/diagnostico-recuperacao`: examina vínculos de operações com vendas, identificando referências incompatíveis sem reexecutar cobrança ou fazer correções automáticas.
- UI exibe caixa e valor separados por empresa, mensagem de pendências e alerta para estados que exigem revisão manual. Sem botão de cobrança.
- `CREDITO_CLIENTE` e `OUTRO` são intencionalmente rejeitados nesta conferência até haver contrato financeiro seguro; Crédito do Cliente segue no PR #35.
- Em ambientes de integração PostgreSQL descartáveis, testes validam alocação correta, troca de caixa entre empresas, soma divergente, empresa omitida, crédito não habilitado e diagnóstico de reserva ativa/cancelada.
- Conferência **não é autorização para venda**: entre conferência e execução futura, preços, permissões e caixas podem mudar. A execução precisará revalidar tudo atomicamente, além de tratar split, crédito, fiscal, autorização externa e recuperação.
- O PDV individual continua intacto. PR ainda é draft e migrations não podem ser aplicadas no banco da Pet King.
