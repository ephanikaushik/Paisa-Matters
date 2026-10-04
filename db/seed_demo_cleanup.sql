-- Removes ONLY the rows created by seed_demo.sql (tagged DEMO_SEED). Your real entries stay.
delete from txn where shop_id = 'sharma-general-store' and source_transcript = 'DEMO_SEED';
delete from customer where shop_id = 'sharma-general-store' and name in ('Ramesh','Suresh','Meena');
