-- Migration 013: per-user request counters for paid endpoints (Gemini extraction and
-- categorisation). Fixed windows; the API deletes a user's rows older than a day as it goes.
-- Until this runs, the API logs a warning and allows the request.
begin;

create table if not exists api_rate_limits (
  user_id uuid not null references users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);

commit;
