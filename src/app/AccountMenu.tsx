import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { C, MENU_SHADOW } from '../lib/tokens';

/**
 * قائمة الحساب — مقاسات GPT-5 ومحتوى 4o، كما بُنيت في الشاشة المُركّبة.
 * 260 عرضًا · عناصر 248x36 · نصف قطر 10 · خلفية #353535 · الظل الثلاثي.
 */
export function AccountMenu({
  menuWidth,

  anchor,
  onClose,
  onSettings,
  onLibrary,
  onLogout,
  onUpgrade,

  email,
}: {
  /** عرض الشريط — والقائمة تأخذه كما هو */
  menuWidth?: number;
  anchor: DOMRect;
  onClose: () => void;
  onSettings: () => void;
  onLibrary: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
  /** المحادثة المؤقّتة — من قائمة الحساب بعد أن غادرت الشريط */
  onTemporary: () => void;
  email: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  /* يُفتح فوق الزر ويمتدّ للأعلى لأنه في تذييل الشريط */
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, anchor.left),
    bottom: Math.max(8, window.innerHeight - anchor.top + 8),
    /* العرض = عرض الشريط نفسه، لا رقم ثابت */
    /* مقيس من الالتقاط: 224×280 — وهو **أضيق من الشريط (240)** بـ16 */
    width: Math.min(menuWidth ?? 224, 224),
    background: C.menu,
    borderRadius: 16,
    boxShadow: MENU_SHADOW,
    padding: '4px 6px',
    zIndex: 200,
  };

  /* لم تبقَ في التصميم بعد الحذف — تُثبَّت كمراجع لاستخدامها لاحقًا */
  void onLibrary;
  void email;
  void Org;

  return (
    <div ref={ref} style={style} role="menu">
      {/*
        **لا شيء فوق القائمة.** المقيس من الالتقاط الكامل:
          الحرّ (Free) ثمّ البنود مباشرة.
        فحُذف: زرّ النسخ بالبريد، ومنتقي المساحات (Interaction Faction /
        Personal account)، و«Manage workspace». لم تكن في الأصل.
      */}
      {/*
        رأس القائمة **مقيس**: الاسم ثمّ «Free» تحته.
          Free @ (53,581) 12/14 w400 rgb(175,175,175)
        أي أنّه سطر الحساب، لا زرّ نسخ بريد.
      */}
      <div style={{ paddingInlineStart: 39, paddingBlock: 8 }}>
        <div style={{ fontSize: 14, lineHeight: '20px', color: C.text }}>عبدالرحمن نبيل</div>
        <div style={{ fontSize: 12, lineHeight: '14px', color: C.muted, marginTop: 2 }}>Free</div>
      </div>
      <Divider />
      {/*
        «My GPTs» أُزيل من المنتج — فحذفه ليس نقصًا بل تصحيح.
        وحلّ محلّه «Temporary chat»، التي كانت صفًّا في الشريط وليست فيه
        في اللقطة. فبقي الوصول إليها بلا مخالفة التصميم.
      */}
      {/*
        الترتيب **مقيس** من الالتقاط الكامل:
          Upgrade plan · Personalization · Profile · Settings
          ← فجوة ٥٣ ←
          Help · Log out
        والتباعد بين البنود ٣٦، ونصّها 14/20 w400.
      */}
      <Item icon="upgradeSparkle" label="Upgrade plan" onClick={onUpgrade} />
      <Item icon="personalization" label="Personalization" onClick={onSettings} />
      <Item icon="user" label="Profile" onClick={() => {}} />
      <Item icon="settings" label="Settings" onClick={onSettings} />

      {/* فاصل **خطّ** لا فراغ — كالذي بين «Manage workspace» و«Personal Account»،
          ومقيس: Settings ينتهي 754 وHelp يبدأ 787 ← 53 تحتوي الخطّ. */}
      <Divider />

      <Item icon="help" label="Help" onClick={() => {}} />
      <Item icon="logout" label="Log out" onClick={onLogout} />
    </div>
  );
}

function Item({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[10px] px-2.5 text-start transition-colors hover:bg-white/[0.07]"
      style={{ height: 36 }}
    >
      <Icon name={icon} size={20} />
      <span style={{ fontSize: 14 }}>{label}</span>
    </button>
  );
}

function Org({ initials, color, label, check }: { initials: string; color: string; label: string; check?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 rounded-[10px] px-2.5 text-start transition-colors hover:bg-white/[0.07]"
      style={{ height: 36 }}
    >
      <span
        className="grid shrink-0 place-items-center rounded-md"
        style={{ width: 20, height: 20, background: color, fontSize: 9, fontWeight: 600, color: '#fff' }}
      >
        {initials}
      </span>
      <span className="flex-1 truncate" style={{ fontSize: 14 }}>
        {label}
      </span>
      {check ? <Icon name="check" size={20} /> : null}
    </button>
  );
}

/*
 * الفاصل خطّ بارتفاع سطر: مقيس ٥٣ بين نهاية آخر بند وبداية التالي،
 * والخطّ في وسطها. و٨ كانت ضيّقة جدًّا.
 */
function Divider({ tall }: { tall?: boolean }) {
  return (
    <div style={{ height: tall ? 53 : 8, display: 'flex', alignItems: 'center' }}>
      <div style={{ height: 1, width: '100%', background: C.divider }} />
    </div>
  );
}
