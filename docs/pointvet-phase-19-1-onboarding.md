# PointVet — Fase 19.1: cadastro assistido (DEV)

## Fluxo de entrada
1. Acesse /comecar e escolha um plano disponibilizado pela plataforma.
2. Informe organização, primeiro CNPJ e dados da empresa.
3. Informe o administrador principal e confirme a senha.
4. Revise os dados e confirme o entendimento das condições exibidas.
5. Após criação bem-sucedida, acesse /login com o e-mail escolhido.

## Limites e validação
- O fluxo não cria dados fictícios nem concede acesso por si só: a API verifica o payload e persiste tenant e administrador com as regras já existentes.
- Os planos são carregados da API. Se indisponíveis ou falhar a conexão, o cadastro não avança e oferece recarregar.
- A confirmação de senha não é enviada à API, servindo somente à validação local. Não persistir senha no navegador.
- A etapa de confirmação não substitui termos jurídicos publicados; revisar textos contratuais e pagamentos antes de abrir inscrições externas.
- Fase 19.1 é melhoria de UX, não certificação de ambiente pronto para cadastro público em produção.
- Serviços de backup, alertas e workers não são modificados.

## Checklist antes do lançamento externo
- [ ] Validar signup real de organização piloto não produtiva com CNPJ e e-mail de teste autorizados
- [ ] Conferir isolamento tenant e permissões do novo gestor
- [ ] Testar ausência de planos e erro de rede
- [ ] Revisar termos, preços, trial, contratação e LGPD
- [ ] Validar faturamento e cobrança em cenário real
- [ ] Validar recuperação de conta, atendimento e suporte
- [ ] Confirmar backup e restauração testada e monitoramento
