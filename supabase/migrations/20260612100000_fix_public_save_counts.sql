create or replace function public.count_vocabulary_node_saves(target_node_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.vocabulary_saved_nodes saved
  where saved.node_id = target_node_id;
$$;

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
  public.count_vocabulary_node_saves(n.id) as save_count
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
