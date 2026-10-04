-- Run AFTER schema.sql. Called by n8n via /rest/v1/rpc/<name>.
-- "Today" is the shop's local date (IST), not the database server's UTC date.
create or replace function shop_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;
-- v8: credit sales. A sale made on credit is a normal 'sale' (counts in sales and profit) flagged on_credit with the customer's name;
-- it also raises that customer's udhaar balance. Later payments are 'udhaar_received' and never count as sales.
alter table txn add column if not exists on_credit boolean not null default false;
alter table txn add column if not exists customer text;

create or replace function get_summary(p_shop text, p_date date) returns jsonb
language sql stable as $$
  with t as (
    select
      coalesce(sum(amount_inr) filter (where type='sale'),0) sales,
      coalesce(sum(amount_inr) filter (where type='purchase'),0) purchases,
      coalesce(sum(amount_inr) filter (where type='expense'),0) expenses,
      coalesce(sum(amount_inr) filter (where type='sale' and on_credit),0) credit_sales,
      coalesce(sum(amount_inr) filter (where type='udhaar_given'),0)
        - coalesce(sum(amount_inr) filter (where type='udhaar_received'),0) udhaar_net
    from txn where shop_id=p_shop and date=p_date),
  prev as (
    select avg(p) avg_profit from (
      select date, sum(case when type='sale' then amount_inr when type in ('purchase','expense') then -amount_inr else 0 end) p
      from txn where shop_id=p_shop and date < p_date and date >= p_date - 14 group by date) x),
  top as (
    select lower(trim(note)) item, sum(amount_inr) spend from txn
    where shop_id=p_shop and date=p_date and type='purchase' group by 1 order by 2 desc limit 1)
  select jsonb_build_object('date',p_date,'sales',t.sales,'purchases',t.purchases,'expenses',t.expenses,'credit_sales',t.credit_sales,
    'udhaar_net',t.udhaar_net,'est_profit',t.sales-t.purchases-t.expenses,
    'avg_profit_prev', (select round(avg_profit) from prev),
    'top_purchase', (select item from top),
    'top_purchase_spend', (select spend from top),
    'top_purchase_share', (select round(spend / nullif(t.purchases,0) * 100) from top))
  from t;
$$;

create or replace function confirm_draft(p_shop text, p_date date, p_draft jsonb, p_transcript text default null) returns jsonb
language plpgsql as $$
declare r jsonb; tid bigint; sid int; n int := 0;
begin
  -- entries APPEND to the day (a vendor may log in several parts)
  for r in select * from jsonb_array_elements(coalesce(p_draft->'sales','[]')) loop
    if (r->>'amount_inr') is not null then
      if coalesce((r->>'on_credit')::boolean, false) and nullif(trim(r->>'customer'),'') is not null then  -- sale on credit: counts as a sale AND adds to what the customer owes
        insert into txn(shop_id,date,type,amount_inr,note,source_transcript,on_credit,customer) values (p_shop,p_date,'sale',(r->>'amount_inr')::numeric,r->>'note',p_transcript,true,initcap(trim(r->>'customer')));
        insert into customer(shop_id,name,udhaar_balance_inr) values (p_shop,initcap(trim(r->>'customer')),(r->>'amount_inr')::numeric)
          on conflict (shop_id,name) do update set udhaar_balance_inr = customer.udhaar_balance_inr + excluded.udhaar_balance_inr;
      else
        insert into txn(shop_id,date,type,amount_inr,note,source_transcript,customer) values (p_shop,p_date,'sale',(r->>'amount_inr')::numeric,r->>'note',p_transcript,nullif(initcap(trim(r->>'customer')),''));  -- cash sale; buyer name kept for reference only
      end if; n:=n+1; end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_draft->'purchases','[]')) loop
    if (r->>'total_inr') is not null then
      sid := null;
      if r->>'supplier' is not null then
        insert into supplier(shop_id,name) values (p_shop,r->>'supplier') on conflict (shop_id,name) do update set name=excluded.name returning id into sid;
      end if;
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (p_shop,p_date,'purchase',(r->>'total_inr')::numeric,r->>'item',p_transcript) returning id into tid;
      insert into purchase_line(txn_id,shop_id,item_raw,qty,unit,unit_price_inr,supplier_id,date)
        values (tid,p_shop,r->>'item',(r->>'qty')::numeric,r->>'unit',(r->>'unit_price_inr')::numeric,sid,p_date); n:=n+1;
    end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_draft->'expenses','[]')) loop
    if (r->>'amount_inr') is not null then
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (p_shop,p_date,'expense',(r->>'amount_inr')::numeric,r->>'category',p_transcript); n:=n+1; end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_draft->'udhaar_given','[]')) loop
    if (r->>'amount_inr') is not null then
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (p_shop,p_date,'udhaar_given',(r->>'amount_inr')::numeric,initcap(trim(r->>'customer')),p_transcript);
      insert into customer(shop_id,name,udhaar_balance_inr) values (p_shop,initcap(trim(r->>'customer')),(r->>'amount_inr')::numeric)
        on conflict (shop_id,name) do update set udhaar_balance_inr = customer.udhaar_balance_inr + excluded.udhaar_balance_inr; n:=n+1; end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_draft->'udhaar_received','[]')) loop
    if (r->>'amount_inr') is not null then
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (p_shop,p_date,'udhaar_received',(r->>'amount_inr')::numeric,initcap(trim(r->>'customer')),p_transcript);
      update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr-(r->>'amount_inr')::numeric) where shop_id=p_shop and name=initcap(trim(r->>'customer')); n:=n+1; end if;
  end loop;
  return jsonb_build_object('saved',n,'summary',get_summary(p_shop,p_date),
    'alerts', coalesce((select jsonb_agg(e) from jsonb_array_elements(get_insights(p_shop)->'insights') e
                        where e->>'type' in ('price_creep','better_supplier')), '[]'::jsonb));
end $$;

-- ===== v2: history, insights, snapshot for Ask (re-run safe) =====
create or replace function get_history(p_shop text, p_days int default 7) returns jsonb
language sql stable as $$
  select jsonb_build_object('days', coalesce(jsonb_agg(d order by (d->>'date')), '[]'::jsonb))
  from (
    select jsonb_build_object('date', date,
      'sales', coalesce(sum(amount_inr) filter (where type='sale'),0),
      'purchases', coalesce(sum(amount_inr) filter (where type='purchase'),0),
      'expenses', coalesce(sum(amount_inr) filter (where type='expense'),0),
      'est_profit', coalesce(sum(amount_inr) filter (where type='sale'),0)
                  - coalesce(sum(amount_inr) filter (where type='purchase'),0)
                  - coalesce(sum(amount_inr) filter (where type='expense'),0)) d
    from txn where shop_id=p_shop and date > shop_today() - p_days group by date) x;
$$;

create or replace function get_insights(p_shop text) returns jsonb
language plpgsql stable as $$
declare ins jsonb := '[]'; creep numeric := 0; better numeric := 0; ud numeric := 0; rec record; n int := 0; tot numeric;
begin
  -- price creep: latest unit price vs average of the previous 28 days
  for rec in
    with pl as (select lower(trim(item_raw)) item, unit_price_inr price, qty, unit, date, id from purchase_line
                where shop_id=p_shop and unit_price_inr is not null and item_raw is not null),
    latest as (select distinct on (item) item, price, date, unit from pl order by item, date desc, id desc),
    base as (select l.item, l.price latest_price, l.unit, avg(p.price) avg_price from latest l
             join pl p on p.item=l.item and p.date < l.date and p.date >= l.date - 28 group by l.item, l.price, l.unit),
    vol as (select item, sum(qty) q from pl where date >= shop_today() - 30 group by item)
    select b.item, b.unit, b.latest_price, round(b.avg_price,2) avg_price,
           round((b.latest_price-b.avg_price)/b.avg_price*100,1) pct,
           round((b.latest_price-b.avg_price)*coalesce(v.q,0),0) impact
    from base b left join vol v using (item)
    where b.avg_price > 0 and (b.latest_price-b.avg_price)/b.avg_price >= 0.05
  loop
    n := n+1; creep := creep + rec.impact;
    ins := ins || jsonb_build_object('id',n,'type','price_creep','title',initcap(rec.item)||' price is rising',
      'detail','Latest ₹'||rec.latest_price||' vs 4-week average ₹'||rec.avg_price||' (+'||rec.pct||'%).','impact_inr',rec.impact,
      'meta',jsonb_build_object('item',rec.item,'unit',rec.unit,'latest',rec.latest_price,'avg',rec.avg_price,'pct',rec.pct));
  end loop;
  -- better supplier: same item, cheaper from another supplier (last 30 days)
  for rec in
    with s as (select lower(trim(item_raw)) item, supplier_id, max(unit) unit, avg(unit_price_inr) avgp, sum(qty) q from purchase_line
               where shop_id=p_shop and date >= shop_today() - 30 and unit_price_inr is not null and supplier_id is not null group by 1,2),
    mn as (select distinct on (item) item, supplier_id sid, avgp from s order by item, avgp asc)
    select s.item, s.unit, cur.name cur_name, round(s.avgp,2) cur_p, best.name best_name, round(mn.avgp,2) best_p,
           round((s.avgp-mn.avgp)*s.q,0) impact
    from s join mn on mn.item=s.item and mn.sid<>s.supplier_id
    join supplier cur on cur.id=s.supplier_id join supplier best on best.id=mn.sid
    where s.avgp > mn.avgp*1.03
  loop
    n := n+1; better := better + rec.impact;
    ins := ins || jsonb_build_object('id',n,'type','better_supplier','title',initcap(rec.item)||' is cheaper elsewhere',
      'detail',rec.best_name||' charged ₹'||rec.best_p||' vs ₹'||rec.cur_p||' from '||rec.cur_name||'.','impact_inr',rec.impact,
      'meta',jsonb_build_object('item',rec.item,'unit',rec.unit,'best_supplier',rec.best_name,'best_price',rec.best_p,'cur_supplier',rec.cur_name,'cur_price',rec.cur_p));
  end loop;
  -- udhaar risk: balance owed and last credit given 14+ days ago
  select coalesce(sum(udhaar_balance_inr),0) into ud from customer where shop_id=p_shop and udhaar_balance_inr>0;
  for rec in
    select c.name, c.udhaar_balance_inr bal, (shop_today() - max(t.date)) age
    from customer c left join txn t on t.shop_id=c.shop_id and (t.type='udhaar_given' and t.note=c.name or t.type='sale' and t.on_credit and t.customer=c.name)
    where c.shop_id=p_shop and c.udhaar_balance_inr>0 group by c.id having (shop_today() - max(t.date)) >= 14
  loop
    n := n+1;
    ins := ins || jsonb_build_object('id',n,'type','udhaar_risk','title',rec.name||' owes ₹'||rec.bal,
      'detail','Last credit given '||rec.age||' days ago. Consider a polite reminder.','impact_inr',rec.bal,
      'meta',jsonb_build_object('customer',rec.name,'balance',rec.bal,'days',rec.age));
  end loop;
  -- top cost driver this week
  select sum(amount_inr) into tot from txn where shop_id=p_shop and type='purchase' and date >= shop_today() - 7;
  for rec in
    select lower(trim(note)) item, sum(amount_inr) spend from txn
    where shop_id=p_shop and type='purchase' and date >= shop_today() - 7 group by 1 order by 2 desc limit 1
  loop
    n := n+1;
    ins := ins || jsonb_build_object('id',n,'type','top_cost','title',initcap(rec.item)||' is your biggest cost',
      'detail','₹'||rec.spend||' this week ('||round(rec.spend/nullif(tot,0)*100)||'% of purchases).','impact_inr',0,
      'meta',jsonb_build_object('item',rec.item,'spend',rec.spend,'share',round(rec.spend/nullif(tot,0)*100)));
  end loop;
  return jsonb_build_object('insights', ins,
    'leak_meter', jsonb_build_object('total_inr', creep+better, 'price_creep', creep, 'better_supplier', better, 'udhaar_outstanding_inr', ud));
end $$;

create or replace function get_snapshot(p_shop text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'today', shop_today(),
    'daily_last_30_days', (get_history(p_shop, 30))->'days',
    'spend_by_item_last_30_days', coalesce((select jsonb_agg(r) from (select lower(trim(note)) item, sum(amount_inr) spend_inr from txn
        where shop_id=p_shop and type='purchase' and date > shop_today()-30 group by 1 order by 2 desc limit 15) r), '[]'::jsonb),
    'spend_by_supplier_last_30_days', coalesce((select jsonb_agg(r) from (select s.name supplier, sum(t.amount_inr) spend_inr from txn t
        join purchase_line pl on pl.txn_id=t.id join supplier s on s.id=pl.supplier_id
        where t.shop_id=p_shop and t.date > shop_today()-30 group by 1 order by 2 desc limit 10) r), '[]'::jsonb),
    'udhaar_balances', coalesce((select jsonb_agg(jsonb_build_object('customer',name,'balance_inr',udhaar_balance_inr))
        from customer where shop_id=p_shop and udhaar_balance_inr>0), '[]'::jsonb),
    'insights', (get_insights(p_shop))->'insights');
$$;

-- ===== v7: shop profile =====
alter table shop add column if not exists first_name text;
alter table shop add column if not exists last_name text;
alter table shop add column if not exists store_type text;
alter table shop add column if not exists city text;
alter table shop add column if not exists area text;
alter table shop add column if not exists phone text;
alter table shop add column if not exists upi_id text;

create or replace function get_profile(p_shop text) returns jsonb
language sql stable as $$
  select jsonb_build_object('store_name', name, 'first_name', first_name, 'last_name', last_name, 'store_type', store_type,
    'city', city, 'area', area, 'phone', phone, 'upi_id', upi_id, 'member_since', created_at)
  from shop where id = p_shop;
$$;

create or replace function save_profile(p_shop text, p_data jsonb) returns jsonb
language plpgsql as $$
begin
  update shop set
    name = coalesce(nullif(trim(p_data->>'store_name'), ''), name),
    first_name = nullif(trim(p_data->>'first_name'), ''), last_name = nullif(trim(p_data->>'last_name'), ''),
    owner_name = nullif(trim(concat_ws(' ', p_data->>'first_name', p_data->>'last_name')), ''),
    store_type = nullif(trim(p_data->>'store_type'), ''), city = nullif(trim(p_data->>'city'), ''),
    area = nullif(trim(p_data->>'area'), ''), phone = nullif(trim(p_data->>'phone'), ''), upi_id = nullif(trim(p_data->>'upi_id'), '')
  where id = p_shop;
  return jsonb_build_object('profile', get_profile(p_shop));
end $$;

-- ===== v3: one-call home payload (summary + week + insights + who owes me) =====
create or replace function get_home(p_shop text, p_date date) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'summary',  get_summary(p_shop, p_date),
    'days',     (get_history(p_shop, 14))->'days',
    'insights', (get_insights(p_shop))->'insights',
    'leak_meter', (get_insights(p_shop))->'leak_meter',
    'profile', get_profile(p_shop),
    'month', (select jsonb_build_object(
        'profit', coalesce(sum(case when type='sale' then amount_inr when type in ('purchase','expense') then -amount_inr else 0 end),0),
        'days', count(distinct date))
      from txn where shop_id = p_shop and date > p_date - 30 and date <= p_date),  -- rolling last 30 days
    'udhaar', coalesce((
      select jsonb_agg(jsonb_build_object('customer', c.name, 'balance_inr', c.udhaar_balance_inr,
'days_since', (select shop_today() - max(t.date) from txn t
                               where t.shop_id = c.shop_id and (t.type='udhaar_given' and t.note=c.name or t.type='sale' and t.on_credit and t.customer=c.name)),
                'taken_on', (select max(t.date) from txn t
                               where t.shop_id = c.shop_id and (t.type='udhaar_given' and t.note=c.name or t.type='sale' and t.on_credit and t.customer=c.name)))
                order by c.udhaar_balance_inr desc)
      from customer c where c.shop_id = p_shop and c.udhaar_balance_inr > 0), '[]'::jsonb));
$$;

-- ===== v5: transactions list for the Reports screen =====
create or replace function get_transactions(p_shop text, p_from date, p_to date) returns jsonb
language sql stable as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'date', t.date, 'type', t.type, 'amount_inr', t.amount_inr, 'note', t.note,
      'on_credit', t.on_credit, 'customer', t.customer, 'qty', pl.qty, 'unit', pl.unit, 'unit_price_inr', pl.unit_price_inr, 'supplier', s.name, 'created_at', t.created_at)
    order by t.date desc, t.created_at desc), '[]'::jsonb))
  from txn t
  left join purchase_line pl on pl.txn_id = t.id
  left join supplier s on s.id = pl.supplier_id
  where t.shop_id = p_shop and t.date between p_from and p_to;
$$;

-- ===== v6: edit / delete an entry (keeps udhaar balances consistent) =====
create or replace function delete_txn(p_shop text, p_id bigint) returns jsonb
language plpgsql as $$
declare t record;
begin
  select * into t from txn where id = p_id and shop_id = p_shop;
  if not found then return jsonb_build_object('deleted', 0); end if;
  if t.type = 'udhaar_given' then
    update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr - t.amount_inr) where shop_id = p_shop and name = t.note;
  elsif t.type = 'sale' and t.on_credit then
    update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr - t.amount_inr) where shop_id = p_shop and name = t.customer;
  elsif t.type = 'udhaar_received' then
    update customer set udhaar_balance_inr = udhaar_balance_inr + t.amount_inr where shop_id = p_shop and name = t.note;
  end if;
  delete from txn where id = p_id;  -- purchase_line rows cascade
  return jsonb_build_object('deleted', 1);
end $$;

create or replace function update_txn(p_shop text, p_id bigint, p_amount numeric) returns jsonb
language plpgsql as $$
declare t record; delta numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select * into t from txn where id = p_id and shop_id = p_shop;
  if not found then return jsonb_build_object('updated', 0); end if;
  delta := p_amount - t.amount_inr;
  if t.type = 'udhaar_given' then
    update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr + delta) where shop_id = p_shop and name = t.note;
  elsif t.type = 'sale' and t.on_credit then
    update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr + delta) where shop_id = p_shop and name = t.customer;
  elsif t.type = 'udhaar_received' then
    update customer set udhaar_balance_inr = greatest(0, udhaar_balance_inr - delta) where shop_id = p_shop and name = t.note;
  elsif t.type = 'purchase' then
    update purchase_line set unit_price_inr = case when qty > 0 then round(p_amount / qty, 2) end where txn_id = p_id;
  end if;
  update txn set amount_inr = p_amount where id = p_id;
  return jsonb_build_object('updated', 1);
end $$;

-- ===== v9: accounts (sign up / log in) + demo profiles =====
-- Prototype auth: email + password (bcrypt via pgcrypto). The app keeps the returned shop_id on the device.
-- For production, swap this for Supabase Auth / OTP and verify a session token on every call.
create extension if not exists pgcrypto with schema extensions;
create table if not exists app_user (
  email text primary key, password_hash text not null, shop_id text not null references shop(id), created_at timestamptz default now());

create or replace function auth_login(p_email text, p_password text) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare u record;
begin
  select * into u from app_user where email = lower(trim(p_email));
  if not found or u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    return jsonb_build_object('error', 'invalid_credentials');
  end if;
  return jsonb_build_object('shop_id', u.shop_id, 'email', u.email, 'store_name', (select name from shop where id = u.shop_id));
end $$;

-- A new account starts with an empty shop: no transactions, customers, suppliers or insights.
create or replace function auth_signup(p_email text, p_password text, p_store text, p_name text default null) returns jsonb
language plpgsql set search_path = public, extensions as $$
declare e text := lower(trim(p_email)); sid text; fn text; ln text;
begin
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return jsonb_build_object('error', 'invalid_email'); end if;
  if length(coalesce(p_password, '')) < 6 then return jsonb_build_object('error', 'weak_password'); end if;
  if nullif(trim(p_store), '') is null then return jsonb_build_object('error', 'store_required'); end if;
  if exists (select 1 from app_user where email = e) then return jsonb_build_object('error', 'email_taken'); end if;
  sid := 'shop-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  fn := nullif(split_part(trim(coalesce(p_name, '')), ' ', 1), '');
  ln := nullif(trim(substr(trim(coalesce(p_name, '')), length(coalesce(fn, '')) + 1)), '');
  insert into shop(id, name, owner_name, first_name, last_name) values (sid, trim(p_store), nullif(trim(p_name), ''), fn, ln);
  insert into app_user(email, password_hash, shop_id) values (e, crypt(p_password, gen_salt('bf')), sid);
  return jsonb_build_object('shop_id', sid, 'email', e, 'store_name', trim(p_store));
end $$;

-- Demo helper: wipes the shared "new user" demo shop back to a blank state so the first-run experience can be shown again.
create or replace function reset_demo_newuser() returns jsonb
language plpgsql set search_path = public, extensions as $$
declare sid text := 'demo-new-shop';
begin
  insert into shop(id, name) values (sid, 'My Shop') on conflict (id) do nothing;
  delete from purchase_line where shop_id = sid;
  delete from txn where shop_id = sid;
  delete from customer where shop_id = sid;
  delete from supplier where shop_id = sid;
  delete from daily_summary where shop_id = sid;
  delete from insight where shop_id = sid;
  update shop set name = 'My Shop', owner_name = null, first_name = null, last_name = null, store_type = null,
    city = null, area = null, phone = null, upi_id = null, created_at = now() where id = sid;
  insert into app_user(email, password_hash, shop_id) values ('newuser@demo.in', crypt('demo123', gen_salt('bf')), sid) on conflict (email) do nothing;
  return jsonb_build_object('shop_id', sid, 'email', 'newuser@demo.in', 'store_name', 'My Shop');
end $$;

-- Demo login for the seeded shop (run db/seed_demo.sql for its data): demo@paisamatters.in / demo123
insert into app_user(email, password_hash, shop_id)
  select 'demo@paisamatters.in', crypt('demo123', gen_salt('bf')), id from shop where id = 'sharma-general-store'
  on conflict (email) do nothing;
