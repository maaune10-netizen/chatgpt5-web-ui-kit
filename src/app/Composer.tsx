import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, FONT, INPUT_SHADOW, L } from '../lib/tokens';

/**
 * حدّ ما يُحوَّل إلى مرفق. أعلاه لا يدخل الصندوق.
 *
 * والقيمة اختيار: طويلة بما يكفي ألّا تتحوّل فقرة عادية إلى مرفق، وقصيرة
 * بما يكفي ألّا يبتلع نصٌّ ضخم الصندوق. وChatGPT يحوّل عند حدٍّ قريب من هذا.
 */
const LONG_PASTE = 1000;

/**
 * صندوق الإدخال — 768x56 بنصف قطر 28، من Prompt Input Field.
 *
 * ويكبر مع النص بدل أن يُمرَّر داخليًا، كما في ChatGPT.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = 'Ask ChatGPT',
  onAttach,
  onAttachText,
  onPasteImage,
  tall,
  showDisclaimer = true,
  thinking,
  onThinking,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text?: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  onAttach?: (files: File[]) => void;
  /**
   * نصّ طويل لُصق — يُبلَّغ ليُحفظ في «Files» بالمكتبة.
   * وكان يبقى في الصندوق وحده ولا يُسجَّل في أيّ مكان.
   */
  onAttachText?: (text: string) => void;
  onPasteImage?: (dataUrl: string) => void;
  /** الوضع غير المسجَّل: 768x102 لا 56 — من New Chat - Logged Out */
  tall?: boolean;
  showDisclaimer?: boolean;
  /** جهد التفكير الحالي — يُعرض في مفتاح `Think` */
  thinking?: 'auto' | 'off' | 'low' | 'high' | 'max';
  onThinking?: (v: 'auto' | 'off' | 'low' | 'high' | 'max') => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [thinkOpen, setThinkOpen] = useState(false);
  /*
   * النصّ الطويل الملصوق لا يدخل الصندوق بل يصير «مرفقًا» فوقه.
   *
   * وهذا ما يفعله ChatGPT فعلًا — مقروء من لقطة المستخدم:
   *   ┌──────────────────────────────┐
   *   │ ...s for a tea shop $  [📄][×]│
   *   │ إظهار في حقل النص ›           │
   *   └──────────────────────────────┘
   * ومربّع الكتابة يبقى فارغًا.
   *
   * وفائدته أنّ الصندوق لا يتضخّم بآلاف الأسطر، ويبقى النصّ ظاهرًا كمرفق
   * يُحذف أو يُعاد إلى الحقل بضغطة.
   */
  const [longText, setLongText] = useState<string | null>(null);

  /* يكبر حتى 200px ثم يُمرَّر */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(200, Math.max(tall ? 78 : L.inputH - 16, el.scrollHeight)) + 'px';
  }, [value, tall]);

  /* المرفق النصّي يُرسل مع ما في الصندوق، والمرفق وحده يكفي للإرسال */
  const outgoing = [longText, value].filter((x) => x && x.trim()).join('\n\n');
  const canSend = outgoing.trim().length > 0 && !streaming && !disabled;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: L.inputW }}>
      <div
        className="flex flex-col px-3 transition-shadow"
        style={{
          background: C.input,
          borderRadius: L.inputRadius,
          /*
           * `minHeight` لا `height`.
           *
           * كان الارتفاع ثابتًا ٥٦ ومربّع الكتابة يكبر حتى ٢٠٠ — فالنصّ الطويل
           * يتجاوز الحاوية **فيُقطع**. وقياس: نصّ يحتاج ١٣٦px وحاويته ٥٦،
           * أي ٨٠ بكسل من النصّ مختفية بلا تمرير.
           *
           * والتصميم محفوظ: ٥٦ حين يكون فارغًا (٧٦٨x٥٦)، و١٠٢ لغير المسجَّل
           * (٧٦٨x١٠٢) — وهي حدود دنيا لا سقوف.
           */
          minHeight: tall ? 102 : L.inputH,
          /*
           * حشو رأسيّ ٨ في الوضع العاديّ: ٨ + ٤٠ + ٨ = ٥٦، فيبقى التصميم كما هو.
           * ووجود الحشو هو ما يجعل الأزرار تلتصق بالأسفل لا بالحدّ نفسه.
           */
          paddingTop: tall ? 12 : 8,
          paddingBottom: tall ? 12 : 8,
          boxShadow: focused ? INPUT_SHADOW + ', 0 0 0 1px var(--c-line)' : INPUT_SHADOW,
        }}
      >
        {/* المرفق النصّي — فوق الصندوق، كما في اللقطة */}
        {longText && (
          <div className="flex justify-end pt-2">
            <div
              className="relative max-w-[60%] rounded-2xl px-3 py-2 pe-10"
              style={{ background: C.raised, border: `1px solid ${C.line}` }}
            >
              <button
                type="button"
                title="Remove"
                aria-label="Remove attachment"
                onClick={() => setLongText(null)}
                className="absolute end-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full"
                style={{ background: 'var(--c-active)' }}
              >
                <Icon name="close" size={12} />
              </button>
              <div className="flex items-center gap-2">
                <Icon name="document" size={18} style={{ color: C.muted, flexShrink: 0 }} />
                <span
                  dir="auto"
                  className="truncate"
                  style={{ fontSize: 13, color: C.text, maxWidth: 220 }}
                >
                  {'…' + longText.replace(/\s+/g, ' ').trim().slice(-40)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange(value.trim() ? longText + '\n\n' + value : longText);
                  setLongText(null);
                  ref.current?.focus();
                }}
                className="mt-0.5 flex items-center gap-1 hover:underline"
                style={{ fontSize: 12, color: C.muted }}
              >
                Show in text field
                <Icon name="chevronRight" size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
        <button
          type="button"
          title="Add photos & files"
          onClick={() => fileRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center self-end rounded-full hover:bg-white/10"
        >
          <Icon name="add" size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onAttach?.(files);
            e.target.value = '';
          }}
        />

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) {
                onSend(outgoing);
                setLongText(null);
              }
            }
          }}
          onPaste={(e) => {
            const img = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
            if (img) {
              const f = img.getAsFile();
              if (f) {
                const r = new FileReader();
                r.onload = () => onPasteImage?.(String(r.result));
                r.readAsDataURL(f);
                return;
              }
            }
            /* نصّ طويل → مرفق لا محتوى صندوق */
            const text = e.clipboardData.getData('text');
            if (text.length > LONG_PASTE) {
              e.preventDefault();
              setLongText(text);
              onChange('');
              onAttachText?.(text);
            }
          }}
          rows={1}
          placeholder={placeholder}
          /*
           * `maxHeight` هنا يطابق سقف الكبر في `useEffect` (٢٠٠) فيتحوّل
           * إلى تمرير داخلي بدل أن يدفع الصفحة.
           */
          className="flex-1 resize-none overflow-y-auto bg-transparent py-2 outline-none placeholder:text-[var(--c-placeholder)]"
          style={{
            fontFamily: FONT.sans,
            fontSize: 16,
            lineHeight: '24px',
            color: C.text,
            minHeight: 24,
            maxHeight: 200,
            alignSelf: 'center',
          }}
          disabled={disabled}
        />

        {/*
          `Think` — في الموقع مفتاح ظاهر دائمًا في الشريط، لا إعداد مخفيّ.
          ومقيس من اللقطة: أيقونة + كلمة، بلا خلفية حتى يُفتح.
        */}
        {onThinking && (
          <div className="relative shrink-0 self-end">
            <button
              type="button"
              onClick={() => setThinkOpen((o) => !o)}
              title={`Thinking effort: ${thinking ?? 'auto'}`}
              aria-haspopup="menu"
              aria-expanded={thinkOpen}
              className="flex h-8 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-white/10"
              style={{ color: thinking === 'off' ? C.dim : C.muted, fontSize: 13 }}
            >
              <Icon name="think" size={16} />
              Think
            </button>
            {thinkOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setThinkOpen(false)} />
                <div
                  className="absolute bottom-10 end-0 z-[61] w-40 overflow-hidden rounded-xl py-1"
                  style={{ background: C.menu, border: `1px solid ${C.line}`, boxShadow: 'var(--c-shadow-menu)' }}
                  role="menu"
                >
                  {(['auto', 'off', 'low', 'high', 'max'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="menuitemradio"
                      aria-checked={thinking === v}
                      onClick={() => {
                        onThinking(v);
                        setThinkOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-start capitalize transition-colors hover:bg-[var(--c-hover)]"
                      style={{ fontSize: 13, color: C.text }}
                    >
                      {v}
                      {thinking === v && <Icon name="check" size={14} style={{ opacity: 0.8 }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          title="Dictate"
          className="grid h-8 w-8 shrink-0 place-items-center self-end rounded-full hover:bg-white/10"
        >
          <Icon name="microphone" size={20} />
        </button>

        {streaming ? (
          <button
            type="button"
            title="Stop"
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full"
            style={{ background: 'var(--c-text)', color: 'var(--c-body)' }}
          >
            <Icon name="stop" size={18} style={{ opacity: 1 }} />
          </button>
        ) : (
          <button
            type="button"
            title="Use voice mode"
            onClick={
              canSend
                ? () => {
                    onSend(outgoing);
                    setLongText(null);
                  }
                : undefined
            }
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full transition-colors"
            style={{
              /* مقيس من اللقطة: #3a83f7 */
              background: canSend ? 'var(--c-text)' : 'var(--c-blue)',
              color: canSend ? 'var(--c-body)' : '#ffffff',
              cursor: canSend ? 'pointer' : 'default',
            }}
          >
            {canSend ? (
              <Icon name="arrowUp" size={18} style={{ opacity: 1 }} />
            ) : (
              <Icon name="voice" size={20} />
            )}
          </button>
        )}
        </div>
      </div>

      {showDisclaimer && (
        <p className="mt-2 text-center" style={{ fontSize: 12, color: C.muted }}>
          ChatGPT can make mistakes. Check important info.
        </p>
      )}
    </div>
  );
}
