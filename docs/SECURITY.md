# Segurança e limites reais

Implementado: segredos exclusivamente no processo Python; .env ignorado; exemplos sem valores secretos; payload limitado a 12 KB e escrita a 2000 caracteres; campos extras proibidos; CEFR e missão em allowlist; JSON validado no servidor e navegador; sem HTML arbitrário; CORS com uma origem configurada; timeout; no-store; erros sem conteúdo enviado ou detalhes internos; limite global de 20 POSTs/minuto/processo.

A resposta é entrada não confiável separada da rubrica e prompt. Bloqueio lexical cobre tentativas comuns de alteração/revelação de regras e é testado. Pode haver evasão e falsos positivos; não é proteção completa. A aplicação não dá ferramentas ao modelo, não executa comandos e usa domínios reservados .example em texto sem links clicáveis.

Sem persistência da escrita no aplicativo. A API OpenAI recebe a escrita; store=False não significa retenção zero do provedor. A página orienta não enviar dados pessoais ou segredos.

Riscos restantes: endpoint local sem autenticação; limite global não distribuído; ausência de autorização por usuário, JWT e RLS; modelo pode gerar explicação incorreta apesar do schema. Revisão humana pendente. Não expor esta fase à Internet. Autenticação e dados são escopo autorizado somente da Fase 2 após revisão.
