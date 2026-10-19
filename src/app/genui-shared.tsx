import { createContext, lazy, useContext } from 'react';

/**
 * الجسر بين الخيط وعارض OpenUI — **بلا وزن**.
 *
 * `GenUI.tsx` يستورد `@openuidev/*` (نحو ٢ ميجابايت)، فلا يجوز أن يستورده
 * `Markdown.tsx` الذي يُحمَّل مع كل رسالة. فهذا الملفّ صغير: فيه السياق
 * ودالّة تمييز اللغة و`lazy()` فقط. والوزن لا يُطلب إلا حين تظهر واجهة فعلًا.
 */

export interface GenUIActions {
  /** زرّ `@ToAssistant` يرسل رسالة إلى المحادثة */
  onSend?: (text: string) => void;
  /** «افتح في اللوحة» — الكتلة تُعرض على عرض أوسع */
  onExpand?: (code: string) => void;
}

export const GenUIContext = createContext<GenUIActions>({});

export const useGenUIActions = () => useContext(GenUIContext);

/**
 * وسم السياج الذي يكتبه النموذج. وفيه شرطة — وهي ما أفلت من نمطين سابقين
 * (`\w*` في محلّل الماركداون، و`[a-zA-Z]*` في أداة القياس) فأعلنا «لا سياج»
 * عن ردود كلّها سياج. فالمقارنة هنا على مجموعة صريحة لا على نمط.
 */
const LANGS = new Set(['openui-lang', 'openui', 'openuilang', 'openui_lang']);

export const isGenUILang = (lang?: string) => !!lang && LANGS.has(lang.toLowerCase());

export const GenUIBlock = lazy(() => import('./GenUI').then((m) => ({ default: m.GenUIBlock })));
export const GenUIPanel = lazy(() => import('./GenUI').then((m) => ({ default: m.GenUIPanel })));
