import { Suspense, lazy, useEffect, useState } from 'react';
import { ChatApp } from './app/ChatApp';
import { DesignViewer } from './app/DesignViewer';
import { preloadIcons } from './lib/icons';
import { C } from './lib/tokens';

/*
 * المعرض يُحمَّل عند الطلب لا مع الإقلاع.
 *
 * فـ`@openuidev/react-ui` يضيف نحو ٢ ميجابايت إلى الحزمة — وثمن لا يدفعه
 * من يريد محادثة. فلا يصل المتصفّح إلا من فتح `#openui`.
 */
const OpenUIGallery = lazy(() => import('./app/OpenUIGallery').then((m) => ({ default: m.OpenUIGallery })));

type Mode = 'app' | 'design' | 'openui';

/* العنوان هو المصدر: #design و#openui و#app */
const modeFromHash = (h: string): Mode => (h === 'design' ? 'design' : h === 'openui' ? 'openui' : 'app');

/**
 * غلاف التطبيق: وضعان.
 *
 * «App» تطبيق محادثة يعمل فعلًا — يكتب ويرسل ويستقبل من النموذج.
 * «Design» الشاشات الأربع والعشرون المستخرجة من Figma بكسلًا ببكسل.
 *
 * والثاني ليس زينة: هو المرجع الذي يُقاس عليه الأول عند أي شكّ في مطابقة
 * المقاسات، فيبقى الاثنان بجانب بعضهما.
 */
export default function App() {
  /*
   * الوضع على الجذر: كل الألوان متغيّرات CSS فتتغيّر معه بلا إعادة رسم.
   * و«auto» يتبع النظام، وهو افتراضي ChatGPT نفسه.
   */
  /*
   * أثر التطوير لا يظهر للمستخدم: `#design` في العنوان، أو Ctrl+Shift+D،
   * أو `?dev=1`. وكان الزرّ ظاهرًا في أسفل كل شاشة بلا سبب.
   */
  const [devMode, setDevMode] = useState(
    () =>
      typeof location !== 'undefined' &&
      (location.hash.includes('design') || location.hash.includes('openui') || new URLSearchParams(location.search).has('dev')),
  );

  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>(
    () => (typeof localStorage !== 'undefined' ? (localStorage.getItem('gpt5.theme') as 'dark' | 'light' | 'auto') : null) || 'auto',
  );
  /* Ctrl+Shift+D يُظهر زرّ الشاشات المستخرجة */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDevMode((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'auto' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const [mode, setMode] = useState<Mode>(() => modeFromHash(typeof location !== 'undefined' ? location.hash.replace('#', '') : ''));

  useEffect(() => {
    preloadIcons();
  }, []);

  useEffect(() => {
    if (typeof location !== 'undefined') {
      history.replaceState(null, '', '#' + mode);
    }
  }, [mode]);

  /*
   * تابع تغيير الـhash.
   *
   * كان الوضع يُقرأ عند الإقلاع فقط، وتغيير العنوان لا يُعيد تحميل الصفحة —
   * فمن يكتب #design بنفسه يبقى في التطبيق ولا يفهم لماذا لم يحدث شيء.
   */
  useEffect(() => {
    const onHash = () => setMode(modeFromHash(location.hash.replace('#', '')));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="h-full" style={{ background: C.body, color: C.text }}>
      {mode === 'app' && <ChatApp theme={theme} onTheme={setTheme} />}
      {mode === 'design' && <DesignViewer />}
      {mode === 'openui' && (
        <Suspense
          fallback={
            <div className="grid h-full place-items-center" style={{ color: C.muted, fontSize: 13 }}>
              Loading OpenUI…
            </div>
          }
        >
          <OpenUIGallery onBack={() => setMode('app')} />
        </Suspense>
      )}

      {/*
       * مبدّل الشاشات المستخرجة — أثر تطويري، فلا يُعرض في واجهة عادية.
       * يظهر بـ#design في العنوان أو بضغط Ctrl+Shift+D، فالمستخدم لا يراه
       * والمسؤول عنه يجده. وكان ظاهرًا دائمًا في أسفل الشاشة.
       */}
      {devMode && (
        <div
          className="fixed bottom-3 end-14 z-[300] flex items-center gap-1 rounded-full p-1"
          style={{ background: 'rgba(255,255,255,0.10)', border: `1px solid ${C.line}`, backdropFilter: 'blur(6px)' }}
        >
          {(
            [
              ['app', 'App', 'The working chat app'],
              ['design', 'Design', 'The 24 extracted Figma screens'],
              ['openui', 'OpenUI', 'Every component of @openuidev/react-ui, rendered'],
            ] as Array<[Mode, string, string]>
          ).map(([m, label, title]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              title={title}
              className="rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-white/15"
              style={{
                color: mode === m ? C.text : C.muted,
                background: mode === m ? 'rgba(255,255,255,0.14)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
