import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],resolve:{preserveSymlinks:true},base:'./',server:{proxy:{'/api':{target:'http://127.0.0.1:8766',changeOrigin:true,headers:{origin:'http://127.0.0.1:8766'}},'/health':'http://127.0.0.1:8766'}},build:{target:'es2022',sourcemap:false}});
