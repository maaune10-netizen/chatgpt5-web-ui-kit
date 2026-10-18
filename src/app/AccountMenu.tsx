import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { C, MENU_SHADOW } from '../lib/tokens';

/**
 * قائمة الحساب — مقاسات GPT-5 ومحتوى 4o، كما بُنيت في الشاشة المُركّبة.
 * 260 عرضًا · عناصر 248x36 · نصف قطر 10 · خلفية #353535 · الظل الثلاثي.
 */
export function AccountMenu({
  anchor,
  onClose,
  onSettings,
  onLibrary,
  onLogout,
  onUpgrade,
  email,
}: {
  anchor: DOMRect;
  onClose: () => void;
  onSettings: () => void;
  onLibrary: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
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
    width: 260,
    background: C.menu,
    borderRadius: 16,
    boxShadow: MENU_SHADOW,
    padding: '4px 6px',
    zIndex: 200,
  };

  return (
    <div ref={ref} style={style} role="menu">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(email);
        }}
        className="flex w-full items-center gap-2 rounded-[10px] px-2.5 text-start hover:bg-white/[0.07]"
        style={{ height: 36 }}
        title="Copy email"
      >
        <span className="flex-1 truncate" style={{ fontSize: 14, color: C.muted }}>
          {email}
        </span>
        <Icon name="copy" size={20} />
      </button>

      <Divider />

      <Org initials="IF" color="#3d47ff" label="Interaction Faction" />
      <Org initials="JO" color="#287fb8" label="Personal account" check />

      <Divider />

      <Item icon="group" label="Manage workspace" onClick={() => onLibrary()} />
      <Item icon="folder" label="My GPTs" onClick={() => onLibrary()} />
      <Item icon="personalization" label="Customize ChatGPT" onClick={onSettings} />
      <Item icon="settings" label="Settings" onClick={onSettings} />

      <Divider />

      <Item icon="upgradeSparkle" label="Upgrade plan" onClick={onUpgrade} />

      <Divider />

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

function Divider() {
  return (
    <div style={{ height: 8, display: 'flex', alignItems: 'center' }}>
      <div style={{ height: 1, width: '100%', background: C.divider }} />
    </div>
  );
}
