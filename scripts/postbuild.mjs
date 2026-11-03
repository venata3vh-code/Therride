import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {pageMeta,structuredData} from '../src/lib/seo.js';
import {composeStoreCatalog} from '../src/lib/catalog-composition.js';
import {withStudioMedia} from '../src/lib/studio-media.js';
import {MODEL_PAGES} from '../src/lib/catalog.js';
const site=(process.env.VITE_SITE_URL||process.env.URL||'').replace(/\/$/,'');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c');
const url=process.env.VITE_SUPABASE_URL||'https://abbwqzvlprpjkfmssktf.supabase.co';
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_gUmIHpE6Pc32oPakGsLP0g_e-cb-qKD';
const read=async p=>{let last;for(let attempt=0;attempt<3;attempt++){try{const r=await fetch(url+'/rest/v1/'+p,{headers:{apikey:key},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Prerender catalog fetch failed: '+r.status);return await r.json();}catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}throw last;};
const snapshotFile=process.env.THERRIDE_CATALOG_SNAPSHOT||(fs.existsSync('catalog/published-snapshot.json')?'catalog/published-snapshot.json':'catalog/baseline-snapshot.json');
let imported;
if(process.env.THERRIDE_CATALOG_SNAPSHOT)imported=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));
else try{
 const [products,settingsRows]=await Promise.all([read('products?select=*&is_active=eq.true&order=sort_order'),read('store_settings?id=eq.1&select=*')]);
 if(!settingsRows[0])throw new Error('Missing live store settings');
 imported={products,settings:settingsRows[0]};
}catch{imported=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));}
const [sourceProducts,rows]=[imported.products,[imported.settings]];
let fileProducts=[];try{fileProducts=JSON.parse(fs.readFileSync('public/catalog/imported-products.json','utf8')).products||[];}catch(e){if(e.code!=='ENOENT')throw e;}
const alreadyImported=rows[0]?.catalogue_imports?.includes('surron_fans');
const products=composeStoreCatalog(sourceProducts.filter(p=>p.is_active!==false),alreadyImported?[]:fileProducts.filter(p=>p.is_active===true)).map(withStudioMedia);
if(!rows[0])throw new Error('Missing store settings');const settings=rows[0];
const snapshot=json({products,settings});
const base=fs.readFileSync('dist/index.html','utf8');
const paths=[...new Set(['/','/shop',...MODEL_PAGES.map(m=>'/models/'+m.slug),'/info/about','/info/contact','/info/delivery','/info/returns','/info/privacy','/info/terms',...products.flatMap(p=>[p.slug,...(p.catalogue_route_aliases||[])].map(s=>'/product/'+s))])];
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 globalThis.localStorage={getItem:()=>null};
 globalThis.document={getElementById:id=>id==='store-data'?{textContent:snapshot}:null};
 const {default:App}=await server.ssrLoadModule('/src/App.jsx');
 for(const route of [...paths,'/404']){
  globalThis.location={pathname:route,search:'',origin:site||'https://therride.example'};
  const rendered=renderToString(React.createElement(App));
  const meta=pageMeta(route,products,settings);
  let html=base.replace(/<title>[^<]*<\/title>/,'<title>'+escape(meta.title)+'</title>');
  const setMeta=(attr,key,val)=>{const tag='<meta '+attr+'="'+key+'" content="'+escape(val)+'"/>';const re=new RegExp('<meta '+attr+'="'+key+'"[^>]*>');html=re.test(html)?html.replace(re,tag):html.replace('</head>',tag+'</head>');};
  setMeta('name','description',meta.description);setMeta('name','robots',meta.noindex?'noindex,follow':'index,follow');
  setMeta('property','og:title',meta.title);setMeta('property','og:description',meta.description);setMeta('property','og:type',meta.product?'product':'website');setMeta('property','og:locale','bg_BG');setMeta('name','twitter:card','summary_large_image');
  setMeta('property','og:image',site?new URL(meta.image,site).href:meta.image);
  if(site){setMeta('property','og:url',site+route);html=html.replace('</head>','<link rel="canonical" href="'+escape(site+route)+'"/>'+structuredData(route,products,settings,site).map(d=>'<script type="application/ld+json" data-therride-schema="true">'+json(d)+'</script>').join('')+'</head>');}
  html=html.replace('<div id="root"></div>','<div id="root" data-prerender="true">'+rendered+'</div><script id="store-data" type="application/json">'+snapshot+'</script>');
  const target=route==='/404'?'dist/404.html':route==='/'?'dist/index.html':path.join('dist',route,'index.html');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);
 }
}finally{await server.close();}
fs.writeFileSync('dist/robots.txt','User-agent: *\nDisallow: /admin\nDisallow: /checkout\n'+(site?'Sitemap: '+site+'/sitemap.xml\n':''));
if(site)fs.writeFileSync('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+escape(site+p)+'</loc></url>').join('')+'</urlset>');
console.log('Prerendered '+paths.length+' complete pages + 404; '+products.length+' actual products.');
process.exit(0); // Vite dependency workers can retain handles in a one-shot prerender CLI.
