# Segurança implementada e limites reais

## Fase 1 preservada

Credencial OpenAI exclusivamente no Python; arquivos .env ignorados; saída estruturada; escrita até 2000 caracteres; corpo até 12 KB; campos extras rejeitados; prompt/rubrica separados; defesa lexical básica contra prompt injection; nenhuma ferramenta de execução para o modelo; domínios fictícios .example não clicáveis. Logs sem escrita ou credenciais; erros não reproduzem entradas nem detalhes do provedor. `store=False` não equivale a garantia de retenção zero do provedor.

## Fase 2

- JWT verificado criptograficamente com PyJWT e JWKS do projeto configurado, algoritmos ES256/RS256, issuer, audience, expiração, iat, role e sub. Cache JWKS de cinco minutos, com atualização para kid desconhecido; não aceita URLs fornecidas pelo token.
- Usuário derivado do JWT. Leituras com JWT + RLS + filtro de proprietário. Perfil usa políticas próprias de inserção/atualização/exclusão.
- Avaliações/XP/revisões não podem ser gravadas pelo navegador. As funções de escrita são restritas ao backend/service_role, com proprietário sempre obtido da identidade validada.
- Finalização atômica e idempotente; revisões usam versão e vencimento. Dados acadêmicos não são protegidos por segredo do gabarito apenas, mas pela verificação da atividade no servidor.
- CORS de uma origem configurada, com headers Authorization e X-Demo-Session permitidos. Limite global local de 60 POSTs/minuto/processo, ajustado para os novos passos de uma missão. CORS não substitui autenticação.
- Link oficial em allowlist de URL exata, sem redirect arbitrário.
- Demo isolado em memória, tempo limitado, sem acesso ao provider live nem ao Supabase; sem XP real.

## Dados e limitações

O aplicativo persiste perfil e resumos de avaliações (categorias e estados), não a escrita livre ou o feedback completo. Perfil não inclui senha; senhas vão diretamente ao Supabase Auth. A sessão do SDK fica no armazenamento do navegador; não usamos HTML arbitrário. Logout remove a sessão do cliente; access tokens já emitidos podem continuar válidos até expirar, conforme a política JWT.

RLS/XP foram testados em PostgreSQL embarcado com roles equivalentes; isso não prova configuração de um projeto Supabase hospedado. Essa prova está pendente em PHASE_2_VALIDATION. Chave secreta de servidor tem privilégio elevado e deve ficar somente no backend. O limite de requisições atual não é distribuído. A defesa de prompt injection pode ter evasões/falsos positivos. O modelo pode explicar algo incorretamente; revisão humana segue necessária.

Não há alegação de auditoria completa, certificação ou conclusão da Fase 3. O checklist final de segurança/apresentação pertence à fase seguinte.
