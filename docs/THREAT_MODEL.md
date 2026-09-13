# Threat model — Fase 3 técnica

Escopo: aplicação acadêmica com três missões, Next.js, FastAPI, Supabase e OpenAI. Este documento complementa os registros históricos das Fases 1/2, sem substituí-los. Não é certificação nem pentest integral.

## Ativos e fronteiras

Ativos: chave OpenAI, chave secreta Supabase, JWT/sessão, perfil e histórico mínimo, progresso/XP/revisões, rubricas, disponibilidade e orçamento do provedor.

| Fronteira | Confiança e controle |
|---|---|
| Navegador → FastAPI | Toda entrada é não confiável. JSON limitado, Pydantic, JWT validado e autorização por proprietário. CORS restringe origens de navegador; não autentica clientes. |
| Navegador → Supabase | Chave publicável não é segredo. JWT e RLS protegem dados; cliente não escreve XP/avaliações/revisões nem executa RPC privilegiada. |
| FastAPI → Supabase | Leituras com JWT + filtro de proprietário; escritas privilegiadas com identidade derivada do JWT. A chave secreta ignora RLS e exige confiança no servidor. |
| FastAPI → OpenAI | Apenas instruções versionadas e catálogo curado em system/developer. Produção, perfil e histórico em mensagem user, como dados não confiáveis. Sem ferramentas nem acesso do modelo ao banco. |
| OpenAI → FastAPI → navegador | Saída não confiável, validada por Pydantic/Zod; exibida como texto React. Metadados, respostas curadas, XP e agendamento pertencem ao servidor. |
| Configuração → bundle público | Allowlist de nomes NEXT_PUBLIC e bloqueio de padrões de chaves privadas/service_role antes do build. Varredura de arquivos e bundle. |

## Ameaças, evidência e risco residual

| Ameaça | Medidas verificadas | Limitação residual |
|---|---|---|
| Roubo/falsificação de identidade | Assinatura ES256/RS256, issuer, audience, exp/iat, role e UUID; rejeita token inválido/ausente e autenticação dupla. | JWT já emitido pode continuar válido até expirar após logout; não há introspecção/revogação imediata. |
| Acesso a dados alheios / IDOR | RLS, filtros de proprietário, IDs derivados da sessão e RPC com owner. Testes SQL e prova A/B hospedada. | Comprometimento da chave secreta ou do backend contorna RLS. Proteger segredo, separar ambientes e rotacionar em incidente. |
| Alteração de XP ou replay | Cliente sem permissão de escrita/RPC; finalização transacional/idempotente, revisão com versão e vencimento. | É prática educacional, não prova antifraude. Jogos e respostas podem ser inferidos; XP não certifica domínio. |
| Prompt injection direta ou via perfil/histórico | Separação das mensagens, prompt v4, normalização NFKD/casefold e remoção de caracteres invisíveis para detecção lexical, schemas e ausência de ferramentas. | Filtros são evasíveis e têm falsos positivos. Não há garantia contra texto codificado, indireto ou multilingue arbitrário, nem de correção pedagógica universal. |
| Abuso de chamadas e orçamento | 60 POST/min e 120 demais requisições/min por cliente; IA 6/min por identidade validada, uma simultânea por usuário e quatro por processo. HTTP 429 com Retry-After. | Memória local; reinício/workers/IPs/contas múltiplas ampliam capacidade. Para produção pública: gateway, cotas distribuídas e teto de gastos no provedor. |
| Amplificação de JWKS | Cache de cinco minutos, refresh por kid no máximo uma vez em 30 s, lock e cache de falha de 5 s. | Chave recém-rotacionada pode levar até 30 s para ser reconhecida. Instâncias não compartilham cache. |
| Corpo grande ou envio lento | Até 12.000 bytes também em chunks, prazo de 5 s, rejeita compressão e conteúdo não JSON; limites de campos/listas. | Não substitui proteção volumétrica, limite de conexões ou timeout no proxy. |
| Vazamento em erros | Respostas genéricas de validação/infraestrutura, sem corpo de entrada nem detalhes upstream; cache-control no-store. | Observabilidade é mínima. Configuração externa de logs, APM e proxy deve excluir credenciais, conteúdo e query strings sensíveis. |
| XSS/clickjacking | Texto React, nenhum HTML arbitrário, testes com HTML malicioso, frame-ancestors none, X-Frame-Options DENY, nosniff e object-src none. | CSP não restringe script-src; não é proteção completa contra XSS. Sessão do SDK em storage continua exposta a scripts que comprometem a origem. |
| CSRF/origem adversária | Bearer explícito em headers, nenhuma credencial cookie na API, origem exata, sem CORS credentials, métodos/headers restritos. | CORS não impede cliente não navegador. Qualquer futura adoção de cookies exigirá revisão CSRF. |
| Indisponibilidade/JSON inválido | Timeout do SDK, deadline adicional de IA, sem retry automático, validação de saída, erro explícito e demo somente por escolha. | Falha de gravação após uma chamada de IA pode exigir repetição e novo custo; envio interrompido pelo navegador pode terminar no servidor. |
| Segredo no repositório/bundle | .env ignorados; guard NEXT_PUBLIC; scanner de valores locais e padrões nos arquivos versionáveis e .next/static. | Varredura não prova ausência de todo segredo desconhecido, imagens, histórico Git remoto ou logs de terceiros. |

## Operação segura no escopo atual

- Usar projeto Supabase dedicado, duas contas próprias e textos fictícios. Não registrar conteúdo integral ou credenciais em evidências.
- Em execução direta local, usar `uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --no-proxy-headers --no-access-log`. Não confiar em X-Forwarded-For arbitrário. Se houver proxy, ele deve remover headers recebidos do cliente e definir os próprios, com lista explícita de proxies confiáveis.
- Configurar FRONTEND_ORIGIN com origem HTTPS exata (sem path/query/wildcard); HTTP é aceito apenas para localhost/loopback. Não há novo deploy nesta etapa.
- HTTPS, HSTS, armazenamento de segredos da hospedagem, limites distribuídos, backups, retenção e alertas dependem do ambiente de publicação. Não alegar que já estão ativos.
- Dados de escrita/feedback completos não são persistidos pelo aplicativo; categorias e perfil são. `store=False` não equivale a retenção zero do provedor.
- Exclusão integral de conta/dados requer procedimento administrativo no Supabase; não foi criada interface de exclusão nesta fase.
- Incidente de credencial: revogar/rotacionar no provedor, revisar acesso e histórico, retirar dados indevidos e repetir scanner/testes. Nunca colar segredo em issue/chat.

## Fontes e interpretação

A separação de dados não confiáveis da mensagem developer segue a [orientação oficial OpenAI](https://developers.openai.com/api/docs/guides/agent-builder-safety). As limitações de filtros e a defesa em camadas são consistentes com o [guia OWASP de prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html). Os controles concretos e seus resultados vêm dos testes deste repositório, não apenas dessas referências. Guias locais do Next.js instalado sobre headers e variáveis de ambiente foram consultados antes da alteração.
