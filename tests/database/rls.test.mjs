import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
let db;
const A="00000000-0000-4000-8000-000000000001",B="00000000-0000-4000-8000-000000000002";
const slug="daily-standup";
async function identity(id,role="authenticated"){
 await db.exec("reset role");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await db.exec(`set role ${role}`);
}
before(async()=>{
 db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;`);
 await db.exec(readFileSync("supabase/migrations/001_phase_2.sql","utf8"));
 await db.query("insert into auth.users values ($1),($2)",[A,B]);
});
after(async()=>{await db.close();});
test("all nine tables have RLS and only three missions exist",async()=>{
 const r=await db.query("select relname from pg_class where relnamespace='public'::regnamespace and relrowsecurity");
 assert.equal(r.rows.length,9);
 assert.equal((await db.query("select * from missions")).rows.length,3);
});
test("A can maintain own profile; B cannot read, update or insert for A",async()=>{
 await identity(A);
 await db.query("insert into profiles(user_id,source_locale,target_locale,cefr,area,role,goal,daily_minutes) values($1,'pt-BR','en','A2','development','Student','Write clearly',10)",[A]);
 assert.equal((await db.query("select * from profiles")).rows.length,1);
 await identity(B);
 assert.equal((await db.query("select * from profiles")).rows.length,0);
 assert.equal((await db.query("update profiles set goal='stolen' where user_id=$1 returning *",[A])).rows.length,0);
 await assert.rejects(()=>db.query("insert into profiles(user_id,source_locale,target_locale,cefr,area,role,goal,daily_minutes) values($1,'pt-BR','en','A2','development','Student','Forged profile',10)",[A]),/row-level security/);
});
test("browser cannot create attempts, forge XP, modify curriculum or call privileged RPC",async()=>{
 await identity(A);
 for(const sql of ["insert into attempts(user_id,mission_slug) values($1,'daily-standup')","insert into user_progress(user_id,mission_slug,context_xp,language_xp,communication_xp) values($1,'daily-standup',20,20,20)","select finish_attempt($1,gen_random_uuid(),true,5,'future-will')"]){await assert.rejects(()=>db.query(sql,[A]),/permission denied/);}
 await assert.rejects(()=>db.query("update missions set title='forged'"),/permission denied/);
});
let attemptId;
test("server writes validated summary and awards XP once",async()=>{
 await identity(A,"service_role");
 attemptId=(await db.query("insert into attempts(user_id,mission_slug) values($1,$2) returning id",[A,slug])).rows[0].id;
 const summary={language_errors:[],professional_feedback:{status:"appropriate"},technical_feedback:{status:"not_applicable"},needs_human_review:false};
 await db.query("select save_feedback($1,$2,$3::jsonb,'live')",[A,attemptId,JSON.stringify(summary)]);
 const first=(await db.query("select finish_attempt($1,$2,true,5,'future-will') as result",[A,attemptId])).rows[0].result;
 assert.equal(first.xp_awarded,60);
 const second=(await db.query("select finish_attempt($1,$2,true,5,'future-will') as result",[A,attemptId])).rows[0].result;
 assert.equal(second.xp_awarded,0);
 await assert.rejects(()=>db.query("select save_feedback($1,$2,$3::jsonb,'live')",[A,attemptId,JSON.stringify(summary)]),/attempt unavailable/);
});
test("RLS isolates attempts, progress, mastery and review even without owner filter",async()=>{
 await identity(B);
 for(const table of ["attempts","user_progress","concept_mastery","review_queue","language_error_events"]){assert.equal((await db.query(`select * from ${table}`)).rows.length,0,table);}
 await identity(A);
 for(const table of ["attempts","user_progress","concept_mastery","review_queue"]){assert.equal((await db.query(`select * from ${table}`)).rows.length,1,table);}
});
test("review requires due date and version; intervals grow then reset after error",async()=>{
 await identity(A,"service_role");
 let row=(await db.query("select * from review_queue where user_id=$1",[A])).rows[0];
 await assert.rejects(()=>db.query("select review_result($1,$2,$3,true,5)",[A,row.id,row.version]),/review unavailable/);
 for(const [correct,confidence,expected] of [[true,5,7],[true,5,14],[true,5,30],[false,5,1],[true,1,2],[true,5,3]]){
  await db.query("update review_queue set due_at=now()-interval '1 second' where id=$1",[row.id]);
  const r=(await db.query("select review_result($1,$2,$3,$4,$5) as result",[A,row.id,row.version,correct,confidence])).rows[0].result;
  assert.equal(r.interval_days,expected);
  await assert.rejects(()=>db.query("select review_result($1,$2,$3,true,5)",[A,row.id,row.version]),/review unavailable/);
  row=(await db.query("select * from review_queue where id=$1",[row.id])).rows[0];
 }
});
test("anonymous has public curriculum only",async()=>{
 await identity("","anon");
 assert.equal((await db.query("select * from missions")).rows.length,3);
 for(const table of ["profiles","attempts","user_progress","review_queue"]){await assert.rejects(()=>db.query(`select * from ${table}`),/permission denied/);}
});
