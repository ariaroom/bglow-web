-- =====================================================================
-- Love's Last Letter — ticketing schema (Supabase / Postgres)
-- Run this once in the Supabase SQL editor.
-- =====================================================================

-- ---------- Sessions (12 total: Aug 30 x7, Aug 31 x5) ----------
create table if not exists sessions (
    id            text primary key,          -- '2026-08-30-1100'
    session_date  date        not null,
    day_label     text        not null,      -- 'Sunday, August 30, 2026'
    time_label    text        not null,      -- '11:00 AM – 12:00 PM'
    sort_order    int         not null,
    is_finale     boolean     not null default false,
    capacity      int         not null default 9
);

-- ---------- Holds / orders ----------
-- A row is created the moment someone starts checkout ("pending"), which
-- reserves the spots. The webhook flips it to "paid" or "expired".
create table if not exists holds (
    id                uuid primary key default gen_random_uuid(),
    session_id        text        not null references sessions (id),
    quantity          int         not null check (quantity >= 1),
    early_bird_qty    int         not null default 0,
    general_qty       int         not null default 0,
    status            text        not null default 'pending'
                                  check (status in ('pending', 'paid', 'expired', 'refunded')),
    stripe_session_id text unique,
    stripe_payment_intent text,
    customer_email    text,
    expires_at        timestamptz not null,
    created_at        timestamptz not null default now(),
    paid_at           timestamptz
);

-- Idempotent upgrades: `create table if not exists` above does nothing when the
-- table already exists, so bring older tables up to date explicitly.
alter table holds add column if not exists stripe_payment_intent text;
alter table holds add column if not exists general_qty int not null default 0;

alter table holds drop constraint if exists holds_quantity_check;
alter table holds add constraint holds_quantity_check check (quantity >= 1);

alter table holds drop constraint if exists holds_status_check;
alter table holds add constraint holds_status_check
    check (status in ('pending', 'paid', 'expired', 'refunded'));

create index if not exists holds_session_idx on holds (session_id);
create index if not exists holds_status_idx on holds (status);
create index if not exists holds_pi_idx on holds (stripe_payment_intent);

-- ---------- Row Level Security ----------
-- Every read/write goes through our serverless functions using the SECRET key,
-- which bypasses RLS. Enabling RLS with NO policies therefore blocks the public
-- publishable/anon key completely while leaving the API untouched.
alter table sessions enable row level security;
alter table holds    enable row level security;

-- A hold counts against inventory while it is paid, or pending and unexpired.
create or replace view live_holds as
select *
from holds
where status = 'paid'
   or (status = 'pending' and expires_at > now());

-- Clean up the earlier name of this function, if an older version of this
-- schema was already run. Safe to run when it never existed.
drop function if exists reserve_seats(text, int, int, int);

-- =====================================================================
-- reserve_spots: the ONLY way spots get taken.
-- Serialized with an advisory lock so simultaneous buyers can never
-- oversell a session or push Early Bird past its global cap.
-- =====================================================================
create or replace function reserve_spots(
    p_session_id       text,
    p_quantity         int,
    p_early_bird_total int,
    p_hold_minutes     int
)
returns table (hold_id uuid, early_bird_qty int, general_qty int)
language plpgsql
as $$
declare
    v_capacity     int;
    v_taken        int;
    v_eb_sold      int;
    v_eb_remaining int;
    v_eb           int;
    v_gen          int;
    v_hold         uuid;
begin
    -- Global lock: all reservations run one at a time (volume here is tiny).
    perform pg_advisory_xact_lock(20260830);

    select capacity into v_capacity from sessions where id = p_session_id;
    if v_capacity is null then
        raise exception 'unknown_session';
    end if;

    -- No per-person cap; capacity below is the only ceiling.
    if p_quantity < 1 then
        raise exception 'invalid_quantity';
    end if;

    -- Columns are table-qualified: the RETURNS TABLE names (early_bird_qty,
    -- general_qty) would otherwise be ambiguous against live_holds' columns.
    select coalesce(sum(live_holds.quantity), 0) into v_taken
    from live_holds
    where live_holds.session_id = p_session_id;

    if v_taken + p_quantity > v_capacity then
        raise exception 'sold_out';
    end if;

    -- Early Bird is capped across every session combined.
    select coalesce(sum(live_holds.early_bird_qty), 0) into v_eb_sold from live_holds;

    v_eb_remaining := greatest(0, p_early_bird_total - v_eb_sold);
    v_eb  := least(p_quantity, v_eb_remaining);
    v_gen := p_quantity - v_eb;

    insert into holds (session_id, quantity, early_bird_qty, general_qty,
                       status, expires_at)
    values (p_session_id, p_quantity, v_eb, v_gen,
            'pending', now() + make_interval(mins => p_hold_minutes))
    returning id into v_hold;

    return query select v_hold, v_eb, v_gen;
end;
$$;

-- =====================================================================
-- Seed the 12 sessions
-- =====================================================================
insert into sessions (id, session_date, day_label, time_label, sort_order, is_finale, capacity) values
    ('2026-08-30-1100', '2026-08-30', 'Sunday, August 30, 2026',  '11:00 AM – 12:00 PM',  1, false, 9),
    ('2026-08-30-1220', '2026-08-30', 'Sunday, August 30, 2026',  '12:20 PM – 1:20 PM',   2, false, 9),
    ('2026-08-30-1400', '2026-08-30', 'Sunday, August 30, 2026',  '2:00 PM – 3:00 PM',    3, false, 9),
    ('2026-08-30-1520', '2026-08-30', 'Sunday, August 30, 2026',  '3:20 PM – 4:20 PM',    4, false, 9),
    ('2026-08-30-1640', '2026-08-30', 'Sunday, August 30, 2026',  '4:40 PM – 5:40 PM',    5, false, 9),
    ('2026-08-30-1800', '2026-08-30', 'Sunday, August 30, 2026',  '6:00 PM – 7:00 PM',    6, false, 9),
    ('2026-08-30-1920', '2026-08-30', 'Sunday, August 30, 2026',  '7:20 PM – 8:20 PM',    7, false, 9),
    ('2026-08-31-1100', '2026-08-31', 'Monday, August 31, 2026',  '11:00 AM – 12:00 PM',  8, false, 9),
    ('2026-08-31-1220', '2026-08-31', 'Monday, August 31, 2026',  '12:20 PM – 1:20 PM',   9, false, 9),
    ('2026-08-31-1400', '2026-08-31', 'Monday, August 31, 2026',  '2:00 PM – 3:00 PM',   10, false, 9),
    ('2026-08-31-1520', '2026-08-31', 'Monday, August 31, 2026',  '3:20 PM – 4:20 PM',   11, false, 9),
    ('2026-08-31-1640', '2026-08-31', 'Monday, August 31, 2026',  '4:40 PM – 5:40 PM',   12, true,  9)
on conflict (id) do nothing;
