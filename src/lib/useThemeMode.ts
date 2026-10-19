import { useEffect, useState } from 'react';

/**
 * الوضع الفعلي (فاتح/غامق) كما هو مطبَّق على الجذر.
 *
 * يُقرأ من `data-theme` لا من حالة React، فلا نسخة ثانية قد تتفرّع عن
 * `App.tsx`. ويُراقَب بـ`MutationObserver` فيتبع تبديل الثيم فورًا.
 */
export function useResolvedMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setMode(el.dataset.theme === 'light' ? 'light' : 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return mode;
}
