import { Icon } from './Icon';
import { C } from '../lib/tokens';

/**
 * سطح موجود في الموقع، غير مبنيّ عندنا بعد — **يُقال صراحةً**.
 *
 * بديلٌ عن رابط ميّت: الشريط الجانبي في اللقطة فيه Images وScheduled
 * وPlugins وCodex وExplore، ولا يصحّ أن تُحذف (فتخالف اللقطة) ولا أن تُترك
 * تُفتح على صفحة فارغة (فتكذب). فهذه الصفحة تقول ما هي وما ينقصها.
 */
export function NotBuilt({ title, needs, onLibrary }: { title: string; needs: string; onLibrary?: () => void }) {
  return (
    <div className="grid h-full place-items-center px-6" style={{ color: C.text }}>
      <div className="max-w-md text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{ background: 'var(--c-raised)', color: C.muted }}
        >
          <Icon name="placeholder" size={22} />
        </span>
        <h2 className="mt-4" style={{ fontSize: 20, fontWeight: 600 }}>
          {title}
        </h2>
        <p className="mt-2" style={{ fontSize: 14, lineHeight: '21px', color: C.muted }}>
          هذا السطح موجود في ChatGPT، ولم يُبنَ في هذه النسخة بعد.
        </p>
        <p className="mt-2" style={{ fontSize: 13, lineHeight: '19px', color: C.dim }}>
          يحتاج: {needs}
        </p>
        {onLibrary && (
          <button
            type="button"
            onClick={onLibrary}
            className="mt-5 rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--c-hover)]"
            style={{ border: `1px solid ${C.line}` }}
          >
            العودة إلى المكتبة
          </button>
        )}
      </div>
    </div>
  );
}
