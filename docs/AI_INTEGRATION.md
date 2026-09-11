# Integração real de IA — Fase 1

## Implementação

`src/lib/api.ts` envia a escrita livre ao FastAPI em `/api/v1/tutor/feedback`. `backend/app/providers.py` usa `AsyncOpenAI.responses.parse`, `text_format=Feedback`, timeout de 35 s, sem retries automáticos e `store=False`. A classe Pydantic gera o JSON Schema usado pelo SDK e valida o resultado. Resposta incompleta, recusa e erro de validação resultam em HTTP 503 com mensagem segura.

Referência oficial consultada em 10/09/2026: [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs). O SDK aceita schemas Pydantic e expõe `output_parsed`; recusas e respostas incompletas precisam de tratamento próprio.

O prompt `tutor-v2.txt`, rubrica curada e dados do aluno são separados em mensagens system, developer e user. Histórico é explicitamente vazio nesta fase. CEFR e idiomas são validados; missão e rubrica são escolhidas pelo servidor. O modelo não decide metadados de proveniência. A pergunta final é curada e seu gabarito permanece no servidor.

## Prova obrigatória antes do aceite e da gravação

1. Configure a chave e um modelo compatível em `backend/.env`, nunca no chat ou GitHub.
2. Inicie FastAPI e Next.js conforme README.
3. Abra a missão no navegador, conclua Spot the Risk.
4. Envie `You need change your password and report the email.`.
5. Confirme HTTP 200 no endpoint e `ai_mode=live`, explicação do infinitivo e citação de trecho da resposta. Não fotografe configuração ou headers sensíveis.
6. Envie outra produção: `Hi Alex, please do not use that link again. Change your password on the official website and report the message to our security team.`.
7. Confira feedback coerentemente diferente, adequação profissional/técnica separada e preservação da intenção.
8. Faça recuperação ativa. Registre data, modelo, IDs e resultado, sem resposta integral sensível ou chave.
9. Verifique no navegador que nenhum segredo aparece nas requisições ou assets.
10. Grave uma demonstração autêntica antes da apresentação. Demo é só fallback.

## Teste live automatizado, opt-in

Com o build pronto e portas 3100/8000 livres, execute `npm run test:live`. Ele inicia os serviços reais, usa somente `backend/.env` no Python e faz duas chamadas pagas ao provedor com textos fictícios. Não há mock nesse teste. Exige `ai_mode=live` nas duas respostas, correções diferentes e recuperação concluída. Gera `docs/evidence/live-check.json` e capturas, sem credencial. A revisão semântica das explicações continua necessária. `npm test` exclui esse teste e não consome a API.

## Registro de execução

**Prova live concluída em 10/09/2026 às 23:09 UTC (20:09 de Brasília).** Modelo configurado: `gpt-5.6-luna`. Comando: `npm run test:live`. Resultado final: **1 teste passou em 44,0 s**, com duas chamadas reais, sem mocks e com fallback desativado.

| Cenário fictício | HTTP | Modo | Prompt | ID da requisição do aplicativo |
| --- | --- | --- | --- | --- |
| Orientação com ausência de infinitivo | 200 | live | tutor-v2 | 2550c3e4-ecd1-4cca-b169-1f0e2d2caee7 |
| Orientação com imperativos corretos | 200 | live | tutor-v2 | 9fcf2678-4d8f-467b-a717-3c6c1a5807fe |

O teste navegou pelo briefing e Spot the Risk, digitou produções livres, enviou-as do frontend ao FastAPI e recebeu respostas reais do provider OpenAI. A saída passou por Pydantic no backend e Zod no navegador. A interface exibiu `Feedback personalizado por IA · live`; a recuperação ativa foi concluída com verificação no servidor.

Revisão das evidências: a primeira resposta citou o trecho real com `need change`, corrigiu para `need to change` e explicou o infinitivo compartilhado. A segunda reconheceu os imperativos como válidos, sem erros linguísticos, e sugeriu explicitar não responder ao remetente e acessar o site oficial independentemente. As duas separaram adequação profissional e conteúdo técnico. As correções e explicações foram diferentes e relacionadas à produção recebida.

A primeira execução live passou no transporte, mas revelou cobrança indevida de repetir pistas do minigame na escrita. O prompt foi versionado para `tutor-v2`, delimitando a rubrica, aceitando imperativos e solicitando texto simples. A prova final acima foi repetida após esse ajuste. Foram quatro chamadas reais no total nesta validação; as evidências publicadas correspondem às duas finais.

Evidências: [registro JSON de textos exclusivamente fictícios](evidence/live-check.json), [primeira resposta](evidence/live-1.png), [segunda resposta](evidence/live-2.png). Não foram salvos chave, headers de autenticação, arquivo de ambiente ou trace de rede. `backend/.env` permanece ignorado pelo Git. A comparação exata da credencial com arquivos versionáveis e assets públicos encontrou zero ocorrências, sem imprimir seu valor.

Esta prova confirma o funcionamento observado, não garante precisão universal do modelo. A revisão da Fase 1 pela usuária e a revisão humana especializada do conteúdo continuam pendentes; a Fase 2 não foi iniciada.

## Demo e limites

`AI_DEMO_FALLBACK_ENABLED=true` permite o botão de demo apenas após falha live. A ação exige clique consciente. O exemplo é fixo, identificado como demo e não avalia a escrita do aluno; adequação profissional e técnica usam `not_applicable`. Em produção autenticada futura, a autorização de uso/custo e limites por usuário precisarão ser acrescentados.
