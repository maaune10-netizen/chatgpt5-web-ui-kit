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
    /*
     * استثنِ مجلد البيانات من المراقبة.
     *
     * Vite يراقب كل ملف تحت الجذر، وكل رسالة تُحفظ تُغيّر `data/gpt5.db`
     * فيُرسل `full-reload` عبر WebSocket — فتُقتل المحادثة الجارية أثناء
     * بثّها. وقد ظهر كتقطّع عشوائي: يحدث فقط حين تُكتب قاعدة البيانات.
     */
    watch: {
      ignored: ['**/data/**', '**/public/generated-icons/**', '**/public/generated-images/**', '**/public/screens/**'],
    },
  },
})
