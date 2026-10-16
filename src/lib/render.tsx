import type { CSSProperties, ReactNode } from 'react';

/*
 * بيانات الشاشة تأتي من ملف Figma الأصلي عبر إضافة Design Dump:
 * كل عقدة بإحداثياتها المطلقة داخل إطار 1440x1024، مع التعبئات
 * والحدود والظلال والنصوص والخطوط. لذا نرسمها بموضع مطلق — مطابقة بكسل ببكسل.
 */

export interface ScreenNode {
  d?: number;             // depth in the original tree
  n: string;              // name
  t: string;              // type
  x: number;
  y: number;
  w: number;
  h: number;
  bg?: string;            // solid fill
  bgi?: string;           // gradient fill (css)
  bd?: string;            // border colour
  bw?: number;            // border width
  r?: number | string;    // corner radius
  fx?: string;            // box-shadow
  op?: number;            // opacity
  cl?: number;            // clips content
  lay?: 'h' | 'v';        // auto-layout direction
  gap?: number;
  pad?: number[];
  jc?: string;
  ai?: string;
  tx?: string;            // text content
  ff?: string;
  fs?: number;
  fw?: number;
  lh?: number;
  ls?: number;
  ta?: 'c' | 'r';
  color?: string;
  ic?: string;            // icon file name
  _inferred?: number;
}

export interface ScreenData {
  slug: string;
  name: string;
  w: number;
  h: number;
  nodes: ScreenNode[];
}

/** خرائط الأيقونات: الاسم → الرابط */
export const iconUrls: Record<string, string> = (() => {
  const mods = import.meta.glob('../generated-icons/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const name = path.split('/').pop()!.replace('.svg', '');
    out[name] = url;
  }
  return out;
})();

const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  MIN: 'flex-start',
  CENTER: 'center',
  MAX: 'flex-end',
  SPACE_BETWEEN: 'space-between',
};

function flexStyle(n: ScreenNode): CSSProperties | undefined {
  if (!n.lay) return undefined;
  const s: CSSProperties = {
    display: 'flex',
    flexDirection: n.lay === 'h' ? 'row' : 'column',
    justifyContent: JUSTIFY[n.jc || 'MIN'] ?? 'flex-start',
    alignItems: n.ai === 'CENTER' ? 'center' : n.ai === 'MAX' ? 'flex-end' : 'flex-start',
  };
  /*
   * لا نطبّق padding: كل الأبناء بموضع مطلق، و«صندوق الحشو» هو المرجع
   * لنقطة أصلهم. فتطبيق الحشو يُزيحهم خطأً، ويزداد الخطأ مع كل مستوى تداخل.
   * الإحداثيات في البيانات نسبية لصندوق الحدود، وهو المطلوب.
   */
  return s;
}

function boxStyle(n: ScreenNode): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    left: n.x,
    top: n.y,
    width: n.w,
    height: n.h,
  };
  if (n.bg) base.background = n.bg;
  else if (n.bgi) base.backgroundImage = n.bgi;
  /*
   * الحدود عبر ظل داخلي بدل border: الحدود العادية تُزيح «صندوق الحشو»
   * بمقدارها، وهو نقطة أصل الأبناء المطلقين — فتظهر إزاحة 1px لكل مستوى.
   */
  if (n.bd) {
    const ring = `inset 0 0 0 ${n.bw ?? 1}px ${n.bd}`;
    base.boxShadow = n.fx ? `${n.fx}, ${ring}` : ring;
  }
  if (n.r !== undefined && n.r !== 0) base.borderRadius = n.r;
  if (n.fx) base.boxShadow = n.fx;
  if (n.op !== undefined && n.op < 1) base.opacity = n.op;
  if (n.cl) base.overflow = 'hidden';
  return base;
}

export interface RenderOptions {
  /** يُستدعى عند النقر؛ يعيد الهدف أو null */
  onNodeClick?: (n: ScreenNode) => void;
  /** أسماء العقد القابلة للنقر */
  clickable?: (n: ScreenNode) => boolean;
}

export function renderScreen(screen: ScreenData, opts: RenderOptions = {}): ReactNode {
  const out: ReactNode[] = [];
  const nodes = screen.nodes;

  // العقد مرتّبة DFS؛ نبني الشجرة بالعمق
  const stack: Array<{ depth: number; children: ReactNode[] }> = [{ depth: -1, children: out }];

  for (const n of nodes) {
    const depth = n.d ?? 0;
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();

    const kids: ReactNode[] = [];
    const clickable = opts.clickable ? opts.clickable(n) : false;

    const inner: ReactNode = (
      <div
        key={n.x + ':' + n.y + ':' + n.n}
        style={{ ...boxStyle(n), ...flexStyle(n) }}
        data-name={n.n}
        onClick={clickable ? () => opts.onNodeClick?.(n) : undefined}
      >
        {n.t === 'TEXT' ? (
          <span
            style={{
              fontFamily: n.ff,
              fontSize: n.fs,
              fontWeight: n.fw,
              lineHeight: n.lh ? n.lh + 'px' : undefined,
              letterSpacing: n.ls,
              color: n.color,
              textAlign: n.ta === 'c' ? 'center' : n.ta === 'r' ? 'right' : 'left',
              whiteSpace: 'pre-wrap',
              width: '100%',
              display: 'block',
            }}
          >
            {n.tx}
          </span>
        ) : n.ic && iconUrls[n.ic] ? (
          <img
            src={iconUrls[n.ic]}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : null}
        {kids}
      </div>
    );

    stack[stack.length - 1].children.push(inner);
    stack.push({ depth, children: kids });
  }

  return out;
}
