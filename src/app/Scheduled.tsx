import { useState } from 'react';
import { C } from '../lib/tokens';
import { Composer } from './Composer';
import { Icon } from './Icon';

/*
 * صفحة `/scheduled` — **كل رقم من `capture-23s-53.2mb.json` (حالة #11)**:
 *
 *   الشبكة    707.5 · عرض 728  (كما في /images — نفس الإطار)
 *   الصف      728 × 74
 *   البطاقة   704 × 50  عند +12,+12   ← أي هامش 12 داخل الصف
 *   العنوان   628 × 24  عند +52 أفقيًّا (أي 40 بعد البطاقة)
 *   الوصف     628 × 24  عند +26 رأسيًّا من العنوان
 *   التباعد   74 بالضبط (الصفّ التالي = 74 + السابق)
 *   «Recommended» 160.4 × 32
 *   الكومبوزر placeholder: «Ask ChatGPT to schedule tasks, set reminders…»
 */

const ROW_H = 74;
const CARD_INSET = 12;

type Item = { title: string; body: string; active?: string };

/* النصوص **مقروءة من الملفّ**، لا مؤلَّفة */
const ITEMS: Item[] = [
  { title: 'Learn a language', body: 'Send me a daily lesson at my level, under ten minutes.', active: 'Active' },
  { title: 'Find a job', body: 'Send me new job matches every Monday and Thursday.' },
  { title: 'News updates', body: 'Send me a daily roundup of news on topics I follow.' },
  { title: 'Follow a topic', body: 'Alert me to big changes in a subject I care about.' },
  { title: 'Find new research', body: 'Send me new research on topics I care about.' },
  { title: 'Track industry news', body: 'Explain what’s changing in my industry every week.' },
  { title: 'Plan workouts', body: "Plan my week's workouts around my goals and schedule." },
  { title: 'Recommend a book', body: 'Pick three books for me each month, based on what I’ve read.' },
  { title: 'Outfit ideas', body: 'Pick an outfit from my clothes for each day.' },
  { title: 'What to watch', body: 'Suggest something to watch based on what I liked.' },
];

function Row({ item }: { item: Item }) {
  return (
    <div style={{ width: 728, height: ROW_H, padding: CARD_INSET, boxSizing: 'border-box' }}>
      <div
        style={{
          width: 704,
          height: 50,
          borderRadius: 10,
          background: 'transparent',
          paddingInlineStart: 40, /* 52 − 12 */
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* أيقونة الصف: plus-lg 20×20 بلون ثانوي — كما في الملفّ */}
        <span style={{ flex: '0 0 auto', marginTop: 4, opacity: 0.7, display: 'inline-flex' }}>
          <Icon name="plus" size={20} />
        </span>
        <div style={{ width: 628 }}>
          <div style={{ height: 24, fontSize: 14, lineHeight: '20px', color: C.text }}>{item.title}</div>
          <div style={{ height: 24, fontSize: 14, lineHeight: '20px', color: C.muted, marginTop: 2 }}>{item.body}</div>
        </div>
        {item.active && (
          <span
            style={{
              flex: '0 0 auto',
              height: 28,
              paddingInline: 10,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.1)',
              color: C.text,
              fontSize: 12,
              lineHeight: '28px',
            }}
          >
            {item.active}
          </span>
        )}
      </div>
    </div>
  );
}

export function Scheduled() {
  const [text, setText] = useState('');
  return (
    /*
     * الترتيب **مقيس**: H1 → +32.8 الوصف → +92.8 الكومبوزر → +24 القسم.
     * والكومبوزر **فوق** هنا، لا أسفل الصفحة كما في /images.
     */
    <div style={{ paddingTop: 82 }}>
      <div style={{ width: 728, marginInline: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ width: 488.2 }}>
            <h1 style={{ fontSize: 24, lineHeight: '28.8px', fontWeight: 400, color: C.text, margin: 0 }}>Scheduled</h1>
            <div style={{ height: 24, marginTop: 4, fontSize: 14, lineHeight: '20px', color: C.muted }}>
              Ask ChatGPT to schedule tasks, set reminders…
            </div>
          </div>
          {/* 85.7 × 28 على حدّ الشبكة الأيمن (1349.8 + 85.7 = 1435.5) */}
          <button
            type="button"
            style={{ width: 85.7, height: 28, borderRadius: 14, fontSize: 14, lineHeight: '20px', color: C.text, background: 'rgba(255,255,255,0.1)' }}
          >
            Active
          </button>
        </div>
        {/*
         * **الكومبوزر الحقيقي** — لا صناديق فارغة.
         * مقيس: 728×52، وزرّ + 36×36 عند +8، وأزرار يمينًا 80 و36.
         */}
        <div style={{ width: 728, marginTop: 36 }}>
          <Composer
            value={text}
            onChange={setText}
            onSend={() => setText('')}
            onStop={() => {}}
            streaming={false}
            placeholder="Ask ChatGPT to schedule tasks, set reminders…"
            showDisclaimer={false}
          />
        </div>
      </div>
      {/* 24 من أسفل الكومبوزر إلى «Recommended» */}
      <div style={{ width: 728, marginInline: 'auto', marginTop: 24, paddingBottom: 140 }}>
        <button
          type="button"
          style={{
            width: 160.4,
            height: 32,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.1)',
            color: C.text,
            fontSize: 14,
            lineHeight: '20px',
          }}
        >
          Recommended
        </button>
        {ITEMS.map((it) => (
          <Row key={it.title} item={it} />
        ))}
      </div>
    </div>
  );
}
