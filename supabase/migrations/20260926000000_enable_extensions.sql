-- M0: Postgres extensions the plan relies on (docs/implementation-plan.md §4).

-- Exclusion constraints on (aircraft_id, period) to prevent double bookings (§4.1).
create extension if not exists btree_gist with schema extensions;

-- Geography points and radius search for airports and aircraft (§4.7).
create extension if not exists postgis with schema extensions;

-- Scheduled jobs: expire requests, publish reviews, document expiry (§4.6).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
