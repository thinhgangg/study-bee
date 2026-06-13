alter table public.card_reviews
  add column if not exists ease_factor numeric(4, 2) not null default 2.5;

alter table public.card_reviews
  add constraint card_reviews_ease_factor_check
  check (ease_factor >= 1.3);
