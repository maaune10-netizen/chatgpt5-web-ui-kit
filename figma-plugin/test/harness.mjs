/**
 * محاكي Figma Plugin API — يشغّل code.js محليًا لاكتشاف الأخطاء.
 */
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../code.js', import.meta.url), 'utf8');

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
  if (type === 'VECTOR' || type === 'BOOLEAN_OPERATION') {
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
  node('VECTOR', 'Add icon'),
  textNode('Ask anything'),
  node('INSTANCE', 'Button', {
    mainComponent: { id: 'c1', name: 'Button' },
    componentProperties: { Variant: { value: 'Primary', type: 'VARIANT' } },
  }),
  node('ELLIPSE', 'Working Indicator', { fills: [{ type: 'GRADIENT_LINEAR', gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 1 } }], gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], visible: true }] }),
  node('BOOLEAN_OPERATION', 'Union'),
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

async function run(msg, label) {
  messages.length = 0;
  try {
    const r = figma.ui.onmessage(msg);
    if (r && typeof r.then === 'function') await r;
  } catch (e) {
    console.log(`✗ ${label} THREW: ${e.message}`);
    return;
  }
  // انتظر انتهاء أي وعود غير مُعادة
  for (let i = 0; i < 60 && !messages.some(m => m.type === 'done' || m.type === 'error'); i++) {
    await new Promise(r => setTimeout(r, 25));
  }
  const decode = (m) => { if (!m) return null; if (m.json === undefined) return m; try { return Object.assign({ type: m.type }, JSON.parse(m.json)); } catch { return m; } };
  const err = decode(messages.find((m) => m.type === 'failed'));
  const done = decode(messages.find((m) => m.type === 'done'));
  if (err) {
    console.log(`✗ ${label} -> error: ${err.errors && err.errors[0] ? err.errors[0].message : err.message}`);
  } else if (done) {
    console.log(`✓ ${label} -> ok: ${done.meta.nodeCount} nodes, ${done.meta.svgCount} svgs`);
  } else {
    console.log(`? ${label} -> no done/error. messages:`, JSON.stringify(messages).slice(0, 200));
  }
  const thrown = messages.filter((m) => m.type === 'threw');
  if (thrown.length) console.log('   thrown:', JSON.stringify(thrown));
}

await run({ type: 'count' }, 'count');
await run({ type: 'dump', scope: 'selection' }, 'dump/selection (empty)');
figma.currentPage.selection = [screen];
await run({ type: 'dump', scope: 'selection' }, 'dump/selection');
await run({ type: 'dump', scope: 'all', includeSvg: true }, 'dump/all + svg');
