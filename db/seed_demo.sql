-- DEMO DATA ONLY — for the deck and video. Label every number from this as "demo data".
-- Run in Supabase SQL editor AFTER schema.sql and functions.sql. Safe to re-run (it cleans its own rows first).
-- All rows are tagged source_transcript = 'DEMO_SEED'; remove with db/seed_demo_cleanup.sql.
-- Today is deliberately left empty so the live "log today" flow can be demoed on camera.

do $$
declare
  shop text := 'sharma-general-store';
  i int; d date; k int; qty numeric; price numeric; tid bigint; sid int; sales numeric;
  sharma int; gupta int;
begin
  -- clean previous demo rows
  delete from txn where shop_id = shop and source_transcript = 'DEMO_SEED';
  delete from customer where shop_id = shop and name in ('Ramesh','Suresh','Meena');

  insert into supplier(shop_id, name) values (shop,'Sharma Distributors') on conflict (shop_id,name) do nothing;
  insert into supplier(shop_id, name) values (shop,'Gupta Traders')      on conflict (shop_id,name) do nothing;
  select id into sharma from supplier where shop_id = shop and name = 'Sharma Distributors';
  select id into gupta  from supplier where shop_id = shop and name = 'Gupta Traders';

  -- i = 0 is 28 days ago, i = 27 is yesterday
  for i in 0..27 loop
    d := shop_today() - (28 - i);
    k := (i * 37 + 11) % 13;                       -- deterministic "randomness"
    continue when i < 20 and i % 9 = 5;            -- a few unlogged days early on (realistic gaps)

    sales := 6800 + k * 220 + (case when extract(dow from d) in (0,6) then 1400 else 0 end);
    insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'sale',sales,'day sales','DEMO_SEED');

    if i % 10 = 4 then insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'expense',300,'electricity','DEMO_SEED'); end if;
    if i % 2 = 0  then insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'expense',120,'transport','DEMO_SEED'); end if;

    -- Atta from Sharma every 3rd day: price creeps 36 -> ~40.5 (the price-creep insight)
    if i % 3 = 0 or i = 27 then
      qty := 40 + (k % 4) * 5;  price := round(36 + 4.5 * i / 27.0, 2);
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'purchase',qty*price,'atta','DEMO_SEED') returning id into tid;
      insert into purchase_line(txn_id,shop_id,item_raw,qty,unit,unit_price_inr,supplier_id,date) values (tid,shop,'atta',qty,'kg',price,sharma,d);
    end if;

    -- Toor dal every 4th day, alternating suppliers: Gupta is cheaper (the better-supplier insight)
    if i % 4 = 1 then
      qty := 20 + (k % 3) * 5;  sid := case when (i / 4) % 2 = 0 then sharma else gupta end;
      price := case when sid = sharma then 130 else 122 end;
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'purchase',qty*price,'toor dal','DEMO_SEED') returning id into tid;
      insert into purchase_line(txn_id,shop_id,item_raw,qty,unit,unit_price_inr,supplier_id,date) values (tid,shop,'toor dal',qty,'kg',price,sid,d);
    end if;

    -- Oil weekly (stable) and rice every 5th day (stable): no false alarms
    if i % 7 = 2 then
      qty := 15;  price := 148;
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'purchase',qty*price,'oil','DEMO_SEED') returning id into tid;
      insert into purchase_line(txn_id,shop_id,item_raw,qty,unit,unit_price_inr,supplier_id,date) values (tid,shop,'oil',qty,'l',price,sharma,d);
    end if;
    if i % 5 = 3 then
      qty := 30;  price := 58;
      insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values (shop,d,'purchase',qty*price,'rice','DEMO_SEED') returning id into tid;
      insert into purchase_line(txn_id,shop_id,item_raw,qty,unit,unit_price_inr,supplier_id,date) values (tid,shop,'rice',qty,'kg',price,gupta,d);
    end if;
  end loop;

  -- Udhaar: Ramesh (25d) and Suresh (18d, part-paid) are overdue and get flagged; Meena (2d) is recent and does not
  insert into txn(shop_id,date,type,amount_inr,note,source_transcript) values
    (shop, shop_today()-25, 'udhaar_given', 1800, 'Ramesh', 'DEMO_SEED'),
    (shop, shop_today()-18, 'udhaar_given',  900, 'Suresh', 'DEMO_SEED'),
    (shop, shop_today()-8,  'udhaar_received', 400, 'Suresh', 'DEMO_SEED'),
    (shop, shop_today()-2,  'udhaar_given',  500, 'Meena',  'DEMO_SEED');
  insert into customer(shop_id,name,udhaar_balance_inr) values (shop,'Ramesh',1800),(shop,'Suresh',500),(shop,'Meena',500)
    on conflict (shop_id,name) do update set udhaar_balance_inr = excluded.udhaar_balance_inr;
end $$;

-- sanity check: should show ~28 rows of daily totals
select * from jsonb_to_recordset(get_history('sharma-general-store', 30)->'days')
  as x(date date, sales numeric, purchases numeric, expenses numeric, est_profit numeric) order by date;
