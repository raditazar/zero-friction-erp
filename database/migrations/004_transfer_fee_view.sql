-- Migration 004: Add admin_fee to transactions and update wallet_balances view
begin;

alter table transactions
  add column if not exists admin_fee numeric(18, 2) not null default 0 constraint transactions_admin_fee_non_negative check (admin_fee >= 0);

create or replace view wallet_balances as
select
  w.id,
  w.user_id,
  w.name,
  w.category,
  w.currency,
  w.init_balance
    + coalesce(sum(
      case
        when t.status <> 'approved' then 0
        when t.type in ('income', 'adjustment') and t.wallet_id = w.id then t.amount
        when t.type = 'expense' and t.wallet_id = w.id then -t.amount
        when t.type = 'transfer' and t.wallet_id = w.id then -(t.amount + coalesce(t.admin_fee, 0))
        when t.type = 'transfer' and t.destination_wallet_id = w.id then t.amount
        else 0
      end
    ), 0) as curr_balance
from wallets w
left join transactions t
  on (t.wallet_id = w.id or t.destination_wallet_id = w.id)
  and t.deleted_at is null
where w.deleted_at is null
group by w.id;

commit;
