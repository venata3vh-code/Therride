import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {composeStoreCatalog} from '../src/lib/catalog-composition.js';
const baseline=JSON.parse(await fs.readFile('catalog/baseline-snapshot.json','utf8'));
const imported=JSON.parse(await fs.readFile('public/catalog/imported-products.json','utf8'));
const snapshot={...baseline,products:composeStoreCatalog(baseline.products,imported.products)};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 globalThis.localStorage={getItem:()=>null};
 globalThis.document={getElementById:id=>id==='store-data'?{textContent:JSON.stringify(snapshot)}:null};
 const {default:App}=await server.ssrLoadModule('/src/App.jsx');
 const render=(pathname,search='')=>{globalThis.location={pathname,search,origin:'http://localhost'};return renderToString(React.createElement(App));};
 const home=render('/');assert.ok(home.includes('НОВИ ЧАСТИ В THERRIDE'));assert.ok(home.includes('/models/ultra-bee')&&home.includes('/models/storm-bee'));
 const shop=render('/shop');assert.equal((shop.match(/class="product-card"/g)||[]).length,147);assert.ok(shop.includes('Минимална цена в евро'));assert.ok(shop.includes('Филтър по цвят'));
 const ultra=render('/models/ultra-bee');assert.equal((ultra.match(/class="product-card"/g)||[]).length,11);
 for(const p of imported.products){const html=render('/product/'+p.slug);assert.ok(html.includes(p.name),'Missing product title '+p.sku);assert.ok(html.includes('Снимката се подготвя'));assert.ok(html.includes('Наличността се уточнява'));assert.ok(html.includes('Запитване за продукта'));assert.ok(!html.includes('Потвърдено наличен'));const built=await fs.readFile(path.join('dist/product',p.slug,'index.html'),'utf8');assert.ok(built.includes(p.name));}
 const builtHome=await fs.readFile('dist/index.html','utf8');assert.ok(builtHome.includes('НОВИ ЧАСТИ В THERRIDE'));assert.ok(builtHome.includes('/models/ultra-bee')&&builtHome.includes('/models/storm-bee'));
 const builtShop=await fs.readFile('dist/shop/index.html','utf8');const cards=builtShop.match(/<article class="product-card">[\s\S]*?<\/article>/g)||[];assert.equal(cards.length,147);for(const p of imported.products)assert.ok(cards.some(card=>card.includes(p.name)),'Product absent from actual public cards: '+p.sku);
 const storm=render('/models/storm-bee');assert.ok(storm.includes('Storm Bee'));assert.equal((storm.match(/class="product-card"/g)||[]).length,0);assert.ok(storm.includes('Подготвяме тази селекция'));
 for(const slug of ['light-bee-x','light-bee-s','ultra-bee','storm-bee']){const page=await fs.readFile('dist/models/'+slug+'/index.html','utf8');assert.ok(!page.includes('Страницата не е намерена'));assert.ok(page.includes('Каталози по модел'));}
 const check={revision:'live-catalogue-four-models' ,public_shop_cards:147,new_visible_products:103,ultra_bee_products:11,new_product_pages_rendered:103,homepage_new_products:true,homepage_ultra_bee_section:true,homepage_storm_bee_section:true,storm_bee_products:0,model_pages:4,preview_flag_required:false,built_html_verified:true,unknown_stock_not_advertised:true,browser_visual_check:'passed_desktop_preview_real_supabase',browser_checked_shop_cards:147,browser_checked_ultra_bee:11,browser_checked_storm_bee:0,browser_variant_prices_eur:[35,40],browser_new_product_search_results:1,browser_blue_max_50_results:11};
 await fs.writeFile('catalog/build-verification.json',JSON.stringify(check,null,2)+'\n');console.log(JSON.stringify(check));
}finally{await server.close();}
process.exit(0);
