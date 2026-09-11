# Arquitetura da Fase 1

- Server Components: layout, home e entrada da missão.
- Client Components: prévia Incident Room, MissionPlayer, FeedbackPanel.
- `brand.ts`: nome técnico e visual, tagline e aviso institucional.
- `messages/pt-BR.ts`: idiomas padrão e mensagens de integração. Parte do conteúdo curado permanece nos componentes; extração completa para outros idiomas ainda pendente.
- Zod: validação defensiva da resposta HTTP antes da renderização.
- FastAPI: health, missão curada, feedback e verificação de recuperação ativa.
- Pydantic: entrada estrita, tipos enumerados, limites e saída estruturada.
- TutorProvider: contrato; OpenAITutorProvider principal; DemoTutorProvider fallback explícito.
- Conteúdo: JSON original; prompt versionado extraído da especificação mestre.

Sem banco, conta, XP, progresso durável ou fila de revisão. A pergunta de recuperação é curada e validada no servidor; não há sessão autenticada nesta fase. Não existe reivindicação de isolamento por usuário.

O endpoint de missão expõe conteúdo pedagógico curado, nunca chave, prompt de sistema ou gabarito de recuperação. O frontend tem a apresentação do briefing e minigame localmente; o gabarito técnico usado pela IA vem sempre do JSON do backend.

A API deve ser iniciada com bind em 127.0.0.1. CORS não é autenticação. Publicação exige a Fase 2 e medidas operacionais adicionais.
