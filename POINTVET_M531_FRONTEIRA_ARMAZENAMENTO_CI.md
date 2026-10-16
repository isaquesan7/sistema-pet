# PointVet M.5.31 — fronteira de armazenamento documental (somente CI)

Data: 16/10/2026. Continuidade controlada da [Issue #37](https://github.com/isaquesan7/sistema-pet/issues/37) no [PR #36 DRAFT](https://github.com/isaquesan7/sistema-pet/pull/36).

## Objetivo e decisão de escopo

Especificar **o que um futuro adaptador seguro de evidências documentais deverá comprovar**, sem criar o adaptador e sem selecionar serviço de armazenamento. A matriz é uma **prévia de planejamento sintético**, exclusivamente em memória; não recebe arquivo, conteúdo, URL, dados de clientes, chaves, credenciais, identificação de comprovante real, nem inicia transferência. **Mesmo 10/10 controles planejados não representam implementação, segurança homologada, autorização de captura ou retenção.**

O **motor fiscal permanece adiado até o proprietário escolher seu provedor**, conforme orientação expressa. Nada nesta etapa seleciona emissor/PSP/TEF/banco, abre checkout, emite nota, lança financeiro, reembolsa, consulta banco ou integra SEFAZ/prefeitura.

## Contrato e fronteiras

- `planejarFronteiraEvidenciasM531` é função pura sem I/O; recebe `minuta` M.5.30 não homologada mas com dez requisitos técnicos especificados e `proposta` com forma fechada: versão `M5_31_FRONTEIRA_EVIDENCIAS_CI_V1`, organização, empresa/CNPJ, comanda, SHA exato da minuta e mapa de dez **booleanos**. Rejeita campos extras, incluindo bytes, URL e texto livre; usa identificadores internos já autorizados.
- `consultarFronteiraEvidenciasSomenteSandbox` reavalia M.5.30 e M.5.29 via cadeia existente, com checagens de `NODE_ENV=test`, flag CI, PostgreSQL descartável `pointvet_unified_ci`, tenant/CNPJ/permissões, auditoria e versão de dossiê. Não expõe rota HTTP, não efetua transação de escrita, não cria tabela, não injeta serviço de objetos.
- O código SHA-256 `codigoFronteira` é **versão sintética de prévia**, não é assinatura, atestado jurídico, recibo de upload, hash de arquivo ou prova de autenticidade. Alteração do plano, minuta ou controles exige nova prévia.
- Não existem no resultado nem provedor, destino, chave, arquivo, conteúdo, tipo MIME aprovado, limite de bytes aprovado, prazo de retenção decidido ou URL temporária. Nenhuma ação possível de upload, armazenamento, exportação, descarte, pagamento ou fiscal. `politicaRetencaoAprovada`, `autorizacaoParaCaptura` e todos os flags operacionais permanecem **false**; `prazoRetencaoDias` permanece **null**.

## Dez decisões de segurança para uma solução futura

| Código | Critério técnico futuro — **não implementado** |
| --- | --- |
| `ISOLAMENTO_ORGANIZACAO` | Particionamento e autorização por organização com negação cross-tenant |
| `ISOLAMENTO_CNPJ_EMPRESA` | Separação por CNPJ emissor/empresa, inclusive no acesso administrativo |
| `CRIPTOGRAFIA_EM_REPOUSO_PLANEJADA` | Modelo de cifragem em repouso, formatos, rotação e responsabilidade |
| `TRANSPORTE_PROTEGIDO_PLANEJADO` | Canal autenticado/protegido e prevenção de transferência insegura |
| `CHAVES_EM_COFRE_SEPARADO_PLANEJADO` | Gestão de chaves apartada do banco de dados e de objetos |
| `ACESSO_TEMPORARIO_MINIMO_PLANEJADO` | Autorização de privilégio mínimo e expiração, sem URLs permanentes |
| `VERIFICACAO_MALWARE_PLANEJADA` | Quarentena e varredura antes de eventual disponibilização |
| `TRILHA_DE_ACESSO_E_CUSTODIA_PLANEJADA` | Auditoria de acesso/download, integridade e cadeia de custódia |
| `DESCARTE_BLOQUEADO_SEM_POLITICA` | Proibição de expurgo sem política aprovada e verificação de litígio |
| `PROCEDIMENTO_INCIDENTE_E_RESTORE_PLANEJADO` | Resposta a incidente, exercício de recuperação/rollback e segregação |

Cada controle informa `planejado: true/false`, `implementado: false` e `validadoEmAmbienteReal: false`. A cobertura conta exclusivamente **planejamento**. As decisões de finalidade/base legal, categorias de dados, retention schedule por categoria e marco inicial, responsável por aprovar, litígios, direitos dos titulares, regras contábeis/fiscais por CNPJ, acesso humano, orçamento e fornecedor dependem de análise/decisão externa futura; nenhuma é presumida.

## Evidências e gates

Testes puros verificam matriz incompleta e completa, recusa de minuta incompleta/adulterada, SHA antigo, escopo cruzado, campos inesperados e coerção de booleanos. O E2E PostgreSQL CI monta dossiê M.5.27 → plano M.5.29 → minuta M.5.30 → proposta M.5.31; verifica isolamento e invalidação após parecer M.5.28 e mudança do dossiê. Workflow `PointVet Unified PDV Foundation` valida novos módulos e roda a integração já existente somente em banco efêmero; não utiliza dados reais.

Para **ativar captura ou guarda real futuramente**, será necessária autorização expressa do proprietário e um projeto separado com: política de privacidade/retenção aprovada por pessoas identificadas; base legal e minimização por documento; aprovação de segurança e contábil/fiscal por CNPJ; escolha e avaliação de provedor, contrato e localidades de armazenamento; modelo de chaves e segregação; classificação/tamanho e prevenção de malware; RBAC, trilha auditada, acesso temporário e bloqueio legal de descarte; testes reais em staging segregado, restauração/incident response e autorização de produção. Nenhum desses gates foi executado ou autorizado nesta M.5.31.

**Não autoriza** alterações em `main`, Pet King, Railway, deploy, merge, staging/restore real, anexos de clientes ou qualquer operação fiscal/financeira.
