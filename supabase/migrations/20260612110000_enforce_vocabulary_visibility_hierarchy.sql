-- Preserve each node's stored visibility and calculate effective visibility
-- from the most restrictive visibility in its ancestor chain.

drop trigger if exists cascade_private_vocabulary_folder on public.vocabulary_nodes;
drop trigger if exists enforce_vocabulary_parent_visibility on public.vocabulary_nodes;
drop function if exists public.cascade_private_vocabulary_folder();
drop function if exists public.enforce_vocabulary_parent_visibility();

create or replace function public.vocabulary_effective_visibility(target_node_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with recursive lineage as (
    select node.id, node.parent_id, node.visibility
    from public.vocabulary_nodes node
    where node.id = target_node_id

    union all

    select parent.id, parent.parent_id, parent.visibility
    from public.vocabulary_nodes parent
    join lineage child on child.parent_id = parent.id
  )
  select case
    when bool_or(visibility = 'private') then 'private'
    when bool_or(visibility = 'unlisted') then 'unlisted'
    else 'public'
  end
  from lineage;
$$;

drop policy if exists "Users can read own and shared vocabulary nodes" on public.vocabulary_nodes;
create policy "Users can read own and effectively shared vocabulary nodes"
on public.vocabulary_nodes
for select
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
  or public.vocabulary_effective_visibility(id) in ('public', 'unlisted')
);

drop policy if exists "Users can read public vocabulary decks" on public.decks;
create policy "Users can read effectively shared vocabulary decks"
on public.decks
for select
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = decks.id
      and node.type = 'deck'
      and public.vocabulary_effective_visibility(node.id) in ('public', 'unlisted')
  )
);

drop policy if exists "Users can read cards in public vocabulary decks" on public.cards;
create policy "Users can read cards in effectively shared vocabulary decks"
on public.cards
for select
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = cards.deck_id
      and node.type = 'deck'
      and public.vocabulary_effective_visibility(node.id) in ('public', 'unlisted')
  )
);

drop policy if exists "Users can read own and shared vocabulary cards" on public.vocabulary_cards;
create policy "Users can read own and effectively shared vocabulary cards"
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
        or public.vocabulary_effective_visibility(deck.id) in ('public', 'unlisted')
      )
  )
);

drop policy if exists "Users can save public vocabulary nodes" on public.vocabulary_saved_nodes;
create policy "Users can save effectively public vocabulary nodes"
on public.vocabulary_saved_nodes
for insert
to authenticated
with check (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = vocabulary_saved_nodes.node_id
      and public.vocabulary_effective_visibility(node.id) = 'public'
      and node.user_id <> vocabulary_saved_nodes.user_id
  )
);

drop policy if exists "Users can create vocabulary reports" on public.vocabulary_reports;
create policy "Users can report effectively public vocabulary nodes"
on public.vocabulary_reports
for insert
to authenticated
with check (
  reporter_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = vocabulary_reports.node_id
      and public.vocabulary_effective_visibility(node.id) = 'public'
  )
);

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
      node.id,
      node.parent_id,
      gen_random_uuid() as new_id,
      0 as depth
    from public.vocabulary_nodes node
    where node.id = source_node_id
      and public.vocabulary_effective_visibility(node.id) = 'public'

    union all

    select
      child.id,
      child.parent_id,
      gen_random_uuid() as new_id,
      parent.depth + 1
    from public.vocabulary_nodes child
    join source_tree parent on child.parent_id = parent.id
    where public.vocabulary_effective_visibility(child.id) = 'public'
  )
  select id, parent_id, new_id, depth from source_tree;

  if not exists (
    select 1 from pg_temp.vocabulary_copy_map where old_id = source_node_id
  ) then
    raise exception 'Source node is not effectively public or does not exist';
  end if;

  insert into public.vocabulary_nodes (
    id, user_id, parent_id, title, description, type, visibility,
    level, category, tags, order_index
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
  left join pg_temp.vocabulary_copy_map parent_map
    on parent_map.old_id = map.old_parent_id
  order by map.depth;

  select new_id into new_root_id
  from pg_temp.vocabulary_copy_map
  where old_id = source_node_id;

  insert into public.decks (
    id,
    user_id,
    name,
    description
  )
  select
    map.new_id,
    target_user_id,
    source.title,
    source.description
  from pg_temp.vocabulary_copy_map map
  join public.vocabulary_nodes source on source.id = map.old_id
  where source.type = 'deck';

  insert into public.cards (
    deck_id, word, phonetic, part_of_speech, vietnamese_meaning,
    english_example, vietnamese_example, synonyms, antonyms,
    collocations, image_url, order_index
  )
  select
    map.new_id,
    card.word,
    card.phonetic,
    card.part_of_speech,
    card.vietnamese_meaning,
    card.english_example,
    card.vietnamese_example,
    card.synonyms,
    card.antonyms,
    card.collocations,
    card.image_url,
    card.order_index
  from public.cards card
  join pg_temp.vocabulary_copy_map map on map.old_id = card.deck_id;

  return new_root_id;
end;
$$;

grant execute on function public.vocabulary_effective_visibility(uuid)
to authenticated;

grant execute on function public.copy_vocabulary_node_tree(uuid, uuid, uuid)
to authenticated;

notify pgrst, 'reload schema';
