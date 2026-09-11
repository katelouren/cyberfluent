# Cyber.fluent

**Play. Learn. Speak Tech.** Inglês profissional para adultos que estudam ou trabalham com tecnologia, com apoio em português e prática em inglês.

## Escopo entregue nesta etapa

Fase 1: home própria, missão **Phishing Incident Communication**, Spot the Risk, escrita livre, FastAPI e provider OpenAI com Structured Outputs, feedback pedagógico em camadas e recuperação ativa. A integração live foi comprovada em 10/09/2026 com duas respostas reais e recuperação concluída; a evidência está em [AI_INTEGRATION](docs/AI_INTEGRATION.md). Para executá-la no seu ambiente, configure credencial e modelo locais. Demo não é evidência de IA.

As outras duas missões, autenticação Supabase, onboarding, RLS, XP e progresso persistente pertencem à Fase 2 e não estão implementados. Não publicar esta API sem autenticação: a versão atual é para execução local em loopback.

## Executar localmente

Pré-requisitos: Node.js 20.9+ e Python 3.11+. Ambiente verificado: Python 3.14.7.

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
- Variáveis Supabase estão reservadas para a Fase 2; não são utilizadas agora.

Terminal 1:

```sh
backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
npm run dev
```

Abra http://localhost:3000. A URL pública do backend é `http://localhost:8000` por padrão; opcionalmente crie `.env.local` com `NEXT_PUBLIC_API_URL`. Essa variável contém apenas URL, nunca chave. Reinicie o servidor após mudar a configuração.

Inicie a missão, selecione as três pistas suspeitas, escreva livremente e envie à tutora. Uma resposta real exibe **Feedback personalizado por IA · live**, versão do prompt e ID de requisição. Sem chave/modelo, a aplicação mostra indisponibilidade; não substitui silenciosamente por demo. No demo, a tutora apresenta um exemplo curado sobre `need to`, sem avaliar a produção enviada.

## Verificar

```sh
npm run lint
npm run typecheck
npm run build
cd backend
.venv/bin/ruff check app tests
.venv/bin/ruff format --check app tests
.venv/bin/pytest -q
```

Se o ambiente restringir subprocessos do Turbopack, use `npm run build -- --webpack` (build de produção também verificado). Fontes do sistema evitam download durante o build.

Testes do navegador (na raiz, após build):

```sh
npx playwright install chromium
npm test
```

O Playwright inicia frontend na porta 3100 e FastAPI na porta 8000, com credencial vazia e demo habilitado **apenas nos processos de teste**. Pare outro backend na porta 8000 antes. O teste verifica transporte real browser→FastAPI; o contrato com o SDK é testado separadamente com substituição controlada, sem alegar prova live. Capturas são geradas em `docs/evidence/`.

## Arquitetura e privacidade

Next.js/React/TypeScript/Tailwind → HTTP JSON → FastAPI/Pydantic → SDK oficial OpenAI Responses API. Zod valida o contrato recebido no navegador. Prompt versionado e rubrica ficam no backend. O modelo não define `ai_mode`, `request_id` ou `prompt_version`.

Sem banco nesta fase. A produção fica em memória do navegador durante a navegação e é enviada ao backend/provedor no envio. Não há logs de respostas, senhas ou prompts na aplicação. `store=False` desativa armazenamento da resposta pela API, mas não equivale a uma garantia de retenção zero pelo provedor. Recarregar a página elimina o estado local da missão. Use apenas o cenário fictício.

Há validação de tamanho, rejeição de campos extras, CORS restrito, timeout, limite global local de 20 POSTs/minuto/processo, renderização como texto e defesa básica contra prompt injection. Essa defesa não é garantia de bloqueio universal. Autenticação e isolamento persistente aguardam a próxima fase.

## Metodologia e conteúdo

Prática contextual, exemplo resolvido, geração de mensagem própria, contraste gramatical, feedback em camadas e recuperação ativa. A confiança é uma reflexão da sessão; não é persistida. Revisões são sugestões, não uma fila implementada. Revisão humana de inglês e cenário ainda pendente.

Projeto acadêmico independente. O Cyber.fluent ensina inglês aplicado à tecnologia e pode utilizar objetivos públicos apenas como referência contextual. Não é afiliado, aprovado ou endossado pela Palo Alto Networks e não contém questões oficiais de certificação. Não emite certificação técnica nem promete aprovação.

## Documentação e próximas fases

- [Integração e prova de IA](docs/AI_INTEGRATION.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Identidade e referência visual](docs/BRAND_AND_UI.md)
- [Segurança](docs/SECURITY.md)
- [Checklist FIAP](docs/FIAP_ACTIVITY_4_CHECKLIST.md)
- [Evolução conceitual](docs/EVOLUTION_FROM_ACTIVITY_3.md)
- [Resultados de validação](docs/PHASE_1_VALIDATION.md)

A Fase 2 depende da revisão da Fase 1. Equipe, RMs, cidades, participação no NEXT e links finais de GitHub/YouTube ainda devem ser fornecidos pela equipe; nenhum foi inventado. Não há deploy ou publicação realizados nesta etapa.
