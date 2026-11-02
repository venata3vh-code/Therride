export const SUPPORTED_IMPORT_MODELS=['Light Bee X','Light Bee S','Ultra Bee','Storm Bee'];
const cents=(n,d)=>Number((2n*n+d)/(2n*d));
export function derivePrice(amount,currency='EUR') {
 if(amount===null||amount===undefined||String(amount).trim()==='')return {price_cents:null,original_eur_cents:null,review_required:true,reason:'missing_price'};
 const value=String(amount).trim().replace(',','.');
 if(!/^[+-]?\d+(\.\d{1,6})?$/.test(value))return {price_cents:null,original_eur_cents:null,review_required:true,reason:'invalid_price'};
 if(value.startsWith('-'))return {price_cents:null,original_eur_cents:null,review_required:true,reason:'non_positive_price'};
 const clean=value.replace(/^\+/,''),[whole,fraction='']=clean.split('.');
 const numerator=BigInt(whole+fraction),denominator=10n**BigInt(fraction.length);
 let euroCents;
 if(currency==='EUR')euroCents=cents(numerator*100n,denominator);
 else if(currency==='BGN')euroCents=cents(numerator*100n*100000n,denominator*195583n);
 else return {price_cents:null,original_eur_cents:null,review_required:true,reason:'unsupported_currency'};
 if(!Number.isSafeInteger(euroCents))return {price_cents:null,original_eur_cents:null,review_required:true,reason:'invalid_price'};
 const result=euroCents-500;
 return {price_cents:result>0?result:null,original_eur_cents:euroCents,review_required:result<=0,reason:result<=0?'non_positive_result':null};
}
export function clearedImage(image){return !!image&&typeof image.url==='string'&&image.url.startsWith('/product-images/')&&!image.url.includes('..')&&!/[?#]/.test(image.url)&&image.license?.status==='approved'&&image.license?.commercial_use===true&&image.product_match_verified===true&&!!image.license?.evidence_url;}
export function canPublish(product){return product.publication?.in_scope===true&&product.publication?.approved===true&&product.publication?.status==='approved'&&product.compatible_models?.some(m=>SUPPORTED_IMPORT_MODELS.includes(m))&&Number.isInteger(product.price_cents)&&product.price_cents>0&&product.variants?.every(v=>Number.isInteger(v.price_cents)&&v.price_cents>0)&&product.images?.length>0&&product.images.every(clearedImage)&&product.variants.every(v=>v.images?.length>0&&v.images.every(clearedImage))&&!product._internal?.price_review&&!product._internal?.identity_review;}
export function canDisplayCatalogue(product){return product.publication?.in_scope===true&&product.publication?.status==='catalogue'&&product.catalogue_only===true&&product.specs?.purchase_mode==='inquiry'&&product.compatible_models?.some(m=>SUPPORTED_IMPORT_MODELS.includes(m));}
export function validateCatalog(catalog){
 const errors=[],warnings=[];if(catalog?.schema_version!==1||!Array.isArray(catalog.products))return {errors:['Unsupported catalogue schema'],warnings};
 const identities=new Set(),skus=new Set(),slugs=new Set(),variantIds=new Set(),covered=new Set();
 for(const p of catalog.products){
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(p.id))errors.push('Invalid ID: '+p.sku);
  for(const [set,value,label] of [[identities,p.id,'ID'],[skus,p.sku?.toLowerCase(),'SKU'],[slugs,p.slug,'slug']]){if(!value||set.has(value))errors.push('Duplicate/missing '+label+': '+value);set.add(value);}
  if(!p.name||!p.description||!p.seo_title||!p.seo_description)errors.push('Missing content: '+p.sku);
  if(!p.variants?.length)errors.push('Missing variants: '+p.sku);
  for(const v of p.variants||[]){
   if(variantIds.has(v.id))errors.push('Duplicate variant: '+v.id);variantIds.add(v.id);
   const vs=v.sku?.toLowerCase();if(!vs||skus.has(vs))errors.push('Duplicate/missing variant SKU: '+vs);skus.add(vs);
   if(!Number.isInteger(v.stock_quantity)||v.stock_quantity<0)errors.push('Invalid stock: '+v.sku);
   if(v._internal?.original_price){const source=v._internal.original_price,price=derivePrice(source.amount,source.currency);if(price.price_cents!==v.price_cents||price.original_eur_cents!==v._internal.original_eur_cents)errors.push('Price mismatch: '+v.sku);const evidence=catalog.sources?.find(s=>s.number===v._internal.source_number);if(!evidence?.prices.some(p=>p.currency===source.currency&&Number(p.amount)===Number(source.amount)))errors.push('Original price not found in source evidence: '+v.sku);}
   else if(v.price_cents!==null)errors.push('Missing original price: '+v.sku);
   for(const im of v.images||[])if(!clearedImage(im))errors.push('Uncleared variant image: '+v.sku);
  }
  const valid=(p.variants||[]).map(v=>v.price_cents).filter(n=>Number.isInteger(n)&&n>0);
  const expected=valid.length===p.variants?.length?Math.min(...valid):null;
  if(p.price_cents!==expected)errors.push('Incorrect minimum price: '+p.sku);
  if(p.inventory_confirmed===false&&p.variants?.some(v=>v.availability==='in_stock'))errors.push('Unconfirmed stock marked available: '+p.sku);
  for(const im of p.images||[])if(!clearedImage(im))errors.push('Uncleared product image: '+p.sku);
  for(const key of ['compare_at_price','compare_at_price_cents','compare_at_cents','old_price'])if(key in p)errors.push('Unsupported promotional price: '+p.sku);
  if(p.is_active&&!canPublish(p)&&!canDisplayCatalogue(p))errors.push('Unreviewed product marked active: '+p.sku);
  if(!canPublish(p))warnings.push({sku:p.sku,reasons:p.missing_data||[]});
  (p._internal?.source_numbers||[]).forEach(n=>covered.add(n));
 }
 for(const s of catalog.sources||[])if(!covered.has(s.number))errors.push('Unhandled source: '+s.number);
 if(catalog.sources?.length!==catalog.source?.public_posts_processed)errors.push('Source count mismatch');
 return {errors,warnings};
}
const safeImages=images=>(images||[]).filter(clearedImage).map(({url,alt,color,license,product_match_verified})=>({url,alt:alt||'',...(color?{color}:{}),license,product_match_verified}));
export function toStoreProduct(p,{staticOnly=false}={}){
 if((!Number.isInteger(p.price_cents)||p.price_cents<=0)&&!(staticOnly&&canDisplayCatalogue(p)&&p.price_cents===null))throw Error('Price needs review: '+p.sku);
 const variants=p.variants.map(v=>({id:v.id,sku:v.sku,label:v.label,attributes:v.attributes,price_cents:v.price_cents,stock_quantity:v.stock_quantity,availability:p.inventory_confirmed&&v.inventory_confirmed&&v.stock_quantity>0?'in_stock':v.stock_quantity===0?'out_of_stock':'unknown',images:safeImages(v.images)}));
 return {id:p.id,sku:p.sku,name:p.name,slug:p.slug,subtitle:p.subtitle,description:p.description,price_cents:p.price_cents,category:p.category,colors:p.colors?.length?p.colors:['Стандартен'],images:safeImages(p.images),specs:{...p.specs,...(staticOnly?{purchase_mode:'inquiry'}:{})},variants,stock_quantity:variants.reduce((n,v)=>n+(v.stock_quantity||0),0),inventory_confirmed:p.inventory_confirmed===true,is_active:p.is_active===true&&(canPublish(p)||staticOnly&&canDisplayCatalogue(p)),...(staticOnly?{catalogue_only:canDisplayCatalogue(p)}:{}),featured:!!p.featured,sort_order:p.sort_order,manufacturer:p.manufacturer||'',fitment_type:p.fitment_type,compatible_models:p.compatible_models,model_years:p.model_years||'',fitment_notes:p.fitment_notes,seo_title:p.seo_title,seo_description:p.seo_description,missing_data:p.missing_data,source_references:p.source_references};
}
// Match by stable ID or case-insensitive SKU. Existing edits and actual inventory win.
export function mergeImportedProducts(existing,incoming,{preserveEditorial=true}={}){
 const result=existing.map(p=>structuredClone(p)),byId=new Map(result.map((p,i)=>[p.id,i])),bySku=new Map(result.filter(p=>p.sku).map((p,i)=>[p.sku.toLowerCase(),result.indexOf(p)]));
 for(const original of incoming){const p=structuredClone(original),at=byId.get(p.id)??bySku.get(p.sku?.toLowerCase());
  if(at!==undefined){const old=result[at];p.id=old.id;p.slug=old.slug;
   const retained=new Set();p.variants=(p.variants||[]).map(v=>{let ov=old.variants?.find(o=>o.id===v.id||o.sku&&o.sku.toLowerCase()===v.sku?.toLowerCase());if(!ov){const byLabel=(old.variants||[]).filter(o=>o.label===v.label);if(byLabel.length>1)throw Error('Ambiguous existing variant label: '+v.label);ov=byLabel[0];}if(ov)retained.add(ov.id);return ov?{...v,id:ov.id,sku:ov.sku||v.sku,stock_quantity:ov.stock_quantity,availability:ov.availability,images:ov.images||v.images}:v;});
   for(const v of old.variants||[])if(!retained.has(v.id)&&!p.variants.some(x=>x.id===v.id))p.variants.push(structuredClone(v));
   p.stock_quantity=p.variants?.length?p.variants.reduce((n,v)=>n+(v.stock_quantity||0),0):old.stock_quantity;p.inventory_confirmed=old.inventory_confirmed;
   if(p.variants?.length)p.price_cents=Math.min(...p.variants.map(v=>v.price_cents).filter(Number.isInteger));
   if(preserveEditorial)for(const key of ['name','description','subtitle','images','is_active','featured','specs','seo_title','seo_description','fitment_type','fitment_notes','compatible_models'])if(old[key]!==undefined)p[key]=old[key];
   result[at]={...old,...p};
  }else{if(result.some(o=>o.slug===p.slug))throw Error('Slug collision requires manual mapping: '+p.slug);const normalized=s=>String(s).toLocaleLowerCase('bg').replace(/[^\p{L}\p{N}]/gu,'');if(result.some(o=>o.category===p.category&&normalized(o.name)===normalized(p.name)))throw Error('Existing product name requires SKU alias mapping: '+p.sku);byId.set(p.id,result.length);if(p.sku)bySku.set(p.sku.toLowerCase(),result.length);result.push(p);}
 }
 return result;
}
export const CSV_HEADERS=['product_id','product_sku','name','slug','category','compatible_models','variant_id','variant_sku','variant_label','color','size','price_eur','price_cents','original_price','original_currency','original_eur_cents','stock_quantity','inventory_confirmed','availability','is_active','publication_status','in_scope','description','seo_title','seo_description','images_json','source_url','source_numbers','price_candidates_json','missing_data_json'];
export function csvRows(catalog){return [CSV_HEADERS,...catalog.products.flatMap(p=>p.variants.map(v=>[p.id,p.sku,p.name,p.slug,p.category,p.compatible_models.join('|'),v.id,v.sku,v.label,v.attributes?.color||'',v.attributes?.size||'',v.price_cents===null?'':(v.price_cents/100).toFixed(2),v.price_cents??'',v._internal.original_price?.amount||'',v._internal.original_price?.currency||'',v._internal.original_eur_cents??'',v.stock_quantity,p.inventory_confirmed,v.availability,p.is_active,p.publication.status,p.publication.in_scope,p.description,p.seo_title,p.seo_description,JSON.stringify(v.images),v._internal.source_url,p._internal.source_numbers.join('|'),JSON.stringify(p._internal.price_candidates),JSON.stringify(p.missing_data)]))];}
export function parseVariantCsv(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){value+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else value+=c;}
 else if(c==='"'){if(value||closed)throw Error('Invalid CSV quoting');quoted=true;}
 else if(c===','){row.push(value);value='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x!==''))rows.push(row);row=[];value='';closed=false;}
 else {if(closed)throw Error('Unexpected text after CSV quote');value+=c;}}
 if(quoted)throw Error('Unterminated CSV quote');if(row.length||value){row.push(value);rows.push(row);}const headers=rows.shift()||[];if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV columns');for(const h of CSV_HEADERS)if(!headers.includes(h))throw Error('Missing CSV column: '+h);return rows.map(r=>{if(r.length!==headers.length)throw Error('Incorrect CSV column count');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
}
export function catalogFromVariantCsv(text,base){
 const db=structuredClone(base),rows=parseVariantCsv(text),variants=new Map(db.products.flatMap(p=>p.variants.map(v=>[v.id,{p,v}]))),seen=new Set(),productSettings=new Map();
 for(const r of rows){const match=variants.get(r.variant_id);if(!match||match.p.id!==r.product_id||match.p.sku!==r.product_sku||match.v.sku!==r.variant_sku)throw Error('CSV identity does not match companion JSON: '+r.variant_sku);if(seen.has(r.variant_id))throw Error('Duplicate CSV variant: '+r.variant_id);seen.add(r.variant_id);const {p,v}=match;const amount=v.price_cents===null?'':String(v.price_cents);if(r.price_cents!==amount||r.original_price!==(v._internal.original_price?.amount||'')||r.original_currency!==(v._internal.original_price?.currency||''))throw Error('CSV price differs from source-checked companion JSON: '+r.variant_sku);if(!/^\d+$/.test(r.stock_quantity))throw Error('Invalid CSV stock');v.stock_quantity=Number(r.stock_quantity);if(!Number.isSafeInteger(v.stock_quantity))throw Error('Invalid CSV stock');if(!['unknown','in_stock','out_of_stock'].includes(r.availability))throw Error('Invalid CSV availability');v.availability=r.availability;if(!['true','false'].includes(r.inventory_confirmed))throw Error('Invalid CSV inventory confirmation');const confirmed=r.inventory_confirmed==='true';if(productSettings.has(p.id)&&productSettings.get(p.id)!==confirmed)throw Error('Inconsistent product inventory confirmation in CSV');productSettings.set(p.id,confirmed);p.inventory_confirmed=confirmed;v.inventory_confirmed=confirmed;}
 if(seen.size!==variants.size)throw Error('CSV is incomplete; companion JSON variants are missing');for(const p of db.products)p.stock_quantity=p.variants.reduce((n,v)=>n+v.stock_quantity,0);return db;
}
