begin;
-- Verification only: all generated orders, settings and stock changes roll back.
update public.store_settings set checkout_enabled=true, discount_2=10, discount_3=20 where id=1;
do $$
declare pid uuid; payload jsonb; receipt jsonb; again jsonb; remaining integer; original_count integer;
begin
 select id into pid from public.products where slug='red-bull-250';
 select count(*) into original_count from public.orders;
 update public.products set stock_quantity=3 where id=pid;
 payload=jsonb_build_object('idempotency_key',gen_random_uuid(),'consent',true,'website','','customer',jsonb_build_object('name','Тестова проверка','phone','+359000000000','city','Тестов град','address','Тестов адрес','courier','econt','delivery_type','office','email',''),'items',jsonb_build_array(jsonb_build_object('product_id',pid,'color','Черно','quantity',2,'price_cents',1)));
 receipt=public.create_store_order(payload,'rollback-test');
 if (receipt->>'total_cents')::integer<>2772 then raise exception 'FAIL authoritative price/discount'; end if;
 select stock_quantity into remaining from public.products where id=pid;
 if remaining<>1 then raise exception 'FAIL stock reservation'; end if;
 again=public.create_store_order(payload,'rollback-test');
 if receipt->>'order_number'<>again->>'order_number' then raise exception 'FAIL idempotency'; end if;
 if (select count(*) from public.orders)<>original_count+1 then raise exception 'FAIL duplicate order'; end if;
 begin
   perform public.create_store_order(jsonb_set(payload,'{customer,name}','"Променен клиент"'),'rollback-test');
   raise exception 'FAIL idempotency payload guard';
 exception when others then
   if sqlerrm not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
 end;
 begin
   perform public.create_store_order(jsonb_set(payload,'{idempotency_key}',to_jsonb(gen_random_uuid()::text)),'rollback-test');
   raise exception 'FAIL stock oversell guard';
 exception when others then
   if sqlerrm not like '%INSUFFICIENT_STOCK%' then raise; end if;
 end;
 update public.orders set status='cancelled' where order_number=receipt->>'order_number';
 select stock_quantity into remaining from public.products where id=pid;
 if remaining<>3 then raise exception 'FAIL cancellation restock'; end if;
 update public.orders set status='cancelled' where order_number=receipt->>'order_number';
 select stock_quantity into remaining from public.products where id=pid;
 if remaining<>3 then raise exception 'FAIL repeated restock'; end if;
 begin
   update public.orders set status='new' where order_number=receipt->>'order_number';
   raise exception 'FAIL cancelled reopening guard';
 exception when others then
   if sqlerrm not like '%Анулирана поръчка%' then raise; end if;
 end;
end $$;
set local role anon;
do $$
begin
 if (select count(*) from public.products)<>4 then raise exception 'FAIL public catalog'; end if;
 if public.is_store_admin() then raise exception 'FAIL anonymous admin'; end if;
 begin
  perform count(*) from public.orders;
  raise exception 'FAIL public customer data leak';
 exception when insufficient_privilege then null; end;
 begin
  perform public.create_store_order('{}','test');
  raise exception 'FAIL direct public order RPC';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare affected integer;
begin
 if public.is_store_admin() then raise exception 'FAIL non-admin privilege'; end if;
 if (select count(*) from public.orders)<>0 then raise exception 'FAIL authenticated customer data leak'; end if;
 update public.products set price_cents=1; get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL non-admin product write'; end if;
 begin
  insert into public.products(slug,name,price_cents) values('rls-test','Непозволен тест',1);
  raise exception 'FAIL non-admin product create';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'passed: server pricing, discounts, idempotency, stock, cancellation, anonymous and non-admin access' as verification;

