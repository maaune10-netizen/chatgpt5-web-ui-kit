import * as React from 'react';
import { Composer } from './Composer';

/*
 * **كومبوزر الصفحات** — واحد لا نسخة لكل صفحة.
 * مقيس على `/images`: 768×52 ثابتة أسفل الإطار، والحقل 529.7×36.
 * والأزرار هي أزرار الشات نفسها: Think · Dictate · Start Voice.
 *
 * وثباته في `Image` و`Sketch` وغيرهما — والموضع واحد: داخل الإطار،
 * بين حدّ الشريط وحدّ النافذة، بـ16 على الجانبين.
 */
export function PageComposer({ placeholder }: { placeholder: string }) {
  const [text, setText] = React.useState('');
  const [effort, setEffort] = React.useState<'auto' | 'off' | 'low' | 'high' | 'max'>('auto');
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        /*
         * **داخل الإطار لا فوقه:** يبدأ حيث ينتهي الشريط، فيتوسّط المحتوى
         * (692 = 240 + (1672−768)/2) ولا يدخل على الشريط حين تضيق الشاشة.
         */
        left: 'var(--gpt5-sidebar-w, 240px)',
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        paddingInline: 16,
        zIndex: 40,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 768 }}>
        <Composer
          value={text}
          onChange={setText}
          onSend={() => setText('')}
          onStop={() => {}}
          streaming={false}
          placeholder={placeholder}
          thinking={effort}
          onThinking={setEffort}
          showDisclaimer={false}
        />
      </div>
    </div>
  );
}
