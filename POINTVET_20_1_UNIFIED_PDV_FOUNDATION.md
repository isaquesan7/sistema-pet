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
