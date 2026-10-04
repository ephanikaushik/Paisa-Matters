-- Paisa Matters — Supabase schema (Build Spec §5)
create table shop (id text primary key, name text not null, owner_name text, created_at timestamptz default now());
create table sku (id serial primary key, name text unique not null, category text, unit text, ref_price_low numeric, ref_price_high numeric); -- reference prices, not peer data
create table supplier (id serial primary key, shop_id text references shop(id), name text not null, unique (shop_id, name));
create table txn (
  id bigserial primary key, shop_id text references shop(id), date date not null,
  type text not null check (type in ('sale','purchase','expense','udhaar_given','udhaar_received')),
  amount_inr numeric not null check (amount_inr > 0), note text, on_credit boolean not null default false, customer text, source_transcript text, created_at timestamptz default now());
create table purchase_line (
  id bigserial primary key, txn_id bigint references txn(id) on delete cascade, shop_id text references shop(id),
  sku_id int references sku(id), item_raw text, qty numeric, unit text, unit_price_inr numeric,
  supplier_id int references supplier(id), date date not null);
create table customer (id serial primary key, shop_id text references shop(id), name text not null, udhaar_balance_inr numeric default 0, unique (shop_id, name));
create table daily_summary (
  shop_id text references shop(id), date date, sales numeric, purchases numeric, expenses numeric,
  udhaar_net numeric, est_profit numeric, narrative jsonb, leak_inr numeric, primary key (shop_id, date));
create table insight (
  id bigserial primary key, shop_id text references shop(id),
  type text check (type in ('price_creep','better_supplier','udhaar_risk','top_cost','margin','dead_stock')),
  title text, detail text, impact_inr numeric, status text default 'open', created_at timestamptz default now());
create table telemetry (id bigserial primary key, shop_id text, seconds int, created_at timestamptz default now());

insert into shop values ('sharma-general-store', 'Sharma General Store', 'Mr. Sharma');
