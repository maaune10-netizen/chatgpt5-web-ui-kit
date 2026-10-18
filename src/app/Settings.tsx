import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, MENU_SHADOW } from '../lib/tokens';
import type { Config } from '../lib/llm';
import { listModels } from '../lib/llm';

/* ————— محدّد النموذج — 113x36 بنصف قطر 8 من الترويسة ————— */
export function ModelMenu({
  config,
  onConfig,
  onClose,
}: {
  config: Config;
  onConfig: (c: Config) => void;
  onClose: () => void;
}) {
  const [models, setModels] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  useEffect(() => {
    listModels(config)
      .then((m) => setModels(m.filter((x) => !/embed|whisper|tts|image/i.test(x)).slice(0, 40)))
      .catch((e) => setErr(String(e.message || e)));
  }, [config]);

  return (
    <div
      ref={ref}
      className="absolute z-50 w-[320px] overflow-hidden rounded-2xl p-1"
      style={{ background: C.menu, boxShadow: MENU_SHADOW, top: 44, left: 12, maxHeight: '60vh' }}
      role="menu"
    >
      <p className="px-3 pb-1 pt-2" style={{ fontSize: 12, color: C.dim }}>
        Model
      </p>
      {err && (
        <p className="px-3 py-2" style={{ fontSize: 12, color: '#ffb4b4' }}>
          {err}
        </p>
      )}
      {!models && !err && (
        <p className="px-3 py-2" style={{ fontSize: 12, color: C.dim }}>
          Loading models…
        </p>
      )}
      <div className="max-h-[46vh] overflow-y-auto">
        {(models || [config.model]).map((m) => {
          const on = m === config.model;
          return (
            <button
              key={m}
              type="button"
              role="menuitem"
              onClick={() => {
                onConfig({ ...config, model: m });
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start hover:bg-white/[0.07]"
            >
              <Icon name={on ? 'check' : 'model'} size={18} />
              <span className="flex-1 truncate" style={{ fontSize: 14 }}>
                {m}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ————— الإعدادات ————— */
export function SettingsModal({ config, onConfig, onClose }: { config: Config; onConfig: (c: Config) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(config);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /* الإغلاق بـEscape — وكان غائبًا فبقي الحجاب يحجب النقر */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 pt-[8vh]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] overflow-hidden rounded-2xl"
        style={{ background: '#2b2b2b', border: `1px solid ${C.line}`, boxShadow: MENU_SHADOW }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', fontSize: 12, color: C.muted, lineHeight: '18px' }}>
            المفتاح يبقى في الخادم ولا يصل هذه الصفحة. لتغييره حرّر
            <code style={{ fontFamily: 'ui-monospace, monospace', margin: '0 4px' }}>.env.local</code>
            ثم أعد تشغيل الوسيط.
          </p>
          <Field label="Model" hint="deepseek-v4.1-flash هو الافتراضي">
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{ background: C.input, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}
            />
          </Field>

          {test && (
            <p style={{ fontSize: 13, color: test.ok ? '#8ee6a0' : '#ffb4b4' }}>{test.msg}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setTest(null);
                try {
                  const list = await listModels(draft);
                  setTest({ ok: true, msg: `الاتصال ناجح — ${list.length} نموذجًا متاحًا` });
                } catch (e) {
                  setTest({ ok: false, msg: String((e as Error).message) });
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-full px-4 py-2 text-sm"
              style={{ background: C.raised }}
            >
              Test connection
            </button>
            <button
              type="button"
              onClick={() => {
                onConfig(draft);
                onClose();
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: '#fff', color: '#000' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-2">
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {hint ? <span style={{ fontSize: 11, color: C.dim }}>{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
