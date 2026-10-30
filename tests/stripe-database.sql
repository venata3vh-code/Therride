begin;
do $$
declare p public.products%rowtype; receipt jsonb; payment jsonb; receipt2 jsonb; sid text; n integer; v text;
begin
 update public.store_settings set checkout_enabled=true,stripe_enabled=true,discount_2=10,shipping_fee_cents=0;
 select * into p from public.products where is_active order by sort_order limit 1;
 update public.products set stock_quantity=3 where id=p.id;
 receipt=public.create_store_order(jsonb_build_object('idempotency_key',gen_random_uuid(),'payment_method','stripe','customer',jsonb_build_object('name','Test Customer','phone','0888123456','city','Test','address','Test address','courier','econt','delivery_type','office'),'consent',true,'items',jsonb_build_array(jsonb_build_object('product_id',p.id,'color',p.colors[1],'quantity',2,'price_cents',1))),'test-stripe-rollback');
 if (receipt->>'total_cents')::integer<>2772 then raise exception 'Authoritative price/discount failed'; end if;
 select stock_quantity into n from public.products where id=p.id;if n<>1 then raise exception 'Reservation failed'; end if;
 begin
  update public.orders set status='shipped' where id=(receipt->>'order_id')::uuid;
  raise exception 'TEST: unpaid shipment allowed';
 exception when others then if sqlerrm='TEST: unpaid shipment allowed' then raise; end if; end;
 sid='cs_test_rollback_paid_00000000000000000000';
 payment=jsonb_build_object('id',sid,'client_reference_id',receipt->>'order_id','amount_total',2772,'currency','eur','payment_status','paid','status','complete','payment_intent','pi_test_rollback');
 begin
  perform public.apply_stripe_session('evt_test_bad','checkout.session.completed',payment||jsonb_build_object('amount_total',1));
  raise exception 'TEST: wrong total accepted';
 exception when others then if sqlerrm<>'AMOUNT_MISMATCH' then raise; end if; end;
 perform public.apply_stripe_session('evt_test_paid','checkout.session.completed',payment);
 perform public.apply_stripe_session('evt_test_paid','checkout.session.completed',payment);
 select payment_status into v from public.orders where id=(receipt->>'order_id')::uuid;if v<>'paid' then raise exception 'Paid transition failed'; end if;
 select count(*) into n from private.stripe_events where event_id='evt_test_paid';if n<>1 then raise exception 'Idempotency failed'; end if;
 perform public.apply_stripe_session('evt_test_stale','checkout.session.expired',payment||jsonb_build_object('payment_status','unpaid','status','expired'));
 select payment_status into v from public.orders where id=(receipt->>'order_id')::uuid;if v<>'paid' then raise exception 'Stale event overwrote paid status'; end if;
 receipt2=public.create_store_order(jsonb_build_object('idempotency_key',gen_random_uuid(),'payment_method','stripe','customer',jsonb_build_object('name','Test Customer','phone','0888123456','city','Test','address','Test address','courier','speedy','delivery_type','address'),'consent',true,'items',jsonb_build_array(jsonb_build_object('product_id',p.id,'color',p.colors[1],'quantity',1))),'test-stripe-rollback');
 payment=jsonb_build_object('id','cs_test_rollback_expired_00000000000000000','client_reference_id',receipt2->>'order_id','amount_total',1540,'currency','eur','payment_status','unpaid','status','expired');
 perform public.apply_stripe_session('evt_test_expired','checkout.session.expired',payment);
 perform public.apply_stripe_session('evt_test_expired_again','checkout.session.expired',payment);
 select stock_quantity into n from public.products where id=p.id;if n<>1 then raise exception 'Expiry should restore inventory exactly once'; end if;
end; $$;
rollback;
