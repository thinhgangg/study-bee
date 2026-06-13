alter table public.daily_study_activity
  add column if not exists due_count_at_start integer not null default 0;

-- Repair rows created by the previous dynamic-goal logic.
update public.daily_study_activity
set due_count_at_start = reviewed_count
where goal_completed = true
  and reviewed_count > 0
  and (
    due_count_at_start = 0
    or due_count_at_start > reviewed_count
  );

create or replace function public.initialize_daily_study_activity(
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  effective_timezone text;
  current_activity_date date;
  current_due_count integer;
begin
  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select name
  into effective_timezone
  from pg_timezone_names
  where name = p_timezone;

  effective_timezone := coalesce(effective_timezone, 'UTC');
  current_activity_date := (now() at time zone effective_timezone)::date;

  select count(*)::integer
  into current_due_count
  from public.card_reviews review
  where review.user_id = current_profile_id
    and review.next_review_at is not null
    and review.next_review_at <= now();

  insert into public.daily_study_activity (
    user_id,
    activity_date,
    reviewed_count,
    due_count_at_start,
    goal_completed,
    timezone
  )
  values (
    current_profile_id,
    current_activity_date,
    0,
    current_due_count,
    false,
    effective_timezone
  )
  on conflict (user_id, activity_date) do nothing;
end;
$$;

create or replace function public.record_daily_study_activity(
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
  effective_timezone text;
  current_activity_date date;
  current_due_count integer;
begin
  select id
  into current_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if current_profile_id is null then
    raise exception 'Profile not found';
  end if;

  select name
  into effective_timezone
  from pg_timezone_names
  where name = p_timezone;

  effective_timezone := coalesce(effective_timezone, 'UTC');
  current_activity_date := (now() at time zone effective_timezone)::date;

  select count(*)::integer
  into current_due_count
  from public.card_reviews review
  where review.user_id = current_profile_id
    and review.next_review_at is not null
    and review.next_review_at <= now();

  insert into public.daily_study_activity (
    user_id,
    activity_date,
    reviewed_count,
    due_count_at_start,
    goal_completed,
    timezone
  )
  values (
    current_profile_id,
    current_activity_date,
    1,
    current_due_count,
    current_due_count <= 1,
    effective_timezone
  )
  on conflict (user_id, activity_date)
  do update set
    reviewed_count = daily_study_activity.reviewed_count + 1,
    goal_completed = daily_study_activity.goal_completed
      or daily_study_activity.due_count_at_start = 0
      or daily_study_activity.reviewed_count + 1
        >= daily_study_activity.due_count_at_start,
    timezone = excluded.timezone,
    updated_at = now();
end;
$$;

revoke all on function public.record_daily_study_activity(text) from public;
grant execute on function public.record_daily_study_activity(text)
  to authenticated;

revoke all on function public.initialize_daily_study_activity(text) from public;
grant execute on function public.initialize_daily_study_activity(text)
  to authenticated;
