-- Standalone Therride store. No Shopify runtime dependency.
create schema if not exists private;
revoke all on schema private from public;
create table private.store_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table private.store_admins enable row level security;
revoke all on private.store_admins from public, anon, authenticated;

-- The administrator's allowlist is maintained only by a privileged operator.
-- Re-check verified Auth identity on each request; never trust user_metadata.
create function private.is_store_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.users u join private.store_admins a on a.email=lower(u.email)
    where u.id=(select auth.uid()) and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous,false)=false
  );
$$;
revoke all on function private.is_store_admin() from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_store_admin() to anon, authenticated, service_role;
create function public.is_store_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.is_store_admin(); $$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(slug) between 2 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 160),
  subtitle text not null default '',
  description text not null default '' check (length(description)<=12000),
  price_cents integer not null check (price_cents between 1 and 10000000),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents > price_cents),
  size_label text not null default '',
  category text not null default 'Държачи за кенове',
  colors text[] not null default array['Черно'] check (cardinality(colors) between 1 and 30),
  images jsonb not null default '[]' check (jsonb_typeof(images)='array' and jsonb_array_length(images)<=20),
  specs jsonb not null default '{}' check (jsonb_typeof(specs)='object'),
  stock_quantity integer check (stock_quantity is null or stock_quantity>=0),
  is_active boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active_sort on public.products(sort_order) where is_active;
alter table public.products enable row level security;
create policy catalog_read on public.products for select to anon, authenticated
using (is_active or (select private.is_store_admin()));
create policy admin_insert_products on public.products for insert to authenticated
with check ((select private.is_store_admin()));
create policy admin_update_products on public.products for update to authenticated
using ((select private.is_store_admin())) with check ((select private.is_store_admin()));
create policy admin_delete_products on public.products for delete to authenticated
using ((select private.is_store_admin()));
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert,update,delete on public.products to authenticated;
grant all on public.products to service_role;

create table public.store_settings (
  id integer primary key default 1 check (id=1),
  hero_title text not null default 'ПОВЕЧЕ ПЪТ. ПО-МАЛКО БАГАЖ.',
  hero_description text not null default 'Твоята напитка има място. Български държачи за кенове за мотор, велосипед и тротинетка.',
  contact_email text not null default 'therride7@gmail.com',
  contact_phone text not null default '',
  business_name text not null default '',
  business_address text not null default '',
  business_registration text not null default '',
  return_address text not null default '',
  delivery_text text not null default 'Изпращаме поръчките в рамките на 2–5 работни дни. Времето за доставка зависи от избрания куриер.',
  returns_text text not null default '',
  privacy_text text not null default '',
  terms_text text not null default '',
  shipping_fee_cents integer check (shipping_fee_cents is null or shipping_fee_cents between 0 and 50000),
  free_shipping_threshold_cents integer default 3699 check (free_shipping_threshold_cents is null or free_shipping_threshold_cents>=0),
  discount_2 integer not null default 0 check (discount_2 between 0 and 80),
  discount_3 integer not null default 0 check (discount_3 between 0 and 80),
  checkout_enabled boolean not null default false,
  instagram_url text not null default 'https://www.instagram.com/_therride_/',
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(1);
alter table public.store_settings enable row level security;
create policy settings_read on public.store_settings for select to anon,authenticated using(true);
create policy settings_update on public.store_settings for update to authenticated
using ((select private.is_store_admin())) with check ((select private.is_store_admin()));
revoke all on public.store_settings from anon,authenticated;
grant select on public.store_settings to anon,authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  idempotency_key uuid not null unique,
  payload_hash text not null,
  customer_name text not null,
  phone text not null,
  email text,
  city text not null,
  address text not null,
  postal_code text not null default '',
  courier text not null check (courier in ('econt','speedy')),
  delivery_type text not null check (delivery_type in ('address','office')),
  customer_note text not null default '',
  admin_note text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','shipped','completed','cancelled')),
  payment_method text not null default 'cod' check (payment_method in ('cod','stripe')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  shipping_cents integer,
  total_cents integer not null,
  currency text not null default 'EUR' check(currency='EUR'),
  created_at timestamptz not null default now()
);
create index orders_created_desc on public.orders(created_at desc);
create index orders_status_created on public.orders(status,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  color text not null,
  quantity integer not null check(quantity between 1 and 10),
  unit_price_cents integer not null check(unit_price_cents>0),
  image_url text not null default '',
  reserved_stock boolean not null default false
);
create index order_items_order_id on public.order_items(order_id);
create index order_items_product_id on public.order_items(product_id);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy admin_read_orders on public.orders for select to authenticated using((select private.is_store_admin()));
create policy admin_read_items on public.order_items for select to authenticated using((select private.is_store_admin()));
create policy admin_update_orders on public.orders for update to authenticated
using((select private.is_store_admin())) with check((select private.is_store_admin()));
revoke all on public.orders,public.order_items from anon,authenticated;
grant select on public.orders,public.order_items to authenticated;
grant update(status,admin_note) on public.orders to authenticated;
grant all on public.orders,public.order_items to service_role;

create function public.touch_updated_at() returns trigger language plpgsql
security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
revoke all on function public.touch_updated_at() from public;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.store_settings for each row execute function public.touch_updated_at();

create table private.checkout_limits (
  request_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table private.checkout_limits enable row level security;
revoke all on private.checkout_limits from public,anon,authenticated;
grant all on private.checkout_limits to service_role;

-- Callable only by the server-side Edge Function. Authoritative prices, limits,
-- idempotency, stock reservations and order writes share one transaction.
create function public.create_store_order(payload jsonb,request_hash text) returns jsonb
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
    return jsonb_build_object('order_number',old_order.order_number,'total_cents',old_order.total_cents,'shipping_cents',old_order.shipping_cents,'currency','EUR');
  end if;
  insert into private.checkout_limits as limits(request_hash,window_start,attempts)
  values(request_hash,now(),1)
  on conflict(request_hash) do update set
    attempts=case when limits.window_start<now()-interval '1 hour' then 1 else limits.attempts+1 end,
    window_start=case when limits.window_start<now()-interval '1 hour' then now() else limits.window_start end
  returning checkout_limits.attempts into attempts;
  if attempts>10 then raise exception 'RATE_LIMIT'; end if;
  select * into settings from public.store_settings where id=1;
  if not settings.checkout_enabled then raise exception 'CHECKOUT_DISABLED'; end if;
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
    if not found or not (color_name=any(product.colors)) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if product.stock_quantity is not null and product.stock_quantity<qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    if product.stock_quantity is not null then update public.products set stock_quantity=stock_quantity-qty where id=product.id; end if;
    subtotal=subtotal+product.price_cents*qty; item_count=item_count+qty;
  end loop;
  if item_count>30 then raise exception 'TOO_MANY_ITEMS'; end if;
  pct=case when item_count>=3 then settings.discount_3 when item_count>=2 then settings.discount_2 else 0 end;
  discount=round(subtotal*pct/100.0)::integer;
  shipping=case when settings.free_shipping_threshold_cents is not null and subtotal-discount>=settings.free_shipping_threshold_cents then 0 else settings.shipping_fee_cents end;
  insert into public.orders(idempotency_key,payload_hash,customer_name,phone,email,city,address,postal_code,courier,delivery_type,customer_note,subtotal_cents,discount_cents,shipping_cents,total_cents)
  values(idem,digest,trim(customer->>'name'),trim(customer->>'phone'),nullif(trim(customer->>'email'),''),trim(customer->>'city'),trim(customer->>'address'),left(coalesce(customer->>'postal_code',''),20),customer->>'courier',customer->>'delivery_type',coalesce(customer->>'note',''),subtotal,discount,shipping,subtotal-discount+coalesce(shipping,0))
  returning id,order_number into order_id,number;
  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into product from public.products where id=(item->>'product_id')::uuid;
    insert into public.order_items(order_id,product_id,product_name,color,quantity,unit_price_cents,image_url,reserved_stock)
    values(order_id,product.id,product.name,item->>'color',(item->>'quantity')::integer,product.price_cents,coalesce(product.images->0->>'url',''),product.stock_quantity is not null);
  end loop;
  delete from private.checkout_limits where window_start<now()-interval '2 days';
  return jsonb_build_object('order_number',number,'total_cents',subtotal-discount+coalesce(shipping,0),'shipping_cents',shipping,'currency','EUR');
end;
$$;
revoke all on function public.create_store_order(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_store_order(jsonb,text) to service_role;

-- Public product media is intentionally readable; only a verified allowlisted
-- administrator may create, replace or delete files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,6291456,array['image/jpeg','image/png','image/webp','image/avif']);
create policy admin_media_insert on storage.objects for insert to authenticated
with check(bucket_id='product-images' and (select private.is_store_admin()));
create policy admin_media_read on storage.objects for select to authenticated
using(bucket_id='product-images' and (select private.is_store_admin()));
create policy admin_media_update on storage.objects for update to authenticated
using(bucket_id='product-images' and (select private.is_store_admin()))
with check(bucket_id='product-images' and (select private.is_store_admin()));
create policy admin_media_delete on storage.objects for delete to authenticated
using(bucket_id='product-images' and (select private.is_store_admin()));

