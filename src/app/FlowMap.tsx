import { useMemo } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { C, FONT } from '../lib/tokens';
import { useResolvedMode } from '../lib/useThemeMode';

/**
 * خريطة الصفحات — رسم تفاعليّ للفلو، وحالة كل صفحة فيه ملوّنة.
 *
 * والمصدر `specs/FLOW.md`: ١٩ شاشة و٦ نوافذ، تنطبق إلى ٨ مسارات. ولا شيء هنا
 * مُقدَّر — كل عقدة إمّا عقدة مقروءة من ملف الـKit، أو شاشة نعرف أنها موجودة في
 * `public/screens`، أو سطح نعرف أنه غير موجود أصلًا.
 *
 * والمواضع مكتوبة باليد لا بتخطيط آليّ: الأعمدة هي المعنى (زائر → بوابة →
 * مسجَّل → أسطح → نوافذ)، والتخطيط الآليّ يخلطها.
 */

type Status = 'live' | 'designed' | 'missing' | 'removed';

interface PageData extends Record<string, unknown> {
  title: string;
  sub: string;
  status: Status;
  kind?: 'page' | 'modal';
}

const STATUS: Record<Status, { color: string; label: string }> = {
  live: { color: 'var(--c-ok, #1a7f37)', label: 'موصول ويعمل' },
  designed: { color: '#d9a441', label: 'مصمَّم · غير موصول' },
  missing: { color: 'var(--c-danger)', label: 'غير موجود' },
  /* أُزيل من المنتج نفسه — فلا يُبنى ولا يُترك «ناقصًا» */
  removed: { color: 'var(--c-dim)', label: 'أُزيل من المنتج' },
};

const W = 208;

function PageNode({ data }: NodeProps<Node<PageData>>) {
  const st = STATUS[data.status];
  return (
    <div
      style={{
        width: W,
        background: 'var(--c-modal)',
        border: `1px ${data.status === 'removed' ? 'dashed' : 'solid'} ${C.line}`,
        borderInlineStart: `3px solid ${st.color}`,
        borderRadius: 10,
        padding: '7px 10px 8px',
        boxShadow: data.status === 'removed' ? 'none' : '0 1px 2px rgba(0,0,0,0.18)',
        opacity: data.status === 'removed' ? 0.55 : 1,
      }}
    >
      {/* نقاط الاتصال مخفيّة بصريًّا — الأسهم تُرسم من الحافة */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }} />
      <div
        dir="ltr"
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: '17px',
          textAlign: 'start',
          textDecoration: data.status === 'removed' ? 'line-through' : undefined,
        }}
      >
        {data.title}
      </div>
      <div style={{ fontSize: 10.5, color: C.muted, lineHeight: '14px', marginTop: 2 }}>{data.sub}</div>
      <div style={{ fontSize: 9.5, color: st.color, marginTop: 3, letterSpacing: 0.2 }}>{st.label}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }} />
    </div>
  );
}

function Lane({ data }: NodeProps<Node<{ text: string; sub: string }>>) {
  return (
    <div style={{ width: W, paddingBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: 0.4, textTransform: 'uppercase' }}>{data.text}</div>
      <div style={{ fontSize: 10, color: C.dim }}>{data.sub}</div>
    </div>
  );
}

const nodeTypes = { page: PageNode, lane: Lane };

/* الأعمدة: زائر · بوابة · مسجَّل (محادثة) · مسجَّل (أسطح) · نوافذ */
const COL = { a: 0, b: 286, c: 572, d: 858, e: 1144 };
const ROW = 86;

const P = (id: string, col: number, row: number, title: string, sub: string, status: Status, kind: 'page' | 'modal' = 'page'): Node<PageData> => ({
  id,
  type: 'page',
  position: { x: col, y: 60 + row * ROW },
  data: { title, sub, status, kind },
});

const L = (id: string, col: number, text: string, sub: string): Node => ({
  id,
  type: 'lane',
  position: { x: col, y: 0 },
  data: { text, sub },
  selectable: false,
  draggable: false,
});

const NODES: Node[] = [
  L('l1', COL.a, 'Visitor', 'بلا تسجيل دخول'),
  L('l2', COL.b, 'Gate', 'المصادقة'),
  L('l3', COL.c, 'Signed in', 'سطح المحادثة'),
  L('l4', COL.d, 'Signed in', 'الأسطح'),
  L('l5', COL.e, 'Overlays', 'نوافذ وقوائم'),

  /* الزائر — مقروءة من الـKit */
  P('nc-lo', COL.a, 0, 'New Chat — Logged Out', 'أوّل ما يراه · 7 عناصر في الشريط', 'live'),
  P('th-lo', COL.a, 1, 'Thread — Logged Out', 'يكتب ويرى ردًّا بلا حساب', 'live'),
  P('ci-lo', COL.a, 2, 'Thread + Citations — Logged Out', 'الردّ ومعه مصادر مرقّمة', 'live'),

  /* البوابة — الـKit لا يحتويها */
  P('signup', COL.b, 0, 'Sign up', 'غير موجودة في الـKit', 'missing'),
  P('login', COL.b, 1, 'Log in', 'نافذة موجودة ومبنية', 'live', 'modal'),
  P('forgot', COL.b, 2, 'Forgot password', 'غير موجودة في الـKit', 'missing'),
  P('onboard', COL.b, 3, 'Onboarding', 'غير موجودة في الـKit', 'missing'),
  P('pricing', COL.b, 4, 'Pricing & plans', 'غير موجودة في الـKit', 'missing'),

  /* المسجَّل — محادثة */
  P('nc-li', COL.c, 0, 'New Chat — Logged In', 'الشريط: محادثات ومشاريع', 'live'),
  P('th-li', COL.c, 1, 'Thread — Logged In', 'محادثة بحساب', 'live'),
  P('ci-li', COL.c, 2, 'Thread + Citations — Logged In', 'مصادر + زرّ مشاركة', 'live'),
  P('temp', COL.c, 3, 'Temporary Chat', 'لا تُحفظ ولا تظهر في التاريخ', 'live'),
  P('resp', COL.c, 4, 'Thread — Response Types', 'نصّ · جدول · كود · صورة', 'live'),
  P('load', COL.c, 5, 'Thread — Loading', 'أشكال الانتظار', 'live'),

  /* المسجَّل — أسطح */
  P('lib', COL.d, 0, 'Library', 'الصور والملفّات', 'live'),
  P('img', COL.d, 1, 'Image Viewer', 'ثلاثة مصادر: محادثة · مكتبة · ويب', 'live'),
  P('proj', COL.d, 2, 'Project Page', 'محادثات المشروع وملفّاته', 'live'),
  P('pchat', COL.d, 3, 'Project Chat', 'محادثة داخل مشروع', 'live'),
  P('gpts', COL.d, 4, 'Explore GPTs', 'كان في الـKit · أُزيل من المنتج', 'removed'),
  P('gdet', COL.d, 5, 'GPT Details', 'كان في الـKit · أُزيل من المنتج', 'removed'),
  P('gchat', COL.d, 6, 'GPT Chat', 'كان في الـKit · أُزيل من المنتج', 'removed'),
  P('builder', COL.d, 7, 'GPT Builder', 'أُزيل من المنتج', 'removed'),

  /* النوافذ */
  P('account', COL.e, 0, 'Account Menu', 'قائمة الحساب', 'live', 'modal'),
  P('search', COL.e, 1, 'Search chats', 'بحث بمفتاح Ctrl+K', 'live', 'modal'),
  P('chatmenu', COL.e, 2, 'Chat Menu', 'إعادة تسمية · تثبيت · أرشفة', 'live', 'modal'),
  P('share', COL.e, 3, 'Share', 'نافذة مشاركة', 'live', 'modal'),
  P('settings', COL.e, 4, 'Settings', 'بنيناها · الـKit لا يحتويها', 'live', 'modal'),
  P('upgrade', COL.e, 5, 'Upgrade', 'نافذة الخطط', 'live', 'modal'),
  P('banner', COL.e, 6, 'Banner', 'في الـKit · غير مبنيّ', 'designed', 'modal'),
];

const edge = (id: string, source: string, target: string, label?: string, dashed?: boolean): Edge => ({
  id,
  source,
  target,
  label,
  type: 'smoothstep',
  animated: !!dashed,
  style: { stroke: dashed ? 'var(--c-dim)' : 'var(--c-divider)', strokeWidth: dashed ? 1 : 1.4, strokeDasharray: dashed ? '4 4' : undefined },
  labelStyle: { fill: 'var(--c-muted)', fontSize: 10 },
  labelBgStyle: { fill: 'var(--c-body)', fillOpacity: 0.9 },
});

const EDGES: Edge[] = [
  edge('e1', 'nc-lo', 'th-lo'),
  edge('e2', 'th-lo', 'ci-lo'),
  edge('e3', 'th-lo', 'login', 'CTA'),
  edge('e4', 'nc-lo', 'login', 'Log in'),
  edge('e5', 'login', 'nc-li'),
  edge('e6', 'signup', 'onboard'),
  edge('e7', 'onboard', 'nc-li'),
  edge('e8', 'signup', 'login'),
  edge('e9', 'login', 'forgot', 'نسيت؟', true),
  edge('e10', 'nc-li', 'th-li'),
  edge('e11', 'th-li', 'ci-li'),
  edge('e12', 'nc-li', 'temp'),
  edge('e13', 'th-li', 'resp'),
  edge('e14', 'th-li', 'load', undefined, true),
  edge('e15', 'nc-li', 'lib'),
  edge('e16', 'lib', 'img'),
  edge('e17', 'nc-li', 'proj'),
  edge('e18', 'proj', 'pchat'),
  edge('e19', 'nc-li', 'gpts'),
  edge('e20', 'gpts', 'gdet'),
  edge('e21', 'gdet', 'gchat'),
  edge('e22', 'nc-li', 'account', undefined, true),
  edge('e23', 'nc-li', 'search', undefined, true),
  edge('e24', 'th-li', 'chatmenu', undefined, true),
  edge('e25', 'ci-li', 'share', undefined, true),
  edge('e26', 'account', 'settings', undefined, true),
  edge('e27', 'account', 'upgrade', undefined, true),
  edge('e28', 'nc-lo', 'banner', undefined, true),
];

export function FlowMap({ onBack }: { onBack?: () => void }) {
  const mode = useResolvedMode();
  const nodes = useMemo(() => NODES, []);
  const edges = useMemo(() => EDGES, []);

  return (
    <div className="relative h-full w-full" style={{ background: C.body }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={mode}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background gap={22} size={1} color={mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/*
       * المفتاح أسفل اليمين لا أعلى اليسار: كان يغطّي ترويسة العمود الأولى
       * («VISITOR») فتُقرأ الخريطة بلا سياق. والمساحة أسفل اليمين فارغة.
       */}
      <div
        className="pointer-events-none absolute start-4 bottom-32 rounded-xl px-3 py-2.5"
        style={{ background: 'var(--c-modal)', border: `1px solid ${C.line}`, maxWidth: 300 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>خريطة الصفحات</div>
        <div style={{ fontSize: 10.5, color: C.muted, lineHeight: '15px', marginTop: 2 }}>
          المصدر: <span style={{ fontFamily: FONT.mono }}>specs/FLOW.md</span> — من عقد الـKit، لا من الموقع
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {(Object.keys(STATUS) as Status[]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS[k].color, display: 'inline-block' }} />
              <span style={{ fontSize: 10.5, color: C.muted }}>{STATUS[k].label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2" style={{ fontSize: 10, color: C.dim, lineHeight: '14px' }}>
          السهم المتقطّع = يفتح كطبقة فوق الشاشة لا كصفحة
        </div>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute end-4 top-4 rounded-full px-3 py-1.5 text-xs transition-colors hover:bg-[var(--c-hover)]"
          style={{ color: C.muted, border: `1px solid ${C.line}`, background: 'var(--c-modal)' }}
        >
          Back to the app
        </button>
      )}
    </div>
  );
}
