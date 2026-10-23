# PointVet M.5.4 — evidências de staging real (gate SEM execução)
**Estado em 14/10/2026:** preparação técnica exclusivamente em branch PR #36 DRAFT. **Staging real NÃO foi criado nem verificado.** Nenhum backup real restaurado, nenhuma conexão Railway/Hostinger/Resend/R2 e nenhum deploy, DNS ou produção alterados.

## Como proceder (somente após autorização específica)
1. Aprovar projeto Railway, ambiente, PostgreSQL, storage e segredos exclusivos e distintos da produção. Não colocar segredos em issues ou manifests.
2. Implantar somente dados sintéticos com email sink, webhooks desligados e módulos experimentais inativos; pagamentos continuam registro manual sem maquininha/PSP. Nenhuma emissão fiscal ou crédito no checkout.
3. Validar DNS e TLS de API/Admin/Portal no **staging dedicado**; smoke HTTP/autenticação e isolamento de empresas, métricas e alertas efetivos. Guardar IDs de evidência sanitizados e revisores.
4. Restaurar backup **REAL** somente após escolha da fonte, autorização independente, controle de acesso, revisão LGPD e mascaramento; medir RTO/RPO, consistência, migrações e storage, sem alterar original.
5. Ensaiar rollback de RELEASE e das flags no staging e documentar critérios de interrupção, preservação de dados e responsáveis. A decisão sobre canário de **uma organização opt-in** é separada e exige aprovação posterior explícita.

## Gate automatizado desta etapa
`api/src/modules/plataforma/pointvet-m54-evidencias.contract.js` confere metadados declarados de 19 evidências e dois SHAs distintos; bloqueia credenciais e provas vagas. `api/tests/pointvet-m54-evidencias.contract.test.mjs` cobre completude, ausências, dados sensíveis e inexistência de efeitos. **Não busca nem autentica evidência externa:** até com declaração completa retorna `executarDeploy=false`, `executarRestore=false`, `executarRollback=false` e `autorizarProducao=false`.

**Pendência:** aprovação de infraestrutura para M.5.4 operacional, acesso/execução controlada, prova externa e revisão independente. Não confundir CI verde com homologação real. Continuam proibidos merge do PR #36, alteração da `main`, retirada de `Empresa.cnpj @unique`, lançamento financeiro/fiscal do PDV unificado e mudanças na produção Pet King.

## M.5.4.1 — segunda camada de auditoria de proveniência (offline)
`api/src/modules/plataforma/pointvet-m541-auditoria-evidencias.contract.js` confere vínculo de cada evidência ao SHA candidato, categoria, referência, hash SHA-256 declarativo, operador/coletor e revisor distintos. Recusa campos desconhecidos, hashes inválidos, metadados divergentes e segredos; testes específicos cobrem casos positivos e negativos. **Hashes e assinaturas de metadados não comprovam que serviços externos foram realmente auditados.** Mesmo que tudo esteja consistente, os campos de ações externas são sempre `false`. A CI testa a forma dos metadados; não faz deploy nem consulta infraestrutura.

## M.5.4.2 — janela de alteração somente staging sintético
Contrato puro `api/src/modules/plataforma/pointvet-m542-janela-staging.contract.js` e testes. Valida identidade de responsável e aprovador distintos, commit completo fixado, referências sanitizadas a ticket e plano de interrupção; exige flags que mantenham produção, dados Pet King, PSP, e-mail real, fiscal e crédito desativados. Declaração consistente NÃO demonstra autorização real nem cria acesso e sempre retorna `executarDeploy=false`, `executarRestore=false`, `executarRollback=false`, `autorizarProducao=false`. Homologação operacional pendente.
