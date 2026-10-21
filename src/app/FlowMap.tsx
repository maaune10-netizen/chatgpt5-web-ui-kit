import { useMemo } from 'react';
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { C, FONT } from '../lib/tokens';
import { useResolvedMode } from '../lib/useThemeMode';

/**
 * خريطة الصفحات — من **لقطات الموقع الحقيقي** (٢١ أكتوبر)، لا من ملفّ Figma.
 *
 * والخريطة السابقة بُنيت على الـKit، وكان عمرها عهد GPT-5. والفرق الذي كشفته
 * اللقطات ليس نقصًا بل **تقادمًا**: أشياء مبنية عندنا، لكنّ الموقع تحرّك عنها.
 * ولذلك صار في المفتاح أربع حالات لا ثلاث — وأهمّها **متقادم**.
 *
 * والمصدر: `specs/LINKS.md` (الجرد) و`specs/GAPS.md` (المقارنة).
 */

type Status = 'live' | 'stale' | 'missing' | 'removed';

interface PageData extends Record<string, unknown> {
  title: string;
  sub: string;
  status: Status;
}

const STATUS: Record<Status, { color: string; label: string }> = {
  live: { color: 'var(--c-ok, #1a7f37)', label: 'مطابق للّقطة' },
  stale: { color: '#d9a441', label: 'مبنيّ لكن متقادم' },
  missing: { color: 'var(--c-danger)', label: 'غير مبنيّ' },
  removed: { color: 'var(--c-dim)', label: 'أُزيل من المنتج' },
};

const W = 208;

function PageNode({ data }: NodeProps<Node<PageData>>) {
  const st = STATUS[data.status];
  const dead = data.status === 'removed';
  return (
    <div
      style={{
        width: W,
        background: 'var(--c-modal)',
        border: `1px ${dead ? 'dashed' : 'solid'} ${C.line}`,
        borderInlineStart: `3px solid ${st.color}`,
        borderRadius: 10,
        padding: '7px 10px 8px',
        boxShadow: dead ? 'none' : '0 1px 2px rgba(0,0,0,0.18)',
        opacity: dead ? 0.55 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1, border: 0, minWidth: 0, minHeight: 0 }} />
      <div
        dir="ltr"
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: '17px',
          textAlign: 'start',
          textDecoration: dead ? 'line-through' : undefined,
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

const COL = { a: 0, b: 268, c: 536, d: 804, e: 1072, f: 1340 };
const ROW = 88;

const P = (id: string, col: number, row: number, title: string, sub: string, status: Status): Node<PageData> => ({
  id,
  type: 'page',
  position: { x: col, y: 58 + row * ROW },
  data: { title, sub, status },
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
  L('l1', COL.a, 'Visitor', 'بلا حساب'),
  L('l2', COL.b, 'Gate', 'المصادقة'),
  L('l3', COL.c, 'Signed in', 'المحادثة والأسطح'),
  L('l4', COL.d, 'Projects', 'المشاريع والبروفايل'),
  L('l5', COL.e, 'Settings', '١٧ صفحة'),
  L('l6', COL.f, 'Overlays', 'نوافذ'),

  /* ————— الزائر ————— */
  P('v-home', COL.a, 0, '/', 'New chat · شريط أيقونات · «Where should we begin?»', 'stale'),
  P('v-images', COL.a, 1, '/images', '«Describe a new image» — شريط توليد صور', 'missing'),
  P('v-plugins', COL.a, 2, '/plugins', 'دليل الإضافات — Popular · New · Small Business', 'missing'),
  /*
   * بلا سهم `↗`: الحرف مع مُحدِّد التنويع يُعامَل كإيموجي فيُرسم مربّعًا فارغًا —
   * وهو نفس ما حدث في الشريط الجانبي سابقًا. فالكلمة بدل الرمز.
   */
  P('v-links', COL.a, 3, 'Sidebar links', 'Deep research · Plans · Help (خارجيّة)', 'missing'),
  P('v-modal', COL.a, 4, 'Login modal', 'موجود · لكن بترويسة ١٩٧px ليست في التصميم', 'stale'),

  /* ————— البوابة ————— */
  P('login', COL.b, 0, '/auth/login', 'صفحة كاملة · «Log in or sign up»', 'missing'),
  P('social', COL.b, 1, 'Google · Apple · phone', 'ثلاثة أزرار بإطار + فاصل or', 'missing'),
  P('email', COL.b, 2, 'Email + Continue', 'حقل · زرّ أسود · «Try it first»', 'missing'),

  /* ————— مسجَّل: المحادثة ————— */
  P('home', COL.c, 0, '/', '«What\'s on your mind today?» · Chat|Work · Think', 'stale'),
  P('thread', COL.c, 1, '/c/:id', 'الخيط والردود والأفعال — الأقرب للمطابقة', 'live'),
  P('s-images', COL.c, 2, '/images', 'صفحة توليد صور', 'missing'),
  P('scheduled', COL.c, 3, '/scheduled', 'محادثات مجدولة', 'missing'),
  P('library', COL.c, 4, '/library', '٥ تبويبات · بحث · New', 'stale'),
  P('plugins', COL.c, 5, '/plugins', 'Plugins | Skills · Installed · Public/Personal', 'missing'),
  P('codex', COL.c, 6, '/codex', 'سطح Codex', 'missing'),
  P('explore', COL.c, 7, '/explore', 'Explore', 'missing'),

  /* ————— مشاريع وبروفايل ————— */
  P('projects', COL.d, 0, 'Projects', 'قسم في الشريط · «No projects»', 'live'),
  P('newproj', COL.d, 1, 'Create project', 'اسم · ٧ ألوان · شبكة أيقونات', 'missing'),
  P('profile', COL.d, 2, '/u/:handle', 'إحصاءات · Showcase · Token activity', 'missing'),
  P('showcase', COL.d, 3, 'Showcase', 'بطاقات المواقع على البروفايل', 'missing'),

  /* ————— إعدادات ————— */
  P('settings', COL.e, 0, '/settings/*', 'شريط أيسر ٣٣٥px + بحث + Back to app', 'missing'),
  P('s-account', COL.e, 1, 'Account', 'Name · Email · Age · Delete', 'stale'),
  P('s-appearance', COL.e, 2, 'Appearance', 'Mode (٣ صور) · Accent · Background · Foreground', 'stale'),
  P('s-usage', COL.e, 3, 'Usage', 'Overview/Analytics · Plan limits · Resets', 'missing'),
  P('s-storage', COL.e, 4, 'Storage', '2.67 of 512 MB · Files / Images', 'missing'),
  P('s-more', COL.e, 5, '١٤ صفحة أخرى', 'Notifications · Security · Pets · Billing · Data controls…', 'missing'),

  /* ————— نوافذ ————— */
  P('o-search', COL.f, 0, 'Search chats', 'بحث · في الموقع صار أيقونة في الترويسة', 'live'),
  P('o-share', COL.f, 1, 'Share', 'نافذة مشاركة', 'live'),
  P('o-chatmenu', COL.f, 2, 'Chat menu', 'تسمية · تثبيت · أرشفة', 'live'),
  P('o-upgrade', COL.f, 3, 'Upgrade', 'الخطط', 'live'),
  P('o-oldgpts', COL.f, 4, 'GPTs (قديم)', 'Explore · Details · Chat · Builder', 'removed'),
];

const edge = (id: string, source: string, target: string, label?: string, dashed?: boolean): Edge => ({
  id,
  source,
  target,
  label,
  type: 'smoothstep',
  animated: !!dashed,
  style: {
    stroke: dashed ? 'var(--c-dim)' : 'var(--c-divider)',
    strokeWidth: dashed ? 1 : 1.4,
    strokeDasharray: dashed ? '4 4' : undefined,
  },
  labelStyle: { fill: 'var(--c-muted)', fontSize: 10 },
  labelBgStyle: { fill: 'var(--c-body)', fillOpacity: 0.9 },
});

const EDGES: Edge[] = [
  /* الزائر */
  edge('e1', 'v-home', 'v-images'),
  edge('e2', 'v-home', 'v-plugins'),
  edge('e3', 'v-home', 'v-links'),
  edge('e4', 'v-home', 'v-modal', 'Log in', true),
  edge('e5', 'v-home', 'login', 'Log in'),

  /* البوابة */
  edge('e6', 'login', 'social'),
  edge('e7', 'social', 'email'),
  edge('e8', 'email', 'home', 'Continue'),
  edge('e9', 'v-modal', 'login', 'نفس المحتوى', true),

  /* مسجَّل */
  edge('e10', 'home', 'thread'),
  edge('e11', 'home', 's-images'),
  edge('e12', 'home', 'scheduled'),
  edge('e13', 'home', 'library'),
  edge('e14', 'home', 'plugins'),
  edge('e15', 'home', 'codex'),
  edge('e16', 'home', 'explore'),

  /* مشاريع */
  edge('e17', 'home', 'projects'),
  edge('e18', 'projects', 'newproj', 'New', true),
  edge('e19', 'home', 'profile'),
  edge('e20', 'profile', 'showcase'),

  /* إعدادات */
  edge('e21', 'home', 'settings'),
  edge('e22', 'settings', 's-account'),
  edge('e23', 'settings', 's-appearance'),
  edge('e24', 'settings', 's-usage'),
  edge('e25', 'settings', 's-storage'),
  edge('e26', 'settings', 's-more'),

  /* نوافذ */
  edge('e27', 'home', 'o-search', 'Ctrl+K', true),
  edge('e28', 'thread', 'o-share', undefined, true),
  edge('e29', 'thread', 'o-chatmenu', undefined, true),
  edge('e30', 'profile', 'o-upgrade', undefined, true),
];

export function FlowMap({ onBack }: { onBack?: () => void }) {
  const mode = useResolvedMode();
  const nodes = useMemo(() => NODES, []);
  const edges = useMemo(() => EDGES, []);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { live: 0, stale: 0, missing: 0, removed: 0 };
    for (const n of NODES) {
      const d = n.data as PageData | undefined;
      if (d?.status) c[d.status]++;
    }
    return c;
  }, []);

  return (
    <div className="relative h-full w-full" style={{ background: C.body }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={mode}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background gap={22} size={1} color={mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div
        className="pointer-events-none absolute start-4 bottom-32 rounded-xl px-3 py-2.5"
        style={{ background: 'var(--c-modal)', border: `1px solid ${C.line}`, maxWidth: 310 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>خريطة الصفحات</div>
        <div style={{ fontSize: 10.5, color: C.muted, lineHeight: '15px', marginTop: 2 }}>
          من لقطات الموقع ٢١ أكتوبر · <span style={{ fontFamily: FONT.mono }}>specs/LINKS.md</span>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {(Object.keys(STATUS) as Status[]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS[k].color, display: 'inline-block' }} />
              <span style={{ fontSize: 10.5, color: C.muted }}>{STATUS[k].label}</span>
              <span style={{ fontSize: 10.5, color: C.dim, marginInlineStart: 'auto' }}>{counts[k]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2" style={{ fontSize: 10, color: C.dim, lineHeight: '14px' }}>
          السهم المتقطّع = طبقة فوق الشاشة لا صفحة
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
