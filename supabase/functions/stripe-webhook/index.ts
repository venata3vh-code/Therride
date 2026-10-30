import Stripe from 'npm:stripe@23.0.0';
import {service} from '../_shared/server.ts';
const key=Deno.env.get('STRIPE_RESTRICTED_KEY'),secret=Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
const live=Deno.env.get('STRIPE_LIVEMODE')==='true';
const stripe=key?new Stripe(key,{apiVersion:'2026-09-30.endive',httpClient:Stripe.createFetchHttpClient()}):null;
const types=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 if(!stripe||!secret)return new Response('Webhook configuration required',{status:503});
 const signature=req.headers.get('stripe-signature');if(!signature)return new Response('Signature required',{status:400});
 const body=await req.text();if(body.length>1024*1024)return new Response('Payload too large',{status:413});
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(body,signature,secret,undefined,Stripe.createSubtleCryptoProvider());}catch{return new Response('Invalid signature',{status:400});}
 if(event.livemode!==live)return new Response('Wrong environment',{status:400});
 if(!types.has(event.type))return Response.json({ignored:true});
 try{
  const input=event.data.object as Stripe.Checkout.Session;
  // Re-read the Session so out-of-order events cannot overwrite a later paid state.
  const session=await stripe.checkout.sessions.retrieve(input.id);
  if(!session.metadata?.order_id)return Response.json({ignored:true});
  const {error}=await service().rpc('apply_stripe_session',{event_id:event.id,event_type:event.type,session_data:session});
  if(error)return new Response('Payment update pending retry',{status:500});
  return Response.json({received:true});
 }catch{return new Response('Payment update pending retry',{status:500});}
});
