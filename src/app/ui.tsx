import { SITE_ICONS, type SiteIconName } from '../lib/site-icons';
import type { CSSProperties, ReactNode } from 'react';
import { C } from '../lib/tokens';

/**
 * الأزرار — جزء واحد بدل ثمانية.
 *
 * كانت مكتوبة في كل ملفّ على حدة (`rounded-full px-4 py-2 text-sm font-semibold`)،
 * وستّة منها بخلفية `#ffffff` مثبّتة. وذلك **يختفي في الوضع الفاتح**: زرّ أبيض
 * على نافذة بيضاء — وهو ما قِسته في نافذة الدخول.
 *
 * والحلّ ليس لونًا جديدًا بل **عكس الأدوار**: الزرّ الرئيسيّ خلفيته لون النصّ،
 * ونصّه لون السطح. فالوضع الغامق يعطينا أبيض على غامق، والفاتح أسود على أبيض —
 * وهو ما تفعله ChatGPT في الوضعين.
 *
 * والمقاسات من الأزرار الموجودة لا من رأسي: ‎md = ٣٦ (px-4 py-2 + سطر ٢٠)،
 * وsm = ٣٠ (px-3 py-1.5 + سطر ١٨). ولا أُضيف `lg` قبل أن تُراه في لقطة.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md';

const SIZE: Record<ButtonSize, { height: number; padX: number; font: number }> = {
  sm: { height: 30, padX: 12, font: 14 },
  md: { height: 36, padX: 16, font: 14 },
};

function styleFor(variant: ButtonVariant): CSSProperties {
  switch (variant) {
    case 'primary':
      /* عكس الدورَين — فيتبع الثيم بلا لون مثبّت */
      return { background: 'var(--c-text)', color: 'var(--c-body)', border: '1px solid transparent' };
    case 'secondary':
      return { background: 'transparent', color: C.text, border: `1px solid ${C.line}` };
    case 'tertiary':
      return { background: 'transparent', color: C.text, border: '1px solid transparent' };
    case 'danger':
      return {
        background: 'color-mix(in srgb, var(--c-danger) 14%, transparent)',
        color: 'var(--c-danger)',
        border: '1px solid transparent',
      };
  }
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  type = 'button',
  title,
  ariaLabel,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** يمتدّ على عرض الحاوية — كما في «Log in» أسفل الشريط */
  full?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  ariaLabel?: string;
  /** أيقونة قبل النصّ — تُمرَّر عقدة جاهزة، فلا يعرف هذا الملفّ نظام الأيقونات */
  icon?: ReactNode;
}) {
  const s = SIZE[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[opacity,background-color,border-color] duration-150 hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        ...styleFor(variant),
        height: s.height,
        paddingInline: s.padX,
        fontSize: s.font,
        lineHeight: `${s.height - 8}px`,
        width: full ? '100%' : undefined,
        flexShrink: 0,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * `Tip` — التلميح، بمقاساته المقيسة من capture.
 *
 *   «Turn off temporary chat» 174×30 @ (1348,50)
 *   bg rgb(48,48,48) · نصّ rgb(237,237,237) · 14/18 w600
 *   حشو 5 · حدّ 0.8px أبيض 5%
 *
 * ويظهر بعد ~٧٠٠ مللي — وهو ما جعل التقاطه يفشل حين كان التأخير ٢٦٠.
 * وبلا حالة React: `group-hover` وحدها، فلا يُعاد رسم شيء عند المرور.
 */
export function Tip({ label, shortcut, wrapperClassName, children, side = 'bottom', align = 'center' }: { label: string; shortcut?: string; wrapperClassName?: string; children: React.ReactNode; side?: 'bottom' | 'top' | 'right'; align?: 'center' | 'end' }) {
  return (
    <span className={`group/tip relative inline-flex ${wrapperClassName || ''}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute z-50 whitespace-nowrap opacity-0 transition-opacity duration-100 group-hover/tip:opacity-100"
        style={{
          /*
           * الشريط المطويّ ضيّق ٥٢: التلميح تحته يغطّي العنصر نفسه.
           * فيُعرض **إلى يمينه** كما في الموقع.
           */
          ...(side === 'right'
            ? { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' }
            : align === 'end'
              /* عند حدّ الشاشة: يُثبَّت بيمين الزرّ فيخرج كاملًا لا مقطوعًا */
              ? { right: 0, [side === 'bottom' ? 'top' : 'bottom']: 'calc(100% + 6px)' }
              : { left: '50%', transform: 'translateX(-50%)', [side === 'bottom' ? 'top' : 'bottom']: 'calc(100% + 6px)' }),
          transitionDelay: '700ms',
          background: '#303030',
          color: '#ededed',
          fontSize: 14,
          lineHeight: '18px',
          fontWeight: 600,
          padding: 5,
          paddingInline: 8,
          borderRadius: 8,
          border: '0.8px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {label}
        {shortcut && (
          <kbd
            style={{
              marginInlineStart: 8,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.10)',
              fontSize: 12,
              lineHeight: '16px',
              fontWeight: 500,
            }}
          >
            {shortcut}
          </kbd>
        )}
      </span>
    </span>
  );
}

/**
 * SiteIcon — أيقونة الموقع مضمَّنة لا img، لأنّ currentColor لا تعبر
 * حدود مستند الصورة.
 */
export function SiteIcon({ name, size = 20, color }: { name: SiteIconName; size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, color: color || "currentColor" }}
      dangerouslySetInnerHTML={{ __html: SITE_ICONS[name] }}
    />
  );
}
