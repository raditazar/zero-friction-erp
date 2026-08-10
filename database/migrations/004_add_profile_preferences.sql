alter table profiles
  add column if not exists locale text not null default 'id',
  add column if not exists date_format text not null default 'DD/MM/YYYY',
  add column if not exists default_currency text not null default 'IDR';
