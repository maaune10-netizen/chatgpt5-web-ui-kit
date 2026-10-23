#!/usr/bin/env node
/**
 * cap2-report.mjs — تقرير عن ملفّ capture2.
 *   node tools/cap2-report.mjs <cap2.json>
 */
import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const m = j.meta;
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

console.log(`\n══ الملفّ ══\n  ${m.objects} كائنًا · ${m.states} حالة · ${m.hovers} تحويمًا · ${m.clicks} نقرة · ${m.motion} حركة · ${(m.durationMs / 1000).toFixed(0)}s`);

/* الانتقالات: من أيّ قيمة إلى أيّ، وبأيّ مدّة */
const trans = [];
for (const o of j.objects) {
  for (let i = 1; i < (o.changes || []).length; i++) {
    const a = o.changes[i - 1], b = o.changes[i];
    if (!b.d) continue;
    for (const [k, v] of Object.entries(b.d)) {
      trans.push({ name: o.name, prop: k, from: v[0], to: v[1], t: b.t, dt: b.t - a.t });
    }
  }
}
const byProp = {};
for (const t of trans) byProp[t.prop] = (byProp[t.prop] || 0) + 1;
console.log(`\n══ الانتقالات (${trans.length}) ══`);
console.log('  ' + Object.entries(byProp).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' · '));

/* مدّة الانتقال الفعليّة = الزمن بين أوّل تغيّر وآخر تغيّر متتالٍ لنفس الخاصيّة */
const runs = [];
for (const o of j.objects) {
  const ch = (o.changes || []).filter((c) => c.d && c.d.x);
  if (ch.length >= 2) runs.push({ name: o.name, span: ch[ch.length - 1].t - ch[0].t, steps: ch.length, from: ch[0].d.x[0], to: ch[ch.length - 1].d.x[1] });
}
if (runs.length) {
  console.log('\n══ حركات أفقية/رأسية (مدّة مقيسة) ══');
  for (const r of runs.sort((a, b) => b.span - a.span).slice(0, 6)) console.log(`  ${pad(r.name, 26)} ${r.steps} خطوة · ${r.span}ms · ${r.from}→${r.to}`);
}

/* الأحجام النهائيّة */
console.log('\n══ أحجام مقيّدة (آخر قيمة) ══');
const seen = new Set();
for (const o of j.objects) {
  if (seen.has(o.name) || !o.first) continue;
  seen.add(o.name);
  const last = (o.changes || []).filter((c) => c.d && (c.d.w || c.d.h)).pop();
  const w = last?.d.w?.[1] ?? o.first.w, h = last?.d.h?.[1] ?? o.first.h;
  if (w > 40 && h > 10) console.log(`  ${pad(o.name, 26)} ${w}×${h} @${o.first.x},${o.first.y}`);
  if (seen.size > 24) break;
}

/* الحركات */
if (j.motion?.length) {
  console.log('\n══ الحركات ══');
  for (const a of j.motion.slice(0, 10)) console.log(`  ${pad(a.name, 24)} ${pad(a.duration + 'ms', 8)} ${pad(a.easing || '', 22)} «${String(a.target).slice(0, 20)}»`);
}

/* التلميحات */
if (j.hovers?.length) {
  console.log('\n══ التلميحات ══');
  for (const h of j.hovers.filter((x) => x.placement)) {
    console.log(`  ${pad(h.key, 22)} ${pad(h.placement.side, 7)} gap=${h.placement.gap} clamped=${h.placement.clamped} ${h.style ? h.style.fs + '/' + h.style.fw : ''}`);
  }
}
console.log('');
