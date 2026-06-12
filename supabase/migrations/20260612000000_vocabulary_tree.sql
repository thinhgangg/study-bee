-- Vocabulary tree migration for StudyBee.
-- This keeps existing decks/cards data and adds a folder/deck node layer.

create table if not exists public.vocabulary_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.vocabulary_nodes(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('folder', 'deck')),
  visibility text not null default 'private' check (visibility in ('private', 'public', 'unlisted')),
  level text,
  category text,
  tags text[] not null default '{}',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vocabulary_nodes_user_parent_idx
  on public.vocabulary_nodes(user_id, parent_id, order_index);

create index if not exists vocabulary_nodes_visibility_parent_idx
  on public.vocabulary_nodes(visibility, parent_id, order_index);

alter table public.vocabulary_nodes enable row level security;

drop policy if exists "Users can read own and shared vocabulary nodes" on public.vocabulary_nodes;
create policy "Users can read own and shared vocabulary nodes"
on public.vocabulary_nodes
for select
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
  or visibility in ('public', 'unlisted')
);

drop policy if exists "Users can create own vocabulary nodes" on public.vocabulary_nodes;
create policy "Users can create own vocabulary nodes"
on public.vocabulary_nodes
for insert
to authenticated
with check (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can update own vocabulary nodes" on public.vocabulary_nodes;
create policy "Users can update own vocabulary nodes"
on public.vocabulary_nodes
for update
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
)
with check (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own vocabulary nodes" on public.vocabulary_nodes;
create policy "Users can delete own vocabulary nodes"
on public.vocabulary_nodes
for delete
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

create or replace function public.touch_vocabulary_nodes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_vocabulary_nodes_updated_at on public.vocabulary_nodes;
create trigger touch_vocabulary_nodes_updated_at
before update on public.vocabulary_nodes
for each row
execute function public.touch_vocabulary_nodes_updated_at();

-- New canonical card table. Existing app screens can keep using public.cards.
create table if not exists public.vocabulary_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.vocabulary_nodes(id) on delete cascade,
  word text not null,
  meaning_vi text,
  definition_en text,
  ipa text,
  part_of_speech text,
  example_en text,
  example_vi text,
  image_url text,
  audio_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vocabulary_cards_deck_idx
  on public.vocabulary_cards(deck_id, created_at);

alter table public.vocabulary_cards enable row level security;

drop policy if exists "Users can read own and shared vocabulary cards" on public.vocabulary_cards;
create policy "Users can read own and shared vocabulary cards"
on public.vocabulary_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes deck
    where deck.id = vocabulary_cards.deck_id
      and deck.type = 'deck'
      and (
        deck.user_id in (
          select id from public.profiles where auth_user_id = auth.uid()
        )
        or deck.visibility in ('public', 'unlisted')
      )
  )
);

drop policy if exists "Users can create cards in own vocabulary decks" on public.vocabulary_cards;
create policy "Users can create cards in own vocabulary decks"
on public.vocabulary_cards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vocabulary_nodes deck
    where deck.id = vocabulary_cards.deck_id
      and deck.type = 'deck'
      and deck.user_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
  )
);

drop policy if exists "Users can update cards in own vocabulary decks" on public.vocabulary_cards;
create policy "Users can update cards in own vocabulary decks"
on public.vocabulary_cards
for update
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes deck
    where deck.id = vocabulary_cards.deck_id
      and deck.type = 'deck'
      and deck.user_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.vocabulary_nodes deck
    where deck.id = vocabulary_cards.deck_id
      and deck.type = 'deck'
      and deck.user_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
  )
);

drop policy if exists "Users can delete cards in own vocabulary decks" on public.vocabulary_cards;
create policy "Users can delete cards in own vocabulary decks"
on public.vocabulary_cards
for delete
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes deck
    where deck.id = vocabulary_cards.deck_id
      and deck.type = 'deck'
      and deck.user_id in (
        select id from public.profiles where auth_user_id = auth.uid()
      )
  )
);

-- Preserve old decks by representing each as a root deck node with the same id.
insert into public.vocabulary_nodes (
  id,
  user_id,
  parent_id,
  title,
  description,
  type,
  visibility,
  created_at,
  updated_at
)
select
  d.id,
  d.user_id,
  null,
  d.name,
  d.description,
  'deck',
  'private',
  d.created_at,
  d.created_at
from public.decks d
on conflict (id) do update
set
  user_id = excluded.user_id,
  title = excluded.title,
  description = excluded.description,
  type = 'deck',
  updated_at = greatest(public.vocabulary_nodes.updated_at, excluded.updated_at);

create or replace function public.sync_deck_to_vocabulary_node()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.vocabulary_nodes (
    id,
    user_id,
    parent_id,
    title,
    description,
    type,
    visibility,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.user_id,
    null,
    new.name,
    new.description,
    'deck',
    'private',
    new.created_at,
    now()
  )
  on conflict (id) do update
  set
    title = excluded.title,
    description = excluded.description,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists sync_deck_to_vocabulary_node on public.decks;
create trigger sync_deck_to_vocabulary_node
after insert or update on public.decks
for each row
execute function public.sync_deck_to_vocabulary_node();

create or replace function public.delete_deck_for_vocabulary_node()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.type = 'deck' then
    delete from public.decks where id = old.id;
  end if;

  return old;
end;
$$;

drop trigger if exists delete_deck_for_vocabulary_node on public.vocabulary_nodes;
create trigger delete_deck_for_vocabulary_node
after delete on public.vocabulary_nodes
for each row
execute function public.delete_deck_for_vocabulary_node();

create or replace view public.vocabulary_node_stats
with (security_invoker = true) as
select
  n.*,
  coalesce(children.folder_count, 0)::integer as child_folder_count,
  coalesce(children.deck_count, 0)::integer as child_deck_count,
  coalesce(legacy_cards.card_count, 0)::integer as card_count,
  case
    when n.type = 'deck' then coalesce(legacy_cards.card_count, 0)::integer
    else coalesce(descendant_cards.total_card_count, 0)::integer
  end as total_card_count,
  coalesce(review_stats.studied_count, 0)::integer as studied_count,
  coalesce(review_stats.due_count, 0)::integer as due_count
from public.vocabulary_nodes n
left join lateral (
  select
    count(*) filter (where c.type = 'folder') as folder_count,
    count(*) filter (where c.type = 'deck') as deck_count
  from public.vocabulary_nodes c
  where c.parent_id = n.id
) children on true
left join lateral (
  select count(*) as card_count
  from public.cards c
  where c.deck_id = n.id
) legacy_cards on true
left join lateral (
  select
    count(distinct r.card_id) filter (where r.reviewed_at is not null) as studied_count,
    count(distinct r.card_id) filter (
      where r.next_review_at is not null and r.next_review_at <= now()
    ) as due_count
  from public.cards c
  left join public.card_reviews r
    on r.card_id = c.id
   and r.user_id = n.user_id
  where c.deck_id = n.id
) review_stats on true
left join lateral (
  with recursive tree as (
    select d.id, d.type
    from public.vocabulary_nodes d
    where d.parent_id = n.id
    union all
    select child.id, child.type
    from public.vocabulary_nodes child
    join tree parent on child.parent_id = parent.id
  )
  select count(c.*) as total_card_count
  from tree
  join public.cards c on c.deck_id = tree.id
  where tree.type = 'deck'
) descendant_cards on true;

create or replace function public.copy_vocabulary_node_tree(
  source_node_id uuid,
  target_user_id uuid,
  target_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_root_id uuid;
begin
  if target_user_id not in (
    select id from public.profiles where auth_user_id = auth.uid()
  ) then
    raise exception 'Cannot copy vocabulary tree into another user account';
  end if;

  create temporary table if not exists pg_temp.vocabulary_copy_map (
    old_id uuid primary key,
    old_parent_id uuid,
    new_id uuid not null,
    depth integer not null
  ) on commit drop;

  truncate table pg_temp.vocabulary_copy_map;

  insert into pg_temp.vocabulary_copy_map (old_id, old_parent_id, new_id, depth)
  with recursive source_tree as (
    select
      n.id,
      n.parent_id,
      gen_random_uuid() as new_id,
      0 as depth
    from public.vocabulary_nodes n
    where n.id = source_node_id and n.visibility = 'public'
    union all
    select
      child.id,
      child.parent_id,
      gen_random_uuid() as new_id,
      parent.depth + 1
    from public.vocabulary_nodes child
    join source_tree parent on child.parent_id = parent.id
  )
  select id, parent_id, new_id, depth from source_tree;

  if not exists (select 1 from pg_temp.vocabulary_copy_map where old_id = source_node_id) then
    raise exception 'Source node is not public or does not exist';
  end if;

  insert into public.vocabulary_nodes (
    id,
    user_id,
    parent_id,
    title,
    description,
    type,
    visibility,
    level,
    category,
    tags,
    order_index
  )
  select
    map.new_id,
    target_user_id,
    case
      when map.old_id = source_node_id then target_parent_id
      else parent_map.new_id
    end,
    source.title,
    source.description,
    source.type,
    'private',
    source.level,
    source.category,
    source.tags,
    source.order_index
  from pg_temp.vocabulary_copy_map map
  join public.vocabulary_nodes source on source.id = map.old_id
  left join pg_temp.vocabulary_copy_map parent_map on parent_map.old_id = map.old_parent_id
  order by map.depth;

  select new_id into new_root_id
  from pg_temp.vocabulary_copy_map
  where old_id = source_node_id;

  insert into public.cards (
    deck_id,
    word,
    phonetic,
    part_of_speech,
    vietnamese_meaning,
    english_example,
    vietnamese_example,
    synonyms,
    antonyms,
    collocations,
    image_url,
    order_index
  )
  select
    map.new_id,
    c.word,
    c.phonetic,
    c.part_of_speech,
    c.vietnamese_meaning,
    c.english_example,
    c.vietnamese_example,
    c.synonyms,
    c.antonyms,
    c.collocations,
    c.image_url,
    c.order_index
  from public.cards c
  join pg_temp.vocabulary_copy_map map on map.old_id = c.deck_id;

  return new_root_id;
end;
$$;
