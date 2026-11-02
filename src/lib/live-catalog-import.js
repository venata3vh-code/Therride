import {composeStoreCatalog} from './catalog-composition.js';
import {canDisplayCatalogue,canPublish,toStoreProduct,validateCatalog} from './product-import.js';

// Prepare explicit catalogue publication separately from the default draft importer.
export function planCataloguePublication(catalog,existing=[]){
 const check=validateCatalog(catalog);if(check.errors.length)throw Error(check.errors.join('\n'));
 const incoming=catalog.products.filter(p=>p.is_active&&(canDisplayCatalogue(p)||canPublish(p))).map(p=>toStoreProduct(p,{staticOnly:true}));
 const skus=new Set(incoming.map(p=>p.sku));
 return composeStoreCatalog(existing,incoming).filter(p=>skus.has(p.sku)).map(p=>{
  const old=existing.find(x=>x.id===p.id);
  const {catalogue_only,catalogue_route_aliases,created_at,updated_at,...row}=p;
  if(old?.specs?.catalogue_source==='surron_fans')return row;
  return {...row,compare_at_cents:null,specs:{...row.specs,catalogue_source:'surron_fans',catalogue_route_aliases:catalogue_route_aliases||[],...(old?.sku&&old.sku!==p.sku?{legacy_sku:old.sku}:{})}};
 });
}
