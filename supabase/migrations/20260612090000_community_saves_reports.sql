create table if not exists public.vocabulary_saved_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  node_id uuid not null references public.vocabulary_nodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, node_id)
);

create index if not exists vocabulary_saved_nodes_user_idx
  on public.vocabulary_saved_nodes(user_id, created_at desc);

create index if not exists vocabulary_saved_nodes_node_idx
  on public.vocabulary_saved_nodes(node_id);

alter table public.vocabulary_saved_nodes enable row level security;

drop policy if exists "Users can read own saved vocabulary nodes" on public.vocabulary_saved_nodes;
create policy "Users can read own saved vocabulary nodes"
on public.vocabulary_saved_nodes
for select
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can save public vocabulary nodes" on public.vocabulary_saved_nodes;
create policy "Users can save public vocabulary nodes"
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
      and node.visibility = 'public'
      and node.user_id <> vocabulary_saved_nodes.user_id
  )
);

drop policy if exists "Users can remove own saved vocabulary nodes" on public.vocabulary_saved_nodes;
create policy "Users can remove own saved vocabulary nodes"
on public.vocabulary_saved_nodes
for delete
to authenticated
using (
  user_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

create table if not exists public.vocabulary_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  node_id uuid not null references public.vocabulary_nodes(id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists vocabulary_reports_node_idx
  on public.vocabulary_reports(node_id, created_at desc);

alter table public.vocabulary_reports enable row level security;

drop policy if exists "Users can create vocabulary reports" on public.vocabulary_reports;
create policy "Users can create vocabulary reports"
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
      and node.visibility = 'public'
  )
);

drop policy if exists "Users can read own vocabulary reports" on public.vocabulary_reports;
create policy "Users can read own vocabulary reports"
on public.vocabulary_reports
for select
to authenticated
using (
  reporter_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  )
);

drop policy if exists "Users can read public vocabulary decks" on public.decks;
create policy "Users can read public vocabulary decks"
on public.decks
for select
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = decks.id
      and node.type = 'deck'
      and node.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "Users can read cards in public vocabulary decks" on public.cards;
create policy "Users can read cards in public vocabulary decks"
on public.cards
for select
to authenticated
using (
  exists (
    select 1
    from public.vocabulary_nodes node
    where node.id = cards.deck_id
      and node.type = 'deck'
      and node.visibility in ('public', 'unlisted')
  )
);

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
  coalesce(review_stats.due_count, 0)::integer as due_count,
  coalesce(save_stats.save_count, 0)::integer as save_count
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
) descendant_cards on true
left join lateral (
  select count(*) as save_count
  from public.vocabulary_saved_nodes saved
  where saved.node_id = n.id
) save_stats on true;
