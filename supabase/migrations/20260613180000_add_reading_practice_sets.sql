-- Extend Reading V1 with standalone passage positions and full IELTS tests.

alter table public.reading_passages
  add column if not exists passage_number smallint;

alter table public.reading_passages
  add column if not exists is_standalone boolean not null default true;

alter table public.reading_passages
  drop constraint if exists reading_passages_passage_number_check;

alter table public.reading_passages
  add constraint reading_passages_passage_number_check
  check (passage_number is null or passage_number between 1 and 3);

create table if not exists public.reading_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  topic text not null default 'Mixed' check (btrim(topic) <> ''),
  difficulty numeric(2,1) not null check (
    difficulty in (5.0, 5.5, 6.0, 6.5, 7.0, 8.0)
  ),
  estimated_time integer not null default 60 check (estimated_time > 0),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table if not exists public.reading_test_passages (
  test_id uuid not null references public.reading_tests(id) on delete cascade,
  passage_id uuid not null references public.reading_passages(id) on delete restrict,
  passage_number smallint not null check (passage_number between 1 and 3),
  primary key (test_id, passage_number),
  unique (test_id, passage_id)
);

create index if not exists reading_passages_standalone_filters_idx
  on public.reading_passages(passage_number, topic, difficulty, published_at desc)
  where is_published = true and is_standalone = true;

create index if not exists reading_tests_published_filters_idx
  on public.reading_tests(topic, difficulty, published_at desc)
  where is_published = true;

create index if not exists reading_test_passages_passage_idx
  on public.reading_test_passages(passage_id);

create or replace function public.touch_reading_tests_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_reading_tests_updated_at on public.reading_tests;
create trigger touch_reading_tests_updated_at
before update on public.reading_tests
for each row execute function public.touch_reading_tests_updated_at();

alter table public.reading_tests enable row level security;
alter table public.reading_test_passages enable row level security;

drop policy if exists "Anyone can read published reading tests" on public.reading_tests;
create policy "Anyone can read published reading tests"
on public.reading_tests for select to anon, authenticated
using (is_published = true);

drop policy if exists "Anyone can read passages in published reading tests"
  on public.reading_test_passages;
create policy "Anyone can read passages in published reading tests"
on public.reading_test_passages for select to anon, authenticated
using (exists (
  select 1
  from public.reading_tests test
  where test.id = reading_test_passages.test_id
    and test.is_published = true
));

