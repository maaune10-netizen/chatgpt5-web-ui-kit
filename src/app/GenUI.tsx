import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Renderer, createParser } from '@openuidev/react-lang';
import { ThemeProvider, openuiLibrary } from '@openuidev/react-ui';
import '@openuidev/react-ui/layered/styles/index.css';
import { C, FONT } from '../lib/tokens';
import { useResolvedMode } from '../lib/useThemeMode';
import { Icon } from './Icon';
import { useGenUIActions } from './genui-shared';

/**
 * عرض الواجهة التي كتبها النموذج بلغة OpenUI.
 *
 * وهذا الملفّ **هو** الوزن: يستورد `@openuidev/*` (نحو ٢ ميجابايت). فلا
 * يستورده شيء إلّا `lazy()` في `genui.tsx`، ولا يُطلب إلّا حين يصل ردّ فيه
 * كتلة `openui-lang` فعلًا. من لم يسأل عن واجهة لا يدفع ثمنها.
 *
 * والنصّ يُحلَّل قبل العرض بـ`createParser` من المكتبة نفسها: الخطأ يُقال
 * صراحةً بدل أن يظهر مربّع فارغ لا يُعرف سببه.
 */

const PARSER = createParser(openuiLibrary.toJSONSchema(), openuiLibrary.root);

function check(code: string): { ok: boolean; issues: string[] } {
  try {
    const r = PARSER.parse(code);
    const issues = [
      ...r.meta.errors.map((e) => `${e.code}${e.component ? ' · ' + e.component : ''}${e.path ? ' @ ' + e.path : ''} — ${String(e.message)}`),
      ...r.meta.unresolved.map((u) => `unresolved — ${u}`),
      ...r.meta.orphaned.map((o) => `orphaned — ${o}`),
    ];
    const ok = r.root !== null && !r.meta.incomplete && issues.length === 0;
    if (!ok && r.root === null) issues.unshift('no usable root — nothing can be drawn');
    if (!ok && r.meta.incomplete) issues.unshift('the program is incomplete (a bracket or string never closed)');
    return { ok, issues };
  } catch (e) {
    return { ok: false, issues: ['parse-exception — ' + (e as Error).message] };
  }
}

/** المسرح: الثيم + العارض + ترجمة الأفعال إلى أفعال التطبيق */
function Stage({ code, roomy, complete = true }: { code: string; roomy?: boolean; complete?: boolean }) {
  const mode = useResolvedMode();
  const { onSend } = useGenUIActions();

  return (
    <ThemeProvider mode={mode}>
      <div style={{ padding: roomy ? 24 : 12 }}>
        <Renderer
          response={code}
          library={openuiLibrary}
          /* أثناء البثّ يُعلَم العارض، فتُعطَّل تفاعلات النماذج حتى يكتمل البرنامج */
          isStreaming={!complete}
          onAction={(e) => {
            const type = String(e.type);
            /*
             * `@OpenUrl` يُفتح في تبويب جديد، و`@ToAssistant` يُرسل رسالة —
             * فيدور الزرّ داخل المحادثة كما في ChatGPT، لا يبقى زينة.
             */
            if (type === 'open_url') {
              const url = String(e.params?.url ?? '');
              if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
              return;
            }
            if (type === 'continue_conversation') {
              const message = e.humanFriendlyMessage || String(e.params?.message ?? '');
              if (message) onSend?.(message);
            }
          }}
        />
      </div>
    </ThemeProvider>
  );
}

function ToolButton({ onClick, children, title }: { onClick: () => void; children: ReactNode; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-[var(--c-hover)]"
      style={{ fontSize: 11, color: C.muted }}
    >
      {children}
    </button>
  );
}

/** الكتلة داخل الخيط — بطاقة لا كتلة كود خام */
export function GenUIBlock({ code, complete = true }: { code: string; complete?: boolean }) {
  const { onExpand } = useGenUIActions();
  const [showCode, setShowCode] = useState(false);
  const v = useMemo(() => check(code), [code]);
  /* أثناء البثّ لا يُعرض عدد الأخطاء — البرنامج لم يكتمل بعد */
  const showIssues = complete && !v.ok;

  return (
    <div className="my-3 overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}`, background: 'var(--c-body)' }}>
      <div className="flex items-center gap-2 px-2 py-1" style={{ borderBottom: `1px solid ${C.line}` }}>
        <Icon name="upgradeSparkle" size={14} style={{ color: C.muted, marginInlineStart: 4 }} />
        <span style={{ fontSize: 11, color: C.muted, letterSpacing: 0.3 }}>GENERATED UI</span>
        {showIssues && (
          <span style={{ fontSize: 11, color: 'var(--c-danger)' }}>
            {v.issues.length} issue{v.issues.length === 1 ? '' : 's'}
          </span>
        )}
        <div className="flex-1" />
        <ToolButton title="Show the OpenUI Lang behind this" onClick={() => setShowCode((s) => !s)}>
          {showCode ? 'Hide code' : 'Code'}
        </ToolButton>
        <ToolButton title="Open on a wider surface" onClick={() => onExpand?.(code)}>
          <Icon name="canvas" size={13} />
          Canvas
        </ToolButton>
      </div>

      <Stage code={code} complete={complete} />

      {showIssues && (
        <div className="px-3 pb-3">
          <pre
            className="overflow-x-auto rounded-lg p-2"
            style={{ margin: 0, fontSize: 11, fontFamily: FONT.mono, color: 'var(--c-danger)', background: 'var(--c-code)', whiteSpace: 'pre-wrap' }}
          >
            {v.issues.join('\n')}
          </pre>
        </div>
      )}

      {showCode && (
        <pre
          className="overflow-x-auto px-3 py-2"
          style={{ margin: 0, fontSize: 12, fontFamily: FONT.mono, color: C.text, background: 'var(--c-code)', whiteSpace: 'pre', borderTop: `1px solid ${C.line}` }}
        >
          {code}
        </pre>
      )}
    </div>
  );
}

/** اللوحة — نفس البرنامج على عرض أوسع، حين لا يكفي عرض الخيط */
export function GenUIPanel({ code, onClose }: { code: string; onClose: () => void }) {
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[160] flex flex-col" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={onClose}>
      <div
        className="mx-auto my-6 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl"
        style={{ maxWidth: 1200, background: 'var(--c-modal)', border: `1px solid ${C.line}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
            <Icon name="close" size={16} />
          </button>
          <span style={{ fontSize: 13 }}>Generated UI</span>
          <div className="flex-1" />
          <ToolButton title="Show the OpenUI Lang" onClick={() => setShowCode((s) => !s)}>
            {showCode ? 'Hide code' : 'Code'}
          </ToolButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto" style={{ background: 'var(--c-body)' }}>
          <Stage code={code} roomy />
          {showCode && (
            <pre
              className="overflow-x-auto px-4 py-3"
              style={{ margin: 0, fontSize: 12, fontFamily: FONT.mono, color: C.text, background: 'var(--c-code)', whiteSpace: 'pre', borderTop: `1px solid ${C.line}` }}
            >
              {code}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
