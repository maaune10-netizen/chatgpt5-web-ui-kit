import { readFileSync } from 'node:fs';
const code = readFileSync('/home/deploy/gpt5-kit/figma-plugin/code.js', 'utf8');
const messages = [];
const t0 = Date.now();

function node(type, name, extra = {}) {
  const n = { id: extra.id || 'n' + Math.random().toString(36).slice(2, 8), name, type, visible: true,
    absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 40 }, relativeTransform: [[1,0,10],[0,1,20]],
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }], strokes: [], ...extra };
  if (!('children' in n) && (type === 'FRAME' || type === 'COMPONENT' || type === 'PAGE')) n.children = [];
  return n;
}

/* 400 مفتاحًا فريدًا × 8 نسخ فاشلة = 3200 محاولة، كلها بلا مسار */
const N = 400;
const kids = [];
for (let i = 0; i < N; i++) {
  for (let c = 0; c < 8; c++) {
    kids.push(node('VECTOR', 'V' + i, {
      id: 'I' + c + ':0;3:' + (1000 + i),
      exportAsync: async () => { throw new Error('Failed to export node. This node may not have any visible layers.'); },
    }));
  }
}
const screen = node('COMPONENT', 'Stress', { children: [node('FRAME', 'Body', { children: kids })] });
const page = node('PAGE', 'P', { children: [screen], selection: [] });
const figma = { root: { name: 'T', children: [page] }, currentPage: page, showUI(){}, closePlugin(){},
  loadAllPagesAsync: async () => {}, ui: { onmessage: null, postMessage: (m) => messages.push(m), resize(){} } };

new Function('figma', '__html__', code)(figma, '<html></html>');

const res = await figma.ui.onmessage({ type: 'icons' });
if (res && res.then) await res;
for (let i = 0; i < 400 && !messages.some((m) => m.type === 'icons' || m.type === 'failed'); i++) await new Promise((r) => setTimeout(r, 50));

const done = messages.map((m) => { try { return { type: m.type, payload: JSON.parse(m.json) }; } catch { return m; } })
  .find((m) => m.type === 'icons' || m.type === 'failed');
const ms = Date.now() - t0;
if (done && done.type === 'icons') {
  const a = done.payload.meta.iconAudit;
  console.log('completed in ' + ms + 'ms');
  console.log('vectorsInScope=' + a.vectorsInScope + ' resolved=' + a.resolved + ' unresolvedCount=' + a.unresolvedCount + ' listed=' + a.unresolved.length);
  console.log(a.unresolvedCount === N && a.unresolved.length === 80 ? 'PASS: true count kept, list capped at 80, no hang, no stack overflow' : 'FAIL: count=' + a.unresolvedCount + ' listed=' + a.unresolved.length);
} else {
  console.log('NO COMPLETION after ' + ms + 'ms — messages: ' + messages.map((m) => m.type).join(','));
}
process.exit(0);
