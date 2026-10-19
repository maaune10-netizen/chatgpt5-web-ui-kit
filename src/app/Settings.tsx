import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, MENU_SHADOW } from '../lib/tokens';
import type { Config } from '../lib/llm';
import { listModels } from '../lib/llm';
import { SYSTEM_PROMPT_PRESETS, DEFAULT_SYSTEM_PROMPT } from '../lib/prompt';
import { limitsFor, isKnown } from '../lib/models';
import type { ReasoningEffort } from '../lib/llm';
import { preloadGenUI } from './genui-shared';

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
        <p className="px-3 py-2" style={{ fontSize: 12, color: 'var(--c-danger)' }}>
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
export function SettingsModal({
  config,
  onConfig,
  theme,
  onTheme,
  onClose,
}: {
  config: Config;
  onConfig: (c: Config) => void;
  theme: 'dark' | 'light' | 'auto';
  onTheme: (t: 'dark' | 'light' | 'auto') => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config);
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const lim = limitsFor(draft.model);
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
        style={{ background: 'var(--c-modal)', border: `1px solid ${C.line}`, boxShadow: MENU_SHADOW }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* الوضع — كما في Settings عند ChatGPT */}
          <div>
            <p className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>Appearance</p>
            <div className="flex gap-2">
              {([['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onTheme(v)}
                  className="flex-1 rounded-lg py-2.5 text-sm transition-colors"
                  style={{
                    background: theme === v ? 'var(--c-text)' : 'var(--c-hover)',
                    color: theme === v ? 'var(--c-body)' : 'var(--c-text)',
                    border: `1px solid ${theme === v ? 'transparent' : 'var(--c-line)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2" style={{ fontSize: 11, color: 'var(--c-dim)' }}>
              Auto follows your system — that is ChatGPT’s own default.
            </p>
          </div>

          <p className="rounded-lg px-3 py-2.5" style={{ background: 'var(--c-hover)', fontSize: 12, color: C.muted, lineHeight: '18px' }}>
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
            <p style={{ fontSize: 13, color: test.ok ? 'var(--c-ok)' : 'var(--c-danger)' }}>{test.msg}</p>
          )}

          {/*
           * ————— الواجهة التوليدية —————
           *
           * مقيس على ٢٧ طلبًا (`specs/openui-eval/REPORT.md`): مع التفكير
           * ٢٦–٢٧ ردًّا سليمًا، وبإطفائه ١٩. و`inlineMode` يجعل النموذج
           * **يختار**: نثرٌ ثم واجهة في سياج، أو نثرٌ فقط إن لم تلزم واجهة.
           */}
          <div>
            <p className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Generative UI
            </p>
            <div className="flex gap-2">
              {([false, true] as const).map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  onClick={() => {
                    set('genui', on);
                    /* يُحمَّل الآن لا عند أوّل واجهة — فالتبديل إعلان نيّة */
                    if (on) preloadGenUI();
                  }}
                  className="rounded-lg px-3 py-1.5"
                  style={{
                    fontSize: 12,
                    background: draft.genui === on ? C.active : C.raised,
                    color: draft.genui === on ? C.text : C.muted,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  {on ? 'On — OpenUI' : 'Off'}
                </button>
              ))}
            </div>
            <p className="mt-1.5" style={{ fontSize: 11, color: C.dim, lineHeight: '16px' }}>
              {draft.genui
                ? 'The model may answer with a rendered interface — tables, charts, forms, cards. It appears as a card in the thread, with a Canvas button to widen it. The system prompt below is not sent while this is on: OpenUI ships its own, and two competing instructions would fight.'
                : 'Answers are prose and Markdown only. Measured on 27 prompts: 26–27 produce a valid interface with thinking on, 19 with it off, and 2 answer in prose because the model decided prose was enough.'}
            </p>
          </div>

          {/* ————— تعليمات النظام ————— */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p style={{ fontSize: 13, fontWeight: 600 }}>System prompt</p>
              <select
                className="rounded-lg px-2 py-1"
                style={{ fontSize: 12, background: C.raised, color: C.text, border: `1px solid ${C.line}` }}
                value={SYSTEM_PROMPT_PRESETS.some((x) => x.value === draft.systemPrompt) ? draft.systemPrompt : '__custom'}
                onChange={(e) => {
                  if (e.target.value !== '__custom') set('systemPrompt', e.target.value);
                }}
              >
                {SYSTEM_PROMPT_PRESETS.map((x) => (
                  <option key={x.label} value={x.value}>
                    {x.label}
                  </option>
                ))}
                {!SYSTEM_PROMPT_PRESETS.some((x) => x.value === draft.systemPrompt) && (
                  <option value="__custom">Custom</option>
                )}
              </select>
            </div>
            <textarea
              value={draft.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="Leave empty to send no system message at all"
              className="w-full resize-y rounded-lg px-3 py-2 outline-none"
              style={{
                background: C.input,
                border: `1px solid ${C.line}`,
                color: C.text,
                fontSize: 12,
                lineHeight: '18px',
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <p className="mt-1" style={{ fontSize: 11, color: C.dim }}>
              {draft.genui ? (
                <span style={{ color: 'var(--c-danger)' }}>Not sent — Generative UI is on and uses OpenUI’s own prompt.</span>
              ) : draft.systemPrompt.trim() ? (
                `${draft.systemPrompt.length} characters sent as one system message before the conversation.`
              ) : (
                'No system message is sent — the model receives the conversation alone.'
              )}
              {!draft.genui && draft.systemPrompt === DEFAULT_SYSTEM_PROMPT ? ' (default)' : ''}
            </p>
          </div>

          {/*
           * ————— جهد التفكير —————
           * كان غائبًا فصار النموذج يفكّر بلا حدّ: ٨٣٨٥ حرفًا في «أعطني أسماء
           * مقهى»، وأول جواب بعد ٣٤ ثانية. والأسوأ: قد يستهلك الحدّ كلّه
           * تفكيرًا فلا يبقى للجواب شيء.
           */}
          <div>
            <p className="mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Thinking effort
            </p>
            <div className="flex gap-2">
              {(
                [
                  ['auto', 'Auto', 'provider default'],
                  ['off', 'Off', 'no reasoning at all'],
                  ['low', 'Low', 'fastest with thinking'],
                  ['high', 'High', 'slower, more thorough'],
                  ['max', 'Max', 'slowest'],
                ] as Array<[ReasoningEffort, string, string]>
              ).map(([v, label, hint]) => (
                <button
                  key={v}
                  type="button"
                  title={hint}
                  onClick={() => set('reasoningEffort', v)}
                  className="flex-1 rounded-lg py-2 transition-colors"
                  style={{
                    fontSize: 13,
                    background: draft.reasoningEffort === v ? 'var(--c-text)' : 'var(--c-hover)',
                    color: draft.reasoningEffort === v ? 'var(--c-body)' : 'var(--c-text)',
                    border: `1px solid ${draft.reasoningEffort === v ? 'transparent' : 'var(--c-line)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5" style={{ fontSize: 11, lineHeight: '16px', color: C.dim }}>
              Measured on “brainstorm names for a coffee shop”: Auto waited 34s before the first
              visible word, Low 10s, Off under a second. Turning it off also stops reasoning from
              consuming the output budget, which is what leaves a reply empty.
            </p>
          </div>

          {/* ————— معاملات النموذج ————— */}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 flex justify-between" style={{ fontSize: 12, color: C.muted }}>
                Temperature <b style={{ color: C.text }}>{draft.temperature.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={draft.temperature}
                onChange={(e) => set('temperature', Number(e.target.value))}
                className="w-full"
              />
              <span style={{ fontSize: 10, color: C.dim }}>0 exact · 2 wild</span>
            </label>

            <label className="block">
              <span className="mb-1 flex justify-between" style={{ fontSize: 12, color: C.muted }}>
                Top P <b style={{ color: C.text }}>{draft.topP.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={draft.topP}
                onChange={(e) => set('topP', Number(e.target.value))}
                className="w-full"
              />
              <span style={{ fontSize: 10, color: C.dim }}>nucleus sampling</span>
            </label>

            <label className="block">
              <span className="mb-1 block" style={{ fontSize: 12, color: C.muted }}>
                Max output tokens
              </span>
              <input
                type="number"
                min={0}
                max={lim.maxTokens}
                step={1024}
                value={draft.maxTokens}
                onChange={(e) => set('maxTokens', Math.min(Number(e.target.value), lim.maxTokens))}
                className="w-full rounded-lg px-2 py-1.5"
                style={{ background: C.input, border: `1px solid ${C.line}`, color: C.text, fontSize: 13 }}
              />
              <span style={{ fontSize: 10, color: C.dim }}>
                {isKnown(draft.model)
                  ? `model max ${lim.maxTokens.toLocaleString()} · 0 = provider default`
                  : '0 = provider default · model limits unknown'}
              </span>
            </label>
          </div>

          {/*
           * الأرقام الحقيقية من مخزن النماذج، لا مُقدَّرة.
           * وكنت أعرض 8192 بثقة — والحدّ الفعلي أكبر منه ٤٧ مرّة.
           */}
          <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--c-hover)', fontSize: 11, lineHeight: '17px', color: C.muted }}>
            <b style={{ color: C.text }}>{draft.model}</b>
            {isKnown(draft.model) ? (
              <>
                {' '}· context {lim.contextWindow.toLocaleString()} tokens · accepts {lim.input.join(' + ')}
                {lim.reasoning ? ' · produces reasoning' : ''}
                <br />
                cache read ${lim.cost.cacheRead}/M against ${lim.cost.input}/M for fresh input —{' '}
                <b style={{ color: C.text }}>
                  {lim.cost.cacheRead > 0 ? Math.round(lim.cost.input / lim.cost.cacheRead) + '× cheaper' : 'no caching'}
                </b>
                . Caching is prefix-based, so editing the system prompt discards it.
              </>
            ) : (
              <> · limits unknown, sending a conservative {lim.maxTokens.toLocaleString()} token ceiling</>
            )}
          </div>

          {/*
           * تحذير من قياس لا من تخمين: النموذج يستهلك الميزانية في تفكيره
           * قبل أن يكتب حرفًا. وmax_tokens=16 أعاد نصًّا فارغًا.
           */}
          {draft.maxTokens > 0 && draft.maxTokens < 1024 && (
            <p
              className="rounded-lg px-3 py-2"
              style={{
                fontSize: 11,
                lineHeight: '16px',
                background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)',
                color: C.muted,
              }}
            >
              Below 1024 this model usually returns nothing: it spends the whole budget on hidden
              reasoning before writing any visible text. Measured — a limit of 16 produced zero
              characters and 16 reasoning tokens.
            </p>
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
