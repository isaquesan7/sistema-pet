# Roadmap SaaS — BichOne

## Fundação concluída neste patch
- Multi-organização (tenant) e múltiplos CNPJs.
- Isolamento de clientes, espécies, fornecedores e demais cadastros por organização.
- Branding e módulos configuráveis.
- Usuários, cargos e permissões por CNPJ.
- Clientes e pets com escopo de tenant.
- Espécies e raças configuráveis.
- Categorias configuráveis de produto/serviço.
- Catálogo com custo, preço, markup, margem e histórico.
- Estrutura de funcionários, jornadas e ponto.
- Pacotes fixos, temporários e personalizados.
- Fundação fiscal por CNPJ.
- Auditoria básica.

## Painel administrativo React — concluído até a Fase 6
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

## Próxima fase recomendada — Banho e Tosa
1. Agenda e capacidade por profissional/recurso.
2. Check-in e ordem de serviço.
3. Ficha técnica de estética/comportamento.
4. Kanban de produção: aguardando, banho, secagem, tosa, pronto e entregue.
5. Fotos/observações de entrada e saída.
6. Pacotes, créditos e lançamento automático na comanda.
7. Aviso de pet pronto preparado para Portal/WhatsApp.

## Fases seguintes
- Portal/PWA do cliente: cadastro, pets, agenda e pagamento antecipado.
- Portal/PWA do cliente: cadastro, pets, agenda e pagamento antecipado.
- Financeiro: contas a pagar/receber e conciliação.
- Fechamento do ponto e exportação para folha (sem substituir software contábil na primeira versão).
- Integração fiscal com provedor homologado, certificado e emissão por CNPJ.
- Multi-plano/módulos contratados para comercialização SaaS.


## Evolução SaaS recomendada
- Onboarding self-service de novas organizações e primeiro administrador.
- Planos/assinaturas e módulos contratados.
- Formas de pagamento e demais cadastros auxiliares configuráveis pelo painel.
- Trilhas de auditoria ampliadas para operações financeiras, estoque e prontuário.
- Políticas de retenção, exportação e exclusão de dados para adequação LGPD.
- Integração com armazenamento de arquivos para logos, fotos e documentos.
- Rotinas de backup, observabilidade e métricas por tenant.
