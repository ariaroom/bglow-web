-- Guestbook reviews for Love's Last Letter.
-- Run in the Supabase SQL Editor (same as schema.sql).

create table if not exists reviews (
    id          uuid primary key default gen_random_uuid(),
    chapter     text,
    comment     text not null check (char_length(comment) between 1 and 2000),
    name        text check (char_length(name) <= 120),
    allow_quote boolean not null default true,
    created_at  timestamptz not null default now()
);

-- Service key only: RLS on with no policies blocks the public anon key.
alter table reviews enable row level security;

-- v2: five-point "would you recommend" scale.
alter table reviews add column if not exists recommend smallint
    check (recommend between 1 and 5);

-- v3: optional improvement feedback (internal use).
alter table reviews add column if not exists feedback text
    check (char_length(feedback) <= 2000);
