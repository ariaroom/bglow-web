-- Run in the Supabase SQL editor. Safe to run more than once.

-- 1) No per-order cap (session capacity is the only limit)
alter table holds drop constraint if exists holds_quantity_check;
alter table holds add constraint holds_quantity_check check (quantity >= 1);

-- 2) Refund tracking
alter table holds add column if not exists stripe_payment_intent text;

alter table holds drop constraint if exists holds_status_check;
alter table holds add constraint holds_status_check
    check (status in ('pending', 'paid', 'expired', 'refunded'));

create index if not exists holds_pi_idx on holds (stripe_payment_intent);

-- 3) Lock the tables down. Our API uses the secret key (bypasses RLS);
--    with RLS on and no policies, the public anon/publishable key gets nothing.
alter table sessions enable row level security;
alter table holds    enable row level security;
