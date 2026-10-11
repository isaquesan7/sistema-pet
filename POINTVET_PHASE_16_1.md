# PointVet 16.1 — Rebranding oficial

Mudança comercial visível: PetRise → PointVet.

## Alterações
- Painel: login, cadastro, dashboard, menus, assinaturas, configurações, administração.
- Portal: login, cadastro, marca no cabeçalho, títulos e manifesto PWA.
- API: mensagens comerciais, onboarding e faturas.

## Compatibilidade
- Preservados: variáveis PETRISE_*, nomes petrise-*, tabelas, migrations, serviços Railway, endpoints e banco.
- Pet King permanece uma organização independente da marca da plataforma.
- Sem alteração no cache técnico do service worker.

## Validação pré-merge
1. Rodar npm ci e npm run build em admin-web e client-web.
2. Revisar scripts de teste disponíveis na API e executar verificações adequadas.
3. Testar login, onboarding, administração, assinatura, configurações e portal.
4. Revisar as diferenças e buscar referências de PetRise residuais em pontos públicos.
5. Fazer merge somente depois de validar; não há migration nesta fase.

Observação: alterações foram propostas em branch própria; testes de build e deploy ainda não foram executados.