import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Използвай POST заявка.'},405);
  const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
  const supplied=req.headers.get('apikey');
  const allowed=[...Object.values(keys),Deno.env.get('SUPABASE_ANON_KEY')].filter(Boolean);
  if(!supplied||!allowed.includes(supplied))return reply({error:'Невалиден ключ за магазина.'},401);
  try{
    if(Number(req.headers.get('content-length')||0)>24000)return reply({error:'Заявката е твърде голяма.'},413);
    const text=await req.text();
    if(new TextEncoder().encode(text).length>24000)return reply({error:'Заявката е твърде голяма.'},413);
    let payload;try{payload=JSON.parse(text);}catch{return reply({error:'Невалидна заявка.'},400);}
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.website)return reply({error:'Невалидна заявка.'},400);
    const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('cf-connecting-ip')||'unknown';
    const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
    const secret=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!secret)return reply({error:'Магазинът все още се настройва.'},503);
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+'|'+forwarded));
    const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await admin.rpc('create_store_order',{payload:{...payload,payment_method:'cod'},request_hash:hash});
    if(error){
      const messages:Record<string,string>={CHECKOUT_DISABLED:'Поръчките още не са активирани. Свържи се с нас за съдействие.',INVALID_CUSTOMER:'Провери данните за контакт и доставка.',PRODUCT_UNAVAILABLE:'Един от продуктите или цветовете вече не е наличен. Обнови количката.',INSUFFICIENT_STOCK:'Няма достатъчно налични бройки. Обнови количката.',RATE_LIMIT:'Твърде много опити. Опитай отново след час.',IDEMPOTENCY_CONFLICT:'Количката е променена. Презареди страницата и опитай отново.',TOO_MANY_ITEMS:'За повече от 30 броя се свържи с нас.'};
      const code=Object.keys(messages).find(k=>error.message.includes(k));
      return reply({error:code?messages[code]:'Поръчката не беше изпратена. Провери данните и опитай отново.'},code==='RATE_LIMIT'?429:code==='CHECKOUT_DISABLED'?503:400);
    }
    return reply(data,201);
  }catch{return reply({error:'Неуспешно изпращане. Опитай отново след малко.'},500);}
});

