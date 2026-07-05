-- ExamOS Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New Query)

-- ============ EXAM CONFIG ============
create table exam_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  exam_name text not null,
  exam_date date not null,
  daily_study_minutes int not null default 240, -- editable daily capacity
  revision_minutes_per_topic int not null default 15,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============ SUBJECTS ============
create table subjects (
  id uuid primary key default gen_random_uuid(),
  exam_config_id uuid references exam_configs on delete cascade not null,
  name text not null,
  color text default '#6366f1',
  priority int not null default 3, -- 1 (low) - 5 (high) weight in scheduling & readiness score
  created_at timestamptz default now()
);

-- ============ TOPICS ============
create table topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects on delete cascade not null,
  title text not null,
  source_reference text, -- e.g. "NCERT Physics Ch.4" or book name
  page_start int,
  page_end int,
  estimated_minutes int not null default 60,
  priority int not null default 3, -- 1-5
  order_index int not null default 0, -- sequence within subject
  status text not null default 'pending' check (status in ('pending','scheduled','completed','skipped')),
  scheduled_date date,
  completed_date date,
  created_at timestamptz default now()
);

-- ============ DAILY SESSIONS (the actual generated schedule) ============
create table daily_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_config_id uuid references exam_configs on delete cascade not null,
  date date not null,
  session_type text not null check (session_type in ('study','revision','test')),
  topic_id uuid references topics on delete cascade,
  revision_stage int, -- 1,2,3,4 for spaced repetition intervals (only for session_type='revision')
  planned_minutes int not null default 30,
  status text not null default 'pending' check (status in ('pending','done','missed','shifted')),
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_daily_sessions_date on daily_sessions(exam_config_id, date);
create index idx_topics_subject on topics(subject_id);

-- ============ QUESTIONS (mock test bank) ============
create table questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references subjects on delete cascade not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  explanation text,
  difficulty text default 'medium' check (difficulty in ('easy','medium','hard')),
  created_at timestamptz default now()
);

-- ============ TEST ATTEMPTS ============
create table test_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_config_id uuid references exam_configs on delete cascade not null,
  subject_id uuid references subjects on delete cascade not null,
  attempt_date date not null default current_date,
  total_questions int not null,
  correct_count int not null,
  time_taken_seconds int,
  created_at timestamptz default now()
);

create table test_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references test_attempts on delete cascade not null,
  question_id uuid references questions on delete cascade not null,
  selected_option text check (selected_option in ('A','B','C','D')),
  is_correct boolean not null
);

-- ============ ROW LEVEL SECURITY ============
alter table exam_configs enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table daily_sessions enable row level security;
alter table questions enable row level security;
alter table test_attempts enable row level security;
alter table test_attempt_answers enable row level security;

create policy "own exam configs" on exam_configs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own subjects" on subjects for all
  using (exam_config_id in (select id from exam_configs where user_id = auth.uid()))
  with check (exam_config_id in (select id from exam_configs where user_id = auth.uid()));

create policy "own topics" on topics for all
  using (subject_id in (select s.id from subjects s join exam_configs e on s.exam_config_id = e.id where e.user_id = auth.uid()))
  with check (subject_id in (select s.id from subjects s join exam_configs e on s.exam_config_id = e.id where e.user_id = auth.uid()));

create policy "own sessions" on daily_sessions for all
  using (exam_config_id in (select id from exam_configs where user_id = auth.uid()))
  with check (exam_config_id in (select id from exam_configs where user_id = auth.uid()));

create policy "own questions" on questions for all
  using (subject_id in (select s.id from subjects s join exam_configs e on s.exam_config_id = e.id where e.user_id = auth.uid()))
  with check (subject_id in (select s.id from subjects s join exam_configs e on s.exam_config_id = e.id where e.user_id = auth.uid()));

create policy "own attempts" on test_attempts for all
  using (exam_config_id in (select id from exam_configs where user_id = auth.uid()))
  with check (exam_config_id in (select id from exam_configs where user_id = auth.uid()));

create policy "own attempt answers" on test_attempt_answers for all
  using (attempt_id in (select t.id from test_attempts t join exam_configs e on t.exam_config_id = e.id where e.user_id = auth.uid()))
  with check (attempt_id in (select t.id from test_attempts t join exam_configs e on t.exam_config_id = e.id where e.user_id = auth.uid()));
