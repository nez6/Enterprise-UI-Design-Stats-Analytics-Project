-- SNOW Stats Lab: the ONE store for all study data.
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: it creates what's missing and resets the policies and views.
--
-- Access model (see docs/IRB_REVIEW.md, risks P1–P3):
--   * The website uses the public "anon" key. With it, anyone can INSERT tickets, surveys and
--     withdrawals, but can never read, update or delete the raw tables.
--   * The live lessons read de-identified VIEWS: no free text (ticket_text, comment) and no
--     timestamps finer than the session. Withdrawn participants are filtered out.
--   * Only the project owner, using the secret service_role key (never in the website),
--     can read the raw tables, via scripts/export_supabase.py.

create table if not exists public.submissions (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  participant_id   text        not null check (char_length(participant_id) <= 40),
  source           text        not null default 'live',
  submitted_at     timestamptz,
  session_label    text        not null check (char_length(session_label) <= 60),
  years_experience smallint    check (years_experience between 0 and 25),
  job_level        text,
  job_role         text,
  snow_primed      smallint    not null check (snow_primed in (0, 1)),
  ai_primed        smallint    not null check (ai_primed in (0, 1)),
  set_order        text        check (set_order in ('legacy_first', 'ai_first')),
  test_num         smallint    not null check (test_num between 1 and 6),
  position         smallint    check (position between 1 and 6),
  test_name        text,
  ticket_type      text,
  workflow         text        not null check (workflow in ('ServiceNow', 'AI Agent')),
  primed           smallint    not null check (primed in (0, 1)),
  completion_time  real        not null check (completion_time > 0 and completion_time < 86400),
  error_count      smallint    not null default 0 check (error_count >= 0),
  rage_quit        smallint    not null default 0 check (rage_quit in (0, 1)),
  frustration      smallint    not null check (frustration between 1 and 10),
  efficiency       smallint    not null check (efficiency between 1 and 10),
  ticket_text      text        check (char_length(ticket_text) <= 500),
  chosen_category  text,
  ai_category      text,
  ai_confidence    real        check (ai_confidence between 0 and 1),
  ai_correct       smallint    check (ai_correct in (0, 1)),
  ai_error_injected smallint   check (ai_error_injected in (0, 1)),
  ai_error_caught  smallint    check (ai_error_caught in (0, 1))
);

create table if not exists public.feedback (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  participant_id   text        not null check (char_length(participant_id) <= 40),
  session_label    text        not null check (char_length(session_label) <= 60),
  snow_primed      smallint    check (snow_primed in (0, 1)),
  ai_primed        smallint    check (ai_primed in (0, 1)),
  job_level        text,
  nps_servicenow   smallint    check (nps_servicenow between 0 and 10),
  ai_trust         smallint    check (ai_trust between 1 and 10),
  prefer_ai        smallint    check (prefer_ai in (0, 1)),
  mc_snow          text        check (mc_snow in ('yes', 'no', 'unsure')),
  mc_ai            text        check (mc_ai in ('yes', 'no', 'unsure')),
  comment          text        check (char_length(comment) <= 400)
);
alter table public.feedback add column if not exists mc_snow text check (mc_snow in ('yes', 'no', 'unsure'));
alter table public.feedback add column if not exists mc_ai text check (mc_ai in ('yes', 'no', 'unsure'));
alter table public.submissions add column if not exists ai_error_injected smallint check (ai_error_injected in (0, 1));
alter table public.submissions add column if not exists ai_error_caught smallint check (ai_error_caught in (0, 1));

create table if not exists public.withdrawals (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  participant_id   text        not null check (char_length(participant_id) <= 40),
  session_label    text        not null check (char_length(session_label) <= 60)
);

create index if not exists submissions_session_idx on public.submissions (session_label);
create index if not exists feedback_session_idx on public.feedback (session_label);

-- Raw tables: insert-only for the public key.
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;
alter table public.withdrawals enable row level security;
drop policy if exists "anon insert" on public.submissions;
drop policy if exists "anon read" on public.submissions;
drop policy if exists "anon insert" on public.feedback;
drop policy if exists "anon read" on public.feedback;
drop policy if exists "anon insert" on public.withdrawals;
create policy "anon insert" on public.submissions for insert to anon with check (source = 'live');
create policy "anon insert" on public.feedback    for insert to anon with check (true);
create policy "anon insert" on public.withdrawals for insert to anon with check (true);
revoke select, update, delete on public.submissions, public.feedback, public.withdrawals from anon;

-- De-identified views for the live lessons (owner rights; the anon key reads these only).
create or replace view public.submissions_public as
  select s.participant_id, s.source, s.session_label, s.years_experience, s.job_level, s.job_role,
         s.snow_primed, s.ai_primed, s.set_order, s.test_num, s.position, s.test_name, s.ticket_type,
         s.workflow, s.primed, s.completion_time, s.error_count, s.rage_quit, s.frustration, s.efficiency,
         s.chosen_category, s.ai_category, s.ai_confidence, s.ai_correct, s.ai_error_injected, s.ai_error_caught
  from public.submissions s
  where not exists (select 1 from public.withdrawals w where w.participant_id = s.participant_id);

create or replace view public.feedback_public as
  select f.participant_id, f.session_label, f.snow_primed, f.ai_primed, f.job_level,
         f.nps_servicenow, f.ai_trust, f.prefer_ai, f.mc_snow, f.mc_ai
  from public.feedback f
  where not exists (select 1 from public.withdrawals w where w.participant_id = f.participant_id);

create or replace view public.withdrawals_public as
  select participant_id, session_label from public.withdrawals;

grant select on public.submissions_public, public.feedback_public, public.withdrawals_public to anon;

-- Retention (docs/IRB_REVIEW.md, risk P5): after the analysis is final, delete raw free text:
--   update public.submissions set ticket_text = null; update public.feedback set comment = null;
-- and delete the project once the course has ended.
