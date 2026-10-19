import { Icon } from './Icon';
import { Composer } from './Composer';
import { C, L, T } from '../lib/tokens';

/**
 * شاشة البداية — مقاساتها من `New Chat - Logged In` و`New Chat - Logged Out`.
 *
 * الفرق الجوهري عن ما بنيته أولًا: صندوق الإدخال **تحت العنوان مباشرةً**،
 * لا ملتصقًا بأسفل الشاشة. وفي التصميم:
 *
 *   مسجَّل:    العنوان y=373 · الإدخال y=445 · الاقتراحات y=509   (إطار 768)
 *   غير مسجَّل: العنوان y=338 · الإدخال y=419                     (إطار 768)
 *
 * والكتلة كلها قريبة من منتصف الإطار (922 ارتفاعًا)، فتُوسَّط وتُزاح للأعلى
 * قليلًا كما في التصميم.
 */

const SUGGESTIONS = [
  { icon: 'image', title: 'Create an image', sub: 'of a cat riding a bike' },
  { icon: 'think', title: 'Brainstorm', sub: 'names for a coffee shop' },
  { icon: 'edit', title: 'Help me write', sub: 'a thank-you note' },
  { icon: 'code', title: 'Write code', sub: 'to reverse a string' },
];

export function NewChat({
  signedIn,
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  onSuggestion,
  onAttach,
  onAttachText,
  onPasteImage,
}: {
  signedIn: boolean;
  value: string;
  onChange: (v: string) => void;
  onSend: (text?: string) => void;
  onStop: () => void;
  streaming: boolean;
  onSuggestion: (text: string) => void;
  onAttach?: (files: File[]) => void;
  onAttachText?: (text: string) => void;
  onPasteImage?: (src: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        {/* إزاحة للأعلى كما في التصميم. وتختلف بين الحالتين لأن سطر
            الإخلاء في الأسفل يزيد ارتفاع الكتلة في الوضع غير المسجَّل. */}
        <div className="w-full" style={{ maxWidth: L.threadW, transform: `translateY(${signedIn ? -38 : -46}px)` }}>
          {/* العنوان في التصميم: 30/600 بارتفاع سطر 36 — لا 24/31 كما خمّنت */}
          <h1
            className="text-center"
            style={{ fontSize: T.h1.size, lineHeight: `${T.h1.lh}px`, fontWeight: 600 }}
          >
            {/* من الموقع الحقيقي: غير المسجَّل يرى «Where should we begin?» */}
            {signedIn ? 'Ready when you are.' : 'Where should we begin?'}
          </h1>

          {/*
            الفراغ من التصميم، مقيسًا من نهاية نص العنوان لا من غلافه:
              مسجَّل   العنوان ينتهي 423 والصندوق 445 ← 22
              غير مسجَّل ينتهي 388 والصندوق 419 ← 31
          */}
          <div style={{ marginTop: signedIn ? 22 : 31 }}>
            <Composer
              value={value}
              onChange={onChange}
              onSend={onSend}
              onStop={onStop}
              streaming={streaming}
              placeholder="Ask ChatGPT"
              tall={!signedIn}
              onAttach={onAttach}
              onAttachText={onAttachText}
              onPasteImage={onPasteImage}
              showDisclaimer={false}
            />
          </div>

          {/* الاقتراحات تحت صندوق الإدخال — موضعها في التصميم y=509 */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => onSuggestion(`${s.title} ${s.sub}`)}
                /*
                 * كانت ساكنة تمامًا: لا حدّ يتغيّر ولا سطح يرتفع، فلا يُعرف
                 * أنّها تُضغط. والآن ترتفع قليلًا ويُضيء حدّها.
                 */
                className="group rounded-2xl px-3 py-2.5 text-start transition-all duration-150 hover:-translate-y-px hover:bg-[var(--c-hover)] active:translate-y-0"
                style={{ border: `1px solid ${C.line}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--c-divider)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--c-line)';
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon name={s.icon} size={16} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                </span>
                <span className="mt-0.5 block truncate" style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                  {s.sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
