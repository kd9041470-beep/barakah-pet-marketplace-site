-- Private report inbox for the public, account-free marketplace.
-- Browser visitors may insert reports; browser roles cannot select, update, or delete them.
create table if not exists public.market_listing_reports (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid references public.market_listings(id) on delete set null,
    listing_title text not null check (char_length(btrim(listing_title)) between 1 and 100),
    reason text not null check (reason in ('spam', 'misleading', 'animal_welfare', 'privacy', 'remove_request', 'other')),
    details text check (details is null or char_length(details) <= 500),
    reporter_contact text check (reporter_contact is null or char_length(reporter_contact) <= 120),
    created_at timestamptz not null default now()
);

create index if not exists market_listing_reports_created_at_idx
    on public.market_listing_reports (created_at desc);
create index if not exists market_listing_reports_listing_idx
    on public.market_listing_reports (listing_id, created_at desc);

alter table public.market_listing_reports enable row level security;
revoke all on public.market_listing_reports from anon, authenticated;
grant insert (listing_id, listing_title, reason, details, reporter_contact)
    on public.market_listing_reports to anon, authenticated;

drop policy if exists market_listing_reports_submit on public.market_listing_reports;
create policy market_listing_reports_submit
    on public.market_listing_reports for insert to anon, authenticated
    with check (
        char_length(btrim(listing_title)) between 1 and 100
        and (details is null or char_length(details) <= 500)
        and (reporter_contact is null or char_length(reporter_contact) <= 120)
        and reason in ('spam', 'misleading', 'animal_welfare', 'privacy', 'remove_request', 'other')
        and (
            listing_id is null
            or exists (
                select 1 from public.market_listings as listing
                where listing.id = listing_id and listing.status = 'active'
            )
        )
    );

comment on table public.market_listing_reports is
    'Private reports about public marketplace listings. Anonymous clients may submit; only project administrators can review them in Supabase.';
