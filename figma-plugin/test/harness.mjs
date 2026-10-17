/**
 * محاكي Figma Plugin API — يشغّل code.js محليًا لاكتشاف الأخطاء.
 *
 * يختبر تحديدًا منطق تصدير الأيقونات: الفشل الجزئي، وإعادة المحاولة على
 * نسخة أخرى من نفس الشكل الأساسي، وتسجيل ما فشل فعلًا.
 */
import { readFileSync } from 'node:fs';

const code = readFileSync('/home/deploy/gpt5-kit/figma-plugin/code.js', 'utf8');

const messages = [];

function node(type, name, extra = {}) {
  const n = {
    id: extra.id || 'n' + Math.random().toString(36).slice(2, 8),
    name,
    type,
    visible: true,
    absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 40 },
    relativeTransform: [[1, 0, 10], [0, 1, 20]],
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.2, b: 0.3 }, opacity: 0.5, visible: true }],
    strokes: [],
    effects: [
      { type: 'DROP_SHADOW', offset: { x: 0, y: 8 }, radius: 16, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.1 }, visible: true },
      { type: 'INNER_SHADOW', offset: { x: 0, y: 1 }, radius: 1, spread: 0, color: { r: 1, g: 1, b: 1, a: 0.13 }, visible: true },
    ],
    ...extra,
  };
  if (!('children' in n) && (type === 'FRAME' || type === 'COMPONENT' || type === 'PAGE')) n.children = [];
  if ((type === 'VECTOR' || type === 'BOOLEAN_OPERATION') && !n.exportAsync) {
    n.exportAsync = async () => {
      await new Promise((r) => setTimeout(r, 1));
      return new TextEncoder().encode('<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>');
    };
  }
  return n;
}

function textNode(chars) {
  return node('TEXT', chars.slice(0, 20), {
    characters: chars,
    style: {
      fontFamily: 'Inter',
      fontStyle: 'Regular',
      fontSize: 14,
      fontWeight: 400,
      lineHeightPx: 19.7,
      lineHeightPercentFontSize: 140.7,
      letterSpacing: 0,
      textAlignHorizontal: 'LEFT',
      textAlignVertical: 'TOP',
    },
    textAutoResize: 'WIDTH_AND_HEIGHT',
  });
}

/* شجرة تشبه الملف الحقيقي: إطار فيه نصوص ومتجهات وحالات */
const leaf1 = node('FRAME', 'Prompt Input', { layoutMode: 'HORIZONTAL', itemSpacing: 6, paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, cornerRadius: 28, clipsContent: false });
leaf1.children = [
  node('VECTOR', 'Add icon', { id: 'I1:0;3:500' }),
  textNode('Ask anything'),
  node('INSTANCE', 'Button', {
    mainComponent: { id: 'c1', name: 'Button' },
    componentProperties: { Variant: { value: 'Primary', type: 'VARIANT' } },
  }),
  node('ELLIPSE', 'Working Indicator', { fills: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 1 } }], gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], visible: true }] }),
  node('BOOLEAN_OPERATION', 'Union', { id: 'I1:0;3:501' }),

  /*
   * الحالة التي كلّفتنا Copy و Retry و Overflow:
   * نسختان تشتركان في المفتاح الأساسي 3:901، الأولى تفشل والثانية تنجح.
   * قبل الإصلاح كان المفتاح يُحجز عند أول مرشّح، فتفشل الأيقونة كاملة.
   */
  node('VECTOR', 'Flip A', {
    id: 'I1:2;3:901',
    exportAsync: async () => { throw new Error('Failed to export node. This node may not have any visible layers.'); },
  }),
  node('VECTOR', 'Flip B', { id: 'I1:3;3:901' }),

  /* فاشل دائمًا لكن له مسار — يجب أن يُبنى من vectorPaths لا أن يُفقَد */
  node('VECTOR', 'Path Fallback Icon', {
    id: 'I1:6;3:903',
    width: 16, height: 16,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }],
    vectorPaths: [{ windingRule: 'NONZERO', data: 'M8 0a8 8 0 100 16A8 8 0 008 0z' }],
    exportAsync: async () => { throw new Error('Failed to export node. This node may not have any visible layers.'); },
  }),

  /* فاشل دائمًا وبلا مسار — يجب أن يظهر في meta.svgFailures */
  node('VECTOR', 'Bad Icon', {
    id: 'I1:4;3:900',
    exportAsync: async () => { throw new Error('Failed to export node. This node may not have any visible layers.'); },
  }),

  /* مخفي — يجب أن يُتخطّى بلا خطأ */
  node('VECTOR', 'Hidden Icon', { id: 'I1:5;3:902', visible: false }),
];

const screen = node('COMPONENT', 'New Chat - Logged In', { children: [leaf1] });
const page = node('PAGE', 'Screen Components', { children: [screen], selection: [] });

const figma = {
  root: { name: 'Test File', children: [page] },
  currentPage: page,
  showUI() {},
  closePlugin() {},
  loadAllPagesAsync: async () => {},
  ui: {
    onmessage: null,
    postMessage: (m) => messages.push(m),
    resize() {},
  },
};

/* تشغيل الإضافة */
const fn = new Function('figma', '__html__', code);
fn(figma, '<html></html>');

if (typeof figma.ui.onmessage !== 'function') {
  console.log('✗ onmessage was never registered');
  process.exit(1);
}

console.log('✓ plugin loaded, handlers registered');

/** افصل الحمولة عن النص — الإضافة ترسل JSON نصًا لأن Figma تُسقط الـSymbols */
function parse(m) {
  if (!m || typeof m.json !== 'string') return m;
  try { return Object.assign({}, m, { payload: JSON.parse(m.json) }); } catch (e) { return m; }
}

async function run(msg, label) {
  messages.length = 0;
  try {
    const r = figma.ui.onmessage(msg);
    if (r && typeof r.then === 'function') await r;
  } catch (e) {
    console.log(`✗ ${label} THREW: ${e.message}`);
    return null;
  }
  for (let i = 0; i < 120 && !messages.some((m) => ['done', 'failed', 'error'].includes(m.type)); i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  const parsed = messages.map(parse);
  const fail = parsed.find((m) => m.type === 'failed' || m.type === 'error');
  const done = parsed.find((m) => m.type === 'done');
  if (fail) {
    const why = (fail.payload && fail.payload.errors && fail.payload.errors[0] && fail.payload.errors[0].message) || fail.message;
    console.log(`✗ ${label} -> failed: ${why}`);
  } else if (done) {
    console.log(`✓ ${label} -> ok: ${done.payload.meta.nodeCount} nodes, ${done.payload.meta.svgCount} svgs, ${done.payload.meta.skippedCount} skipped`);
  } else {
    console.log(`? ${label} -> no done/failed`);
  }
  const thrown = parsed.filter((m) => m.type === 'threw');
  if (thrown.length) console.log('   thrown:', JSON.stringify(thrown));
  return parsed;
}

let failures = 0;
function check(label, ok, extra) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${extra !== undefined ? ' — ' + extra : ''}`);
  if (!ok) failures++;
}

await run({ type: 'count' }, 'count');

const empty = await run({ type: 'dump', scope: 'selection' }, 'dump/selection (empty)');
check('empty selection is reported as failed, not done', !!empty && !empty.some((m) => m.type === 'done'));

figma.currentPage.selection = [screen];
const sel = await run({ type: 'dump', scope: 'selection' }, 'dump/selection');
const meta = sel && sel.find((m) => m.type === 'done') && sel.find((m) => m.type === 'done').payload.meta;

const all = await run({ type: 'dump', scope: 'all', includeSvg: true }, 'dump/all + svg');
const am = all && all.find((m) => m.type === 'done');
const ap = am && am.payload;

console.log('\n--- assertions ---');
if (ap) {
  const svgKeys = Object.keys(ap.svgs || {});
  const failed = (ap.meta.svgFailures || []).map((f) => f.name);

  check('flip icon exported via its 2nd candidate', svgKeys.indexOf('I1:3;3:901') !== -1, svgKeys.filter((k) => k.indexOf('3:901') !== -1).join(',') || 'none');
  check('the failing first candidate is not what got stored', svgKeys.indexOf('I1:2;3:901') === -1);
  check('always-failing icon is reported in svgFailures', failed.indexOf('Bad Icon') !== -1, failed.join(',') || 'none');
  check('failing icon WITH vectorPaths is built instead of lost', svgKeys.indexOf('I1:6;3:903') !== -1);
  check('the path fallback contains real geometry', String(ap.svgs['I1:6;3:903'] || '').indexOf('M8 0a8 8') !== -1);
  check('path fallback is counted', ap.meta.svgFallbacks >= 1, ap.meta.svgFallbacks);
  check('fallback icon is NOT also listed as a failure', failed.indexOf('Path Fallback Icon') === -1);
  check('hidden icon is not in svgFailures', failed.indexOf('Hidden Icon') === -1);
  check('hidden icon produced no svg', svgKeys.indexOf('I1:5;3:902') === -1);
  check('svgFailures is a separate uncapped list', Array.isArray(ap.meta.svgFailures));
  check('revision is 6', ap.meta.revision === 6, ap.meta.revision);
  check('fonts summary present', Array.isArray(ap.meta.fonts) && ap.meta.fonts.length > 0, (ap.meta.fonts || [])[0]);
  check('no inferred-font flag on text nodes', !ap.nodes.some((n) => n._inferred));
  check('vector nodes are tagged', ap.nodes.filter((n) => n.vector).length >= 5);
} else {
  check('dump/all + svg produced a payload', false);
}

/* وضع الأيقونات وحدها: بلا عقد، بخريطة svgs فقط */
messages.length = 0;
figma.ui.onmessage({ type: 'icons' });
for (let i = 0; i < 120 && !messages.some((m) => m.type === 'icons'); i++) await new Promise((r) => setTimeout(r, 25));
const iconsMsg = messages.map(parse).find((m) => m.type === 'icons');
console.log('\n--- icons-only mode ---');
check('icons-only returns an svg map', !!iconsMsg && Object.keys(iconsMsg.payload.svgs).length > 0);
check('icons-only omits the nodes array', !!iconsMsg && iconsMsg.payload.nodes === undefined);
check('icons-only flags itself', !!iconsMsg && iconsMsg.payload.iconsOnly === true);
check('icons-only still reports failures', !!iconsMsg && Array.isArray(iconsMsg.payload.meta.svgFailures));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
