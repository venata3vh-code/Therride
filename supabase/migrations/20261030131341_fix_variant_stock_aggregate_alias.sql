create or replace function private.validate_product_variants() returns trigger language plpgsql security invoker set search_path='' as $$
declare v jsonb; seen text[]:='{}'; key text;
begin
 for v in select value from jsonb_array_elements(new.variants) loop
  key=v->>'id';
  if jsonb_typeof(v)<>'object' or key is null or key!~'^[a-z0-9][a-z0-9-]{0,100}$' or key=any(seen)
   or length(coalesce(v->>'label','')) not between 1 and 160
   or coalesce(v->>'price_cents','')!~'^[0-9]{1,8}$' or (v->>'price_cents')::integer not between 1 and 10000000
   or coalesce(v->>'availability','') not in ('unknown','in_stock','out_of_stock')
   or (v->>'stock_quantity' is not null and (v->>'stock_quantity'!~'^[0-9]{1,8}$' or (v->>'stock_quantity')::integer<0))
   or (v->'images' is not null and (jsonb_typeof(v->'images')<>'array' or jsonb_array_length(v->'images')>20))
  then raise exception 'Невалиден вариант: провери име, цена и наличност.'; end if;
  seen=array_append(seen,key);
 end loop;
 if new.is_active and not new.inventory_confirmed then raise exception 'Потвърди наличността преди публикуване.'; end if;
 if TG_OP='UPDATE' and exists(select 1 from public.order_items oi where oi.product_id=new.id and oi.reserved_stock and oi.variant_id is not null and not (oi.variant_id=any(seen))) then raise exception 'Не премахвай вариант с резервирани бройки.'; end if;
 if jsonb_array_length(new.variants)>0 then select case when count(*) filter(where part.value->>'stock_quantity' is null)>0 then null else sum((part.value->>'stock_quantity')::integer) end into new.stock_quantity from jsonb_array_elements(new.variants) as part(value); end if;
 return new;
end; $$;
