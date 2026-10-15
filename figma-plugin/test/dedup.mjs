/* يتحقق أن إزالة التكرار والتخطي تعمل: 6 نسخ لنفس الأيقونة → تصدير واحد */
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../code.js', import.meta.url), 'utf8');
const msgs = [];
let exportCalls = 0;

function leaf(id, name, extra = {}) {
  return Object.assign({
    id, name, type: 'VECTOR', visible: true,
    absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 },
    relativeTransform: [[1, 0, 0], [0, 1, 0]], fills: [], strokes: [], effects: [],
    exportAsync: async () => { exportCalls++; return new Uint8Array([60, 115, 118, 103, 62]); },
  }, extra);
}
function wrap(id, type, name, children, extra = {}) {
  return Object.assign({ id, type, name, visible: true, children,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    relativeTransform: [[1, 0, 0], [0, 1, 0]], fills: [], strokes: [], effects: [] }, extra);
}

// نفس الأيقونة (3:311) داخل 3 نسخ + واحدة مخفية + واحدة ظاهرة
const master = wrap('c1', 'COMPONENT', 'Icon', [leaf('3:311', 'Vector')]);
const inst = (i) => wrap('I1:' + i + ';3:311', 'INSTANCE', 'inst' + i, [leaf('I1:' + i + ';3:311', 'Vector')]);
const hidden = wrap('h', 'FRAME', 'hiddenFrame', [leaf('9:9', 'Hidden')], { visible: false });

const screen = wrap('scr', 'COMPONENT', 'Screen', [
  master, inst(1), inst(2), inst(3), hidden,
]);
const page = wrap('p', 'PAGE', 'P', [screen], { selection: [screen] });

// اربط الآباء — كما يفعل Figma الحقيقي (isVisible يعتمد عليها)
function link(n, parent) {
  n.parent = parent;
  (n.children || []).forEach((c) => link(c, n));
  return n;
}
link(page, null);

const figma = {
  root: { name: 'F', children: [page] }, currentPage: page, showUI() {}, closePlugin() {},
  loadAllPagesAsync: async () => {}, apiVersion: '1.0.0', editorType: 'figma',
  ui: { onmessage: null, postMessage: (m) => msgs.push(m), resize() {} },
};
new Function('figma', '__html__', code)(figma, '<html></html>');
figma.ui.onmessage({ type: 'dump', scope: 'all', includeSvg: true });
for (let i = 0; i < 100 && !msgs.some((m) => m.type === 'done' || m.type === 'failed'); i++) await new Promise((r) => setTimeout(r, 20));

const dec = (m) => (m && m.json ? Object.assign({ type: m.type }, JSON.parse(m.json)) : m);
const done = dec(msgs.find((m) => m.type === 'done'));
if (!done) { console.log('✗ no done. types:', msgs.map((m) => m.type).join(',')); process.exit(1); }

const m = done.meta;
console.log('vectors found   :', m.vectorCount);
console.log('unique vectors  :', m.uniqueVectorCount);
console.log('SVGs exported   :', m.svgCount);
console.log('skipped         :', m.skippedCount);
console.log('errors          :', m.errorCount);
console.log('exportAsync calls:', exportCalls);

const ok = m.svgCount === 1 && exportCalls === 1 && m.errorCount === 0 && m.skippedCount >= 4;
console.log(ok
  ? '\n✓ PASS — 5 vectors collapsed to 1 export, hidden ones skipped, 0 false errors'
  : '\n✗ FAIL');
process.exit(ok ? 0 : 1);
