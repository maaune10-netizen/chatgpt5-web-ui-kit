import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
 * بلا StrictMode.
 *
 * وهو مفيد عمومًا: يشغّل التأثيرات مرّتين لكشف عدم النقاء. لكنه في تطبيق
 * يفتح اتصالًا طويلًا يعني **اتصالين**، وأحدهما يُهجر ثم يُلغى — فيبدو
 * البثّ معلّقًا بلا سبب ظاهر. ولا وجود له في الإنتاج أصلًا، فإبقاؤه يعني
 * اختبار شيء غير الذي سيُشغَّل.
 */
createRoot(document.getElementById('root')!).render(<App />)
