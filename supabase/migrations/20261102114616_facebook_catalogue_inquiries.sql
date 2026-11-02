-- A catalogue inquiry may be visible without claiming physical stock or a settled price.
-- Existing checkout functions reject purchase_mode=inquiry and unconfirmed inventory.
alter table public.products alter column price_cents drop not null;
alter table public.products add constraint products_price_or_inquiry_check check (
 price_cents is not null or (coalesce(specs->>'purchase_mode','')='inquiry' and not inventory_confirmed)
);
alter table public.store_settings add column catalogue_imports text[] not null default '{}';

create table private.catalogue_product_sources (
 sku text primary key,
 source_catalog text not null,
 product_data jsonb not null check (jsonb_typeof(product_data)='object'),
 imported_at timestamptz not null default now()
);
alter table private.catalogue_product_sources enable row level security;
revoke all on private.catalogue_product_sources from public,anon,authenticated;
create table private.catalogue_import_backups (
 import_key text primary key,
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
alter table private.catalogue_import_backups enable row level security;
revoke all on private.catalogue_import_backups from public,anon,authenticated;

create or replace function private.validate_product_variants() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v jsonb; seen text[]:='{}'; key text;
 inquiry boolean:=coalesce(new.specs->>'purchase_mode','')='inquiry';
begin
 for v in select value from jsonb_array_elements(new.variants) loop
  key=v->>'id';
  if jsonb_typeof(v)<>'object' or key is null or key!~'^[a-z0-9][a-z0-9-]{0,100}$' or key=any(seen)
   or length(coalesce(v->>'label','')) not between 1 and 160
   or (not (inquiry and not new.inventory_confirmed and v->>'price_cents' is null)
       and (coalesce(v->>'price_cents','')!~'^[0-9]{1,8}$' or (v->>'price_cents')::integer not between 1 and 10000000))
   or coalesce(v->>'availability','') not in ('unknown','in_stock','out_of_stock')
   or (not new.inventory_confirmed and v->>'availability'='in_stock')
   or (v->>'stock_quantity' is not null and (v->>'stock_quantity'!~'^[0-9]{1,8}$' or (v->>'stock_quantity')::integer<0))
   or (v->'images' is not null and (jsonb_typeof(v->'images')<>'array' or jsonb_array_length(v->'images')>20))
  then raise exception 'Невалиден вариант: провери име, цена и наличност.'; end if;
  seen=array_append(seen,key);
 end loop;
 if new.is_active and not new.inventory_confirmed and not inquiry then
  raise exception 'Потвърди наличността или избери режим със запитване.';
 end if;
 if TG_OP='UPDATE' and exists(select 1 from public.order_items oi where oi.product_id=new.id and oi.reserved_stock and oi.variant_id is not null and not (oi.variant_id=any(seen))) then
  raise exception 'Не премахвай вариант с резервирани бройки.';
 end if;
 if jsonb_array_length(new.variants)>0 then
  select case when count(*) filter(where part.value->>'stock_quantity' is null)>0 then null else sum((part.value->>'stock_quantity')::integer) end
  into new.stock_quantity from jsonb_array_elements(new.variants) as part(value);
 end if;
 return new;
end; $$;
