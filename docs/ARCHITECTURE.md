# Arquitetura — Fases 1 e 2

Next.js/React/TypeScript/Tailwind → FastAPI/Pydantic → OpenAI Responses API + Supabase Auth/Postgres.

## Fronteiras de confiança

- Supabase JS no navegador gerencia cadastro, login, renovação da sessão e logout. Usa apenas URL e chave publicável. A sessão é mantida pelo SDK no armazenamento do navegador; os componentes privados são desmontados ao mudar de usuário.
- O frontend envia o access token ao FastAPI. O backend verifica assinatura ES256/RS256 pelo JWKS configurado, expiração, issuer, audience, role authenticated e sub UUID. Tokens sem assinatura, legados HS256 e usuários anônimos são rejeitados.
- SupabaseStore faz leituras com JWT do usuário e filtro por seu ID, além da RLS. O ID não é aceito nos schemas de entrada.
- Escrita de avaliação, XP e fila usa chave secreta exclusivamente no Python. RPCs são executáveis apenas pelo service_role; assumem IDs derivados do JWT validado. O navegador não pode gravar essas tabelas nem chamar as funções privilegiadas.
- Atualização de perfil usa o JWT do usuário e RLS de leitura/escrita própria.
- Sem configuração, operações reais falham de forma explícita. Nunca convertem silenciosamente para demo.

## Missões e tutora

`catalog.py` reúne conteúdo curado de três missões. Metadados e minigames públicos não incluem gabaritos. Cada produção exige tentativa vinculada ao usuário e dois minigames validados no servidor. `tutor-v3` amplia o ensino para três missões, preservando o ensino de need to validado na Fase 1. v1/v2 permanecem versionados.

O provider recebe perfil mínimo, categorias das últimas três avaliações e conceitos em revisão. Saída via Structured Outputs/Pydantic, validada também por Zod antes de renderizar. IA não define metadados, respostas curadas, XP ou intervalos.

A escrita livre e o feedback completo são transmitidos para avaliação, mas não armazenados nas tabelas. Persistem missão, categorias de erros e estados de adequação, suficientes para contexto mínimo, recuperação e progresso.

## Dados e consistência

A migração cria profiles, learning_paths, missions, mission_steps, attempts, language_error_events, concept_mastery, review_queue e user_progress. Currículo é somente leitura para clientes; dados pessoais usam RLS.

O catálogo de execução vem dos JSONs versionados; o seed SQL contém a mesma projeção pública para integridade referencial. Ao alterar currículo, atualizar ambos com migração apropriada.

Finalização da tentativa bloqueia a linha e serializa por usuário/missão. XP máximo por missão: 20 contexto + 20 estrutura + 20 comunicação; a parcela de comunicação exige avaliação apropriada/correta e sem revisão humana pendente. Repetição não duplica XP. Progresso significa prática concluída, não certificação ou domínio garantido.

Revisões só podem ser respondidas quando vencidas. Versão e bloqueio impedem aplicação dupla de uma resposta. Intervalos: erro 1; acerto inseguro 2; acerto seguro 3, 7, 14 e 30 dias. Revisão curada de um conceito principal por missão; fila arbitrária gerada pela IA não é executada.

## Demo

Sessão explícita com identificador opaco, expiração em duas horas e armazenamento em memória isolado. O browser guarda apenas o token de sessão em sessionStorage. Reiniciar o backend elimina dados demo; nenhum dado demo é gravado no Supabase, nem recebe XP real. Fallback de feedback numa conta real também não concede XP nem substitui a avaliação persistida.

## Validação

PGlite executa SQL/RLS localmente; testes Python validam criptografia, contratos e autorização; Playwright percorre os jogos. Integração real hospedada exige configuração e duas contas Supabase; status em PHASE_2_VALIDATION.md.
