#!/usr/bin/env node
/**
 * مطاردة الحلقة: «Let me do it. Let me write. Let me call.» × ن.
 *
 * وقد ظهرت في التطبيق، ولم تظهر في قياس OpenUI (٠ من ٢٧). فالفرق ليس النموذج
 * ولا المزوّد، بل ما **نرسله**. وثلاثة فروق محتملة، ولكلٍّ متغيّر هنا:
 *
 *   ١) `with-reasoning`  — تاريخ المحادثة يُعيد `reasoning_content` كما هو.
 *      والنموذج يعلن `requiresReasoningContentOnAssistantMessages: true`،
 *      ونحن نُعيده. **وهذه فرضيتي الأولى**: إعادة التفكير القديم تُغري النموذج
 *      بأن يتابع التفكير نفسه بدل أن يجيب.
 *   ٢) `strip-reasoning` — نفس المحادثة بلا `reasoning_content` في التاريخ.
 *   ٣) `no-thinking`     — التفكير مُطفأ أصلًا (`thinking: {type:'disabled'}`).
 *
 * والطلبات مختارة **لتُغري بنداء أداة** — فالنموذج في الحلقة التي رأيناها
 * كان يقول «Let me call»، ونصّ نظامنا يقول صراحةً إنّه لا يملك أدوات.
 *
 *   node tools/loop-probe.mjs
 *   node tools/loop-probe.mjs --runs 3
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loopiness, isLoop } from './loopiness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const p = join(ROOT, '.env.local');
  const out = {};
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
const env = loadEnv();
const BASE = (env.VITE_LLM_BASE_URL || '').replace(/\/$/, '');
const KEY = env.VITE_LLM_API_KEY || '';
const MODEL = env.VITE_LLM_MODEL || 'deepseek-v4.1-flash';

/* نصّ نظامنا الحقيقي — لا نسخة ثانية قد تتفرّع عنه */
const promptSrc = readFileSync(join(ROOT, 'src/lib/prompt.ts'), 'utf8');
const m = /export const DEFAULT_SYSTEM_PROMPT = `([\s\S]*?)`;/.exec(promptSrc);
if (!m) {
  console.error('لم أقرأ DEFAULT_SYSTEM_PROMPT من src/lib/prompt.ts');
  process.exit(1);
}
const SYSTEM = m[1];

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const RUNS = Number(flag('runs', '2'));
const EFFORT = flag('effort', 'auto'); // auto | off | low | high | max
const OUT = flag('out', join(ROOT, 'specs', 'openui-eval', `loop-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));

const TASKS = [
  { id: 'web', text: 'Search the web and tell me the current stable version of React.' },
  { id: 'file', text: 'Read the file /etc/hosts on this machine and summarize what is in it.' },
  { id: 'api', text: 'Call the weather API for Riyadh and tell me today\u2019s high.' },
  { id: 'repo', text: 'Look at my repository and tell me what changed this week.' },
  { id: 'control', text: 'Explain useEffect in two sentences.' },
];
const FOLLOW_UP = 'Go ahead and do it.';

const VARIANTS = [
  { id: 'with-reasoning', replayReasoning: true, thinking: true },
  { id: 'strip-reasoning', replayReasoning: false, thinking: true },
  { id: 'no-thinking', replayReasoning: false, thinking: false },
];

async function stream(messages, variant) {
  const started = Date.now();
  let content = '';
  let reasoning = '';
  let usage = null;
  let finish = null;
  let error = null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180_000);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
        'x-opencode-session': 'ses_loop_' + variant.id + '_' + Math.random().toString(36).slice(2, 8),
        'x-opencode-client': 'pi',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: 1,
        top_p: 1,
        max_tokens: 32768,
        ...(variant.thinking
          ? EFFORT === 'auto'
            ? {}
            : { reasoning_effort: EFFORT }
          : { thinking: { type: 'disabled' } }),
      }),
    });
    if (!res.ok) {
      error = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`;
    } else {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for (const line of parts) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            if (j.usage) usage = j.usage;
            const ch = j.choices?.[0];
            if (ch?.finish_reason) finish = ch.finish_reason;
            if (ch?.delta?.content) content += ch.delta.content;
            if (ch?.delta?.reasoning_content) reasoning += ch.delta.reasoning_content;
          } catch {
            /* حزمة مبتورة */
          }
        }
      }
    }
  } catch (e) {
    error = (e.name === 'AbortError' ? 'timeout ' : '') + (e.message || '');
  } finally {
    clearTimeout(timer);
  }
  return { ms: Date.now() - started, content, reasoning, usage, finish, error };
}

const cases = [];
for (const variant of VARIANTS) {
  for (const task of TASKS) {
    for (let run = 1; run <= RUNS; run++) cases.push({ variant, task, run });
  }
}

console.log(`\nنموذج: ${MODEL} · جهد: ${EFFORT} · نصّ نظامنا: ${SYSTEM.length} حرفًا`);
console.log(`متغيّرات: ${VARIANTS.length} · مهامّ: ${TASKS.length} · تكرار: ${RUNS} → ${cases.length} محادثة من دورين\n`);

const results = [];
let next = 0;
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= cases.length) return;
    const { variant, task, run } = cases[i];
    const base = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: task.text },
    ];

    const t1 = await stream(base, variant);
    if (t1.error) {
      results[i] = { ...cases[i], t1, t2: null, loop1: null, loop2: null };
      console.log(`  ERR ${variant.id}/${task.id}#${run}  ${t1.error.slice(0, 70)}`);
      continue;
    }

    const assistant1 = { role: 'assistant', content: t1.content };
    if (variant.replayReasoning && t1.reasoning) assistant1.reasoning_content = t1.reasoning;

    const t2 = await stream([...base, assistant1, { role: 'user', content: FOLLOW_UP }], variant);

    const loop1 = loopiness(t1.content);
    const loop2 = loopiness(t2.content);
    const loopR2 = loopiness(t2.reasoning);
    const bad = isLoop(loop2) || isLoop(loopR2);
    results[i] = { variant: variant.id, task: task.id, run, t1, t2, loop1, loop2, loopR2 };

    console.log(
      `  ${bad ? '⟳ LOOP' : '      '} ${variant.id.padEnd(15)} ${task.id.padEnd(8)} #${run}  ` +
        `turn2 ${String(t2.ms).padStart(6)}ms out ${String(t2.content.length).padStart(6)} think ${String(t2.reasoning.length).padStart(6)}  ` +
        `periodRun ${String(loop2.maxPeriodRun).padStart(2)}/${String(loopR2.maxPeriodRun).padStart(2)} lineRun ${String(loop2.maxLineRun).padStart(2)}  ${t2.finish || ''}`,
    );
    if (bad) console.log(`        → ${JSON.stringify((loop2.worstShingle || loopR2.worstShingle).slice(0, 100))}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

console.log('\n' + '─'.repeat(78));
for (const v of VARIANTS) {
  const g = results.filter((r) => r && r.variant === v.id && r.t2 && !r.t2.error);
  const loops = g.filter((r) => isLoop(r.loop2) || isLoop(r.loopR2)).length;
  const truncated = g.filter((r) => r.t2.finish === 'length').length;
  const avgThink = g.length ? Math.round(g.reduce((n, r) => n + r.t2.reasoning.length, 0) / g.length) : 0;
  const avgOut = g.length ? Math.round(g.reduce((n, r) => n + r.t2.content.length, 0) / g.length) : 0;
  const avgMs = g.length ? Math.round(g.reduce((n, r) => n + r.t2.ms, 0) / g.length) : 0;
  console.log(
    `  ${v.id.padEnd(16)} حلقات ${String(loops).padStart(2)}/${String(g.length).padStart(2)}  مقطوع ${truncated}  ` +
      `متوسّط: ${String(avgMs).padStart(5)}ms · تفكير ${String(avgThink).padStart(6)} · إخراج ${String(avgOut).padStart(6)}`,
  );
}
const all = results.filter((r) => r && r.t2 && !r.t2.error);
console.log(`\n  حلقات في الدور الثاني: ${all.filter((r) => isLoop(r.loop2) || isLoop(r.loopR2)).length}/${all.length}`);
console.log(`  حلقات في الدور الأول:  ${results.filter((r) => r && r.loop1 && isLoop(r.loop1)).length}/${results.filter((r) => r && r.loop1).length}`);
console.log('─'.repeat(78));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), model: MODEL, effort: EFFORT, runs: RUNS, systemChars: SYSTEM.length, results }, null, 1));
console.log(`\n  النتائج الخام: ${OUT}\n`);
