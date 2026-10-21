import { ICONS } from '../lib/icon-map';
import { CAPTURE_ICONS } from '../lib/icon-capture';
import { useIconsReady } from '../lib/icons';

/**
 * أيقونة من ملفات Figma المُصدَّرة.
 *
 * تُرسم بـ**قناع CSS** لا بوسم `img`.
 *
 * السبب: الأيقونات في التصميم سوداء على خلفية فاتحة. ولأن التطبيق داكن، كنت
 * أقلبها بـ`filter: invert(1)` — وهو حلّ هشّ: كل موضع أُلغي فيه الفلتر يعود
 * الرمز أسود على خلفية سوداء فيختفي تمامًا. وقد حدث في ثلاثة مواضع.
 *
 * والقناع يجعل الرمز يأخذ `currentColor`، أي **لون النص حوله**. فلا فلتر،
 * ولا حالة خاصة، ويستحيل أن يختفي رمز بسبب الخلفية.
 */
export function Icon({
  name,
  size = 20,
  w,
  className = '',
  style,
}: {
  name: string;
  size?: number;
  /** عرض مستقلّ عن الارتفاع — الشعار 77×18 لا مربّع */
  w?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ready = useIconsReady();
  /*
   * الأيقونة المأخوذة من الموقع تتقدّم على أيقونة الـKit: تلك من عهد GPT-5،
   * وهذه من الصفحة الحيّة. والمصدر في `icon-capture.ts` مولَّد لا مكتوب.
   */
  const file = CAPTURE_ICONS[name] ?? ICONS[name];
  /*
   * قيمة فيها شرطة مائلة = مسار كامل (أيقونة مرسومة يدويًا في app-icons).
   * وما عداها اسم ملف داخل مجلد المولَّد.
   */
  const src = file ? (file.includes('/') ? `/${file}.svg` : `/generated-icons/${file}.svg`) : undefined;

  /* بلا أيقونة لا نرسم صندوقًا فارغًا — نحفظ المساحة ونسكت */
  if (!src || !ready) {
    return <span aria-hidden style={{ width: w ?? size, height: size, display: 'inline-block', ...style }} />;
  }

  const url = `url("${src}")`;

  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'block',
        /*
         * تفصيلًا لا اختصارًا: `flex: '0 0 auto'` مع `flexShrink` التي يمرّرها
         * المستدعي في `style` تُنتج تحذير React «خلط اختصار بتفصيل»، وكان
         * يُطلق خمس مرّات في الشاشة الرئيسية.
         */
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
        width: w ?? size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        opacity: 0.92,
        ...style,
      }}
    />
  );
}

/** أيقونة داخل زر — توريث الشفافية عند المرور */
export function IconButton({
  name,
  label,
  size = 20,
  onClick,
  active,
  disabled,
  className = '',
  box = 36,
}: {
  name: string;
  label: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  box?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        'group grid place-items-center rounded-lg transition-colors disabled:opacity-40 ' +
        (active ? 'bg-white/10 ' : 'hover:bg-white/10 ') +
        className
      }
      style={{ width: box, height: box }}
    >
      <Icon name={name} size={size} style={{ opacity: active ? 1 : 0.75 }} />
    </button>
  );
}
