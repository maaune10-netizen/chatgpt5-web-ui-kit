import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    allowedHosts: ['.ts.net', 'localhost'],
    /*
     * الوسيط الخلفي.
     * المزوّد لا يسمح بأصل المتصفح، والمفتاح لا يصحّ أن يصل الصفحة.
     */
    proxy: {
      '/api': { target: 'http://127.0.0.1:5199', changeOrigin: true },
    },
  },
})
