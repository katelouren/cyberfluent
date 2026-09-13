# Fase 3 — hardening e validação técnica

Escopo autorizado: segurança e validação final na branch `feature/cyberfluent-phase-3`. Sem slides, pitch, PDF, roteiro de apresentação, staging, commit, push ou merge. Fases 1/2 aprovadas e mergeadas conforme informado pela usuária; seus documentos, prompts e evidências foram preservados.

Este documento é o complemento técnico atual. As referências a pendências da Fase 2 em documentos históricos não foram reescritas, em respeito à preservação solicitada.

## Linha de base antes de editar

Árvore de trabalho limpa. A especificação mestre e AGENTS.md foram lidos. Passaram 42 testes Python, 7 SQL/PGlite, 7 de navegador (Next.js + FastAPI), ESLint, TypeScript, Prettier, Ruff e build. As capturas da linha de base foram direcionadas a uma pasta temporária.

## Alterações e justificativas

- `backend/app/security.py`: middleware ASGI com origem exata, limites de corpo inclusive em chunks, deadline de envio, Content-Type JSON, recusa de compressão, respostas redigidas e headers de segurança. CORS continua sem cookies/credentials e com apenas GET/POST e headers explicitamente permitidos.
- Rate limiting passou de cota global a janela por cliente. Até 60 POSTs/min e 120 demais requisições/min. Até 10.000 buckets por limiter, expiração de inativos e recusa de novas chaves na saturação, sem apagar quotas ativas para liberar acesso. HTTP 429 inclui Retry-After.
- IA limitada a 6 chamadas/min por identidade validada, uma simultânea por usuário e quatro por processo, com liberação da reserva mesmo em falha. Timeout adicional de 38 s além do SDK de 35 s; nenhuma repetição automática.
- `auth.py`: cache/lock de JWKS, limitação de refresh por kid desconhecido e cache curto de indisponibilidade. Limites de token/kid e recusa de duas formas de autenticação simultâneas. Validação criptográfica e proprietário continuam obrigatórios.
- `schemas.py`: tamanho de strings/coleções, limites de estruturas de minigames, rejeição de controles e confiança inteira estrita. Saída do modelo também tem limites e continua validada com Pydantic.
- `providers.py` + novo `tutor-v4.txt`: perfil e histórico deixam a mensagem developer e passam a dados na mensagem user. Apenas prompt versionado e rubrica curada têm autoridade instrucional. Sem ferramentas, sem segredos no contexto e sem mudança de modelo. Filtros normalizam Unicode antes de detectar padrões de instruções adversárias.
- `next.config.ts`: bloqueio de configurações NEXT_PUBLIC fora da allowlist ou com credenciais privadas/service_role; headers contra framing, sniffing e objetos incorporados, Referrer-Policy e Permissions-Policy. CSP deliberadamente parcial para preservar o runtime Next; não alegar bloqueio completo de XSS.
- `src/lib/api.ts`: falhas de transporte e JSON inválido retornam mensagens compreensíveis sem detalhes internos; escrita preservada pelo fluxo existente.
- Testes ampliados; screenshots de rotina passaram a `test-results` e prova live a `docs/evidence/phase-3`, evitando sobrescrever evidências históricas.
- Não houve necessidade de modificar SQL, políticas RLS ou permissões Supabase nesta rodada.

## Resultados finais

| Verificação | Resultado |
|---|---|
| Python/Pytest | 92 passaram |
| Ruff lint | Passou |
| Ruff format | 17 arquivos Python formatados |
| SQL/PGlite | 7 passaram; migração real, RLS, permissões, idempotência e revisão |
| Navegador Chromium | 9 passaram em 26,7 s; três missões, acessibilidade crítica, erros, injection e HTML inerte |
| Navegador live | 1 passou em 1,5 minuto; três missões `tutor-v4`/`ai_mode=live`, persistência, RLS A/B nos dois sentidos e injection autenticada bloqueada |
| ESLint | Passou |
| TypeScript | Passou |
| Prettier | Passou |
| Build Next.js de produção | Passou |
| git diff --check | Passou |
| npm audit | 0 vulnerabilidades reportadas |
| OSV, lockfile Python | 32 versões consultadas, nenhum aviso retornado |

Prova live: [live-check.json](evidence/phase-3/live-check.json). Resultado consolidado: [technical-check.json](evidence/phase-3/technical-check.json). A varredura final não encontrou correspondências a segredos nos arquivos versionáveis nem nos 21 arquivos de bundle público. Os três arquivos de credenciais continuam ignorados e não versionados. Hashes de 31 documentos, evidências e prompts anteriores foram conferidos: nenhuma alteração.

## Cobertura de segurança

- CORS: configuração wildcard/path/credentials/HTTP externo recusada; preflight de método/header indevido negado; requisição de origem adversária bloqueada antes da autenticação.
- Abuso: clientes separados, header X-Forwarded-For não usado pelo limiter, quotas com expiração, capacidade limitada, concorrência e liberação após falha.
- Entrada: corpo acima de 12 KB, chunks, envio lento, conteúdo não JSON, compressão, valores aninhados, campos extras e controles inválidos.
- Injection: padrões diretos em português/inglês, caracteres invisíveis e compatibilidade Unicode, falsa mensagem developer, pedido de XP e instruções codificadas explícitas. Casos profissionais legítimos preservados.
- Fronteiras da IA: perfil/histórico maliciosos não entram em system/developer; não há ferramentas; recusa/incompleto/JSON inválido/timeout não viram demo nem persistem feedback.
- Autenticação: claims e assinatura JWT, tokens ausentes/adulterados, JWKS indisponível, refresh limitado e autenticação ambígua.
- Navegador: conteúdo HTML sintético no feedback permanece texto, nenhum elemento img ou evento é executado; escrita preservada após injection; mensagem segura na falha de rede.
- RLS/XP: testes SQL existentes continuam passando; isolamento hospedado é revalidado pela suíte live, separado da prova local.

## Falhas encontradas e resolução

A primeira execução dos novos testes de navegador falhou por seletor: usava o nome do botão live no fluxo demo. Após corrigir, uma segunda execução encontrou a região alert adicional do Next.js. O teste passou a selecionar a mensagem relevante; nenhuma alteração de comportamento do produto foi feita para acomodar essas falhas. A execução final com nove testes passou.

A varredura inicial sinalizou uma URL com usuário/senha fictícios no teste de rejeição de CORS. Não era credencial real; a construção do fixture foi ajustada, preservando a condição testada. A varredura seguinte passou.

Duas advertências de depreciação de Starlette/TestClient permanecem (httpx e alias AnyIO); não impedem os testes. Nenhuma atualização de dependências foi aplicada apenas para suprimir avisos.

## Limitações e operação

O [threat model](THREAT_MODEL.md) descreve ativos, fronteiras, ameaças e limites. Rate limiting/cache são locais por processo e não oferecem defesa distribuída ou volumétrica. Configure gateway, TLS, limites de conexão e gastos, proxies confiáveis, alertas e retenção antes de exposição pública. O deployment não foi realizado.

CSP não define script-src; a sessão do SDK permanece no storage do navegador. Logout não revoga imediatamente um access token já emitido. A configuração de logs de proxy/hosting/APM não foi auditada. Para execução direta, use `--no-proxy-headers --no-access-log` no Uvicorn; só confie em proxy que remova headers forjados.

Filtros de injection podem ser evadidos ou rejeitar textos legítimos. Não há garantia de correção pedagógica universal nem pentest/auditoria WCAG integral. Verificações de vulnerabilidades dependem das bases consultadas e não provam ausência de falhas desconhecidas. A revisão espaçada usa regras já validadas; a prova temporal da Fase 2 foi controlada, não uma espera de 30 dias.

Há procedimentos administrativos de exclusão no Supabase, mas não foi criada interface de exclusão de conta. Um erro de persistência após a geração pode exigir novo envio e custo; o cliente pode encerrar a espera antes do backend terminar.

## Reproduzir

Na raiz, com credenciais somente nos arquivos ignorados:

```sh
npm run lint
npm run typecheck
npm run format:check
npm run test:db
backend/.venv/bin/python -m pytest backend/tests -q
backend/.venv/bin/ruff check backend
backend/.venv/bin/ruff format --check backend/app backend/tests backend/scripts
npm run build
npm test
npm run test:live
backend/.venv/bin/python backend/scripts/check_secrets.py
git diff --check
```

`test:live` usa duas contas próprias confirmadas, Supabase configurado e três chamadas pagas à OpenAI. Exige portas 3100/8000 livres; não registra senhas, tokens, texto pessoal, traces ou screenshots live. Não executar os scripts históricos de evidência da Fase 2 para atualizar a Fase 3, pois seus caminhos antigos permanecem preservados.


## Arquivos desta entrega técnica

Modificados: `backend/app/auth.py`, `backend/app/main.py`, `backend/app/providers.py`, `backend/app/schemas.py`, `next.config.ts`, `src/lib/api.ts`, `tests/live/openai.spec.ts`, `tests/mission.spec.ts`.

Criados: `backend/app/security.py`, `backend/app/prompts/tutor-v4.txt`, `backend/scripts/check_secrets.py`, `backend/tests/test_security.py`, `tests/security.spec.ts`, este documento, `docs/THREAT_MODEL.md`, `docs/evidence/phase-3/live-check.json` e `docs/evidence/phase-3/technical-check.json`.

Total: 17 arquivos. Nenhum arquivo de ambiente real, lockfile ou migração SQL foi alterado. A documentação das Fases 1/2 foi mantida intacta.
