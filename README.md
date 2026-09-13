# Cyber.fluent

**Play. Learn. Speak Tech.** Inglês profissional para adultos que estudam ou trabalham com tecnologia, com apoio em português e prática em inglês.

## Escopo atual

Fase 1 validada com IA live em 10/09/2026. Seus prompts e evidências históricas permanecem preservados.

Fase 2 implementa três missões jogáveis (**Daily Standup**, **Bug Report**, **Phishing Incident Communication**), onboarding, integração Supabase Auth/JWT/RLS, XP por competência, progresso/revisão e Companion oficial. **Validação integrada com Supabase e duas contas concluída**, incluindo três missões IA live e isolamento A/B nos dois sentidos. Revisão/aceite da usuária pendente; resultados e limites em [PHASE_2_VALIDATION](docs/PHASE_2_VALIDATION.md).

Veja [validação da Fase 2](docs/PHASE_2_VALIDATION.md) e [configuração Supabase](docs/SUPABASE_SETUP.md). Não houve commit, push ou início da Fase 3 nesta implementação.

## Executar localmente

Pré-requisitos: Node.js 22+ (exigido pelo SDK Supabase instalado) e Python 3.11+. Ambiente verificado: Python 3.14.7.

```sh
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.lock.txt
cp backend/.env.example backend/.env
```

Edite `backend/.env` **somente no seu computador**:

- `OPENAI_API_KEY`: sua credencial OpenAI; nunca use prefixo `NEXT_PUBLIC_`.
- `OPENAI_MODEL`: identificador de modelo habilitado na sua conta e compatível com Responses/Structured Outputs.
- `AI_PROVIDER=openai`: provider principal.
- `AI_DEMO_FALLBACK_ENABLED=false`: padrão. Para permitir o plano B, use `true`; a interface só o oferece após uma falha e exige escolha explícita.
- `FRONTEND_ORIGIN=http://localhost:3000`: origem permitida pelo CORS.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`: configuração do projeto no backend. A chave secreta nunca recebe prefixo público.
- `SUPABASE_JWT_AUDIENCE=authenticated`: audiência aceita. Use JWT assimétrico ES256/RS256.

Terminal 1:

```sh
backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
npm run dev
```

Configure também URL e chave publicável no frontend conforme [SUPABASE_SETUP](docs/SUPABASE_SETUP.md), aplique a migração revisada e reinicie os serviços.

Abra http://localhost:3000. A URL pública do backend é `http://localhost:8000` por padrão; opcionalmente crie `.env.local` com `NEXT_PUBLIC_API_URL`. Essa variável contém apenas URL, nunca chave. Reinicie o servidor após mudar a configuração.

Cadastre-se, confirme o e-mail, entre e conclua o onboarding. Escolha uma das três missões na trilha, realize os dois minigames, escreva livremente e envie à tutora. A recuperação ativa registra competências e agenda revisão. Phishing oferece continuidade opcional no Companion.

Sem Supabase configurado, o login real informa indisponibilidade. Para explorar localmente sem conta, habilite `AI_DEMO_FALLBACK_ENABLED=true` no backend e escolha explicitamente o plano B em `/login`. A sessão demo mantém progresso local por até duas horas/enquanto o backend estiver ativo; não avalia sua escrita por IA e não concede XP real.

## Verificar

```sh
npm run lint
npm run typecheck
npm run build
npm run test:db
cd backend
.venv/bin/ruff check app tests scripts
.venv/bin/ruff format --check app tests scripts
.venv/bin/pytest -q
```

Se o ambiente restringir subprocessos do Turbopack, use `npm run build -- --webpack` (build de produção também verificado). Fontes do sistema evitam download durante o build.

Testes do navegador (na raiz, após build):

```sh
npx playwright install chromium
npm test
```

O Playwright inicia frontend na porta 3100 e FastAPI na porta 8000, com credencial vazia e demo habilitado **apenas nos processos de teste**. Pare outro backend na porta 8000 antes. O teste verifica transporte real browser→FastAPI; o contrato com o SDK é testado separadamente com substituição controlada, sem alegar prova live. Capturas novas são geradas em `docs/evidence/phase-2/`; as evidências da Fase 1 não são sobrescritas.

`npm run test:db` executa a migração e RLS num PostgreSQL embarcado (PGlite), sem substituir Supabase Auth. `npm run test:live` é opt-in, exige Supabase configurado e duas contas em `tests/.env.live`; realiza três chamadas reais de IA e verifica isolamento hospedado.

A checagem opcional `backend/.venv/bin/python backend/scripts/check_provider_live.py` valida somente o provider OpenAI, com três chamadas pagas e textos fictícios. Não comprova autenticação ou fluxo completo da Fase 2.

## Arquitetura e privacidade

Next.js/React/TypeScript/Tailwind → HTTP JSON → FastAPI/Pydantic → SDK oficial OpenAI Responses API. Zod valida o contrato recebido no navegador. Prompt versionado e rubrica ficam no backend. O modelo não define `ai_mode`, `request_id` ou `prompt_version`.

Na Fase 2, perfil, categorias de erros, tentativas e progresso são persistidos no Supabase. A escrita livre e o feedback completo não são armazenados pelo aplicativo; o provedor recebe o texto no envio. Use somente cenários fictícios. `store=False` não garante retenção zero pelo provedor.

JWT é validado no FastAPI; RLS limita leituras por usuário. O frontend não grava avaliações, XP ou fila. O backend executa funções transacionais com chave secreta e identidade validada. O modo demo usa armazenamento local em memória isolado, separado do Supabase. Detalhes em [arquitetura](docs/ARCHITECTURE.md) e [segurança](docs/SECURITY.md).

## Metodologia e conteúdo

Prática contextual, exemplo resolvido, geração de mensagem própria, contraste gramatical, feedback em camadas e recuperação ativa. A confiança orienta o intervalo de revisão curada por missão: 1, 2, 3, 7, 14 ou 30 dias. O histórico guarda categorias de erros; isso é adaptação por regras, não machine learning. Revisão humana de inglês e cenário ainda pendente.

Projeto acadêmico independente. O Cyber.fluent ensina inglês aplicado à tecnologia e pode utilizar objetivos públicos apenas como referência contextual. Não é afiliado, aprovado ou endossado pela Palo Alto Networks e não contém questões oficiais de certificação. Não emite certificação técnica nem promete aprovação.

## Documentação e próximas fases

- [Integração e prova de IA](docs/AI_INTEGRATION.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Identidade e referência visual](docs/BRAND_AND_UI.md)
- [Segurança](docs/SECURITY.md)
- [Checklist FIAP](docs/FIAP_ACTIVITY_4_CHECKLIST.md)
- [Evolução conceitual](docs/EVOLUTION_FROM_ACTIVITY_3.md)
- [Resultados de validação](docs/PHASE_1_VALIDATION.md)

A Fase 2 depende agora da prova real Supabase e da sua revisão antes da Fase 3. Equipe, RMs, cidades, participação no NEXT e links finais de GitHub/YouTube ainda devem ser fornecidos pela equipe; nenhum foi inventado. Não há deploy ou publicação realizados nesta etapa.
