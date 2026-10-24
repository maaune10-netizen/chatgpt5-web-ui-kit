import { C } from '../lib/tokens';

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
        {/* الكومبوزر: 728×52 · زرّ + 36 عند +8 · الحقل 580 عند +52 · وأزرار 80 و36 يمينًا */}
        <div
          style={{
            width: 728,
            height: 52,
            marginTop: 36, /* 92.8 − (28.8 + 4 + 24) = 36 */
            borderRadius: 26,
            background: C.input,
            boxShadow: 'inset 0 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            paddingInline: 8,
            gap: 8,
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.1)' }} />
          <input
            placeholder="Ask ChatGPT to schedule tasks, set reminders…"
            style={{ width: 580, height: 36, background: 'transparent', fontSize: 16, lineHeight: '26px', color: C.text, outline: 'none' }}
          />
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
            <div style={{ width: 80, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.1)' }} />
          </div>
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
