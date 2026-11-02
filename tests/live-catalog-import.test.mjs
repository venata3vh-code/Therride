import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {planCataloguePublication} from '../src/lib/live-catalog-import.js';
import {loadCombinedCatalog,productAtRoute} from '../src/lib/catalog-composition.js';
import {MODEL_PAGES,modelPageAtPath,modelPagePath,filterProducts} from '../src/lib/catalog.js';
import {pageMeta} from '../src/lib/seo.js';
const db=JSON.parse(await fs.readFile(new URL('../therride-products.json',import.meta.url)));
const baseline=JSON.parse(await fs.readFile(new URL('../catalog/baseline-snapshot.json',import.meta.url)));
const incoming=JSON.parse(await fs.readFile(new URL('../public/catalog/imported-products.json',import.meta.url)));
test('live plan publishes 103 inquiries, with stable existing IDs and no fabricated prices',()=>{
 const rows=planCataloguePublication(db,baseline.products);assert.equal(rows.length,103);assert.equal(rows.filter(p=>p.price_cents===null).length,2);
 const oldIds=new Set(baseline.products.map(p=>p.id));assert.equal(rows.filter(p=>oldIds.has(p.id)).length,5);
 for(const p of rows){assert.equal(p.is_active,true);assert.equal(p.inventory_confirmed,false);assert.equal(p.specs.catalogue_source,'surron_fans');assert.equal(p.specs.purchase_mode,'inquiry');assert.equal(p.compare_at_cents,null);assert.ok(!('catalogue_only' in p));assert.ok(!JSON.stringify(p).includes('original_price'));}
 const after=baseline.products.filter(p=>!rows.some(r=>r.id===p.id)).concat(rows);assert.equal(after.length,147);assert.deepEqual(planCataloguePublication(db,after),rows);
});
test('published database wins over bundled data, including admin edits and hidden products',async()=>{
 const rows=planCataloguePublication(db,baseline.products);rows[0].name='Име, редактирано от собственика';rows[0].variants[0].stock_quantity=3;
 const visible=rows.slice(0,-1);const result=await loadCombinedCatalog({readRemote:async()=>({products:visible,settings:{catalogue_imports:['surron_fans']}}),readImported:async()=>incoming,readBaseline:async()=>{throw Error('not used');}});
 assert.equal(result.products.length,102);assert.equal(result.products[0].name,rows[0].name);assert.equal(result.products[0].variants[0].stock_quantity,3);
 const alias=result.products.find(p=>p.specs.catalogue_route_aliases.length);assert.equal(productAtRoute(result.products,alias.specs.catalogue_route_aliases[0]).id,alias.id);
});
test('all four model pages have working routes, SEO and honest model filters',()=>{
 assert.equal(MODEL_PAGES.length,4);for(const p of MODEL_PAGES){const route=modelPagePath(p.model);assert.equal(modelPageAtPath(route).model,p.model);assert.ok(pageMeta(route).title.includes(p.model));}
 assert.equal(filterProducts(incoming.products,{model:'Ultra Bee'}).length,11);assert.equal(filterProducts(incoming.products,{model:'Storm Bee'}).length,0);
});
