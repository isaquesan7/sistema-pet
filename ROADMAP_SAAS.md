# Roadmap SaaS — PetRise

## Fundação concluída neste patch
- Multi-organização (tenant) e múltiplos CNPJs.
- Isolamento de clientes, espécies, fornecedores e demais cadastros por organização.
- Branding e módulos configuráveis.
- Usuários, cargos e permissões por CNPJ.
- Clientes e pets com escopo de tenant.
- Espécies e raças configuráveis.
- Categorias configuráveis de produto/serviço.
- Catálogo com custo, preço, markup, margem e histórico.
- Estrutura de funcionários, jornadas, ponto e fechamento mensal.
- Pacotes fixos, temporários e personalizados.
- Fundação fiscal por CNPJ.
- Auditoria básica.

## Painel administrativo React — concluído até a Fase 15
- Login, seleção da empresa/CNPJ e shell responsivo.
- Sessão renovada automaticamente e opção **Mantenha-me conectado**.
- Controle de acesso por permissão/módulo.
- Dashboard inicial.
- Clientes e pets.
- Configurações de organização, logo e cores.
- Espécies, raças e categorias configuráveis.
- Produtos e serviços com precificação e histórico.
- Funcionários, funções, jornadas e ponto eletrônico.
- Modelos de pacotes, pacotes personalizados, créditos e consumo.
- PDV, caixa, múltiplos pagamentos e histórico de vendas.
- Comandas compartilhadas entre CNPJs com fechamento financeiro separado.
- Baixa e restauração de estoque por venda/cancelamento.
- Recebimento de pacotes e vínculo automático com `vendaId`.
- Estoque operacional: fornecedores, entradas, custo médio, lotes, validade, inventário e ajustes.
- Consultório veterinário: fila, prontuário, prescrições, vacinação, vermifugação, exames, procedimentos, documentos e integração com comanda/estoque.

- Banho e Tosa: agenda, bloqueio de conflito por profissional, check-in, OS, ficha técnica, anexos, Kanban, pacotes e comanda.

## Fases seguintes
- Conexão de produção com o provedor fiscal escolhido e homologado para cada município/UF.
- Multi-plano/módulos contratados para comercialização SaaS.


## Evolução SaaS recomendada
- Onboarding self-service de novas organizações e primeiro administrador.
- Planos/assinaturas e módulos contratados.
- Formas de pagamento e demais cadastros auxiliares configuráveis pelo painel.
- Trilhas de auditoria ampliadas para operações financeiras, estoque e prontuário.
- Políticas de retenção, exportação e exclusão de dados para adequação LGPD.
- Integração com armazenamento de arquivos para logos, fotos e documentos.
- Rotinas de backup, observabilidade e métricas por tenant.

## Fase 10 — Portal/PWA do Cliente — concluída
- Cadastro/login do tutor e sessão própria.
- Pets pelo próprio cliente.
- Agenda online de Consultório.
- Banho e Tosa com reserva temporária e confirmação condicionada ao pagamento.
- Base de transações online e PWA.
- Rebranding oficial da plataforma para PetRise.

## Fase 11 — Financeiro — concluída
- Contas a pagar e receber por CNPJ.
- Fiado integrado automaticamente ao PDV.
- Categorias e contas financeiras.
- Baixas parciais/totais, juros e descontos.
- Conciliação de vendas, baixas e pagamentos online.
- Fluxo de caixa por CNPJ e consolidado da organização.
- Relatórios gerenciais e vencidos.

## Fase 12 — Ponto e fechamento mensal — concluída
- Fechamento mensal individual e por competência.
- Banco de horas, atrasos, faltas, extras e divergências.
- Workflow de aprovação/rejeição de ajustes sem apagar a batida original.
- Snapshot auditável e reabertura controlada.
- Exportação CSV para folha/contabilidade.

## Fase 13 — Fiscal — concluída
- Configuração fiscal separada por CNPJ, regime e ambiente.
- Tributação de produtos e serviços no catálogo fiscal.
- Preparação de NF-e, NFC-e e NFS-e conforme o tipo dos itens da venda.
- Fila de documentos, snapshots auditáveis, tentativas e vínculo com vendas.
- Recibo interno identificado como não fiscal.
- Simulador `development` bloqueado em Produção e destinado somente à homologação.
- Emissão automática opcional adiciona o documento padrão à fila após finalizar a venda.
- Cancelamento de venda bloqueado enquanto existir documento fiscal autorizado.
- Camada preparada para adaptador de provedor real sem acoplar o PDV a uma API fiscal específica.

> A transmissão oficial para SEFAZ/prefeituras depende da escolha e credenciais de um provedor fiscal real. A Fase 13 não finge autorização oficial quando o adaptador não está conectado.

## Fase 14 — Relatórios e indicadores — concluída
- Dashboard executivo por CNPJ e consolidado da organização.
- Comparativos com período anterior.
- Vendas, ticket médio, formas de pagamento, categorias e ranking de itens.
- Clientes, recorrência e distribuição de pets.
- Indicadores de Consultório, Banho e Tosa e Pacotes.
- Estoque, validade, mínimo e valor a custo médio.
- Financeiro realizado/em aberto e indicadores fiscais.
- Exportações CSV gerenciais.
- Dashboard principal enriquecido com indicadores mensais.

## Fase 15 — SaaS comercial e onboarding — concluída
- Cadastro self-service de novas organizações.
- Criação do primeiro administrador e primeiro CNPJ.
- Planos comerciais editáveis, módulos contratados, trial e limites por plano.
- Assinatura e faturas próprias da plataforma, com simulador seguro em desenvolvimento.
- Área de plano/assinatura para proprietário e administrador do tenant.
- Bloqueio operacional por suspensão/cancelamento/trial expirado, preservando acesso à regularização.
- Console interno `/plataforma` para tenants, planos, assinaturas, faturas e suporte.
- `superAdmin` separado das permissões comuns dos tenants.
- Portal do Cliente integrado ao status comercial e aos limites de clientes/pets.
- Organizações anteriores migradas sem interrupção para o plano Completo/ATIVA.

## Próxima fase recomendada — Fase 16 — Segurança, LGPD e arquivos
- Central de privacidade/LGPD por organização.
- Exportação estruturada dos dados de um cliente/tutor.
- Anonimização/exclusão controlada respeitando vínculos fiscais e clínicos obrigatórios.
- Políticas de retenção e trilha de auditoria ampliada.
- Storage real para logos, fotos de pets, anexos clínicos e Banho e Tosa.
- URLs assinadas e controles de acesso aos arquivos.
- Base de observabilidade, health checks e rotinas de backup/recuperação para produção SaaS.

## Infra 15.2 — Railway Ready
- Variáveis sensíveis centralizadas no Railway; `.env` local deixa de ser obrigatório.
- API compatível com `railway run`, healthcheck e pre-deploy de migrations.
- Admin e Portal recebem URL da API em runtime por `/runtime-config.js`.
- Servidor estático próprio para React/Vite em produção Railway, com fallback SPA.
- Simuladores de pagamento bloqueados quando `NODE_ENV=production`.
- Deploy recomendado em três serviços (`petrise-api`, `petrise-admin`, `petrise-portal`) no mesmo projeto do PostgreSQL.
