import type { FC, ReactNode } from 'react';
import { NAV, type NavItem } from '../nav';
import { IconOpenaiLogo, IconSidebar, IconStarIntelligence } from './icons';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onUpgrade: () => void;
}

/** يضبط حجم أي أيقونة داخل العقدة */
const Box: FC<{ children: ReactNode; size?: string; className?: string }> = ({
  children,
  size = 'h-5 w-5',
  className = '',
}) => (
  <span className={`shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${size} ${className}`}>
    {children}
  </span>
);

const IconBtn: FC<{ children: ReactNode; onClick?: () => void; title: string; dim?: boolean }> = ({
  children,
  onClick,
  title,
  dim,
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white/5 ${
      dim ? 'text-muted' : 'text-white'
    }`}
  >
    <Box size="h-5 w-5">{children}</Box>
  </button>
);

const Row: FC<{
  item: NavItem;
  active: boolean;
  onSelect: (id: string) => void;
}> = ({ item, active, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(item.id)}
    style={{ paddingInlineStart: item.inset ?? 10 }}
    className={`flex h-9 w-full items-center gap-2 rounded-[10px] pe-2.5 text-left transition ${
      active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
    }`}
  >
    {item.icon && (
      <Box size="h-5 w-5" className="text-white/90">
        {item.icon}
      </Box>
    )}
    <span className="min-w-0 flex-1 truncate text-[14px] leading-[19.7px] text-white">
      {item.label}
    </span>
  </button>
);

export const Sidebar: FC<SidebarProps> = ({
  open,
  onClose,
  activeId,
  onSelect,
  onNewChat,
  onUpgrade,
}) => {
  if (!open) return null;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-sidebar">
      {/* Section header: logo + sidebar toggle */}
      <div className="flex h-[52px] shrink-0 items-center justify-between px-2">
        <IconBtn title="ChatGPT"><IconOpenaiLogo /></IconBtn>
        <IconBtn title="Close sidebar" dim onClick={onClose}>
          <IconSidebar />
        </IconBtn>
      </div>

      {/* Main menu */}
      <div className="shrink-0 px-1.5 pb-3 pt-2">
        {NAV[0].items.map((item) => (
          <Row
            key={item.id}
            item={item}
            active={activeId === item.id}
            onSelect={item.id === 'new-chat' ? onNewChat : onSelect}
          />
        ))}
      </div>

      {/* Scrollable sections */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        {NAV.slice(1).map((section) => (
          <section key={section.id} className="pb-5">
            <h3 className="flex h-9 items-center px-2.5 text-[14px] leading-[19.7px] text-muted">
              {section.title}
            </h3>
            {section.items.map((item) => (
              <Row
                key={item.id}
                item={item}
                active={activeId === item.id}
                onSelect={onSelect}
              />
            ))}
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="mx-2 mb-2.5 flex h-12 shrink-0 items-center justify-between gap-2.5 px-2">
        <button type="button" className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-avatar text-[11px] font-medium text-white">
            A
          </span>
          <span className="flex min-w-0 flex-col leading-[15.6px]">
            <span className="truncate text-[14px] leading-[19.7px] text-white">Username</span>
            <span className="text-[12px] text-muted">Free</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onUpgrade}
          className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/[0.26] bg-white/[0.05] px-2 text-[13px] leading-[18.5px] text-white transition hover:bg-white/[0.10]"
        >
          <Box size="h-5 w-5"><IconStarIntelligence /></Box>
          Upgrade
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
