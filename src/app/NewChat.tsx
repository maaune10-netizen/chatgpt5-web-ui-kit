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

/**
 * الاقتراحات — **ثلاثة أسطر بأيقونات، للزائر فقط**.
 *
 * وكانت أربع بطاقات للجميع. واللقطة تقول غير ذلك:
 *   • الزائر: ثلاثة أسطر (قلم · كتاب · علامة سؤال) تحت الصندوق.
 *   • المسجَّل: **لا شيء** — الشاشة فارغة تحت الصندوق.
 */
const SUGGESTIONS = [
  { icon: 'edit', text: 'Make this message easier to follow' },
  { icon: 'book', text: 'Teach me something in 5 minutes' },
  { icon: 'help', text: 'Create a five question trivia challenge' },
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
  thinking,
  onThinking,
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
  thinking?: 'auto' | 'off' | 'low' | 'high' | 'max';
  onThinking?: (v: 'auto' | 'off' | 'low' | 'high' | 'max') => void;
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
            {/* من اللقطة: المسجَّل «What's on your mind today?» · الزائر «Where should we begin?» */}
            {signedIn ? "What's on your mind today?" : 'Where should we begin?'}
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
              /*
               * لا `tall` بعد اليوم: الـKit رسم صندوق الزائر 768x102، واللقطة
               * تقول ٤٤ سطرًا واحدًا. والصندوق هنا واحد في الحالتين.
               */
              tall={false}
              onAttach={onAttach}
              onAttachText={onAttachText}
              onPasteImage={onPasteImage}
              showDisclaimer={false}
              /* `Think` للمسجَّل فقط — الزائر لا يراه في اللقطة */
              thinking={signedIn ? thinking : undefined}
              onThinking={signedIn ? onThinking : undefined}
            />
          </div>

          {/*
            الاقتراحات للزائر فقط، أسطرًا لا بطاقات — كما في لقطة `/`.
            والمسجَّل لا يرى شيئًا تحتها.
          */}
          {!signedIn && (
            <div className="mt-4 flex flex-col">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => onSuggestion(s.text)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-start transition-colors hover:bg-[var(--c-hover)]"
                >
                  <Icon name={s.icon} size={18} style={{ color: C.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, lineHeight: '20px', color: C.text }}>{s.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
