# Fase 2 — implementação e evidências

Branch: `feature/cyberfluent-phase-2`, iniciada no mesmo commit da main: `78571c5`. Nenhum commit ou push nesta execução.

## Linha de base — antes de editar

Em 11/09/2026: 16 testes Python, 4 testes Playwright, ESLint, TypeScript, Prettier, Ruff e build passaram. O Playwright executou Next.js e FastAPI. A captura de demo regenerada pelo teste foi restaurada byte a byte a partir do commit inicial. Prompts v1/v2, phishing.json e evidências históricas da Fase 1 foram preservados.

## Implementação

- Três missões: Daily Standup (Build the Message + Choose Your Response), Bug Report (Bug Report Builder + Choose Your Response), Phishing (Spot the Risk + Choose Your Response).
- Perfil/onboarding, cadastro e login Supabase, sessão do SDK, logout, validação criptográfica JWT no FastAPI.
- Migração com nove tabelas, RLS, permissões e funções transacionais restritas ao backend.
- XP por contexto, estrutura linguística e comunicação. Idempotência evita duplicar recompensas; uma produção posterior melhor pode completar XP de comunicação ainda não obtido.
- Progresso e revisão persistentes no Supabase quando configurado. Revisão curada de um conceito por missão; outros erros ficam como categorias para histórico mínimo.
- Companion linguístico original com URL oficial exata em allowlist, sem certificação nem afiliação.
- Demo explicitamente separado, sem chamadas de IA nem XP real; armazenamento local em memória por sessão isolada e token no sessionStorage. Expira após duas horas ou reinício do backend.

## Testes locais

- Python: 42 testes passaram na rodada final; Ruff passou. Duas advertências de depreciação vêm de Starlette/TestClient.
- PostgreSQL embarcado PGlite: 7 testes passaram. Executam a migração real, RLS, negação de escrita pelo cliente, isolamento A/B, RPC de XP idempotente e progressão 3→7→14→30 / erro→1 / baixa confiança→2.
- PGlite substitui apenas o ambiente Supabase Auth nos testes SQL por roles e auth.uid compatíveis. Não prova configuração, chaves, gateway ou Auth do projeto hospedado.
- Playwright: 7 testes passaram com FastAPI real em modo demo. Incluem três missões, recuperação, progresso da sessão após reload, fila, Companion, erro/JSON inválido, teclado, mobile e Axe (WCAG 2 A/AA). Não é auditoria WCAG integral.
- Build final com TypeScript, ESLint e Prettier passaram após ajustes de navegação.

## Verificação real do provedor

Três chamadas reais à OpenAI passaram com `gpt-5.6-luna` e `tutor-v3`. As três saídas foram validadas e citaram um trecho da entrada sintética. Evidência sem credenciais ou textos: [provider-check.json](evidence/phase-2/provider-check.json). Essa prova é direta do provedor: não comprova integração Supabase/JWT/frontend.

A varredura dos arquivos versionáveis não encontrou correspondências às chaves locais nem padrões de chaves privadas. `backend/.env` e `tests/.env.live` estão ignorados pelo Git.

## Validação integrada — 12/09/2026 (America/Sao_Paulo)

Supabase configurado e migração aplicada pelo usuário. Os três arquivos locais de ambiente estão ignorados. Build com a configuração real passou.

- Conta B autenticou realmente no Supabase; onboarding salvo pelo frontend/FastAPI.
- Três missões completas no navegador com resposta livre → FastAPI → OpenAI, HTTP 200 e `ai_mode=live`, saída estruturada validada. Demo desabilitado.
- Progresso persistiu após reload; 60 XP de contexto + 60 de estrutura linguística + 60 de comunicação = 180 XP. As três revisões persistiram e a tela de revisão abriu.
- Nove verificações adicionais de XP passaram: repetir a recuperação nas três tentativas concluídas concedeu zero XP e preservou o progresso; PostgREST negou escrita de XP e execução de RPC de recompensa pelo cliente autenticado.
- 32 verificações complementares passaram usando a aplicação FastAPI ASGI real, sem overrides, conectada ao Supabase hospedado. Incluem JWT válido aceito, token ausente/assinatura adulterada rejeitados, revisão 3→7→14→30, erro→1, baixa confiança→2, datas/versões persistidas, bloqueio antes do vencimento e ausência de XP por revisão.
- O teste temporal criou uma revisão temporária em uma missão ainda sem revisão de B e antecipou apenas seu vencimento entre respostas. Revisão e domínio do conceito temporários foram removidos ao final. Não representa espera real de 30 dias. O script recusa execução se B não tiver um espaço livre, preservando revisões existentes.

Evidências sem credenciais ou textos de alunos: [navegador live](evidence/phase-2/live-check.json), [persistência e revisão](evidence/phase-2/persistence-check.json), [XP](evidence/phase-2/xp-check.json).

## Validação integrada concluída — 12/09/2026, 22:17 (America/Sao_Paulo)

Após correção local das credenciais de A, `npm run test:live` passou: **1 teste em 1,1 minuto**, com as três missões reais autenticadas por A, HTTP 200, `ai_mode=live`, progresso após reload e isolamento Supabase. A evidência está marcada `complete=true`.

A checagem complementar `backend/scripts/check_isolation_live.py` passou em **35 verificações**:

- Login real de A e B, identidades distintas e JWT de ambas aceito no FastAPI.
- Isolamento nos dois sentidos em profiles, attempts, user_progress, review_queue, concept_mastery e language_error_events. O teste confirmou dados existentes visíveis ao proprietário antes de exigir resultado vazio para a outra conta.
- PATCH de perfil alheio não alcançou nenhuma linha. Foi enviado o valor já existente para evitar alterar dados mesmo se a política estivesse incorreta.
- Uso de tentativa e revisão alheias no FastAPI retornou 404 nos dois sentidos.

Evidência adicional: [isolation-check.json](evidence/phase-2/isolation-check.json). As evidências de XP e revisão da rodada anterior continuam válidas; não foram substituídas por mocks nem repetidas alterando revisões existentes. ESLint, TypeScript, Ruff e `git diff --check` passaram nesta rodada.

## Limites e revisão da usuária

A validação integrada solicitada de JWT, persistência, isolamento, XP, progresso e revisão foi concluída. A revisão/aceite da Fase 2 pela usuária permanece aberta.

- O login automatizado usa a API Auth real no navegador; cadastro, confirmação e login/logout pelos formulários continuam como revisão manual complementar. As contas foram criadas e confirmadas pela usuária.
- JWT expirado e issuer de outro projeto têm cobertura criptográfica local. A prova remota cobre JWT real válido, ausente e assinatura adulterada.
- O teste de revisão usa vencimentos controlados, não espera cronológica de 30 dias.
- Revisão humana do conteúdo e auditoria integral de acessibilidade não são substituídas por estes testes.

Nenhum staging, commit, push ou avanço à Fase 3.
