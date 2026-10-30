-- Sur-Ron catalog metadata; no fabricated parts, fitment, prices or inventory.
alter table public.products
 add column sku text not null default '' check(length(sku)<=100),
 add column manufacturer text not null default '' check(length(manufacturer)<=100),
 add column fitment_type text not null default 'unspecified' check(fitment_type in ('unspecified','universal','specific')),
 add column compatible_models text[] not null default '{}' check(cardinality(compatible_models)<=20),
 add column model_years text not null default '' check(length(model_years)<=120),
 add column fitment_notes text not null default '' check(length(fitment_notes)<=2000),
 add column seo_title text not null default '' check(length(seo_title)<=100),
 add column seo_description text not null default '' check(length(seo_description)<=220);
create unique index products_sku_unique on public.products(lower(sku)) where sku<>'';
alter table public.store_settings add column stripe_enabled boolean not null default false;
update public.store_settings set hero_title=E'ТВОЯТ SUR-RON.\nТВОИТЕ ПРАВИЛА.',
 hero_description='Части и аксесоари за следващата ти посока. Започни от модела. Избери своя детайл.' where id=1;
update public.products set category='Аксесоари',manufacturer='THERRIDE',fitment_type='universal',
 fitment_notes='Провери размерите и мястото за монтаж. Универсален аксесоар; съвместимостта с конкретен модел зависи от монтажа.'
 where category='Държачи за кенове';
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check(payment_status in ('unpaid','pending','paid','refunded','failed','expired'));
alter table public.orders add column stripe_session_id text unique, add column stripe_payment_intent_id text;
create table private.stripe_events(event_id text primary key,order_id uuid references public.orders(id),processed_at timestamptz not null default now());
alter table private.stripe_events enable row level security;
revoke all on private.stripe_events from public,anon,authenticated;
grant all on private.stripe_events to service_role;
create policy stripe_events_deny_client on private.stripe_events for all to anon,authenticated using(false) with check(false);
create or replace function public.create_store_order(payload jsonb,request_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  settings public.store_settings%rowtype;
  item jsonb; product public.products%rowtype; old_order public.orders%rowtype;
  order_id uuid; number text; idem uuid; digest text; item_count integer:=0;
  subtotal integer:=0; discount integer:=0; shipping integer; pct integer:=0;
  qty integer; attempts integer; customer jsonb; color_name text; pid uuid;
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
    if not found or color_name is null or not (color_name=any(product.colors)) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if product.stock_quantity is not null and product.stock_quantity<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    if product.stock_quantity is not null then update public.products set stock_quantity=stock_quantity-qty where id=product.id; end if;
    subtotal=subtotal+product.price_cents*qty; item_count=item_count+qty;
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
    insert into public.order_items(order_id,product_id,product_name,color,quantity,unit_price_cents,image_url,reserved_stock)
    values(order_id,product.id,product.name,item->>'color',(item->>'quantity')::integer,product.price_cents,coalesce(product.images->0->>'url',''),product.stock_quantity is not null);
  end loop;
  delete from private.checkout_limits where window_start<now()-interval '2 days';
  return jsonb_build_object('order_id',order_id,'order_number',number,'total_cents',subtotal-discount+coalesce(shipping,0),'shipping_cents',shipping,'currency','EUR');
end;
$$;
revoke all on function public.create_store_order(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_store_order(jsonb,text) to service_role;



-- Only the signature-verifying server may record a payment or release a reservation.
create function public.apply_stripe_session(event_id text, event_type text, session_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.orders%rowtype; sid text; oid uuid; state text; paid boolean;
begin
 if current_user not in ('service_role','postgres') then raise exception 'FORBIDDEN'; end if;
 if event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired') then return jsonb_build_object('ignored',true); end if;
 sid=session_data->>'id';
 begin oid=(session_data->>'client_reference_id')::uuid; exception when others then raise exception 'INVALID_ORDER'; end;
 select * into o from public.orders where id=oid for update;
 if not found or o.payment_method<>'stripe' then raise exception 'INVALID_ORDER'; end if;
 if o.stripe_session_id is not null and o.stripe_session_id<>sid then raise exception 'SESSION_MISMATCH'; end if;
 if session_data->>'currency'<>'eur' or (session_data->>'amount_total')::integer<>o.total_cents then raise exception 'AMOUNT_MISMATCH'; end if;
 if exists(select 1 from private.stripe_events e where e.event_id=$1) then return jsonb_build_object('duplicate',true); end if;
 paid=session_data->>'payment_status'='paid';
 if paid then
   update public.orders set payment_status='paid',stripe_session_id=sid,stripe_payment_intent_id=session_data->>'payment_intent',
   status=case when status='new' then 'confirmed' else status end,
   admin_note=case when status='cancelled' then concat(admin_note,E'\nПлатена след анулиране: необходима е ръчна проверка.') else admin_note end where id=oid and payment_status<>'refunded';
 elsif o.payment_status not in ('paid','refunded') and (session_data->>'status'='expired' or event_type='checkout.session.async_payment_failed') then
   state=case when session_data->>'status'='expired' then 'expired' else 'failed' end;
   update public.orders set payment_status=state,stripe_session_id=sid where id=oid;
   update public.orders set status='cancelled' where id=oid;
 else
   update public.orders set stripe_session_id=sid where id=oid;
 end if;
 insert into private.stripe_events(event_id,order_id) values($1,oid);
 return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.apply_stripe_session(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_stripe_session(text,text,jsonb) to service_role;
-- An admin must not fulfil an unpaid Stripe order or cancel a session still accepting payment.
create function private.guard_stripe_order_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.payment_method='stripe' and new.status<>old.status then
   if new.status in ('confirmed','shipped','completed') and new.payment_status<>'paid' then raise exception 'Плащането още не е потвърдено от Stripe.'; end if;
   if new.status='cancelled' and new.payment_status in ('pending','unpaid') then raise exception 'Първо изчакай потвърдено изтичане или прекратяване на плащането в Stripe.'; end if;
 end if;
 return new;
end; $$;
revoke all on function private.guard_stripe_order_status() from public,anon,authenticated;
create trigger a_guard_stripe_order before update of status on public.orders for each row execute function private.guard_stripe_order_status();
