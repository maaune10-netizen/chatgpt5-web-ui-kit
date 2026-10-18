import { useEffect, useState } from 'react';
import { ChatApp } from './app/ChatApp';
import { DesignViewer } from './app/DesignViewer';
import { preloadIcons } from './lib/icons';
import { C } from './lib/tokens';

type Mode = 'app' | 'design';

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
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>(
    () => (typeof localStorage !== 'undefined' ? (localStorage.getItem('gpt5.theme') as 'dark' | 'light' | 'auto') : null) || 'auto',
  );
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

  const [mode, setMode] = useState<Mode>(() => {
    const h = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
    return h === 'design' ? 'design' : 'app';
  });

  useEffect(() => {
    preloadIcons();
  }, []);

  useEffect(() => {
    if (typeof location !== 'undefined') {
      history.replaceState(null, '', mode === 'design' ? '#design' : '#app');
    }
  }, [mode]);

  /*
   * تابع تغيير الـhash.
   *
   * كان الوضع يُقرأ عند الإقلاع فقط، وتغيير العنوان لا يُعيد تحميل الصفحة —
   * فمن يكتب #design بنفسه يبقى في التطبيق ولا يفهم لماذا لم يحدث شيء.
   */
  useEffect(() => {
    const onHash = () => setMode(location.hash.replace('#', '') === 'design' ? 'design' : 'app');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="h-full" style={{ background: C.body, color: C.text }}>
      {mode === 'app' ? <ChatApp theme={theme} onTheme={setTheme} /> : <DesignViewer />}

      {/* مبدّل الوضع — صغير وغير متطفّل */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'app' ? 'design' : 'app'))}
        title={mode === 'app' ? 'Show the extracted Figma screens' : 'Back to the working app'}
        className="fixed bottom-3 end-3 z-[300] rounded-full px-3 py-1.5 text-xs transition-colors hover:bg-white/15"
        style={{ background: 'rgba(255,255,255,0.10)', border: `1px solid ${C.line}`, color: C.muted, backdropFilter: 'blur(6px)' }}
      >
        {mode === 'app' ? 'Design' : 'App'}
      </button>
    </div>
  );
}
