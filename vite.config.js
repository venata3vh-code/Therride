import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const previewFile=fileURLToPath(new URL('./catalog/catalog-preview.json',import.meta.url));
const cataloguePreview={name:'therride-local-catalogue-preview',configureServer(server){server.middlewares.use('/__therride-catalog-preview',async(req,res)=>{try{const body=await fs.readFile(previewFile,'utf8');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(body);}catch{res.statusCode=404;res.end('Run npm run catalog:preview first.');}});}};
export default defineConfig({plugins:[react(),cataloguePreview],server:{allowedHosts:['terminal.local']},define:{'import.meta.env.VITE_SITE_URL':JSON.stringify(process.env.VITE_SITE_URL||process.env.URL||'')},build:{target:'es2022',chunkSizeWarningLimit:450}});
