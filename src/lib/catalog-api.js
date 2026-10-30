const url=import.meta.env.VITE_SUPABASE_URL||'https://abbwqzvlprpjkfmssktf.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_gUmIHpE6Pc32oPakGsLP0g_e-cb-qKD';
export async function loadCatalog() {
  const read=async path=>{const r=await fetch(url+'/rest/v1/'+path,{headers:{apikey:key},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Catalog unavailable');return r.json();};
  const [products,settings]=await Promise.all([read('products?select=*&is_active=eq.true&order=sort_order'),read('store_settings?id=eq.1&select=*')]);
  if(!settings[0])throw new Error('Store settings unavailable');
  return {products,settings:settings[0]};
}
