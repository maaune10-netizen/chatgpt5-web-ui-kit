import { useMemo, useState, type ReactNode } from 'react';
import { Renderer, createParser } from '@openuidev/react-lang';
import { ThemeProvider, openuiChatLibrary, openuiComponentGroups, openuiLibrary } from '@openuidev/react-ui';
import '@openuidev/react-ui/layered/styles/index.css';
import { C, FONT } from '../lib/tokens';
import { useResolvedMode } from '../lib/useThemeMode';
import { Icon } from './Icon';
import { OPENUI_CHAT_SAMPLES, OPENUI_SAMPLES, type OpenUISample } from '../lib/openui-samples';

/**
 * معرض OpenUI — كل مكوّن في المكتبة معروضًا حيًّا.
 *
 * ولماذا صفحة مستقلّة لا دمجًا في المحادثة؟ لأنّ محادثة ChatGPT **لا تعرض
 * شجرة مكوّنات يولّدها النموذج** — فلو حشونا المعرض في الخيط لكسرنا مطابقة
 * التصميم، وهي أصل المشروع كلّه. فالمعرض هنا ليرى المرء ما يمكن، ثم يقرّر.
 *
 * ولا نموذج في هذه الصفحة: البرامج مكتوبة بخطّ اليد في `openui-samples.ts`،
 * فما يُرى هو **المكتبة**، لا قدرة `deepseek-v4.1-flash` على توليدها.
 * وهذا فصل مقصود: لو خلطناهما لما عرفنا أيّهما فسد عند أول خطأ.
 *
 * وكل برنامج يُتحقَّق منه بـ`createParser` قبل عرضه، فيظهر عدد الأخطاء
 * تحته إن وُجدت — فالصفحة مرجع واختبار في الوقت نفسه.
 */

type Lib = typeof openuiLibrary;
type Tab = 'general' | 'chat' | 'catalog';

interface Validation {
  ok: boolean;
  errors: string[];
  unresolved: string[];
  orphaned: string[];
}

function validate(program: string, lib: Lib): Validation {
  try {
    const parser = createParser(lib.toJSONSchema(), lib.root);
    const r = parser.parse(program);
    const errors = r.meta.errors.map(
      (e) => `${e.code}${e.component ? ' · ' + e.component : ''}${e.path ? ' @ ' + e.path : ''} — ${e.message}`,
    );
    return {
      ok: r.root !== null && !r.meta.incomplete && errors.length === 0 && r.meta.unresolved.length === 0 && r.meta.orphaned.length === 0,
      errors,
      unresolved: r.meta.unresolved,
      orphaned: r.meta.orphaned,
    };
  } catch (e) {
    return { ok: false, errors: ['parse-exception — ' + (e as Error).message], unresolved: [], orphaned: [] };
  }
}

/* ————— جدول الخصائص، مقروء من المخطّط لا من رأسي ————— */
interface PropRow {
  name: string;
  type: string;
  required: boolean;
}
interface CatalogEntry {
  name: string;
  description: string;
  props: PropRow[];
}

function typeOf(schema: Record<string, unknown>): string {
  if (typeof schema.$ref === 'string') return schema.$ref.replace('#/$defs/', '');
  if (Array.isArray(schema.enum)) return (schema.enum as string[]).map((v) => `"${v}"`).join(' | ');
  if (schema.type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    return items ? `${typeOf(items)}[]` : 'any[]';
  }
  if (Array.isArray(schema.anyOf)) {
    return (schema.anyOf as Record<string, unknown>[]).map(typeOf).join(' | ');
  }
  return typeof schema.type === 'string' ? schema.type : 'any';
}

function buildCatalog(lib: Lib): { groups: Array<{ name: string; notes: string[]; entries: CatalogEntry[] }>; total: number } {
  const defs = (lib.toJSONSchema() as { $defs?: Record<string, Record<string, unknown>> }).$defs || {};
  const groups = (lib.componentGroups || []).map((g) => {
    const group = g as unknown as { name: string; components: string[]; notes?: string[] };
    return {
      name: group.name,
      notes: group.notes || [],
      entries: group.components.map((name) => {
        const d = defs[name] || {};
        const props = (d.properties || {}) as Record<string, Record<string, unknown>>;
        const required = (d.required || []) as string[];
        return {
          name,
          description: typeof d.description === 'string' ? d.description : '',
          props: Object.entries(props).map(([pn, ps]) => ({ name: pn, type: typeOf(ps), required: required.includes(pn) })),
        };
      }),
    };
  });
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  return { groups, total };
}

function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'var(--c-ok, #1a7f37)' : tone === 'bad' ? 'var(--c-danger)' : C.muted;
  return (
    <span
      className="rounded-full px-2 py-0.5"
      style={{ fontSize: 11, color, background: 'var(--c-hover)', border: '1px solid var(--c-line)' }}
    >
      {children}
    </span>
  );
}

function SampleSection({ sample, lib }: { sample: OpenUISample; lib: Lib }) {
  const [open, setOpen] = useState(false);
  const v = useMemo(() => validate(sample.program, lib), [sample.program, lib]);

  return (
    <section className="mb-10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>{sample.group}</h2>
        <Chip tone={v.ok ? 'ok' : 'bad'}>
          {v.ok ? '✓ parses clean' : `${v.errors.length} error${v.errors.length === 1 ? '' : 's'}`}
        </Chip>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full px-3 py-1 transition-colors hover:bg-[var(--c-hover)]"
          style={{ fontSize: 12, color: C.muted }}
        >
          {open ? 'Hide the OpenUI Lang' : 'Show the OpenUI Lang'}
        </button>
      </div>

      <p style={{ fontSize: 13, color: C.muted, marginBottom: 8, maxWidth: 760 }}>{sample.note}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {sample.covers.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
      </div>

      {!v.ok && (
        <pre
          className="mb-3 overflow-x-auto rounded-xl p-3"
          style={{ fontSize: 12, fontFamily: FONT.mono, color: 'var(--c-danger)', background: 'var(--c-code)', whiteSpace: 'pre-wrap' }}
        >
          {[...v.errors, ...v.unresolved.map((u) => `unresolved — ${u}`), ...v.orphaned.map((o) => `orphaned — ${o}`)].join('\n')}
        </pre>
      )}

      {/* العرض الحيّ — هنا يُرسم البرنامج فعلًا */}
      <div className="overflow-hidden rounded-2xl p-4" style={{ background: 'var(--c-body)', border: '1px solid var(--c-line)' }}>
        <Renderer response={sample.program} library={lib} isStreaming={false} />
      </div>

      {open && (
        <pre
          className="mt-3 overflow-x-auto rounded-xl p-3"
          style={{ fontSize: 12, fontFamily: FONT.mono, color: C.text, background: 'var(--c-code)', whiteSpace: 'pre', lineHeight: '18px' }}
        >
          {sample.program}
        </pre>
      )}
    </section>
  );
}

function CatalogTable({ lib, label, covered }: { lib: Lib; label: string; covered: Set<string> }) {
  const { groups, total } = useMemo(() => buildCatalog(lib), [lib]);
  const live = groups.reduce((n, g) => n + g.entries.filter((e) => covered.has(e.name)).length, 0);
  return (
    <div>
      <p className="mb-6" style={{ fontSize: 13, color: C.muted }}>
        {label} — <strong style={{ color: C.text }}>{total}</strong> components in{' '}
        <strong style={{ color: C.text }}>{groups.length}</strong> groups; <strong style={{ color: C.text }}>{live}</strong> of them rendered live.
        Signatures read from <code style={{ fontFamily: FONT.mono }}>library.toJSONSchema()</code> of the installed package, not from the docs.
      </p>
      {groups.map((g) => (
        <section key={g.name} className="mb-8">
          <h3 className="mb-2" style={{ fontSize: 15, fontWeight: 600 }}>
            {g.name} <span style={{ color: C.muted, fontWeight: 400 }}>· {g.entries.length}</span>
          </h3>
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--c-line)' }}>
            {g.entries.map((e, i) => (
              <div key={e.name} className="px-3 py-2" style={{ borderTop: i ? '1px solid var(--c-line)' : undefined }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <code style={{ fontFamily: FONT.mono, fontSize: 13, color: C.text }}>{e.name}</code>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {e.props.length ? `${e.props.length} prop${e.props.length === 1 ? '' : 's'}` : 'no props'}
                  </span>
                  {covered.has(e.name) ? <Chip tone="ok">rendered live</Chip> : <Chip>catalog only</Chip>}
                </div>
                {e.description && (
                  <p className="mt-0.5" style={{ fontSize: 12, color: C.muted }}>
                    {e.description}
                  </p>
                )}
                {e.props.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {e.props.map((p) => (
                      <span key={p.name} style={{ fontSize: 11, fontFamily: FONT.mono, color: p.required ? C.text : C.dim }}>
                        {p.name}
                        {p.required ? '' : '?'}: {p.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {g.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {g.notes.map((n, i) => (
                <li key={i} style={{ fontSize: 11, color: C.dim }}>
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function OpenUIGallery({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const mode = useResolvedMode();

  const generalErrors = useMemo(() => OPENUI_SAMPLES.filter((s) => !validate(s.program, openuiLibrary).ok).length, []);
  const chatErrors = useMemo(() => OPENUI_CHAT_SAMPLES.filter((s) => !validate(s.program, openuiChatLibrary).ok).length, []);
  const coveredGeneral = useMemo(() => new Set(OPENUI_SAMPLES.flatMap((s) => s.covers)), []);
  const coveredChat = useMemo(() => new Set(OPENUI_CHAT_SAMPLES.flatMap((s) => s.covers)), []);

  return (
    <ThemeProvider mode={mode}>
      <div className="h-full overflow-y-auto" style={{ background: C.body, color: C.text }} data-openui-gallery="">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: 1100 }}>
          <div className="mb-1 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--c-raised)' }}>
              <Icon name="upgradeSparkle" size={18} />
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 600 }}>OpenUI — the whole catalog</h1>
            <div className="flex-1" />
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-[var(--c-hover)]"
                style={{ color: C.muted, border: '1px solid var(--c-line)' }}
              >
                Back to the app
              </button>
            )}
          </div>
          <p className="mb-5 max-w-3xl" style={{ fontSize: 13, color: C.muted, lineHeight: '20px' }}>
            Every component of <code style={{ fontFamily: FONT.mono }}>@openuidev/react-ui</code>, rendered from hand-written OpenUI Lang — no model in
            the loop. Two libraries: <strong style={{ color: C.text }}>general</strong> (root{' '}
            <code style={{ fontFamily: FONT.mono }}>Stack</code>) and <strong style={{ color: C.text }}>chat</strong> (root{' '}
            <code style={{ fontFamily: FONT.mono }}>Card</code>). Each program is validated with the library's own parser before it is shown.
          </p>

          <div className="mb-8 flex items-center gap-2">
            {(
              [
                ['general', `General (${OPENUI_SAMPLES.length} groups${generalErrors ? `, ${generalErrors} broken` : ''})`],
                ['chat', `Chat (${OPENUI_CHAT_SAMPLES.length}${chatErrors ? `, ${chatErrors} broken` : ''})`],
                ['catalog', 'Catalog — every component'],
              ] as Array<[Tab, string]>
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="rounded-full px-3 py-1.5 text-sm transition-colors"
                style={{ background: tab === t ? 'var(--c-active)' : 'transparent', color: tab === t ? C.text : C.muted }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'general' && OPENUI_SAMPLES.map((s) => <SampleSection key={s.group} sample={s} lib={openuiLibrary} />)}
          {tab === 'chat' && OPENUI_CHAT_SAMPLES.map((s) => <SampleSection key={s.group} sample={s} lib={openuiChatLibrary} />)}
          {tab === 'catalog' && (
            <>
              <CatalogTable lib={openuiLibrary} label="openuiLibrary" covered={coveredGeneral} />
              <div className="my-10" style={{ borderTop: '1px solid var(--c-line)' }} />
              <CatalogTable lib={openuiChatLibrary} label="openuiChatLibrary" covered={coveredChat} />
            </>
          )}

          <p className="mt-12 mb-4" style={{ fontSize: 11, color: C.dim }}>
            Source of truth: the installed packages, read at runtime. Signatures come from{' '}
            <code style={{ fontFamily: FONT.mono }}>toJSONSchema()</code>, groups and notes from{' '}
            <code style={{ fontFamily: FONT.mono }}>openuiComponentGroups</code> ({openuiComponentGroups.length} groups). Nothing on this page is
            quoted from memory.
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}
