-- SNOW Stats Lab: shared live database for the teaching site.
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
--
-- Security model: the site uses the public "anon" key. Anyone with the site can INSERT
-- tickets/feedback and READ the class data (that's what makes the lessons live), but
-- nobody can UPDATE or DELETE through the API. Ticket text is visible to everyone, which
-- is why the consent screen tells participants not to type personal information.

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
  ai_correct       smallint    check (ai_correct in (0, 1))
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
  comment          text        check (char_length(comment) <= 400)
);

create index if not exists submissions_session_idx on public.submissions (session_label);
create index if not exists feedback_session_idx on public.feedback (session_label);

alter table public.submissions enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "anon insert" on public.submissions;
drop policy if exists "anon read" on public.submissions;
drop policy if exists "anon insert" on public.feedback;
drop policy if exists "anon read" on public.feedback;
create policy "anon insert" on public.submissions for insert to anon with check (source = 'live');
create policy "anon read"   on public.submissions for select to anon using (true);
create policy "anon insert" on public.feedback    for insert to anon with check (true);
create policy "anon read"   on public.feedback    for select to anon using (true);

-- Session picker for the lessons.
create or replace view public.session_counts with (security_invoker = true) as
  select session_label, count(distinct participant_id) as participants, max(created_at) as last_seen
  from public.submissions group by session_label;

-- Live updates: lessons subscribe to new rows.
alter publication supabase_realtime add table public.submissions, public.feedback;
