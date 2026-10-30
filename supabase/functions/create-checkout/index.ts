import Stripe from 'npm:stripe@23.0.0';
import {reply,headers,publicKeyValid,service,requestHash,isAdmin} from '../_shared/server.ts';
import {checkoutLineItems,isReceiptSession,receiptState} from '../_shared/payments.mjs';

const key=Deno.env.get('STRIPE_RESTRICTED_KEY');
const webhook=Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
const site=Deno.env.get('SITE_URL')?.replace(/\/$/,'');
const live=Deno.env.get('STRIPE_LIVEMODE')==='true';
const ready=Boolean(key&&webhook&&site?.startsWith('https://')&&key.startsWith(live?'rk_live_':'rk_test_'));
const stripe=key?new Stripe(key,{apiVersion:'2026-09-30.endive',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2}):null;

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Използвай POST.'},405);
 if(!publicKeyValid(req))return reply({error:'Невалиден ключ.'},401);
 try{
  const text=await req.text();if(new TextEncoder().encode(text).length>24000)return reply({error:'Заявката е твърде голяма.'},413);
  const payload=JSON.parse(text);if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply({error:'Невалидна заявка.'},400);
  const db=service();
  if(payload.action==='config')return reply({ready,livemode:live});
  if(payload.action==='status'){
   if(!isReceiptSession(payload.session_id))return reply({error:'Невалидно плащане.'},400);
   const {data,error}=await db.from('orders').select('order_number,payment_status,total_cents,shipping_cents').eq('stripe_session_id',payload.session_id).maybeSingle();
   if(error)throw error;return data?reply(receiptState(data)):reply({payment_status:'pending'},202);
  }
  if(!ready||!stripe)return reply({error:'Плащането с карта още се настройва. Избери наложен платеж.'},503);
  if(payload.action==='reconcile'){
   if(!await isAdmin(req))return reply({error:'Необходим е администраторски достъп.'},403);
   const {data:o,error}=await db.from('orders').select('*').eq('id',payload.order_id).eq('payment_method','stripe').single();if(error)throw error;
   let session=o.stripe_session_id?await stripe.checkout.sessions.retrieve(o.stripe_session_id):null;
   if(!session){for await(const candidate of stripe.checkout.sessions.list({created:{gte:Math.floor(new Date(o.created_at).getTime()/1000)-60},limit:100})){if(candidate.client_reference_id===o.id){session=candidate;break;}}}
   if(session){const type=session.status==='expired'?'checkout.session.expired':'checkout.session.completed';const {error:e}=await db.rpc('apply_stripe_session',{event_id:'reconcile_'+session.id+'_'+session.status+'_'+session.payment_status,event_type:type,session_data:session});if(e)throw e;return reply({ok:true,status:session.payment_status});}
   if(Date.now()-new Date(o.created_at).getTime()>3600000){const {error:e}=await db.from('orders').update({payment_status:'failed',status:'cancelled'}).eq('id',o.id).eq('payment_status','pending').is('stripe_session_id',null);if(e)throw e;return reply({ok:true,status:'failed'});}
   return reply({ok:true,status:'pending'});
  }
  if(payload.website)return reply({error:'Невалидна заявка.'},400);
  const {data:receipt,error}=await db.rpc('create_store_order',{payload:{...payload,payment_method:'stripe'},request_hash:await requestHash(req)});
  if(error){const disabled=/CHECKOUT_DISABLED|PAYMENTS_DISABLED/.test(error.message);return reply({error:disabled?'Поръчките или плащанията с карта още не са активирани.':/INSUFFICIENT_STOCK/.test(error.message)?'Недостатъчна наличност. Обнови количката.':/ORDER_CANCELLED/.test(error.message)?'Този опит за плащане е изтекъл. Презареди страницата за нов опит.':'Провери данните и наличността в количката.'},disabled?503:400);}
  const {data:order,error:orderError}=await db.from('orders').select('*,order_items(*)').eq('id',receipt.order_id).single();if(orderError)throw orderError;
  if(order.stripe_session_id){const existing=await stripe.checkout.sessions.retrieve(order.stripe_session_id);if(existing.status==='open'&&existing.url)return reply({url:existing.url,session_id:existing.id});return reply({error:'Плащането е приключило или изтекло. Провери статуса на поръчката.'},409);}
  const created=Math.floor(new Date(order.created_at).getTime()/1000);
  if(Date.now()/1000-created>1700)return reply({error:'Този опит е твърде стар. Свържи се с нас за проверка на плащането.'},409);
  const session=await stripe.checkout.sessions.create({mode:'payment',integration_identifier:'therride_store_mqvndkzr',
   client_reference_id:order.id,metadata:{order_id:order.id,order_number:order.order_number},
   customer_email:order.email||undefined,expires_at:created+3600,
   line_items:checkoutLineItems(order,order.order_items),
   adaptive_pricing:{enabled:false},
   custom_text:order.shipping_cents===null?{submit:{message:'Сумата е за продуктите. Доставката се заплаща отделно на куриера по неговата тарифа.'}}:undefined,
   success_url:site+'/checkout/return?session_id={CHECKOUT_SESSION_ID}',cancel_url:site+'/checkout?payment=cancelled',
  },{idempotencyKey:'checkout_'+order.id});
  if(session.livemode!==live||!session.url)throw new Error('PAYMENT_MODE_MISMATCH');
  const {error:attachError}=await db.from('orders').update({stripe_session_id:session.id}).eq('id',order.id).is('stripe_session_id',null);if(attachError)throw attachError;
  return reply({url:session.url,session_id:session.id});
 }catch{return reply({error:'Плащането не започна. Опитай отново със същата количка. Не е потвърдена покупка.'},500);}
});
