import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withStudioMedia} from '../src/lib/studio-media.js';

const catalog=JSON.parse(fs.readFileSync(new URL('../catalog/published-snapshot.json',import.meta.url)));
const studio=JSON.parse(fs.readFileSync(new URL('../catalog/studio-photos.json',import.meta.url)));
const targetSlugs=new Set(studio.photos.map(photo=>photo.product_slug));
const targets=catalog.products.filter(product=>targetSlugs.has(product.slug));

test('studio galleries replace every old frame with 72 unique approved photos',()=>{
 const result=targets.map(withStudioMedia);
 assert.equal(result.length,41);
 assert.equal(result.reduce((count,product)=>count+product.images.length,0),72);
 for(const product of result){
  const galleries=[product.images,...product.variants.map(variant=>variant.images)];
  for(const images of galleries){
   assert.equal(new Set(images.map(image=>image.url)).size,images.length);
   assert.ok(images.every(image=>image.url.startsWith('/images/products/')));
  }
 }
 assert.ok(targets.some(product=>product.images.some(image=>studio.legacy_urls[image.url])),'input records must remain unchanged');
});

test('seat details and aliased originals stay stable across repeated catalogue loads',()=>{
 for(const product of targets){
  const once=withStudioMedia(product);
  assert.deepEqual(withStudioMedia(once),once);
 }
 assert.equal(withStudioMedia(targets.find(product=>product.slug==='sedalka-logo-surron')).images.length,5);
 assert.equal(withStudioMedia(targets.find(product=>product.slug==='povdigach-vilka')).images.length,2);
});

test('studio replacement preserves later admin uploads, prices and stock',()=>{
 const product=structuredClone(targets.find(product=>product.slug==='preden-panel-plate'));
 const upload={url:'https://example.com/new-admin-photo.webp',alt:'New upload'};
 product.images.push(upload);
 const result=withStudioMedia(product);
 assert.ok(result.images.includes(upload));
 assert.deepEqual({...result,images:[],variants:[]},{...product,images:[],variants:[]});
 assert.deepEqual(result.variants.map(({images,...rest})=>rest),product.variants.map(({images,...rest})=>rest));
});
