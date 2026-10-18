/**
 * الرموز التصميمية — كل رقم مقروء من ملف Figma، لا مُقدَّر.
 * والمصدر مذكور بجانب كل قيمة كي يبقى التحقق ممكنًا.
 *
 * الأيقونات في `icon-map.ts` مولَّدة آليًا من التصدير نفسه.
 */

export const C = {
  /* أسطح — Thread - Logged In، New Chat - Logged In */
  body: '#212121',
  sidebar: '#181818',
  input: '#303030', // Prompt Input Field 768x56
  menu: '#353535', // Context Menu 61:13896
  raised: '#424242',
  hover: 'rgba(255, 255, 255, 0.05)', // Button في ترويسة التطبيق
  active: 'rgba(255, 255, 255, 0.10)',
  line: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.26)', // Line 1 في Divider

  /* نص */
  text: '#ffffff',
  muted: '#afafaf', // Secondary text
  dim: '#696969',
  faint: '#8f8f8f',

  accent: '#3c6ac3', // .User Profile Icon
  avatar: '#3c6ac3', // .User Profile Icon
  upsell: '#373669',
  userBubble: '#303030',
  codeBg: '#2f2f2f',
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
export const MENU_SHADOW =
  'inset 0 0 1px 1px rgba(255,255,255,0.13), 0 6px 8px 0 rgba(0,0,0,0.10), 0 0 1.5px 0 rgba(0,0,0,0.45)';

/* ظل صندوق الإدخال — Prompt Input Field */
export const INPUT_SHADOW =
  'inset 0 1px 0 0 rgba(255,255,255,0.13), 0 8px 16px rgba(0,0,0,0.10), 0 1.5px 3px rgba(0,0,0,0.45)';

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
  userBg: 'rgba(48, 48, 48, 1)',
  assistantBg: 'transparent',
} as const;
