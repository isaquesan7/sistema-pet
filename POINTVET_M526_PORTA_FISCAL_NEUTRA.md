# PointVet M.5.26 — porta fiscal neutra, sem motor ou provedor escolhido

## Decisão expressa do proprietário (15/10/2026)
**NÃO implementar o motor fiscal agora.** O provedor de emissão fiscal será escolhido posteriormente. Preparar a arquitetura para conexão futura, sem escolher fornecedor antecipadamente nem iniciar emissão, consulta, cancelamento ou contingência oficial.

Esta decisão **não** dispensa documentação fiscal legal quando exigível e **não** libera checkout comercial do PDV Unificado. Permite evoluir os componentes não fiscais, o ambiente de homologação com dados sintéticos e os controles de segurança enquanto a escolha está pendente.

## Fronteira técnica entregue
- `api/src/modules/fiscal/fiscal-provedor-neutro.contract.js` exporta `prepararEnvelopesFiscaisNeutrosM526(plano)`, função **pura**, sem acesso ao banco ou rede. Recebe somente prévia M.4C.2 de Venda FILHA já finalizada e previamente autorizada pela camada existente, nunca a comanda total multiempresa.
- A função confere o fingerprint SHA-256 da fonte M.4C.2, flags de bloqueio, organização/empresa/emissor, grupo único por classe, tipo escolhido (produto: NF-e/NFC-e; serviço: NFS-e), itens únicos, descontos/acréscimos rateados e somas exatas em centavos. Mistura de CNPJs, mudança de valores, troca de documento, item duplicado ou origem adulterada falham fechados.
- Gera envelope interno versionado `POINTVET_FISCAL_PORT_V1` com referência à venda, comanda, empresa, identidade fiscal/unidade, documento **pretendido**, série apenas **informada** (não reservada), itens, classificação cadastral **não homologada**, valores, fingerprint próprio e pendências. Uma Venda filha com produto e serviço produz dois envelopes distintos, nunca uma nota agregada. Não replica parâmetros privados de fornecedor, tokens, certificados ou dados completos de cliente.
- **Bloqueios permanentes nesta fase:** `permiteEmissao=false`, `permiteCancelamento=false`, `permiteConsultaExterna=false`, `permiteContingencia=false`, `transmitiu=false`, `assinouXml=false`, `reservouNumero=false`, `documentoFiscalCriado=false`, `provedorConectado=false`, `motorFiscalImplementado=false`. Mesmo com pendências cadastrais vazias, sempre exige escolha do provedor, homologação tributária por emissor e adaptador futuro.
- **Não foram criados** rota HTTP, configuração de chave, SDK, webhook, XML, comunicação SEFAZ/prefeitura, cálculo de imposto, numeração, migrations, tabelas, emissão, cancelamento ou alteração de `DocumentoFiscal` legado.

## Contrato para o adaptador FUTURO (não implementado)
1. Uma implementação por fornecedor deverá declarar separadamente suas capacidades de NF-e/NFC-e/NFS-e por emissor, UF/município, ambiente, séries, consulta após resposta indeterminada, cancelamento e contingência, sem supor compatibilidade nacional universal.
2. O adaptador receberá um **novo comando autorizado e revalidado** contra a venda, emissor, versão/fingerprint, permissões e idempotência sob lock. O envelope de hoje é **insumo documental**, não comando executável nem payload certificado.
3. Antes de transmitir, exigirá análise fiscal/contábil responsável, tratamento LGPD de dados do tutor, credenciais/certificado em cofre seguro, número/série e regras específicas do provedor, ambiente homologado, replay/retentativa segura e auditoria independente. Resposta incerta deverá provocar **consulta/investigação**, nunca reenvio automático.
4. O sistema só poderá gravar resultados fiscais oficiais quando houver prova autenticada de autorização/cancelamento e fluxo de contingência homologado; **estados simulados M.4D jamais serão promovidos automaticamente**.

## Testes e aceite
- `api/tests/fiscal-provedor-neutro.contract.test.mjs`: dois tipos distintos, centavos exatos, identificação de emissor, estabilidade de fingerprint, pendências de provedor ainda não escolhido, plano sem configuração fiscal, tentativas de adulteração de hash, emissor, documento, rateio, itens e flags de emissão.
- `api/tests/pdv-unificado-integration.test.mjs`: com PostgreSQL descartável CI, duas vendas filhas reais de CNPJs diferentes (NF-e R$180 e NFS-e R$140) geram somente envelopes distintos, sem criar `DocumentoFiscal` ou conectar fornecedor. Workflow `PointVet Unified PDV Foundation` executa testes puros, compilação/Prisma, integração e backup/restore **sintéticos**.
- **Status do CI final:** pendente; verificar jobs `validate` + `isolated-postgres` no SHA exato, corrigir eventuais falhas e registrar evidências na Issue #37/PR #36.

## Continuidade e gates
**Próximo desenvolvimento pode prosseguir SEM motor fiscal**: comprovação financeira manual, revisão multiempresa, interfaces de conferência, segurança, observabilidade e plano de staging. A escolha/homologação do emissor fiscal é uma trilha independente a ser retomada **somente após decisão do proprietário**. Staging REAL, restore/rollback real e piloto exigem autorização específica. O PR #36 segue DRAFT; checkout unificado desabilitado, `main`, produção Pet King e Railway intocados; sem integração bancária, TEF, PSP ou maquininha.
