import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
 plugins: [react()],
 server: {
   port: 7734,
   host: true,
   strictPort: true,
   proxy: {
     '/api': {
       target: 'http://localhost:8834',
       changeOrigin: true,
       secure: false
     }
   }
 }
})
