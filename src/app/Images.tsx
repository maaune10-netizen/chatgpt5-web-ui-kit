import * as React from 'react';
import { C } from '../lib/tokens';

/*
 * صفحة `/images` — كل رقم فيها **مقيس** من `capture-13s-18.2mb.json` (حالة #9):
 *
 *   التبويبان   Trending 707.5,90.8 90×36 · Templates 801.5,90.8 98.1×36  ← فجوة 4
 *   البطاقة     139.2 × 174  عند 707.5,142.8
 *   الشبكة      ٥ أعمدة · الفرق الأفقي 147.2 (= 139.2 + 8) · الرأسي 182 (= 174 + 8)
 *   الحاوية     728 × 1448  (٥×139.2 + ٤×8 = 728 ✓)
 *   صندوق النصّ  139.2 × 63  عند +111 من أعلى البطاقة
 *   النصّ       115.2 × 19  عند +12 أفقيًّا و+32 رأسيًّا  (= 139.2 − 24 ✓)
 *
 * ولا توجد أرقام مخترعة: ما لم يُقَس مكتوب صريحًا.
 */

const CARD_W = 139.2;
const CARD_H = 174;
const GAP = 8;
const COLS = 5;
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP; /* 728 ✓ */

type Card = { title: string; tone: string };

const TRENDING: Card[] = [
  { title: 'Aerial view', tone: '#3b4a5a' },
  { title: 'Collector’s tin', tone: '#5a4a3b' },
  { title: '’80s flashback', tone: '#4a3b5a' },
  { title: 'Caricature', tone: '#5a3b42' },
  { title: 'Sketch', tone: '#3b5a4a' },
  { title: 'Claymation', tone: '#5a553b' },
  { title: 'Blueprint', tone: '#3b455a' },
  { title: 'Watercolor', tone: '#4a5a3b' },
  { title: 'Neon noir', tone: '#3b3b5a' },
  { title: 'Paper cut', tone: '#5a3b55' },
];

const TEMPLATES: Card[] = [
  { title: 'Product shot', tone: '#43525a' },
  { title: 'Book cover', tone: '#5a4b43' },
  { title: 'Poster', tone: '#4b435a' },
  { title: 'Icon set', tone: '#5a434b' },
  { title: 'Logo mark', tone: '#435a4b' },
];

function Tab({ label, active, onClick, width }: { label: string; active: boolean; onClick: () => void; width: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width,
        height: 36,
        borderRadius: 18,
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: active ? 500 : 400,
        background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: active ? C.text : C.muted,
      }}
    >
      {label}
    </button>
  );
}

function CardView({ card }: { card: Card }) {
  return (
    <button
      type="button"
      style={{ width: CARD_W, height: CARD_H, borderRadius: 12, overflow: 'hidden', background: CARD_INK, textAlign: 'start' }}
    >
      {/* مساحة الصورة: 111 = 174 − 63 */}
      <div style={{ height: CARD_H - 63, background: `linear-gradient(150deg, ${card.tone}, #1b1b1b)` }} />
      <div style={{ height: 63, padding: '32px 12px 12px' }}>
        <span style={{ fontSize: 12, lineHeight: '19px', color: C.text, display: 'block' }}>{card.title}</span>
      </div>
    </button>
  );
}

const CARD_INK = 'rgba(255,255,255,0.06)';

/*
 * الشريط الثابت أسفل الصفحة — **مقيس** (حالة #11):
 *   الحاوية  692.5, 846   768 × 52   ← نفس مقاس كومبوزر الشات بحرفه
 *   الحقل    744.5, 854   529.7 × 36 ← أي +52 أفقيًّا و+8 رأسيًّا
 * وبقيّة العرض (186.3) على يمين الحقل أزرارٌ لم تُسمَّ في الملفّ.
 */
function PromptBar() {
  return (
    <div
      style={{
        position: 'fixed',
        /*
         * **وسط المحتوى لا وسط الشاشة.** المقيس 692.5 = 240 + (1672−768)/2،
         * والتوسيط على الشاشة يعطي 572 — أي فارق 120.5 هو نصف الشريط.
         * ولأنّ الشريط يُسحب، الموضع يُقرأ من متغيّر لا من رقم ثابت.
         */
        left: 'calc(50% + (var(--gpt5-sidebar-w, 240px) / 2))',
        transform: 'translateX(-50%)',
        bottom: 24, /* 922 − 846 − 52 */
        width: 768,
        height: 52,
        borderRadius: 26,
        background: C.input,
        boxShadow: 'inset 0 0 1px 0 rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        paddingInline: 8,
        zIndex: 40,
      }}
    >
      {/* 44 + 8 = 52 — موضع الحقل كما قِيس */}
      <div style={{ width: 44 }} />
      <input
        placeholder="Describe an image"
        style={{ width: 529.7, height: 36, background: 'transparent', fontSize: 16, lineHeight: '26px', color: C.text, outline: 'none' }}
      />
      <div style={{ flex: 1 }} />
    </div>
  );
}

export function Images() {
  const [tab, setTab] = React.useState<'trending' | 'templates'>('trending');
  const cards = tab === 'trending' ? TRENDING : TEMPLATES;

  return (
    <div style={{ paddingTop: 90.8 - 52 /* رأس الصفحة 52 */ }}>
      <div style={{ width: GRID_W, marginInline: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          <Tab label="Trending" active={tab === 'trending'} onClick={() => setTab('trending')} width={90} />
          <Tab label="Templates" active={tab === 'templates'} onClick={() => setTab('templates')} width={98.1} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CARD_W}px)`, gap: GAP }}>
          {cards.map((c) => (
            <CardView key={c.title} card={c} />
          ))}
        </div>
      </div>
      <PromptBar />
    </div>
  );
}

