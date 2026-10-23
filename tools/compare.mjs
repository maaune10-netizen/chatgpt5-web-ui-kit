#!/usr/bin/env node
/**
 * compare.mjs — مقارنة آلية بين ملفّ الالتقاط وتطبيقنا.
 *
 *   node tools/compare.mjs <capture.json> [--w 1912] [--state aside] [--out report.md]
 *
 * يُطابق العناصر بالاسم (نصّ أو aria-label)، ويُخرج:
 *   • ناقص عندنا   (في الملفّ وليس عندنا)
 *   • زائد عندنا    (عندنا وليس في الملفّ)
 *   • فروق المقاس   (x,y,w,h بفارق > 2)
 *   • فروق النمط    (خطّ · وزن · لون · خلفية · حشو · نصف قطر)
 */
import { chromium } from '/home/deploy/pro/e2e/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : d;
};
const W = Number(flag('--w', 1912));
const H = Number(flag('--h', 922));
const OUT = flag('--out', '/tmp/compare.md');

const j = JSON.parse(readFileSync(file, 'utf8'));
const st =
  j.states.find((s) => s.viewport.w === W && s.chrome && s.chrome.aside && s.chrome.aside.w === 240 && s.elements.some((e) => e.role === 'textbox')) ||
  j.states.find((s) => s.viewport.w === W);

const KEY = (t) => (t || '').trim().replace(/\s+/g, ' ').slice(0, 40);
const theirs = new Map();
for (const e of st.elements) {
  const k = KEY(e.text || e.label);
  if (k.length < 3) continue;
  if (!theirs.has(k)) {
    const s = j.styles[e.s] || {};
    theirs.set(k, {
      x: Math.round(e.box.x), y: Math.round(e.box.y), w: Math.round(e.box.w), h: Math.round(e.box.h),
      fs: s['font-size'], lh: s['line-height'], fw: s['font-weight'], color: s.color,
      bg: s['background-color'], pad: [s['padding-top'], s['padding-right'], s['padding-bottom'], s['padding-left']].join(' '),
      r: s['border-radius'],
    });
  }
}

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
await p.goto('https://bahr-vps.tail18374c.ts.net:8446/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.evaluate(() => { localStorage.setItem('gpt5.signedIn', '1'); localStorage.setItem('gpt5.theme', 'dark'); });
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(3200);

const ours = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('aside *, main *, header *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || !el.offsetParent) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    const t = own || el.getAttribute('aria-label') || '';
    if (t.length < 3) continue;
    const cs = getComputedStyle(el);
    /*
     * أبقِ **الأكبر** لكل اسم، لا الأوّل: النصّ يعيش في غلاف ثمّ في span
     * داخليّ أضيق، ومقارنة الداخليّ تُنتج فروقًا وهميّة (63×17 مقابل 182×20
     * والغلاف مطابق تمامًا).
     */
    const rec = {
      t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      fs: cs.fontSize, lh: cs.lineHeight, fw: cs.fontWeight, color: cs.color, bg: cs.backgroundColor,
      pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '), r: cs.borderRadius,
    };
    const prev = out.findIndex((x) => x.t === t);
    if (prev === -1) out.push(rec);
    else if (rec.w * rec.h > out[prev].w * out[prev].h) out[prev] = rec;
  }
  return out;
});
await b.close();

const seen = new Set();
const rows = { box: [], style: [], exact: 0 };
for (const o of ours) {
  const k = KEY(o.t);
  if (seen.has(k) || !theirs.has(k)) continue;
  seen.add(k);
  const t = theirs.get(k);
  const db = [o.x - t.x, o.y - t.y, o.w - t.w, o.h - t.h];
  const ds = [];
  if (o.fs !== t.fs) ds.push(`font ${t.fs}→${o.fs}`);
  if (o.fw !== t.fw) ds.push(`weight ${t.fw}→${o.fw}`);
  if (o.color !== t.color) ds.push(`color ${t.color}→${o.color}`);
  if (o.bg !== t.bg && t.bg !== 'rgba(0, 0, 0, 0)') ds.push(`bg ${t.bg}→${o.bg}`);
  if (o.pad !== t.pad && t.pad !== '0px 0px 0px 0px') ds.push(`pad ${t.pad}→${o.pad}`);
  if (db.some((d) => Math.abs(d) > 2)) rows.box.push(`${k} | عندهم ${t.x},${t.y} ${t.w}x${t.h} | عندنا ${o.x},${o.y} ${o.w}x${o.h}`);
  if (ds.length) rows.style.push(`${k} | ${ds.join(' · ')}`);
  if (!db.some((d) => Math.abs(d) > 2) && !ds.length) rows.exact++;
}
const missing = [...theirs.keys()].filter((k) => !ours.some((o) => KEY(o.t) === k));
const extra = [...new Set(ours.map((o) => KEY(o.t)))].filter((k) => k && !theirs.has(k));

const md = [
  `# مقارنة ${W}×${H}`,
  ``,
  `عناصر الملفّ: ${theirs.size} · عناصرنا: ${ours.length} · **مطابق تمامًا: ${rows.exact}**`,
  ``,
  `## ناقص عندنا (${missing.length})`,
  ...missing.slice(0, 40).map((m) => `- ${m}`),
  ``,
  `## فروق المقاس (${rows.box.length})`,
  ...rows.box.slice(0, 40).map((m) => `- ${m}`),
  ``,
  `## فروق النمط (${rows.style.length})`,
  ...rows.style.slice(0, 40).map((m) => `- ${m}`),
  ``,
  `## زائد عندنا (أوّل ٣٠ من ${extra.length})`,
  ...extra.slice(0, 30).map((m) => `- ${m}`),
].join('\n');
writeFileSync(OUT, md);
console.log(md.split('\n').slice(0, 46).join('\n'));
console.log(`\n→ ${OUT}`);
