# Validação — 10/09/2026

## Linha de base antes da edição

Scaffold Next.js 16.3.4 / React 19.2.8 / Tailwind 4 / TypeScript. Sem testes iniciais. Nenhum AGENTS.md inicial; Next dev gerou AGENTS.md e CLAUDE.md, lidos antes da implementação. Especificação e referência visual locais preservadas.

- npm run lint: passou.
- npm run dev: primeira tentativa bloqueada ao abrir porta; execução autorizada iniciou e página respondeu HTTP 200.
- npm run build: falhou buscando Google Fonts; repetição sofreu erro de subprocesso/porta do Turbopack no ambiente.

## Implementação

- 16 testes pytest passaram, com dois avisos de depreciação de bibliotecas de teste.
- Ruff check e format executados.
- ESLint e TypeScript passaram.
- Build de produção `npm run build -- --webpack` passou; home e rota de missão prerenderizadas.
- Rodada final `npm test`: 4 testes Playwright passaram em 4,1 s. Cobertura: home/mobile, transporte real ao FastAPI e fallback/recall, seleção incorreta/teclado, JSON inválido.
- Teste live opt-in separado em `npm run test:live`. Uma execução anterior sem credencial falhou corretamente na pré-condição de configuração, antes de qualquer chamada ao provedor.
- `npm run format:check`, `git diff --check`, Ruff check e Ruff format --check passaram.
- Capturas inspecionadas: [home desktop](evidence/home-desktop.png), [home mobile](evidence/home-mobile.png), [missão demo](evidence/mission-demo.png).
- `npm run build` padrão com Turbopack também passou após remoção das fontes externas.
- Live OpenAI: **passou**. Em 10/09/2026 às 23:09 UTC, `npm run test:live` concluiu em 44,0 s com duas respostas HTTP 200, `ai_mode=live`, modelo configurado `gpt-5.6-luna`, prompt `tutor-v2` e recuperação concluída. Evidências e revisão semântica em [AI_INTEGRATION](AI_INTEGRATION.md).
- Após ajustar a delimitação da rubrica no prompt, 16 testes Python, Ruff, ESLint, TypeScript e formatação passaram novamente. Nenhuma alteração de frontend exigiu novo build nesta prova.
- Comparação exata da credencial contra arquivos versionáveis e assets públicos: zero ocorrências; valor nunca exibido.
- Implementação e prova técnica da Fase 1 concluídas; revisão/aceite pela usuária pendente.
- `git check-ignore backend/.env` confirmou proteção do arquivo local. Nenhum valor de credencial foi exibido.

Não foram implementadas funcionalidades da Fase 2. Sem publicação, commit ou deploy nesta execução.
