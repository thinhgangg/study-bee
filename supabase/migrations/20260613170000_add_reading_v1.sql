-- Reading V1 schema for StudyBee.
-- Content is managed with the service role; learners can only read published content.

do $$
begin
  create type public.reading_question_type as enum (
    'multiple_choice',
    'true_false_not_given',
    'matching_headings',
    'matching_information',
    'summary_completion',
    'sentence_completion',
    'diagram_labeling'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.reading_passages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  content text not null check (btrim(content) <> ''),
  topic text not null check (btrim(topic) <> ''),
  difficulty numeric(2,1) not null check (
    difficulty in (5.0, 5.5, 6.0, 6.5, 7.0, 8.0)
  ),
  estimated_time integer not null check (estimated_time > 0),
  source text,
  source_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

comment on column public.reading_passages.estimated_time is
  'Estimated completion time in minutes.';

create table if not exists public.reading_passage_sections (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  label text not null check (btrim(label) <> ''),
  content text not null check (btrim(content) <> ''),
  order_index integer not null check (order_index >= 0),
  unique (passage_id, label),
  unique (passage_id, order_index)
);

create table if not exists public.reading_questions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  question_group text,
  order_index integer not null check (order_index >= 0),
  question_type public.reading_question_type not null,
  prompt text not null check (btrim(prompt) <> ''),
  explanation text,
  unique (passage_id, order_index)
);

create table if not exists public.reading_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.reading_questions(id) on delete cascade,
  option_key text not null check (btrim(option_key) <> ''),
  option_text text not null check (btrim(option_text) <> ''),
  order_index integer not null check (order_index >= 0),
  unique (question_id, option_key),
  unique (question_id, order_index)
);

create table if not exists public.reading_question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.reading_questions(id) on delete cascade,
  answer_text text not null check (btrim(answer_text) <> ''),
  unique (question_id, answer_text)
);

create table if not exists public.reading_passage_vocabulary (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  word text not null check (btrim(word) <> ''),
  context_sentence text not null check (btrim(context_sentence) <> ''),
  created_at timestamptz not null default now(),
  unique (passage_id, word, context_sentence)
);

create table if not exists public.user_reading_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  passage_id uuid not null references public.reading_passages(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  time_taken_seconds integer check (time_taken_seconds is null or time_taken_seconds >= 0),
  total_questions integer not null check (total_questions > 0),
  correct_count integer not null default 0 check (
    correct_count >= 0 and correct_count <= total_questions
  ),
  accuracy numeric(5,2) generated always as (
    round((correct_count::numeric / total_questions::numeric) * 100, 2)
  ) stored,
  created_at timestamptz not null default now(),
  check (
    (completed_at is null and time_taken_seconds is null)
    or (completed_at is not null and time_taken_seconds is not null)
  )
);

create table if not exists public.user_reading_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.user_reading_attempts(id) on delete cascade,
  question_id uuid not null references public.reading_questions(id) on delete restrict,
  user_answer text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.user_saved_passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (user_id, passage_id)
);

create index if not exists reading_passages_published_filters_idx
  on public.reading_passages(topic, difficulty, published_at desc)
  where is_published = true;
create index if not exists reading_passages_title_lower_idx
  on public.reading_passages(lower(title));
create index if not exists reading_passage_sections_passage_order_idx
  on public.reading_passage_sections(passage_id, order_index);
create index if not exists reading_questions_passage_order_idx
  on public.reading_questions(passage_id, order_index);
create index if not exists reading_question_options_question_order_idx
  on public.reading_question_options(question_id, order_index);
create index if not exists reading_question_answers_question_idx
  on public.reading_question_answers(question_id);
create index if not exists reading_passage_vocabulary_passage_word_idx
  on public.reading_passage_vocabulary(passage_id, lower(word));
create index if not exists user_reading_attempts_user_history_idx
  on public.user_reading_attempts(user_id, completed_at desc)
  where completed_at is not null;
create index if not exists user_reading_attempts_passage_idx
  on public.user_reading_attempts(passage_id);
create index if not exists user_reading_answers_attempt_idx
  on public.user_reading_answers(attempt_id);
create index if not exists user_reading_answers_question_idx
  on public.user_reading_answers(question_id);
create index if not exists user_saved_passages_user_saved_idx
  on public.user_saved_passages(user_id, saved_at desc);
create index if not exists user_saved_passages_passage_idx
  on public.user_saved_passages(passage_id);

create or replace function public.touch_reading_passages_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_reading_passages_updated_at on public.reading_passages;
create trigger touch_reading_passages_updated_at
before update on public.reading_passages
for each row execute function public.touch_reading_passages_updated_at();

alter table public.reading_passages enable row level security;
alter table public.reading_passage_sections enable row level security;
alter table public.reading_questions enable row level security;
alter table public.reading_question_options enable row level security;
alter table public.reading_question_answers enable row level security;
alter table public.reading_passage_vocabulary enable row level security;
alter table public.user_reading_attempts enable row level security;
alter table public.user_reading_answers enable row level security;
alter table public.user_saved_passages enable row level security;

drop policy if exists "Anyone can read published reading passages" on public.reading_passages;
create policy "Anyone can read published reading passages"
on public.reading_passages for select to anon, authenticated
using (is_published = true);

drop policy if exists "Anyone can read sections of published passages" on public.reading_passage_sections;
create policy "Anyone can read sections of published passages"
on public.reading_passage_sections for select to anon, authenticated
using (exists (
  select 1 from public.reading_passages passage
  where passage.id = reading_passage_sections.passage_id
    and passage.is_published = true
));

drop policy if exists "Anyone can read questions of published passages" on public.reading_questions;
create policy "Anyone can read questions of published passages"
on public.reading_questions for select to anon, authenticated
using (exists (
  select 1 from public.reading_passages passage
  where passage.id = reading_questions.passage_id
    and passage.is_published = true
));

drop policy if exists "Anyone can read options of published passages" on public.reading_question_options;
create policy "Anyone can read options of published passages"
on public.reading_question_options for select to anon, authenticated
using (exists (
  select 1
  from public.reading_questions question
  join public.reading_passages passage on passage.id = question.passage_id
  where question.id = reading_question_options.question_id
    and passage.is_published = true
));

drop policy if exists "Anyone can read answers of published passages" on public.reading_question_answers;
create policy "Anyone can read answers of published passages"
on public.reading_question_answers for select to anon, authenticated
using (exists (
  select 1
  from public.reading_questions question
  join public.reading_passages passage on passage.id = question.passage_id
  where question.id = reading_question_answers.question_id
    and passage.is_published = true
));

drop policy if exists "Anyone can read vocabulary of published passages" on public.reading_passage_vocabulary;
create policy "Anyone can read vocabulary of published passages"
on public.reading_passage_vocabulary for select to anon, authenticated
using (exists (
  select 1 from public.reading_passages passage
  where passage.id = reading_passage_vocabulary.passage_id
    and passage.is_published = true
));

drop policy if exists "Users can read own reading attempts" on public.user_reading_attempts;
create policy "Users can read own reading attempts"
on public.user_reading_attempts for select to authenticated
using (user_id in (
  select id from public.profiles where auth_user_id = auth.uid()
));

drop policy if exists "Users can delete own incomplete reading attempts" on public.user_reading_attempts;
create policy "Users can delete own incomplete reading attempts"
on public.user_reading_attempts for delete to authenticated
using (
  completed_at is null
  and user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can read own reading answers" on public.user_reading_answers;
create policy "Users can read own reading answers"
on public.user_reading_answers for select to authenticated
using (exists (
  select 1
  from public.user_reading_attempts attempt
  where attempt.id = user_reading_answers.attempt_id
    and attempt.user_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
));

drop policy if exists "Users can read own saved passages" on public.user_saved_passages;
create policy "Users can read own saved passages"
on public.user_saved_passages for select to authenticated
using (user_id in (
  select id from public.profiles where auth_user_id = auth.uid()
));

drop policy if exists "Users can save published passages" on public.user_saved_passages;
create policy "Users can save published passages"
on public.user_saved_passages for insert to authenticated
with check (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
  and exists (
    select 1 from public.reading_passages passage
    where passage.id = user_saved_passages.passage_id
      and passage.is_published = true
  )
);

drop policy if exists "Users can remove own saved passages" on public.user_saved_passages;
create policy "Users can remove own saved passages"
on public.user_saved_passages for delete to authenticated
using (user_id in (
  select id from public.profiles where auth_user_id = auth.uid()
));

create or replace function public.start_reading_attempt(p_passage_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  question_total integer;
  new_attempt_id uuid;
begin
  select id into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1 from public.reading_passages
    where id = p_passage_id and is_published = true
  ) then
    raise exception 'Published passage not found';
  end if;

  select count(*)::integer into question_total
  from public.reading_questions
  where passage_id = p_passage_id;

  if question_total = 0 then
    raise exception 'Passage has no questions';
  end if;

  insert into public.user_reading_attempts (
    user_id, passage_id, total_questions
  ) values (
    current_profile_id, p_passage_id, question_total
  ) returning id into new_attempt_id;

  return new_attempt_id;
end;
$$;

create or replace function public.submit_reading_attempt(
  p_attempt_id uuid,
  p_question_ids uuid[],
  p_user_answers text[]
)
returns public.user_reading_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  target_attempt public.user_reading_attempts;
  submitted_count integer;
  submitted_correct integer;
  completed_attempt public.user_reading_attempts;
begin
  select id into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Profile not found';
  end if;

  if p_question_ids is null
    or p_user_answers is null
    or cardinality(p_question_ids) <> cardinality(p_user_answers) then
    raise exception 'Question and answer arrays must have the same length';
  end if;

  select * into target_attempt
  from public.user_reading_attempts
  where id = p_attempt_id and user_id = current_profile_id
  for update;

  if target_attempt.id is null then
    raise exception 'Reading attempt not found';
  end if;

  if target_attempt.completed_at is not null then
    raise exception 'Reading attempt has already been submitted';
  end if;

  select count(distinct submitted.question_id)::integer
  into submitted_count
  from unnest(p_question_ids) submitted(question_id)
  join public.reading_questions question
    on question.id = submitted.question_id
   and question.passage_id = target_attempt.passage_id;

  if submitted_count <> target_attempt.total_questions
    or cardinality(p_question_ids) <> target_attempt.total_questions then
    raise exception 'Every passage question must be answered exactly once';
  end if;

  insert into public.user_reading_answers (
    attempt_id,
    question_id,
    user_answer,
    is_correct
  )
  select
    target_attempt.id,
    submitted.question_id,
    coalesce(submitted.user_answer, ''),
    exists (
      select 1
      from public.reading_question_answers answer
      where answer.question_id = submitted.question_id
        and lower(btrim(answer.answer_text)) = lower(btrim(coalesce(submitted.user_answer, '')))
    )
  from unnest(p_question_ids, p_user_answers)
    as submitted(question_id, user_answer);

  select count(*) filter (where is_correct)::integer
  into submitted_correct
  from public.user_reading_answers
  where attempt_id = target_attempt.id;

  update public.user_reading_attempts
  set
    completed_at = now(),
    time_taken_seconds = greatest(
      0,
      floor(extract(epoch from (now() - started_at)))::integer
    ),
    correct_count = submitted_correct
  where id = target_attempt.id
  returning * into completed_attempt;

  return completed_attempt;
end;
$$;

revoke all on function public.start_reading_attempt(uuid) from public;
grant execute on function public.start_reading_attempt(uuid) to authenticated;
revoke all on function public.submit_reading_attempt(uuid, uuid[], text[]) from public;
grant execute on function public.submit_reading_attempt(uuid, uuid[], text[]) to authenticated;

