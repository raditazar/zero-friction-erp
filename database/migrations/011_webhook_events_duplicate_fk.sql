-- Migration 011: webhook_events.duplicate_of_id holds the id of the original TRANSACTION
-- (that is what the dedup engine returns), but 008 pointed the foreign key at webhook_events,
-- so every insert for a detected duplicate violated it. Re-point the key. Idempotent.
begin;

alter table webhook_events drop constraint if exists webhook_events_duplicate_of_id_fkey;

update webhook_events
set duplicate_of_id = null
where duplicate_of_id is not null
  and not exists (select 1 from transactions t where t.id = webhook_events.duplicate_of_id);

alter table webhook_events
  add constraint webhook_events_duplicate_of_id_fkey
  foreign key (duplicate_of_id) references transactions(id) on delete set null;

commit;
