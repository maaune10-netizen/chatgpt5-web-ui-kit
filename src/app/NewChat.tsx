import { Icon } from './Icon';
import { Composer } from './Composer';
import { C, L } from '../lib/tokens';

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
/*
 * النصوص **حرفيًّا** من capture على `/`، بالترتيب نفسه:
 *   y=285 «Create an image or sticker» · y=337 «Write or edit» · y=389 «Search the web»
 * ومقيس: كل صفّ 768×52، والتباعد 52، والنصّ عند 52 من اليسار.
 */
/*
 * الأيقونات **ملفّات الموقع نفسه**، لا مرسومة عندنا.
 *
 *   persistent.oaistatic.com/chatgpt/icons/use-case-icons//gray/{name}@3x.png
 *
 * وظهرت في سجلّ CSP عند المستخدم: كانت الصور تُرفض لأنّ `fetch` طلب
 * `credentials: 'include'` وخادمها يرسل `ACAO: *`. والملفّات نُزّلت من هنا
 * مباشرة، فلم تعد تحتاج التقاطًا.
 */
const SUGGESTIONS = [
  { src: '/app-icons/site/image-square-gray.png', text: 'Create an image or sticker' },
  { src: '/app-icons/site/pencil-gray.png', text: 'Write or edit' },
  { src: '/app-icons/site/globe-gray.png', text: 'Search the web' },
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
      <div className="flex min-h-0 flex-1 items-start justify-center px-6">
        {/* إزاحة للأعلى كما في التصميم. وتختلف بين الحالتين لأن سطر
            الإخلاء في الأسفل يزيد ارتفاع الكتلة في الوضع غير المسجَّل. */}
        {/*
          **الحدّ الأعلى مثبَّت، لا الوسط.** كان التوسيط يحرّك الكتلة إلى
          الأعلى كلّما نما الصندوق — فيبدو الشريط «نازلًا».
          والمقيس: العنوان عند 143 في ارتفاع 498، أي 90.5 من أعلى المحتوى.
          فالثابت هو الحدّ الأعلى، والنموّ يمتدّ إلى الأسفل.
        */}
        <div
          className="w-full"
          style={{ maxWidth: L.threadW, marginTop: 'calc(50vh - 158.5px)' }}
        >
          {/* العنوان في التصميم: 30/600 بارتفاع سطر 36 — لا 24/31 كما خمّنت */}
          <h1
            className="text-center"
            /* مقيس: 24px / 28.8px / w400 — لا 30/36/600. وكان خطّنا أثقل. */
            style={{ fontSize: 24, lineHeight: '28.8px', fontWeight: 400 }}
          >
            {/* من اللقطة: المسجَّل «What's on your mind today?» · الزائر «Where should we begin?» */}
            {/*
              المستخدم يرى على الموقع «Where should we begin?» في الحالتين.
              ولقطة سابقة أظهرت «What's on your mind today?» — فقد يكون اختبارًا
              متغيّرًا عندهم. اتّبعنا ما يراه الآن، والقياس القادم يحسم.
            */}
            Where should we begin?
          </h1>

          {/*
            الفراغ من التصميم، مقيسًا من نهاية نص العنوان لا من غلافه:
              مسجَّل   العنوان ينتهي 423 والصندوق 445 ← 22
              غير مسجَّل ينتهي 388 والصندوق 419 ← 31
          */}
          <div style={{ marginTop: 38 }}>  {/* مقيس: عنوان 143 · صندوق 209 (فرق 66) · عنوان بارتفاع 32 */}
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
            الاقتراحات في **الحالتين** — والمقيس من capture على `/` لِحساب
            مسجَّل: الصفوف موجودة. وكانت للزائر فقط، وهذا خطأ قراءة لقطة.
          */}
          <div className="flex flex-col" style={{ marginTop: 11 }}>  {/* مقيس: صندوق ينتهي 261 · أوّل صفّ يبدأ 272 */}
            {SUGGESTIONS.map((s) => (
              <div key={s.text} className="group flex items-center" style={{ height: 52 }}>
                <button
                  type="button"
                  onClick={() => onSuggestion(s.text)}
                  className="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-start transition-colors hover:bg-[var(--c-hover)]"
                  style={{ height: 52, paddingInlineStart: 16 }}
                >
                  <img src={s.src} alt="" width={20} height={20} style={{ flexShrink: 0, opacity: 0.95 }} />
                  <span className="truncate" style={{ fontSize: 16, lineHeight: '26px', color: C.muted }}>{s.text}</span>
                </button>
                <button
                  type="button"
                  title="Dismiss suggestion"
                  aria-label="Dismiss suggestion"
                  className="grid shrink-0 place-items-center rounded-md opacity-0 transition-opacity hover:bg-[var(--c-hover)] group-hover:opacity-100"
                  style={{ width: 36, height: 36, color: C.muted }}
                  onClick={(e) => (e.currentTarget.parentElement as HTMLElement).style.display = 'none'}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
