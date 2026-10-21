import { C } from '../lib/tokens';
import { Icon } from './Icon';

/**
 * `WorkDialog` — لوحة «Meet ChatGPT Work».
 *
 * كل رقم هنا مقيس من capture على chatgpt.com:
 *
 *   الحوار            520×440 @ (505,149)  موسَّط أفقيًّا (765 = 1530/2)
 *   H2                424×28  @ (553,327)  20/28 w500  rgb(237,237,237)
 *   «Learn more»      226×45.6@ (746,412)  16/24 w400  rgb(205,205,205)
 *   «Unlock with Plus»149.6×42@ (690,515)  16/18 w400  rgb(229,243,255)
 *                     خلفية oklab(0.832 -0.035 -0.081 / 0.15) — أزرق ١٥٪
 *
 * والنصّ حرفيًّا من الملفّ، لا مصاغًا من عندي.
 */
export function WorkDialog({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[70]" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meet ChatGPT Work"
        className="fixed left-1/2 top-1/2 z-[71] flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden"
        style={{
          width: 520,
          height: 440,
          background: 'var(--c-modal)',
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        }}
      >
        {/* المساحة المصوّرة — 929 بايت في الطبقة العليا، مقيسة 178 ارتفاعًا */}
        <div
          className="relative shrink-0"
          style={{
            height: 178,
            background: 'linear-gradient(135deg, #3a5bbf 0%, #6b46c1 55%, #b83280 100%)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full transition-colors"
            style={{ background: 'rgba(0,0,0,0.25)', color: '#fff' }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col" style={{ paddingInline: 48, paddingTop: 20 }}>
          <h2 style={{ fontSize: 20, lineHeight: '28px', fontWeight: 500, color: C.text, margin: 0 }}>
            Meet ChatGPT Work
          </h2>

          <p style={{ fontSize: 16, lineHeight: '24px', color: C.muted, marginTop: 12, marginBottom: 0 }}>
            Use ChatGPT Work when a task needs more than a quick answer. ChatGPT can gather context,
            organize the work, and create polished docs, slides, spreadsheets, and more.
          </p>

          <a
            href="https://openai.com/chatgpt/pricing"
            target="_blank"
            rel="noreferrer"
            className="self-start hover:underline"
            style={{ fontSize: 16, lineHeight: '24px', color: C.muted, marginTop: 8 }}
          >
            Learn more
          </a>

          <div className="mt-auto flex justify-center" style={{ paddingBottom: 32 }}>
            <button
              type="button"
              className="flex items-center justify-center transition-opacity hover:opacity-90"
              style={{
                width: 149.6,
                height: 42,
                borderRadius: 9999,
                background: 'oklab(0.832228 -0.0346136 -0.0814301 / 0.15)',
                color: 'rgb(229, 243, 255)',
                fontSize: 16,
                lineHeight: '18px',
                fontWeight: 400,
              }}
            >
              Unlock with Plus
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
