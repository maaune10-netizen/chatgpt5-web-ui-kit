import { useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, ITEM, L } from '../lib/tokens';
import type { Store } from './store';

/** صف الشريط الجانبي — 260x36 بنصف قطر 10، من Menu List Item Base */
function Row({
  icon,
  label,
  trailing,
  active,
  onClick,
  onContextMenu,
  muted,
  bold,
}: {
  icon?: string;
  label: string;
  trailing?: string;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex w-full items-center gap-2 rounded-[10px] px-2.5 text-start transition-colors hover:bg-white/[0.07]"
      style={{
        height: ITEM.h,
        background: active ? 'rgba(255,255,255,0.10)' : undefined,
        color: muted ? C.muted : C.text,
      }}
    >
      {icon ? <Icon name={icon} size={ITEM.icon} /> : <span style={{ width: ITEM.icon }} />}
      <span
        className="flex-1 truncate"
        style={{ fontSize: ITEM.labelSize, lineHeight: `${ITEM.labelLh}px`, fontWeight: bold ? 500 : 400 }}
      >
        {label}
      </span>
      {trailing ? (
        <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>{trailing}</span>
      ) : null}
    </button>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-4">
      <span style={{ fontSize: 12, color: C.dim, letterSpacing: 0.2 }}>{children}</span>
      {action}
    </div>
  );
}

export function Sidebar({
  store,
  onOpenSearch,
  onOpenAccount,
  onUpgrade,
  collapsed,
  onToggleCollapsed,
}: {
  store: Store;
  onOpenSearch: () => void;
  onOpenAccount: (anchor: DOMRect) => void;
  onUpgrade: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { state, active } = store;
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const accountRef = useRef<HTMLButtonElement>(null);

  /*
   * محادثة المشروع تظهر داخل مشروعها فقط.
   * وكانت تظهر مرّتين — مرة تحت المشروع ومرة في Chats — لأن الشرط لم يكن
   * يستثني ما له مشروع.
   */
  const { pinned, rest } = useMemo(() => {
    const free = state.conversations.filter((c) => !c.projectId);
    const p: typeof state.conversations = [];
    const r: typeof state.conversations = [];
    for (const c of free) (c.pinned ? p : r).push(c);
    r.sort((a, b) => b.updatedAt - a.updatedAt);
    return { pinned: p, rest: r };
  }, [state.conversations]);

  const w = collapsed ? 0 : L.sidebarW;

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200"
      style={{ width: w, background: C.sidebar, borderRight: `1px solid ${C.line}` }}
      aria-hidden={collapsed}
    >
      <div style={{ width: L.sidebarW }} className="flex h-full flex-col">
        {/* الترويسة: الشعار + طيّ الشريط */}
        <div className="flex items-center justify-between px-2.5 pt-2">
          <button
            type="button"
            onClick={() => store.newChat()}
            title="ChatGPT"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
          >
            <Icon name="chatgpt" size={22} />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Close sidebar"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
          >
            <Icon name="sidebar" size={20} />
          </button>
        </div>

        <div className="px-1.5 pt-1">
          <Row icon="create" label="New Chat" trailing="Ctrl + Shift + O" onClick={() => store.newChat()} />
          <Row icon="search" label="Search chats" onClick={onOpenSearch} />
          <Row icon="images" label="Library" onClick={() => store.go('library')} />
        </div>

        {/* GPTs */}
        <div className="px-1.5">
          <SectionLabel>GPTs</SectionLabel>
          <Row icon="explore" label="Explore" onClick={() => store.newChat()} />
          <Row icon="chatgpt" label="Example GPT 1" onClick={() => store.newChat()} />
          <Row icon="chatgpt" label="Example GPT 2" onClick={() => store.newChat()} />
        </div>

        {/* المشاريع */}
        <div className="px-1.5">
          <SectionLabel
            action={
              <button
                type="button"
                title="New project"
                onClick={() => store.newProject('New project')}
                className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
              >
                <Icon name="add" size={16} />
              </button>
            }
          >
            Projects
          </SectionLabel>
          {state.projects.map((p) => (
            <div key={p.id}>
              <Row icon="folder" label={p.name} onClick={() => store.go('project', p.id)} />
              {state.conversations
                .filter((c) => c.projectId === p.id)
                .map((c) => (
                  <div key={c.id} className="ps-6">
                    <Row
                      label={c.title}
                      active={c.id === state.activeId && state.view === 'chat'}
                      onClick={() => store.openChat(c.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenuFor(c.id);
                      }}
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* المحادثات */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          <SectionLabel>Chats</SectionLabel>
          {pinned.length > 0 && (
            <>
              {pinned.map((c) => (
                <Row
                  key={c.id}
                  label={c.title}
                  active={c.id === state.activeId && state.view === 'chat'}
                  onClick={() => store.openChat(c.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuFor(c.id);
                  }}
                  bold
                />
              ))}
              <SectionLabel>Recents</SectionLabel>
            </>
          )}
          {rest.map((c) => (
            <Row
              key={c.id}
              label={c.title}
              active={c.id === state.activeId && state.view === 'chat'}
              onClick={() => store.openChat(c.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuFor(c.id);
              }}
            />
          ))}
          {rest.length === 0 && pinned.length === 0 && (
            <p className="px-2.5 py-2" style={{ fontSize: 12, color: C.dim }}>
              No chats yet.
            </p>
          )}
        </div>

        {/* التذييل */}
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <button
            ref={accountRef}
            type="button"
            onClick={() => {
              const r = accountRef.current?.getBoundingClientRect();
              if (r) onOpenAccount(r);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-start hover:bg-white/[0.07]"
          >
            <span
              className="grid shrink-0 place-items-center rounded-full"
              style={{ width: 24, height: 24, background: C.avatar }}
            >
              <Icon name="user" size={14} style={{ filter: 'none', opacity: 1 }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 14, lineHeight: '20px' }}>
                Username
              </span>
              <span className="block truncate" style={{ fontSize: 12, lineHeight: '16px', color: C.muted }}>
                Free
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/15"
            style={{ background: 'rgba(255,255,255,0.10)', border: `1px solid ${C.line}` }}
          >
            Upgrade
          </button>
        </div>

        {/* قائمة سياق المحادثة */}
        {menuFor && (
          <ConversationMenu
            store={store}
            id={menuFor}
            onClose={() => setMenuFor(null)}
          />
        )}

        {/* زر إظهار الشريط حين يكون مطويًا */}
        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Open sidebar"
            className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
            style={{ background: C.sidebar }}
          >
            <Icon name="sidebar" size={20} />
          </button>
        )}
      </div>

      {/* زر الطيّ حين يكون مقفلًا */}
      {!collapsed && (
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px" style={{ background: C.line }} />
      )}

      {active == null ? null : null}

      <div className="hidden">{active?.title}</div>
    </aside>
  );
}

function ConversationMenu({ store, id, onClose }: { store: Store; id: string; onClose: () => void }) {
  const conv = store.state.conversations.find((c) => c.id === id);
  if (!conv) return null;
  const item = 'w-full rounded-[8px] px-3 py-2 text-start hover:bg-white/10';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 w-48 overflow-hidden rounded-xl p-1"
        style={{ background: C.menu, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', left: 12, bottom: 80 }}
      >
        <button type="button" className={item} style={{ fontSize: 14 }} onClick={() => { store.togglePin(id); onClose(); }}>
          {conv.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          type="button"
          className={item}
          style={{ fontSize: 14 }}
          onClick={() => {
            const name = window.prompt('Rename chat', conv.title);
            if (name) store.renameChat(id, name);
            onClose();
          }}
        >
          Rename
        </button>
        <button type="button" className={item} style={{ fontSize: 14 }} onClick={() => { store.go('chat', null); onClose(); }}>
          Open in new chat
        </button>
        <div className="my-1 h-px" style={{ background: C.line }} />
        <button
          type="button"
          className={item}
          style={{ fontSize: 14, color: '#ff8a8a' }}
          onClick={() => { store.deleteChat(id); onClose(); }}
        >
          Delete
        </button>
      </div>
    </>
  );
}
