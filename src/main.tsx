import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
 * نمنع ودجة OpenUI التطويرية من حقن نفسها في الصفحة.
 *
 * شرطها في `@openuidev/react-lang` هو `process.env.NODE_ENV === 'development'`،
 * وسيرفر التطوير عندنا تطوير — فكانت تُضيف لوحة «Ready to share your app?»
 * وتجلب سكربتها من `cdn.jsdelivr.net`. أي أنّ «نسخة محليّة» تكلّم شبكةً
 * وتُقحم واجهةً ليست لنا. (وفي بناء الإنتاج يُحذف الشرط أصلًا، فلا تظهر.)
 *
 * والراية موجودة في الحزمة لمنع التركيب المزدوج — فمن سبقها بها منعه. وهي
 * تُقرأ عند أوّل تقييم لـ`@openuidev/react-lang`، فمكانها هنا قبل أي استيراد
 * كسول له.
 */
;(globalThis as unknown as Record<symbol, boolean>)[Symbol.for('openui.devtools.autoMount')] = true

/*
 * بلا StrictMode.
 *
 * وهو مفيد عمومًا: يشغّل التأثيرات مرّتين لكشف عدم النقاء. لكنه في تطبيق
 * يفتح اتصالًا طويلًا يعني **اتصالين**، وأحدهما يُهجر ثم يُلغى — فيبدو
 * البثّ معلّقًا بلا سبب ظاهر. ولا وجود له في الإنتاج أصلًا، فإبقاؤه يعني
 * اختبار شيء غير الذي سيُشغَّل.
 */
createRoot(document.getElementById('root')!).render(<App />)
