-- One atomic row lock protects all variant prices and stock reservations.
alter table public.products add column variants jsonb not null default '[]' check(jsonb_typeof(variants)='array' and jsonb_array_length(variants)<=100),
 add column inventory_confirmed boolean not null default true,
 add column source_references jsonb not null default '[]' check(jsonb_typeof(source_references)='array'),
 add column missing_data text[] not null default '{}';
alter table public.order_items add column variant_id text,add column variant_label text not null default '';
create function private.validate_product_variants() returns trigger language plpgsql security invoker set search_path='' as $$
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
 return new;
end; $$;
revoke all on function private.validate_product_variants() from public,anon,authenticated;
create trigger variants_validate before insert or update on public.products for each row execute function private.validate_product_variants();
create or replace function public.create_store_order(payload jsonb,request_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  settings public.store_settings%rowtype;
  item jsonb; product public.products%rowtype; old_order public.orders%rowtype;
  order_id uuid; number text; idem uuid; digest text; item_count integer:=0;
  subtotal integer:=0; discount integer:=0; shipping integer; pct integer:=0;
  qty integer; attempts integer; customer jsonb; color_name text; pid uuid; variant jsonb; variant_index integer; unit_price integer; stock integer; chosen_image text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>24000 then raise exception 'INVALID_REQUEST'; end if;
  if length(coalesce(payload->>'website',''))>0 then raise exception 'INVALID_REQUEST'; end if;
  begin idem=(payload->>'idempotency_key')::uuid; exception when others then raise exception 'INVALID_REQUEST'; end;
  if idem is null then raise exception 'INVALID_REQUEST'; end if;
  digest=md5(payload::text);
  perform pg_advisory_xact_lock(hashtextextended(idem::text,0));
  select * into old_order from public.orders where idempotency_key=idem;
  if found then
    if old_order.payload_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if old_order.status='cancelled' then raise exception 'ORDER_CANCELLED'; end if;
    return jsonb_build_object('order_id',old_order.id,'order_number',old_order.order_number,'total_cents',old_order.total_cents,'shipping_cents',old_order.shipping_cents,'currency','EUR');
  end if;
  insert into private.checkout_limits as limits(request_hash,window_start,attempts)
  values($2,now(),1)
  on conflict on constraint checkout_limits_pkey do update set
    attempts=case when limits.window_start<now()-interval '1 hour' then 1 else limits.attempts+1 end,
    window_start=case when limits.window_start<now()-interval '1 hour' then now() else limits.window_start end
  returning limits.attempts into attempts;
  if attempts>10 then raise exception 'RATE_LIMIT'; end if;
  select * into settings from public.store_settings where id=1;
  if not settings.checkout_enabled then raise exception 'CHECKOUT_DISABLED'; end if;
  if coalesce(payload->>'payment_method','cod') not in ('cod','stripe') then raise exception 'INVALID_REQUEST'; end if;
  if payload->>'payment_method'='stripe' and not settings.stripe_enabled then raise exception 'PAYMENTS_DISABLED'; end if;
  customer=payload->'customer';
  if length(trim(coalesce(customer->>'name',''))) not between 3 and 160
    or length(coalesce(customer->>'phone','')) not between 7 and 25
    or (customer->>'phone')!~'^[+0-9 ()-]+$'
    or length(trim(coalesce(customer->>'city',''))) not between 2 and 120
    or length(trim(coalesce(customer->>'address',''))) not between 3 and 500
    or length(coalesce(customer->>'email',''))>200
    or (coalesce(customer->>'email','')<>'' and (customer->>'email')!~'^[^@ ]+@[^@ ]+\.[^@ ]+$')
    or coalesce(customer->>'courier','') not in ('econt','speedy')
    or coalesce(customer->>'delivery_type','') not in ('address','office')
    or length(coalesce(customer->>'note',''))>1000
    or coalesce(payload->>'consent','')<>'true'
  then raise exception 'INVALID_CUSTOMER'; end if;
  if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
  -- Serialize reservation per product using a consistent lock order.
  for pid in select distinct (v->>'product_id')::uuid from jsonb_array_elements(payload->'items') v order by 1
  loop perform 1 from public.products where id=pid for update; end loop;
  for item in select * from jsonb_array_elements(payload->'items') loop
    if coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'INVALID_ITEMS'; end if;
    qty=(item->>'quantity')::integer; color_name=item->>'color';
    if qty not between 1 and 10 then raise exception 'INVALID_ITEMS'; end if;
    select * into product from public.products where id=(item->>'product_id')::uuid and is_active;
    if not found or not product.inventory_confirmed then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if jsonb_array_length(product.variants)>0 then
      select v.value,v.ordinality::integer-1 into variant,variant_index from jsonb_array_elements(product.variants) with ordinality v where v.value->>'id'=item->>'variant_id';
      if not found or variant->>'availability'<>'in_stock' then raise exception 'PRODUCT_UNAVAILABLE'; end if;
      unit_price=(variant->>'price_cents')::integer; stock=(variant->>'stock_quantity')::integer;
      if stock is not null and stock<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
      if stock is not null then update public.products set variants=jsonb_set(variants,array[variant_index::text,'stock_quantity'],to_jsonb(stock-qty)) where id=product.id; end if;
    else
      if color_name is null or not (color_name=any(product.colors)) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
      unit_price=product.price_cents;stock=product.stock_quantity;
      if stock is not null and stock<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
      if stock is not null then update public.products set stock_quantity=stock_quantity-qty where id=product.id; end if;
    end if;
    subtotal=subtotal+unit_price*qty; item_count=item_count+qty;
  end loop;
  if item_count>30 then raise exception 'TOO_MANY_ITEMS'; end if;
  pct=case when item_count>=3 then settings.discount_3 when item_count>=2 then settings.discount_2 else 0 end;
  discount=round(subtotal*pct/100.0)::integer;
  shipping=case when settings.free_shipping_threshold_cents is not null and subtotal-discount>=settings.free_shipping_threshold_cents then 0 else settings.shipping_fee_cents end;
  insert into public.orders(idempotency_key,payload_hash,customer_name,phone,email,city,address,postal_code,courier,delivery_type,customer_note,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,total_cents)
  values(idem,digest,trim(customer->>'name'),trim(customer->>'phone'),nullif(trim(customer->>'email'),''),trim(customer->>'city'),trim(customer->>'address'),left(coalesce(customer->>'postal_code',''),20),customer->>'courier',customer->>'delivery_type',coalesce(customer->>'note',''),coalesce(payload->>'payment_method','cod'),case when payload->>'payment_method'='stripe' then 'pending' else 'unpaid' end,subtotal,discount,shipping,subtotal-discount+coalesce(shipping,0))
  returning id,order_number into order_id,number;
  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into product from public.products where id=(item->>'product_id')::uuid;
    if jsonb_array_length(product.variants)>0 then
      select value into variant from jsonb_array_elements(product.variants) where value->>'id'=item->>'variant_id';
      color_name=variant->>'label';unit_price=(variant->>'price_cents')::integer;stock=(variant->>'stock_quantity')::integer;
      chosen_image=coalesce(variant->'images'->0->>'url',product.images->0->>'url','');
    else
      variant=null;color_name=item->>'color';unit_price=product.price_cents;stock=product.stock_quantity;chosen_image=coalesce((select value->>'url' from jsonb_array_elements(product.images) where value->>'color'=color_name limit 1),product.images->0->>'url','');
    end if;
    insert into public.order_items(order_id,product_id,product_name,color,quantity,unit_price_cents,image_url,reserved_stock,variant_id,variant_label)
    values(order_id,product.id,product.name,color_name,(item->>'quantity')::integer,unit_price,chosen_image,stock is not null,variant->>'id',coalesce(variant->>'label',''));
  end loop;
  delete from private.checkout_limits where window_start<now()-interval '2 days';
  return jsonb_build_object('order_id',order_id,'order_number',number,'total_cents',subtotal-discount+coalesce(shipping,0),'shipping_cents',shipping,'currency','EUR');
end;
$$;
revoke all on function public.create_store_order(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_store_order(jsonb,text) to service_role;




create or replace function private.on_order_status_change() returns trigger
language plpgsql security invoker set search_path='' as $$
declare line record; p public.products%rowtype; vi integer; remaining integer;
begin
 if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Анулирана поръчка не може да се отвори повторно.'; end if;
 if new.status='cancelled' and old.status<>'cancelled' then
  for line in select * from public.order_items where order_id=old.id and reserved_stock order by product_id loop
   select * into p from public.products where id=line.product_id for update;
   if found then
    if line.variant_id is null then update public.products set stock_quantity=stock_quantity+line.quantity where id=p.id and stock_quantity is not null;
    else
     select ordinality::integer-1,(value->>'stock_quantity')::integer into vi,remaining from jsonb_array_elements(p.variants) with ordinality where value->>'id'=line.variant_id;
     if found and remaining is not null then update public.products set variants=jsonb_set(variants,array[vi::text,'stock_quantity'],to_jsonb(remaining+line.quantity)) where id=p.id; end if;
    end if;
   end if;
   update public.order_items set reserved_stock=false where id=line.id;
  end loop;
 end if;
 return new;
end; $$;
