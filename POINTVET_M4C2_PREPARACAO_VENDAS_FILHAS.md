# PointVet M.4C.2 — Pré-preparação fiscal por venda-filha, somente CI
**Data:** 14/10/2026 | PR #36 DRAFT | sem merge, deploy ou migrations em produção.

## Implementação
- api/src/modules/fiscal/fiscal-unificado-venda.contract.js: prepara uma Venda filha FINALIZADA do PDV unificado, nunca o total de uma comanda multiempresa. Exige vínculo ReservaOperacaoUnificada CONCLUIDA, item do catálogo da mesma empresa emissora, mesma organização e tutor, zero documentos fiscais preexistentes.
- Escolha OBRIGATÓRIA de documento: para PRODUTO, NFE ou NFCE; para SERVICO, NFSE. Não escolhe entre NF-e e NFC-e por conta própria, e não usa RECIBO como substituto. Requer revisão das regras por emissor/UF/município. Nenhum XML, documento, número fiscal, certificado, protocolo, transmissão ou autorização é emitido.
- Desconto e acréscimo GLOBAL da Venda são rateados separadamente, em centavos exatos, entre linhas do mesmo CNPJ, pela técnica do maior resto de Hamilton e BigInt; desempate determinístico por ID da linha. O desconto global é proporcional ao líquido de cada linha após seu desconto próprio; acréscimo ponderado pelos subtotais após rateio do desconto. Arredondamentos reconciliados com soma integral da Venda, de grupos e de linhas, sem centavo residual.
- Resultado contém snapshot de emissor (cnpj, razaoSocial, UF/município, regime, ambiente), grupos separados por classe fiscal, escolha explícita, pendências, totais e fingerprint SHA-256 estável. Fingerprint é somente diagnóstico da prévia (não foi persistido e NÃO representa autorização nem chave fiscal).
- api/src/modules/fiscal/fiscal-unificado-venda-sandbox.service.js: serviço SOMENTE PostgreSQL descartável pointvet_unified_ci com NODE_ENV=test e POINTVET_UNIFIED_SALES_SANDBOX=1; confirmação SQL do banco, transação RepeatableRead de leitura, usuario ATIVO, vinculação a empresa/tutor/organização, acesso pdv.acessar e fiscal.visualizar, origem unificada CONCLUIDA e comanda FECHADA. Sem rota pública, sem escrita.
- Todas as flags de emissão, autorização, transmissão, venda criada, documento criado e pagamento são false. CREDITO_CLIENTE permanece bloqueado. Sem integração com PSP, gateway ou maquininha.

## Testes e status
- api/tests/fiscal-unificado-venda.contract.test.mjs: conservação de centavos, rateios com empates e acréscimos superiores ao peso, ordem estável, seleção incompatível, valores, status, item de outro emissor e documentos existentes.
- api/tests/pdv-unificado-integration.test.mjs: após finalizar efetivamente duas Vendas filhas no BANCO CI pelo fluxo manual M.3B, gera prévias independentes: empresa 1 PRODUTO NFE R$180,00; empresa 2 SERVICO NFSE R$140,00. Confere permissão, idempotência funcional de leitura, divergência de emissor/tenant, seleção RECIBO inválida, documento preexistente e zero escrita fiscal/econômica. As regressões M.3, M.4B e M.4C.1 também rodam.
- [CI código #38662162537](https://github.com/isaquesan7/sistema-pet/actions/runs/38662162537): validate SUCCESS + isolated-postgres SUCCESS. Revalidar o HEAD documental antes de declarar status final.

## Limitações e continuidade
- É apenas prévia de Venda já FINALIZADA dentro de um banco descartável; não é a geração real de nota.
- Cadastro de campos fiscais não garante conformidade com leis/regras municipais ou estaduais. Seleção NFE/NFCE requer análise por responsável fiscal, incluindo contingência, autorização, rejeição, cancelamento, consulta externa, idempotência e série.
- A organização pode ter várias empresas distintas, mas cada venda permanece vinculada a só uma empresa/CNPJ. Empresa.cnpj permanece UNIQUE; EntidadeFiscal/UnidadeOperacional ainda não disponibilizam uma segunda unidade com PDV e estoque próprios.
- Próximo M.4C.3: backfill auditado e migração assistida das empresas para topologia fiscal/unidades, snapshots históricos, filtros por organização, autorização por emissor e rollback (sem remover CNPJ único).
- Posterior M.4D: protocolo real de autorização fiscal conforme UF/município, isolado de pagamentos e sem chamadas externas nesta branch. M.5: staging, restauração verificada de backup, reversão, telemetria, canário e aprovação explícita antes da publicação.
