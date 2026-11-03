import studio from '../../catalog/studio-photos.json' with {type:'json'};

const framesByUrl=new Map(studio.photos.map(frame=>[frame.url,frame]));
const framesBySource=new Map();
for(const frame of studio.photos){
 const related=framesBySource.get(frame.source_url)||[];
 related.push(frame);framesBySource.set(frame.source_url,related);
}

// Replace known legacy frames while preserving later administrator uploads.
export function withStudioMedia(product){
 const replaceGallery=(images=[])=>{
  const result=[];
  const add=image=>{if(!result.some(existing=>existing.url===image.url))result.push(image);};
  for(const image of images){
   const url=studio.legacy_urls[image.url];
   if(!url){add(image);continue;}
   const primary=framesByUrl.get(url);
   const makeImage=(frame,detail=false)=>({...image,url:frame.url,width:frame.width,height:frame.height,
    alt:product.name+(detail?' — детайл':' — студиен кадър')+(image.color?' · '+image.color:''),
    ...(detail?{role:'detail'}:{})});
   add(makeImage(primary));
   for(const frame of framesBySource.get(image.url)||[])if(frame.url!==url)add(makeImage(frame,true));
  }
  return result;
 };
 return {...product,images:replaceGallery(product.images),variants:(product.variants||[]).map(variant=>({...variant,images:replaceGallery(variant.images)}))};
}
