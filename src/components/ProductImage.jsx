import React from 'react';
import manifest from '../lib/image-manifest.json';
export function ProductImage({src,alt='',sizes='100vw',priority=false,...props}) {
  const variants=manifest[src];
  return <img {...props} src={variants?.fallback||src||'/images/logo.webp'} srcSet={variants?.srcSet} sizes={variants?sizes:undefined} alt={alt} loading={priority?'eager':'lazy'} decoding="async" fetchPriority={priority?'high':undefined}/>;
}
