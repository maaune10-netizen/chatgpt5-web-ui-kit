/**
 * الرموز التصميمية — كل رقم مقروء من ملف Figma، لا مُقدَّر.
 * والمصدر مذكور بجانب كل قيمة كي يبقى التحقق ممكنًا.
 *
 * الأيقونات في `icon-map.ts` مولَّدة آليًا من التصدير نفسه.
 */

export const C = {
  /* أسطح — Thread - Logged In، New Chat - Logged In */
  body: 'var(--c-body)',
  sidebar: 'var(--c-sidebar)',
  input: 'var(--c-input)', // Prompt Input Field 768x56
  menu: 'var(--c-menu)', // Context Menu 61:13896
  raised: 'var(--c-raised)',
  hover: 'var(--c-hover)', // Button في ترويسة التطبيق
  active: 'var(--c-active)',
  line: 'var(--c-line)',
  divider: 'var(--c-divider)', // Line 1 في Divider

  /* نص */
  text: 'var(--c-text)',
  muted: 'var(--c-muted)', // Secondary text
  dim: 'var(--c-dim)',
  faint: 'var(--c-muted)',

  accent: 'var(--c-accent)', // .User Profile Icon
  /** أزرق الإجراء — مقيس من لقطة الموقع: #3a83f7 */
  blue: 'var(--c-blue)',
  /** سطح المفتاح المقطعي Chat | Work — مقيس: #f4f4f4 */
  segment: 'var(--c-segment)',
  avatar: 'var(--c-accent)', // .User Profile Icon
  upsell: 'var(--c-upsell)',
  userBubble: 'var(--c-user-bubble)',
  codeBg: 'var(--c-code)',
} as const;

export const L = {
  sidebarW: 260, // Sidebar 260x1024
  railW: 1180, // Body
  headerH: 52, // App Header 1180x52
  threadW: 768, // Chat Thread 768x850
  inputH: 56, // Prompt Input Field
  inputW: 768, // Prompt Input Field 768x56
  inputRadius: 28,
  footerH: 138, // Chat Footer
  sidebarPad: 6, // صفوف متداخلة 6px
} as const;

export const ITEM = {
  h: 36, // Menu List Item Base 260x36
  radius: 10,
  padX: 10, // pad=6/10/6/10
  icon: 20,
  gap: 8,
  labelSize: 14,
  labelLh: 19.74,
  subSize: 12,
  subLh: 15.6,
} as const;

export const FONT = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--font-emoji)',
  mono: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/* الظل الثلاثي — Context Menu */
export const MENU_SHADOW = 'var(--c-shadow-menu)';

/* ظل صندوق الإدخال — Prompt Input Field */
export const INPUT_SHADOW = 'var(--c-shadow-input)';

/* سلّم الطباعة — من قسم Typography */
export const T = {
  body: { size: 16, lh: 24 },
  bodySm: { size: 14, lh: 19.74 },
  caption: { size: 12, lh: 15.6 },
  h1: { size: 30, lh: 36 },
  h2: { size: 24, lh: 31.2 },
  h3: { size: 20, lh: 27.9, ls: -0.72 },
} as const;

/* ألوان المستخدم/المساعد */
export const MSG = {
  userBg: 'var(--c-user-bubble)',
  assistantBg: 'transparent',
} as const;
