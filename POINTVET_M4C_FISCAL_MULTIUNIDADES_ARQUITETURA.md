# PointVet M.4C.1 — pré-matriz fiscal multiempresa e topologia de unidades
**Status:** somente na branch do PR #36, com CI PostgreSQL descartável. Data: 14/10/2026.

## 1. Contrato de segregação fiscal
- O carrinho PDV unificado pode ter itens de mais de uma empresa. A emissão futura deve ocorrer a partir da VENDA FILHA de cada emissor/CNPJ, nunca do valor total da comanda multi-CNPJ.
- A prévia técnica de RASCUNHOS agrupa por (empresaId, classe PRODUTO ou SERVICO). Produtos têm NFE/NFCE como tipos POSSÍVEIS, exigindo escolha fiscal explícita depois; serviços têm NFSE sujeita às regras do município. Recibo não substitui documento fiscal legalmente exigível.
- Validação de campos fiscais do emissor (CNPJ no formato de 14 dígitos, cidade, UF, regime, séries, provedor, certificado), produto (NCM, CFOP, origem, CST/CSOSN), serviço (código municipal), preço, desconto, quantidade e totais. É apenas checagem técnica: NÃO valida enquadramento legal, alíquotas, regras SEFAZ/municipais, autorização externa ou protocolo.
- Toda prévia informa emissaoHabilitada=false, documentoEmitido=false e gerouVenda=false, mesmo com campos completos. Não existe emissão, transmissão, cálculo de tributo, cobrança, movimentação de estoque ou alteração de DocumentoFiscal.
- Contrato puro: api/src/modules/fiscal/fiscal-unificado-planejamento.contract.js.
- Serviço somente CI: api/src/modules/fiscal/fiscal-unificado-planejamento-sandbox.service.js. Exige NODE_ENV=test, POINTVET_UNIFIED_SALES_SANDBOX=1, banco real pointvet_unified_ci, operador ATIVO e permissões pdv.acessar + fiscal.visualizar em TODAS as empresas. Revalida organização, tutor, versão, ausência de venda/reserva e lê em transação RepeatableRead. Nenhuma rota HTTP foi criada.

## 2. Identidade fiscal e unidade operacional: somente estrutura futura
Migration aditiva api/prisma/migrations/20261015013000_fiscal_entity_operational_units_foundation.
- EntidadeFiscal: identidade potencial do emissor; CNPJ único dentro da organização e razão social. Ainda não cria/autorizada documentos.
- UnidadeOperacional: código, nome e identidade fiscal; uma EntidadeFiscal pode ter VÁRIAS unidades. Somente UMA unidade pode apontar para determinada Empresa legada por empresaLegadaId opcional UNIQUE.
- Empresa segue intacta, inclusive Empresa.cnpj @unique, vínculos históricos de venda, fiscais, catálogo, permissões, caixa e estoque. Não há backfill nem migração produtiva.
- FKs compostas com organizacaoId impedem no banco que uma UnidadeOperacional referencie empresa legada ou emissor de outra organização. Há índices UNIQUE compatíveis com essas relações.
- Unidade adicional SEM empresaLegadaId é apenas estrutura cadastral no banco de CI: **não significa PDV, estoque, caixa, equipe ou emissão ativos**, nem autoriza tratar mesma inscrição/CNPJ igualmente em locais físicos diferentes.
- Cada localização e CNPJ pode exigir exame tributário e administrativo específico. Filial com CNPJ próprio deve manter identidade fiscal distinta. Não presumir permissões municipais/estaduais.

## 3. Testes
- api/tests/fiscal-unificado-planejamento.contract.test.mjs: segregação de produtos/serviços, dados inválidos, centavos, total, topologia e isolamento.
- api/tests/pdv-unificado-fiscal.integration.test.mjs: PostgreSQL descartável, três grupos de mercadoria/serviço em dois emissores, duas unidades para uma EntidadeFiscal/uma Empresa, unicidade dos códigos, FKs cross-tenant rejeitadas pelo próprio banco, permissão por emissor, preço alterado, classificação incompleta, versão incorreta e ZERO Venda/Pagamento/DocumentoFiscal/Caixa/Estoque.
- CI mantém regressões das fases M.3/M.4B. CI verde não libera produção.

## 4. Próxima etapa oficial
M.4C.2: preparar contrato de alocação fiscal por VENDA FILHA efetiva, com discriminação produto/serviço, escolha explícita NF-e/NFC-e e rateio determinístico de descontos/acréscimos em centavos. A preparação continuará sem transmissão, autorização ou emissão até fiscal homologado.

M.4C.3: migração assistida da Empresa legada para EntidadeFiscal/UnidadeOperacional (backfill auditado, snapshot, autorização de acesso/caixa/estoque, série fiscal, rollback) sem retirar Empresa.cnpj @unique antes de planejamento explicitamente aprovado.

M.5: staging isolado, teste de restore real de backup, migrações e reversão, contingência, canário por organização e aprovação explícita de publicação. Integração de maquininhas/PSP NÃO está no escopo. Crédito cliente continua bloqueado no PDV.

**Fontes de continuidade:** POINTVET_CONTINUIDADE_OFICIAL.md, POINTVET_GATES_PUBLICACAO.md, Issue #37, PR #36 e CI do HEAD exato.


## 6. M.4C.2 — escolha fiscal explícita e rateio exato por venda-filha
Uma etapa SOMENTE CI agora lê a Venda FILHA real de M.3B, já finalizada, com vínculo à reserva, da empresa selecionada. Faz prévia segregada de PRODUTO (NFE ou NFCE por escolha explícita) e SERVICO (NFSE), sem recibo como substituto automático, com distribuição exata em centavos de descontos/acréscimos globais usando BigInt e maior resto. Conferência de organização, permissões fiscais e PDV, item/empresa, total, documento preexistente. Não gera DocumentoFiscal, nem status de autorização, nota ou transmissão. Detalhes: [M.4C.2](POINTVET_M4C2_PREPARACAO_VENDAS_FILHAS.md). Próximo M.4C.3 migração assistida e M.5 homologação.


## 7. M.4C.3 — vinculação assistida e reversão lógica CI
Serviço CI isolado fiscal-unidades-migracao-sandbox.service.js lê Empresa e históricos para montar fingerprint SHA256 de snapshot cadastral/volume de registros, revalida permissões de gestor da organização e fiscal.gerenciar, exige código explícito e chave idempotente, transação Serializable/lock de Empresa, e cria EntidadeFiscal + UnidadeOperacional em vínculo 1:1 sem alterar Empresa.cnpj UNIQUE, venda, caixa, estoque e DocumentoFiscal. Auditoria guarda snapshot/causa e reversão lógica apenas desliga a ponte unidade→Empresa; a entidade fiscal e unidade permanecem para análise. Repetição, revisão desatualizada, vinculação por outro tenant, anomalia ou tentativa de reimportar depois de reversão são bloqueadas. Nenhuma integração pública ou autorização fiscal. [Handoff M.4C.3](POINTVET_M4C3_MIGRACAO_FISCAL_ASSISTIDA.md).
