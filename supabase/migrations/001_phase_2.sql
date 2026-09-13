-- Cyber.fluent Phase 2. Run once in a dedicated development project.
-- No credentials in this migration. All personal tables use RLS.
begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 source_locale text not null check(source_locale='pt-BR'),
 target_locale text not null check(target_locale='en'),
 cefr text not null check(cefr in ('A1','A2','B1')),
 area text not null check(area in ('development','security','support','other')),
 role text not null check(length(role) between 2 and 80),
 goal text not null check(length(goal) between 5 and 200),
 daily_minutes integer not null check(daily_minutes in (5,10,15,20,30)),
 updated_at timestamptz not null default now()
);
create table public.learning_paths(slug text primary key, title text not null, published boolean not null default true);
create table public.missions(
 slug text primary key, path_slug text not null references public.learning_paths(slug),
 title text not null, position integer not null unique, content jsonb not null,
 published boolean not null default true
);
create table public.mission_steps(
 mission_slug text references public.missions(slug), step_id text,
 content jsonb not null, primary key(mission_slug,step_id)
);
create table public.attempts(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mission_slug text not null references public.missions(slug),
 feedback jsonb, ai_mode text check(ai_mode in ('live','demo')),
 recalled boolean not null default false, created_at timestamptz not null default now()
);
create index attempts_owner on public.attempts(user_id,created_at desc);
create table public.language_error_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id uuid not null references public.attempts(id) on delete cascade,
 concept_id text not null, error_type text not null, created_at timestamptz not null default now(),
 unique(attempt_id,concept_id,error_type)
);
create table public.concept_mastery(
 user_id uuid references auth.users(id) on delete cascade, concept_id text,
 correct_count integer not null default 0, error_count integer not null default 0,
 last_practiced_at timestamptz not null default now(), primary key(user_id,concept_id)
);
create table public.review_queue(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mission_slug text not null references public.missions(slug), concept_id text not null,
 due_at timestamptz not null, interval_days integer not null check(interval_days in (1,2,3,7,14,30)),
 streak integer not null default 0 check(streak>=0), version integer not null default 0,
 reason text not null, unique(user_id,mission_slug)
);
create index review_owner_due on public.review_queue(user_id,due_at);
create table public.user_progress(
 user_id uuid references auth.users(id) on delete cascade,
 mission_slug text references public.missions(slug),
 context_xp integer not null check(context_xp in (0,20)),
 language_xp integer not null check(language_xp in (0,20)),
 communication_xp integer not null check(communication_xp in (0,20)),
 completed_at timestamptz not null default now(), primary key(user_id,mission_slug)
);
-- Deny browser writes to evaluations, XP, review and curriculum.
revoke all on public.profiles,public.learning_paths,public.missions,public.mission_steps,
 public.attempts,public.language_error_events,public.concept_mastery,public.review_queue,public.user_progress from anon,authenticated;
grant select on public.profiles,public.attempts,public.language_error_events,public.concept_mastery,public.review_queue,public.user_progress to authenticated;
grant select on public.learning_paths,public.missions,public.mission_steps to anon,authenticated;
grant insert,update,delete on public.profiles to authenticated;
grant all on public.profiles,public.learning_paths,public.missions,public.mission_steps,
 public.attempts,public.language_error_events,public.concept_mastery,public.review_queue,public.user_progress to service_role;

do $$ declare tbl text; begin
 foreach tbl in array array['profiles','attempts','language_error_events','concept_mastery','review_queue','user_progress'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',tbl);
 end loop;
 foreach tbl in array array['learning_paths','missions','mission_steps'] loop
  execute format('alter table public.%I enable row level security',tbl);
 end loop;
end $$;
create policy own_profile_insert on public.profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy own_profile_update on public.profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_profile_delete on public.profiles for delete to authenticated using((select auth.uid())=user_id);
create policy published_path on public.learning_paths for select to anon,authenticated using(published);
create policy published_mission on public.missions for select to anon,authenticated using(published);
create policy published_step on public.mission_steps for select to anon,authenticated using(exists(select 1 from public.missions m where m.slug=mission_slug and m.published));

create function public.save_feedback(p_user_id uuid,p_attempt_id uuid,p_feedback jsonb,p_mode text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.attempts; e jsonb;
begin
 select * into a from public.attempts where id=p_attempt_id and user_id=p_user_id for update;
 if not found or a.recalled then raise exception 'attempt unavailable'; end if;
 update public.attempts set feedback=p_feedback,ai_mode=p_mode where id=a.id;
 delete from public.language_error_events where attempt_id=a.id and user_id=p_user_id;
 for e in select value from jsonb_array_elements(coalesce(p_feedback->'language_errors','[]')) loop
  insert into public.language_error_events(user_id,attempt_id,concept_id,error_type)
  values(p_user_id,a.id,e->>'concept_id',e->>'type') on conflict do nothing;
 end loop;
 return jsonb_build_object('saved',true);
end $$;

create function public.finish_attempt(p_user_id uuid,p_attempt_id uuid,p_correct boolean,p_confidence integer,p_concept text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.attempts; old_xp integer:=0; new_xp integer; comm integer:=0; days integer; rationale text;
begin
 if p_confidence not between 1 and 5 then raise exception 'invalid confidence'; end if;
 select * into a from public.attempts where id=p_attempt_id and user_id=p_user_id for update;
 if not found or a.feedback is null or a.ai_mode<>'live' then raise exception 'attempt unavailable'; end if;
 if a.recalled then return jsonb_build_object('correct',true,'xp_awarded',0,'already_completed',true); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||a.mission_slug,0));
 days:=case when not p_correct then 1 when p_confidence<=2 then 2 else 3 end;
 rationale:=case when not p_correct then 'Erro: retomar amanhã.' when p_confidence<=2 then 'Acerto com baixa confiança.' else 'Primeiro acerto seguro.' end;
 insert into public.review_queue(user_id,mission_slug,concept_id,due_at,interval_days,streak,reason)
 values(p_user_id,a.mission_slug,p_concept,now()+make_interval(days=>days),days,case when p_correct and p_confidence>2 then 1 else 0 end,rationale)
 on conflict(user_id,mission_slug) do update set
 due_at=least(public.review_queue.due_at,excluded.due_at),
 interval_days=least(public.review_queue.interval_days,excluded.interval_days),
 streak=case when p_correct then public.review_queue.streak else 0 end,
 reason=excluded.reason,version=public.review_queue.version+1;
 insert into public.concept_mastery(user_id,concept_id,correct_count,error_count)
 values(p_user_id,p_concept,case when p_correct then 1 else 0 end,case when p_correct then 0 else 1 end)
 on conflict(user_id,concept_id) do update set correct_count=public.concept_mastery.correct_count+excluded.correct_count,
 error_count=public.concept_mastery.error_count+excluded.error_count,last_practiced_at=now();
 if not p_correct then return jsonb_build_object('correct',false,'xp_awarded',0,'already_completed',false); end if;
 if a.feedback#>>'{professional_feedback,status}'='appropriate'
 and a.feedback#>>'{technical_feedback,status}' in ('correct','not_applicable')
 and not coalesce((a.feedback->>'needs_human_review')::boolean,true) then comm:=20; end if;
 select context_xp+language_xp+communication_xp into old_xp from public.user_progress where user_id=p_user_id and mission_slug=a.mission_slug;
 old_xp:=coalesce(old_xp,0);
 insert into public.user_progress(user_id,mission_slug,context_xp,language_xp,communication_xp)
 values(p_user_id,a.mission_slug,20,20,comm)
 on conflict(user_id,mission_slug) do update set communication_xp=greatest(public.user_progress.communication_xp,excluded.communication_xp);
 select context_xp+language_xp+communication_xp into new_xp from public.user_progress where user_id=p_user_id and mission_slug=a.mission_slug;
 update public.attempts set recalled=true where id=a.id;
 return jsonb_build_object('correct',true,'xp_awarded',new_xp-old_xp,'already_completed',false);
end $$;

create function public.review_result(p_user_id uuid,p_review_id uuid,p_version integer,p_correct boolean,p_confidence integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.review_queue; days integer; new_streak integer; rationale text;
begin
 if p_confidence not between 1 and 5 then raise exception 'invalid confidence'; end if;
 select * into r from public.review_queue where id=p_review_id and user_id=p_user_id for update;
 if not found or r.version<>p_version or r.due_at>now() then raise exception 'review unavailable'; end if;
 if not p_correct then days:=1;new_streak:=0;rationale:='Erro: retomar o conceito amanhã.';
 elsif p_confidence<=2 then days:=2;new_streak:=0;rationale:='Acerto com baixa confiança: reforçar em dois dias.';
 else days:=(array[3,7,14,30])[least(r.streak+1,4)];new_streak:=r.streak+1;rationale:='Acerto seguro: ampliar intervalo.'; end if;
 update public.review_queue set due_at=now()+make_interval(days=>days),interval_days=days,streak=new_streak,reason=rationale,version=version+1 where id=r.id;
 insert into public.concept_mastery(user_id,concept_id,correct_count,error_count)
 values(p_user_id,r.concept_id,case when p_correct then 1 else 0 end,case when p_correct then 0 else 1 end)
 on conflict(user_id,concept_id) do update set correct_count=public.concept_mastery.correct_count+excluded.correct_count,
 error_count=public.concept_mastery.error_count+excluded.error_count,last_practiced_at=now();
 return jsonb_build_object('correct',p_correct,'interval_days',days,'reason',rationale,'xp_awarded',0);
end $$;
revoke all on function public.save_feedback(uuid,uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.finish_attempt(uuid,uuid,boolean,integer,text) from public,anon,authenticated;
revoke all on function public.review_result(uuid,uuid,integer,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_feedback(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.finish_attempt(uuid,uuid,boolean,integer,text) to service_role;
grant execute on function public.review_result(uuid,uuid,integer,boolean,integer) to service_role;

insert into public.learning_paths(slug,title) values('tech-english-starter-path','Tech English Starter Path');
insert into public.missions(slug,path_slug,title,position,content) values('daily-standup','tech-english-starter-path','Daily Standup',1,'{"path": "Tech English Starter Path", "cefr": ["A1", "A2", "B1"], "human_review_status": "pending", "source": "Cenário original fictício; revisão humana pendente.", "slug": "daily-standup", "title": "Daily Standup", "role": "Software developer", "scenario": "Na Northstar, ontem você corrigiu o bug de login. Hoje vai escrever testes. Falta acesso ao ambiente de staging e você precisa de ajuda da equipe.", "briefing": "Comunique andamento, próximo passo e bloqueio em 2 a 4 frases em inglês.", "language_objective": "Organizar passado, plano atual e pedido de ajuda.", "professional_objective": "Informar o bloqueio de modo específico e colaborativo.", "technical_objective": null, "vocabulary": [["fixed", "corrigi"], ["blocker", "impedimento"], ["staging", "ambiente de homologação"], ["access", "acesso"]], "grammar": "Yesterday, I + past verb. Today, I will + base verb. I am blocked by ...", "worked_example": "Yesterday, I updated the documentation. Today, I will review the tests. I need access to the repository.", "base_explanation": "Yesterday sinaliza passado; will recebe verbo base e comunica o próximo passo.", "review_concepts": ["future-will"], "minigames": ["Build the Message", "Choose Your Response"], "games": [{"id": "build", "type": "order", "title": "Build the Message", "prompt": "Monte uma atualização na ordem: ontem → hoje → bloqueio.", "options": [{"id": "blocker", "text": "I need access to staging. Can someone help?"}, {"id": "today", "text": "Today, I will write tests."}, {"id": "yesterday", "text": "Yesterday, I fixed the login bug."}]}, {"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "O acesso ainda não chegou. Qual atualização ajuda a equipe?", "options": [{"id": "wait", "text": "Everything is fine."}, {"id": "ask", "text": "I am blocked by missing staging access. Could you help me get access?"}, {"id": "blame", "text": "This is your fault."}]}], "position": 1}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('daily-standup','build','{"id": "build", "type": "order", "title": "Build the Message", "prompt": "Monte uma atualização na ordem: ontem → hoje → bloqueio.", "options": [{"id": "blocker", "text": "I need access to staging. Can someone help?"}, {"id": "today", "text": "Today, I will write tests."}, {"id": "yesterday", "text": "Yesterday, I fixed the login bug."}]}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('daily-standup','decide','{"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "O acesso ainda não chegou. Qual atualização ajuda a equipe?", "options": [{"id": "wait", "text": "Everything is fine."}, {"id": "ask", "text": "I am blocked by missing staging access. Could you help me get access?"}, {"id": "blame", "text": "This is your fault."}]}'::jsonb);
insert into public.missions(slug,path_slug,title,position,content) values('bug-report','tech-english-starter-path','Bug Report',2,'{"path": "Tech English Starter Path", "cefr": ["A1", "A2", "B1"], "human_review_status": "pending", "source": "Cenário original fictício; revisão humana pendente.", "slug": "bug-report", "title": "Bug Report", "role": "QA analyst", "scenario": "No aplicativo fictício Northstar Tasks, clicar em Save deveria salvar a tarefa. Em vez disso, a tela mostra Error 500 e a tarefa não aparece após atualizar. Isso impede o registro do trabalho.", "briefing": "Escreva um relato de 3 a 5 frases com reprodução, comportamento esperado, observado e impacto.", "language_objective": "Contrastar expected e actual usando should + verbo base.", "professional_objective": "Escrever um relato reproduzível sem atribuir culpa ou inventar a causa.", "technical_objective": "Separar observação de hipótese.", "vocabulary": [["expected", "esperado"], ["actual", "observado"], ["reproduce", "reproduzir"], ["impact", "impacto"]], "grammar": "The app should + base verb, but it + observed behavior.", "worked_example": "The button should open the menu, but it shows a blank screen. Users cannot access the settings.", "base_explanation": "Should expressa comportamento esperado e recebe verbo base, sem to. But introduz o contraste.", "review_concepts": ["modal-should"], "minigames": ["Bug Report Builder", "Choose Your Response"], "games": [{"id": "build", "type": "classify", "title": "Bug Report Builder", "prompt": "Classifique cada parte do relato.", "options": [{"id": "save", "text": "The app should save the task."}, {"id": "error", "text": "It shows Error 500 and the task is missing after refresh."}, {"id": "work", "text": "Users cannot record their work."}], "labels": ["expected", "actual", "impact"]}, {"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "Qual informação torna o relato reproduzível sem inventar uma causa?", "options": [{"id": "cause", "text": "The database is definitely broken."}, {"id": "steps", "text": "Click Save, observe Error 500, then refresh and check whether the task appears."}, {"id": "delete", "text": "Delete all tasks and try again."}]}], "position": 2}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('bug-report','build','{"id": "build", "type": "classify", "title": "Bug Report Builder", "prompt": "Classifique cada parte do relato.", "options": [{"id": "save", "text": "The app should save the task."}, {"id": "error", "text": "It shows Error 500 and the task is missing after refresh."}, {"id": "work", "text": "Users cannot record their work."}], "labels": ["expected", "actual", "impact"]}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('bug-report','decide','{"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "Qual informação torna o relato reproduzível sem inventar uma causa?", "options": [{"id": "cause", "text": "The database is definitely broken."}, {"id": "steps", "text": "Click Save, observe Error 500, then refresh and check whether the task appears."}, {"id": "delete", "text": "Delete all tasks and try again."}]}'::jsonb);
insert into public.missions(slug,path_slug,title,position,content) values('phishing-incident-communication','tech-english-starter-path','Phishing Incident Communication',3,'{"slug": "phishing-incident-communication", "title": "Phishing Incident Communication", "path": "Tech English Starter Path", "cefr": ["A1", "A2", "B1"], "role": "IT support analyst", "scenario": "Na empresa fictícia Northstar, Alex recebeu um e-mail suspeito e inseriu sua senha no site indicado. O domínio oficial fictício é northstar.example.", "language_objective": "Orientar com need to + verbo e imperativos profissionais.", "professional_objective": "Dar instruções claras, acolhedoras e acionáveis, sem culpar Alex.", "technical_objective": "Reconhecer pistas e comunicar uma resposta defensiva à exposição de senha.", "vocabulary": [["suspicious", "suspeito"], ["report", "reportar ao canal de segurança"], ["credentials", "credenciais de acesso"], ["trusted channel", "canal confiável"]], "grammar": "person + need/needs + to + base verb", "briefing": "Identifique três pistas e escreva uma orientação de 2 a 4 frases em inglês.", "minigames": ["Spot the Risk", "Choose Your Response"], "base_explanation": "Em need to change, need expressa necessidade; to é marcador do infinitivo. Need help usa substantivo; must change usa modal sem to. Ações coordenadas podem compartilhar to.", "review_concepts": ["need-to", "defensive-instructions"], "human_review_status": "pending", "source": "Cenário original fictício; revisão humana pendente.", "worked_example": "You need to contact the support team.", "games": [{"id": "risk", "type": "select_many", "title": "Spot the Risk", "prompt": "Selecione três pistas suspeitas. Endereços fictícios; não são links.", "options": [{"id": "sender", "text": "From: IT Support <help@northstar-security.example>"}, {"id": "urgent", "text": "Subject: Your account will be closed in 10 minutes"}, {"id": "password", "text": "Please enter your password at northstar-verify.example"}, {"id": "hello", "text": "Hello Alex,"}]}, {"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "Alex inseriu a senha. Qual é a orientação defensiva adequada?", "options": [{"id": "reply", "text": "Reply to the sender with your password."}, {"id": "safe", "text": "Open the official website independently, change your password, and report the email through a trusted channel."}, {"id": "click", "text": "Click the same link again to check."}]}], "position": 3}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('phishing-incident-communication','risk','{"id": "risk", "type": "select_many", "title": "Spot the Risk", "prompt": "Selecione três pistas suspeitas. Endereços fictícios; não são links.", "options": [{"id": "sender", "text": "From: IT Support <help@northstar-security.example>"}, {"id": "urgent", "text": "Subject: Your account will be closed in 10 minutes"}, {"id": "password", "text": "Please enter your password at northstar-verify.example"}, {"id": "hello", "text": "Hello Alex,"}]}'::jsonb);
insert into public.mission_steps(mission_slug,step_id,content) values('phishing-incident-communication','decide','{"id": "decide", "type": "single", "title": "Choose Your Response", "prompt": "Alex inseriu a senha. Qual é a orientação defensiva adequada?", "options": [{"id": "reply", "text": "Reply to the sender with your password."}, {"id": "safe", "text": "Open the official website independently, change your password, and report the email through a trusted channel."}, {"id": "click", "text": "Click the same link again to check."}]}'::jsonb);
commit;
