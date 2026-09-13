# Configurar Supabase — Fase 2

Use um projeto de desenvolvimento dedicado ao Cyber.fluent. A configuração externa ainda não está validada.

1. Crie um projeto no [dashboard Supabase](https://supabase.com/dashboard). Guarde a senha do banco no seu gerenciador de senhas; não a envie no chat nem coloque no repositório.
2. Em configuração de API, obtenha Project URL, chave publicável (`sb_publishable_...`) e uma chave secreta (`sb_secret_...`). A publicável identifica o aplicativo e não concede acesso aos dados privados sem JWT/RLS; a secreta deve existir apenas no backend.
3. Em Authentication, habilite o provedor Email e mantenha confirmação de e-mail. Configure Site URL como `http://localhost:3000` e URLs de redirecionamento `http://localhost:3000/login` e `http://localhost:3100/login` (testes).
4. Em Authentication → Signing Keys, use uma chave assimétrica ES256 ou RS256 ativa. O backend valida assinatura via JWKS, issuer, audience, expiração e identidade. Tokens legados HS256 não são aceitos nesta implementação.
5. Em `.env.local` na raiz (arquivo ignorado), configure:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

6. Acrescente a `backend/.env`, preservando as configurações OpenAI:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWT_AUDIENCE=authenticated
FRONTEND_ORIGIN=http://localhost:3000
```

7. Revise e execute `supabase/migrations/001_phase_2.sql` no SQL Editor **do projeto de desenvolvimento**. A migração está pronta para revisão e deve ser aplicada uma única vez, integralmente. A migração cria tabelas e funções, sem apagar dados existentes. Não exponha a chave secreta no SQL ou frontend.
8. Reinicie frontend e backend. Cadastre duas contas próprias de teste pelo produto e confirme os e-mails. Não use dados de alunos reais na validação.
9. Rode a prova de isolamento descrita em `docs/PHASE_2_VALIDATION.md` quando o código e as migrações estiverem prontos. Testes locais com doubles não substituem essa prova.

Não é necessário fornecer credenciais pelo chat. Avise apenas quando os arquivos locais estiverem preenchidos e a migração aplicada. O envio de e-mail de confirmação depende do serviço de e-mail/SMTP configurado no Supabase e de seus limites; para uso público, configurar SMTP próprio é uma etapa operacional separada.

Referências consultadas em 11/09/2026: [chaves de API](https://supabase.com/docs/guides/getting-started/api-keys), [JWT/JWKS](https://supabase.com/docs/guides/auth/jwts), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [login por senha](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## Prova live com duas contas (após configuração)

Copie `tests/.env.example` para `tests/.env.live` e preencha localmente a URL/chave publicável e e-mails/senhas das duas contas de teste já confirmadas. Esse arquivo é ignorado. Não use contas ou textos de alunos reais.

Depois do build, com as portas 3100/8000 livres, rode `npm run test:live`. O teste autentica realmente no Supabase pelo navegador, executa as três missões com chamadas reais à OpenAI, confirma persistência e testa A/B via PostgREST/RLS. Faz três chamadas pagas de IA. O registro contém apenas data, slugs, códigos HTTP, modo, versão de prompt, IDs de requisição e resultados booleanos. Não salva tokens, e-mails, senhas, textos de produção ou traces.

O teste usa a API de autenticação real no navegador para não capturar senhas em ações gravadas de formulário. A revisão manual complementar deve cobrir cadastro pelo formulário, confirmação de e-mail, entrada e saída, incluindo uma credencial incorreta.
