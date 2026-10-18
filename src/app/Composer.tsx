import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, FONT, INPUT_SHADOW, L } from '../lib/tokens';

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
  onPasteImage,
  tall,
  showDisclaimer = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  onAttach?: (files: File[]) => void;
  onPasteImage?: (dataUrl: string) => void;
  /** الوضع غير المسجَّل: 768x102 لا 56 — من New Chat - Logged Out */
  tall?: boolean;
  showDisclaimer?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  /* يكبر حتى 200px ثم يُمرَّر */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(200, Math.max(tall ? 78 : L.inputH - 16, el.scrollHeight)) + 'px';
  }, [value, tall]);

  const canSend = value.trim().length > 0 && !streaming && !disabled;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: L.inputW }}>
      <div
        className="flex items-end gap-2 px-3 transition-shadow"
        style={{
          background: C.input,
          borderRadius: L.inputRadius,
          /* 56 ارتفاعًا في التصميم: النص 24 وحشو 16 */
          /* غير مسجَّل: 768x102 من New Chat - Logged Out؛ ومسجَّل: 768x56 */
          height: tall ? 102 : L.inputH,
          paddingTop: tall ? 12 : 0,
          paddingBottom: tall ? 12 : 0,
          boxShadow: focused ? INPUT_SHADOW + ', 0 0 0 1px var(--c-line)' : INPUT_SHADOW,
        }}
      >
        <button
          type="button"
          title="Add photos & files"
          onClick={() => fileRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full hover:bg-white/10"
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
              if (canSend) onSend();
            }
          }}
          onPaste={(e) => {
            const img = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
            if (!img) return;
            const f = img.getAsFile();
            if (!f) return;
            const r = new FileReader();
            r.onload = () => onPasteImage?.(String(r.result));
            r.readAsDataURL(f);
          }}
          rows={1}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-[var(--c-placeholder)]"
          style={{ fontFamily: FONT.sans, fontSize: 16, lineHeight: '24px', color: C.text, minHeight: 24, alignSelf: 'center' }}
          disabled={disabled}
        />

        <button
          type="button"
          title="Dictate"
          className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full hover:bg-white/10"
        >
          <Icon name="microphone" size={20} />
        </button>

        {streaming ? (
          <button
            type="button"
            title="Stop"
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full"
            style={{ background: '#ffffff', color: '#000000' }}
          >
            <Icon name="stop" size={18} style={{ opacity: 1 }} />
          </button>
        ) : (
          <button
            type="button"
            title="Use voice mode"
            onClick={canSend ? onSend : undefined}
            disabled={!canSend}
            className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full transition-colors"
            style={{
              background: canSend ? '#ffffff' : 'var(--c-active)',
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

      {showDisclaimer && (
        <p className="mt-2 text-center" style={{ fontSize: 12, color: C.muted }}>
          ChatGPT can make mistakes. Check important info.
        </p>
      )}
    </div>
  );
}
