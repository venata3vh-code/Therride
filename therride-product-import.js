#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {planCataloguePublication} from './src/lib/live-catalog-import.js';
import {validateCatalog,canPublish,canDisplayCatalogue,toStoreProduct,mergeImportedProducts,csvRows,catalogFromVariantCsv} from './src/lib/product-import.js';
export * from './src/lib/product-import.js';
const root=path.dirname(fileURLToPath(import.meta.url));
async function atomicJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid;await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n');await fs.rename(tmp,file);}
export async function run(args=process.argv.slice(2)){
 const get=(key,fallback)=>{const n=args.indexOf(key);if(n<0)return fallback;if(!args[n+1]||args[n+1].startsWith('--'))throw Error('Missing value for '+key);return args[n+1];};
 if(args.includes('--help')){console.log('node therride-product-import.js [--check | --public | --preview-out FILE | --merge-file FILE | --supabase]\nOptional: --input FILE. --supabase uses server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\nNo mode selected: validate only. Supabase imports as drafts by default. Add --publish-inquiries after applying the catalogue migration to publish supported inquiries; existing database edits win.');return;}
 const input=path.resolve(root,get('--input','therride-products.json'));const body=await fs.readFile(input,'utf8');
 const db=input.toLowerCase().endsWith('.csv')?catalogFromVariantCsv(body,JSON.parse(await fs.readFile(path.resolve(root,get('--base-json','therride-products.json')),'utf8'))):JSON.parse(body);const validation=validateCatalog(db);
 if(validation.errors.length)throw Error(validation.errors.join('\n'));
 const supported=db.products.filter(p=>p.publication.in_scope),priced=supported.filter(p=>p.price_cents!==null);let aliases={};try{aliases=JSON.parse(await fs.readFile(path.join(root,'catalog/product-aliases.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const adapt=(p,options)=>{const row=toStoreProduct(p,options);if(aliases[p.sku])row.sku=aliases[p.sku];return row;};
 const rows=priced.map(p=>adapt(p));
 if(new Set(rows.map(r=>r.sku.toLowerCase())).size!==rows.length)throw Error('Multiple imported products map to the same SKU; reconcile their variants first.');
 const reviewFile=args.includes('--preview-out')?path.resolve(root,get('--preview-out','')):null;
 if(reviewFile){const snapshot={products:supported.map(p=>p.price_cents===null?{...structuredClone(p),inventory_confirmed:false,is_active:false}:toStoreProduct(p,{staticOnly:true})),settings:{hero_title:'THERRIDE — ПРОВЕРКА НА КАТАЛОГА',hero_description:'Работен преглед на продуктите. Снимките и наличностите се уточняват.',checkout_enabled:false,stripe_enabled:false,free_shipping_threshold_cents:3699,contact_email:'therride7@gmail.com'}};for(const p of snapshot.products){delete p._internal;for(const v of p.variants||[])delete v._internal;}await atomicJson(reviewFile,snapshot);}
 if(args.includes('--merge-file')){const file=path.resolve(root,get('--merge-file',''));let old={products:[]};try{old=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}await atomicJson(file,{...old,products:mergeImportedProducts(old.products||[],rows)});}
 if(args.includes('--public')){const baseline=JSON.parse(await fs.readFile(path.join(root,'catalog/published-snapshot.json'),'utf8'));await atomicJson(path.join(root,'public/catalog/base-products.json'),{products:baseline.products,settings:{...baseline.settings,checkout_enabled:false,stripe_enabled:false}});const active=db.products.filter(p=>p.is_active&&(canPublish(p)||canDisplayCatalogue(p))).map(p=>adapt(p,{staticOnly:true}));const sourceDir=path.join(root,'product-images');for(const row of active)for(const image of [...row.images,...row.variants.flatMap(v=>v.images)]){const relative=image.url.slice('/product-images/'.length);if(!/\.(png|jpe?g|webp|avif)$/i.test(relative))throw Error('Unsupported product image file: '+relative);const actual=await fs.realpath(path.join(sourceDir,relative));const allowed=await fs.realpath(sourceDir);if(!actual.startsWith(allowed+path.sep))throw Error('Image must be inside product-images.');const target=path.join(root,'public/product-images',relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(actual,target);}await atomicJson(path.join(root,'public/catalog/imported-products.json'),{schema_version:1,products:active,generated_date:db.generated_date});}
 if(args.includes('--supabase')){
  const endpoint=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!endpoint||!key)throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server environment.');
  const base=new URL(endpoint);if(base.protocol!=='https:')throw Error('Supabase URL must use HTTPS.');
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const existing=[];for(let offset=0;;offset+=1000){const response=await fetch(new URL('/rest/v1/products?select=*&order=id&limit=1000&offset='+offset,base),{headers,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Reading existing products failed: HTTP '+response.status);const page=await response.json();existing.push(...page);if(page.length<1000)break;}
  const incomingSkus=new Set(rows.map(r=>r.sku.toLowerCase()));const merged=args.includes('--publish-inquiries')?planCataloguePublication(db,existing):mergeImportedProducts(existing,rows).filter(r=>incomingSkus.has(r.sku?.toLowerCase()));
  // Existing schema has a partial lower(sku) index. Use primary-key ID conflict handling.
  for(let n=0;n<merged.length;n+=100){const response=await fetch(new URL('/rest/v1/products?on_conflict=id',base),{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(merged.slice(n,n+100)),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Product upsert failed: HTTP '+response.status+'; completed rows: '+n);}
  if(args.includes('--publish-inquiries')){const response=await fetch(new URL('/rest/v1/store_settings?id=eq.1',base),{method:'PATCH',headers,body:JSON.stringify({catalogue_imports:['surron_fans']}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Imported products saved, but catalogue publication marker failed: HTTP '+response.status);}
  console.log('Database rows imported: '+merged.length+'; existing stock and edits preserved.');
 }
 console.log(JSON.stringify({sources:db.sources.length,products:db.products.length,variants:csvRows(db).length-1,supported:supported.length,priced_drafts:rows.length,price_review:supported.length-rows.length,public_products:db.products.filter(p=>p.is_active&&(canPublish(p)||canDisplayCatalogue(p))).length,preview_written:!!reviewFile}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e.message);process.exitCode=1;});
