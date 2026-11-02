const url=import.meta.env.VITE_SUPABASE_URL||'https://abbwqzvlprpjkfmssktf.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_gUmIHpE6Pc32oPakGsLP0g_e-cb-qKD';
import {loadCombinedCatalog} from './catalog-composition.js';
export async function loadCatalog() {
  if(import.meta.env.DEV&&new URLSearchParams(location.search).get('catalogPreview')==='1'){
    const r=await fetch('/__therride-catalog-preview');if(!r.ok)throw Error('Generate the catalogue preview first.');return r.json();
  }
  const read=async path=>{const r=await fetch(url+'/rest/v1/'+path,{headers:{apikey:key},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Catalog unavailable');return r.json();};
  const file=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Catalogue file unavailable');return r.json();};
  return loadCombinedCatalog({readImported:()=>file('/catalog/imported-products.json'),readBaseline:()=>file('/catalog/base-products.json'),readRemote:async()=>{const [products,settings]=await Promise.all([read('products?select=*&is_active=eq.true&order=sort_order'),read('store_settings?id=eq.1&select=*')]);if(!settings[0])throw Error('Store settings unavailable');return {products,settings:settings[0]};}});
}
