import React from 'react';
import {ImageOff} from 'lucide-react';
import manifest from '../lib/image-manifest.json';
export function ProductImage({src,alt='',sizes='100vw',priority=false,...props}) {
 if(!src)return <div className="media-placeholder" role="img" aria-label={alt||'Снимката се подготвя'}><ImageOff size={32} strokeWidth={1.2}/><span>Снимката се подготвя</span></div>;
 const variants=manifest[src];return <img {...props} width={variants?.width||props.width} height={variants?.height||props.height} src={variants?.fallback||src} srcSet={variants?.srcSet} sizes={variants?sizes:undefined} alt={alt} loading={priority?'eager':'lazy'} decoding="async" fetchPriority={priority?'high':undefined}/>;
}
