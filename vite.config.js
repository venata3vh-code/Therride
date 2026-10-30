import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],define:{'import.meta.env.VITE_SITE_URL':JSON.stringify(process.env.VITE_SITE_URL||process.env.URL||'')},build:{target:'es2022',chunkSizeWarningLimit:450}});
