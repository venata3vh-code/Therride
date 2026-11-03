import {withStudioMedia} from './studio-media.js';
const normalizedName=p=>[p.category,p.name].join('|').toLocaleLowerCase('bg').replace(/[^\p{L}\p{N}|]/gu,'');
// Display composition only. It never writes to the database or combines physical stock.
export function composeStoreCatalog(existing=[],catalogue=[]){
 const result=existing.map(input=>{const p=structuredClone(input);if(p.specs?.catalogue_source==='surron_fans'){p.catalogue_only=true;p.catalogue_route_aliases=p.specs.catalogue_route_aliases||[];}return p;});
 for(const input of catalogue){
  if(input.is_active!==true)continue;
  const next={...structuredClone(input),catalogue_route_aliases:[...(input.catalogue_route_aliases||[])]};
  let at=result.findIndex(p=>p.id===next.id||p.sku&&p.sku.toLowerCase()===next.sku?.toLowerCase());
  if(at<0&&next.catalogue_only)at=result.findIndex(p=>normalizedName(p)===normalizedName(next));
  if(at<0){result.push(next);continue;}
  const previous=result[at];
  // Once imported, the database is authoritative: admin edits, stock and hide/show win.
  if(previous.specs?.catalogue_source==='surron_fans')continue;
  next.catalogue_route_aliases=[...new Set([...(previous.catalogue_route_aliases||[]),...(next.catalogue_route_aliases||[]),next.slug].filter(s=>s!==previous.slug))];
  next.id=previous.id;next.slug=previous.slug;
  if(previous.sku!==next.sku||previous.specs?.identity_match_status==='display_only_pending_verification')next.specs={...next.specs,identity_match_status:'display_only_pending_verification'};
  // The incoming enquiry keeps its own unconfirmed quantities and cleared images.
  result[at]=next;
 }
 return result;
}
export function productAtRoute(products,slug){return products.find(p=>p.slug===slug||p.catalogue_route_aliases?.includes(slug)||p.specs?.catalogue_route_aliases?.includes(slug));}
export async function loadCombinedCatalog({readRemote,readBaseline,readImported}){
 const imported=await readImported();
 let base;try{base=await readRemote();}catch{base=await readBaseline();base={...base,settings:{...base.settings,checkout_enabled:false,stripe_enabled:false}};}
 const published=base.settings?.catalogue_imports?.includes('surron_fans');
 return {products:composeStoreCatalog(base.products,published?[]:imported.products||[]).map(withStudioMedia),settings:base.settings};
}
