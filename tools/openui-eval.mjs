#!/usr/bin/env node
/**
 * قياس: هل يستطيع `deepseek-v4.1-flash` كتابة OpenUI Lang صحيحة؟
 *
 * هذا هو السؤال الذي يقرّر إن كان OpenUI ميزةً أم عرضًا. وكل ما بنيناه قبله
 * (المعرض، الكتالوج، الأخطاء) يقيس **المكتبة**، لا النموذج. وهنا يُقاس النموذج.
 *
 * والطريقة: نصّ التعليمات الحقيقي من `openuiLibrary.prompt()` يُرسل كما هو،
 * ثم يُقرأ الردّ بمحلّل المكتبة نفسها. فلا حكم من رأيي: `createParser` تقول
 * إن كان البرنامج سليمًا، و`meta.errors` تقول بماذا فسد.
 *
 *   node tools/openui-eval.mjs                  # كل الطلبات
 *   node tools/openui-eval.mjs --effort off     # بلا تفكير
 *   node tools/openui-eval.mjs --n 6 --concurrency 2
 *
 * ويُحفظ كل ردّ خام في ملفّ النتيجة — فمن أراد أن يرى بعينه ما كتبه النموذج
 * يجده هناك، لا في وصفٍ مني عنه.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loopiness, isLoop } from './loopiness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ————— الإعداد ————— */
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
const BASE = (env.VITE_LLM_BASE_URL || 'https://opencode.ai/inference/go/v1').replace(/\/$/, '');
const KEY = env.VITE_LLM_API_KEY || '';
const MODEL = env.VITE_LLM_MODEL || 'deepseek-v4.1-flash';
if (!KEY) {
  console.error('لا مفتاح في .env.local — لا يمكن القياس');
  process.exit(1);
}

/* ————— الوسائط ————— */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const EFFORT = flag('effort', 'auto'); // auto | off | low | high | max
const CONCURRENCY = Number(flag('concurrency', '3'));
const LIMIT = Number(flag('n', '0')) || 999;
const MAX_TOKENS = Number(flag('max-tokens', '32768'));
const OUT = flag('out', join(ROOT, 'specs', 'openui-eval', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));

/* ————— المكتبة والمحلّل ————— */
const { openuiLibrary } = await import('@openuidev/react-ui');
const { createParser } = await import('@openuidev/react-lang');

/**
 * قاعدتان فقط — لأنّ الفشل كلّه تقريبًا في مكوّن واحد.
 *
 * قِيس على ٢٧ طلبًا بلا تفكير: ٨ فشل، و١٨ خطأ، **١٦ منها في `Card`**.
 * والسبب أنّ نصّ OpenUI نفسه يقول عن `Card`: «Accepts all Stack flex params»
 * — وهي صياغة تُغري بتمرير `(direction, gap)` وهما ليستا الوسيطتين الأولى
 * والثانية في `Card`. فالقاعدة تُسمّي الفرق صراحةً.
 *
 * والثانية لـ`Text`: `variant` وسيط **أوّل** اختياري، فالنموذج يضع القيمة
 * مكانه. ووسيط أوّل اختياري فخّ حقيقي.
 */
const FIX_RULES = [
  '`Card` and `Stack` do NOT have the same signature. Stack(children, direction?, gap?, ...) but Card(children, variant?, direction?, gap?, ...). To lay a Card\'s children out in a row write Card([...], null, "row", "m") — pass null for variant. Never put a direction or a gap string in Card\'s second argument.',
  '`Text` and `BoldText` take variant FIRST: Text(variant?, value, subtext?, ...). Write Text("text", "Sell well") or Text("number", "1,284"). The value is never the first argument.',
];
const USE_FIX = argv.includes('--fix-rules');
/**
 * `inlineMode` يعلّم النموذج أن يجيب **نثرًا** ثم يضع الواجهة في سياج كود.
 * وهو ما يحلّ مشكلة «كل جواب صار واجهة»: النثر يبقى ماركداون في الخيط،
 * والواجهة تصير «قطعة» تُعرض جانبًا — كما تفعل ChatGPT في Artifacts.
 */
const USE_INLINE = argv.includes('--inline');
const SYSTEM_PROMPT = openuiLibrary.prompt({
  ...(USE_FIX ? { additionalRules: FIX_RULES } : {}),
  ...(USE_INLINE ? { inlineMode: true } : {}),
});
const PARSER = createParser(openuiLibrary.toJSONSchema(), openuiLibrary.root);

/**
 * الطلبات: أربعة وعشرون طلبًا لتصميم واجهات، وثلاثة لا تصلح لواجهة أصلًا.
 *
 * والثلاثة الأخيرة ليست حشوًا: نصّ تعليمات OpenUI يقول «ردّك كلّه يجب أن
 * يكون OpenUI Lang» — فالسؤال «كم ٢+٢؟» يكشف إن كان النموذج سيبني واجهة
 * لسؤال نصّي. وهذا يقرّر إن كنّا نحتاج توجيهًا (routing) قبل العرض.
 */
const PROMPTS = [
  { id: 'sales-quarter', kind: 'ui', text: 'Show me quarterly sales for a coffee roastery in Riyadh.' },
  { id: 'crm-compare', kind: 'ui', text: 'Compare three CRM tools in a table: HubSpot, Pipedrive and Attio.' },
  { id: 'newsletter-form', kind: 'ui', text: 'Build a signup form for a weekly newsletter.' },
  { id: 'tickets-priority', kind: 'ui', text: 'Show my open support tickets grouped by priority.' },
  { id: 'saas-kpis', kind: 'ui', text: 'Give me a KPI dashboard for a SaaS product.' },
  { id: 'pricing-card', kind: 'ui', text: 'Show a product card for a subscription plan with pricing and a CTA.' },
  { id: 'top-cities', kind: 'ui', text: 'List the top 5 cities by population with a bar chart.' },
  { id: 'onboarding', kind: 'ui', text: 'Create an onboarding checklist for a new engineer.' },
  { id: 'ad-spend', kind: 'ui', text: 'Show a scatter plot of ad spend versus conversions for two campaigns.' },
  { id: 'deploy-failed', kind: 'ui', text: 'The deploy failed because of a missing environment variable. Tell the user, briefly.' },
  { id: 'notif-settings', kind: 'ui', text: 'Make a settings form with notification toggles.' },
  { id: 'revenue-12m', kind: 'ui', text: 'Show revenue trend over 12 months as a line chart.' },
  { id: 'tier-compare', kind: 'ui', text: 'Compare our two pricing tiers in cards.' },
  { id: 'employees', kind: 'ui', text: 'Show a table of employees with name, role and start date.' },
  { id: 'survey', kind: 'ui', text: 'Build a short survey with five rating questions.' },
  { id: 'order-detail', kind: 'ui', text: 'Show an order detail view with line items, a subtotal and a total.' },
  { id: 'funnel', kind: 'ui', text: 'Show a funnel of signup, activation and retention.' },
  { id: 'filter-bar', kind: 'ui', text: 'Create a filter bar for a report: date range, region and status.' },
  { id: 'overview-cards', kind: 'ui', text: 'Show an overview card set with four metrics and their week-over-week change.' },
  { id: 'tabs-charts', kind: 'ui', text: 'Compare a bar chart and a line chart for the same data, in tabs.' },
  { id: 'invoice', kind: 'ui', text: 'Show an invoice with line items and a total.' },
  { id: 'timeline', kind: 'ui', text: 'Show a timeline of the last five releases.' },
  { id: 'chart-table', kind: 'ui', text: 'Show the same monthly numbers twice: once as a bar chart, once as a table.' },
  { id: 'no-such-component', kind: 'ui', text: 'Show a map of our offices with pins on a world map.' },
  { id: 'math', kind: 'text', text: 'What is 2 + 2?' },
  { id: 'haiku', kind: 'text', text: 'Write a haiku about rain.' },
  { id: 'who', kind: 'text', text: 'Who are you?' },
].slice(0, LIMIT);

/* ————— نداء واحد ————— */
async function call(prompt) {
  const started = Date.now();
  let ttft = null;
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt.text },
    ],
    stream: true,
    stream_options: { include_usage: true },
    temperature: 1,
    top_p: 1,
    max_tokens: MAX_TOKENS,
    ...(EFFORT === 'off' ? { thinking: { type: 'disabled' } } : EFFORT === 'auto' ? {} : { reasoning_effort: EFFORT }),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300_000);
  let content = '';
  let reasoning = '';
  let usage = null;
  let finish = null;
  let httpError = null;

  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
        'x-opencode-session': 'ses_eval_' + prompt.id,
        'x-opencode-client': 'pi',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      httpError = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`;
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
            if (ch?.delta?.content) {
              if (ttft === null) ttft = Date.now() - started;
              content += ch.delta.content;
            }
            if (ch?.delta?.reasoning_content) {
              if (ttft === null) ttft = Date.now() - started;
              reasoning += ch.delta.reasoning_content;
            }
          } catch {
            /* حزمة مبتورة */
          }
        }
      }
    }
  } catch (e) {
    httpError = (e.name === 'AbortError' ? 'timeout after 300s' : '') + (e.message || '');
  } finally {
    clearTimeout(timer);
  }

  const ms = Date.now() - started;

  /* الحكم: محلّل المكتبة، لا رأيي */
  /* في inlineMode يُحكم على السياج لا على النصّ كلّه */
  const fence = /```[\w-]*\n([\s\S]*?)```/.exec(content);
  const judged = USE_INLINE && fence ? fence[1] : content;
  const prose = USE_INLINE ? content.replace(/```[\s\S]*?```/g, '').trim() : '';

  let parsed = { ok: false, codes: [], messages: [], unresolved: 0, orphaned: 0, incomplete: null, hasRoot: false, statements: 0 };
  if (judged.trim()) {
    try {
      const r = PARSER.parse(judged);
      const codes = r.meta.errors.map((e) => e.code);
      parsed = {
        ok: r.root !== null && !r.meta.incomplete && codes.length === 0 && r.meta.unresolved.length === 0 && r.meta.orphaned.length === 0,
        codes,
        messages: r.meta.errors.slice(0, 4).map((e) => `${e.code}${e.component ? '/' + e.component : ''}: ${String(e.message).slice(0, 120)}`),
        unresolved: r.meta.unresolved.length,
        orphaned: r.meta.orphaned.length,
        incomplete: !!r.meta.incomplete,
        hasRoot: r.root !== null,
        statements: (judged.match(/^[A-Za-z_$][\w$]*\s*=/gm) || []).length,
      };
    } catch (e) {
      parsed = { ...parsed, codes: ['parse-exception'], messages: [String(e.message).slice(0, 160)] };
    }
  }

  const rep = loopiness(content);
  const reasoningRep = loopiness(reasoning);

  return {
    id: prompt.id,
    kind: prompt.kind,
    prompt: prompt.text,
    ms,
    ttft,
    contentChars: content.length,
    reasoningChars: reasoning.length,
    usage,
    finish,
    httpError,
    parsed,
    rep,
    reasoningRep,
    fenced: /```/.test(content),
    hasFence: !!fence,
    proseChars: prose.length,
    startsWithRoot: /^\s*root\s*=/.test(judged),
    content,
    reasoning,
  };
}

/* ————— إعادة تحليل بلا نداء جديد ————— *
 * المقياس تغيّر والبيانات لم تتغيّر. فهذا الوضع يعيد الحكم على نفس الردود
 * المخزّنة — لأنّ إعادة النداء كانت ستُنتج ردودًا أخرى فتصير المقارنة كذبًا.
 */
const ANALYZE = flag('analyze', '');
if (ANALYZE) {
  const j = JSON.parse(readFileSync(ANALYZE, 'utf8'));
  console.log(`\nإعادة تحليل: ${ANALYZE}\n`);
  let loops = 0;
  for (const r of j.results) {
    const rep = loopiness(r.content || '');
    const rrep = loopiness(r.reasoning || '');
    const loop = isLoop(rep) || isLoop(rrep);
    if (loop) loops++;
    console.log(
      `  ${loop ? '⟳' : ' '} ${r.id.padEnd(20)} content: periodRun ${String(rep.maxPeriodRun).padStart(2)} lineRun ${String(rep.maxLineRun).padStart(2)}` +
        `  |  thinking: periodRun ${String(rrep.maxPeriodRun).padStart(2)} lineRun ${String(rrep.maxLineRun).padStart(2)}` +
        `  |  top5gram ${String(rep.topShingle).padStart(2)}`,
    );
    if (loop) console.log(`      period ${rep.period || rrep.period} → ${JSON.stringify((rep.worstShingle || '').slice(0, 70))}`);
  }
  console.log(`\n  حلقات متتالية: ${loops}/${j.results.length}\n`);
  process.exit(0);
}

/* ————— التشغيل ————— */
console.log(`\nنموذج: ${MODEL} · جهد التفكير: ${EFFORT} · max_tokens: ${MAX_TOKENS}`);
console.log(`نصّ التعليمات: ${SYSTEM_PROMPT.length} حرفًا (~${Math.round(SYSTEM_PROMPT.length / 4)} توكن)${USE_FIX ? ' · + قاعدتا الإصلاح' : ''}${USE_INLINE ? ' · + inlineMode' : ''}`);
console.log(`طلبات: ${PROMPTS.length} · تزامن: ${CONCURRENCY}\n`);

const results = [];
let next = 0;
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= PROMPTS.length) return;
    const p = PROMPTS[i];
    const r = await call(p);
    results[i] = r;
    const mark = r.httpError ? 'HTTP' : r.parsed.ok ? 'OK  ' : 'FAIL';
    const detail = r.httpError ? r.httpError.slice(0, 60) : r.parsed.ok ? `${r.parsed.statements} statements` : r.parsed.codes.join(',');
    const loopMark = isLoop(r.rep) ? '⟳' : isLoop(r.reasoningRep) ? '⟳think' : '';
    console.log(
      `  ${mark} ${p.id.padEnd(20)} ${String(r.ms).padStart(6)}ms  ttft ${String(r.ttft ?? '-').padStart(5)}  ` +
        `out ${String(r.contentChars).padStart(6)}  think ${String(r.reasoningChars).padStart(6)}  loop ${String(r.rep.maxPeriodRun).padStart(2)} ${loopMark.padEnd(6)} ${detail}`,
    );
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, PROMPTS.length) }, worker));

/* ————— الملخّص ————— */
const ok = results.filter((r) => r.parsed.ok);
const failed = results.filter((r) => !r.httpError && !r.parsed.ok);
const errored = results.filter((r) => r.httpError);
const codeCounts = {};
for (const r of failed) for (const c of r.parsed.codes) codeCounts[c] = (codeCounts[c] || 0) + 1;
const byKind = (k) => {
  const g = results.filter((r) => r.kind === k);
  return { n: g.length, ok: g.filter((r) => r.parsed.ok).length };
};
const ui = byKind('ui');
const text = byKind('text');
const loops = results.filter((r) => isLoop(r.rep) || isLoop(r.reasoningRep));
const truncated = results.filter((r) => r.finish === 'length');
const thinkAll = results.reduce((n, r) => n + (r.usage?.completion_tokens_details?.reasoning_tokens || 0), 0);
const outAll = results.reduce((n, r) => n + (r.usage?.completion_tokens || 0), 0);
const slow = results.filter((r) => r.ms > 15000);

console.log('\n' + '─'.repeat(78));
console.log(`  سليم            ${ok.length}/${results.length}`);
console.log(`  فاسد التحليل     ${failed.length}`);
console.log(`  خطأ HTTP        ${errored.length}`);
console.log(`  UI prompts      ${ui.ok}/${ui.n}   ·   نصّ prompts ${text.ok}/${text.n}`);
console.log(`  حلقة متتالية     ${loops.length}${loops.length ? ' → ' + loops.map((r) => r.id).join(', ') : ''}`);
console.log(`  مقطوع (length)   ${truncated.length}${truncated.length ? ' → ' + truncated.map((r) => r.id).join(', ') : ''}`);
console.log(`  بطيء >15s        ${slow.length}${slow.length ? ' → ' + slow.map((r) => `${r.id}(${Math.round(r.ms / 1000)}s)`).join(', ') : ''}`);
console.log(`  يبدأ بـroot=      ${results.filter((r) => r.startsWithRoot).length}/${results.length}`);
console.log(`  فيه سياج كود      ${results.filter((r) => r.fenced).length}${USE_INLINE ? ` (سياج قابل للقراءة: ${results.filter((r) => r.hasFence).length}, متوسّط النثر ${Math.round(results.reduce((n, r) => n + (r.proseChars || 0), 0) / results.length)} حرفًا)` : ''}`);
console.log(`  تفكير/إخراج      ${thinkAll.toLocaleString()} / ${outAll.toLocaleString()} توكنًا`);
if (Object.keys(codeCounts).length) {
  console.log('\n  أكواد الأخطاء:');
  for (const [c, n] of Object.entries(codeCounts).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${c}`);
}
console.log('─'.repeat(78));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({ at: new Date().toISOString(), model: MODEL, effort: EFFORT, maxTokens: MAX_TOKENS, systemPromptChars: SYSTEM_PROMPT.length, results }, null, 1),
);
console.log(`\n  النتائج الخام: ${OUT}`);
console.log(`  لعرض ردٍّ بعينه:  node -e "const j=require('${OUT}');console.log(j.results.find(r=>r.id==='sales-quarter').content)"\n`);
