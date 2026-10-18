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
  onMenu,
  muted,
  bold,
}: {
  icon?: string;
  label: string;
  trailing?: string;
  active?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** يفتح قائمة الإجراءات — التصميم يضعها في .List Item Trailing Content عند x=218 */
  onMenu?: (at: DOMRect) => void;
  muted?: boolean;
  bold?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <div className="group/row relative">
      <button
        ref={ref}
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
        {trailing && !onMenu ? (
          <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>{trailing}</span>
        ) : null}
      </button>

      {/* يظهر عند المرور فقط، فلا يزدحم الشريط */}
      {onMenu && (
        <button
          type="button"
          title="More"
          aria-label={`More options for ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            const r = ref.current?.getBoundingClientRect();
            if (r) onMenu(r);
          }}
          className="absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-md hover:bg-white/15 group-hover/row:grid"
        >
          <Icon name="overflow" size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * عنوان قسم قابل للطيّ.
 *
 * التصميم لا يضع سهمًا هنا — أُضيف بطلب، لأن الأقسام تطول فتحتاج طيًّا.
 * والمقاسات من `.Sidebar Title`: صفّ 248x36 ونصّ 14px بلون #afafaf.
 */
function SectionLabel({
  children,
  action,
  open,
  onToggle,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const collapsible = typeof open === 'boolean' && onToggle;

  return (
    <div className="flex items-center justify-between ps-2.5 pe-1 pt-3">
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        className={
          'flex items-center gap-1 rounded-md py-0.5 ' + (collapsible ? 'hover:text-white/80' : 'cursor-default')
        }
        style={{ fontSize: 13, color: C.dim }}
        aria-expanded={collapsible ? open : undefined}
      >
        {collapsible && (
          <span
            className="grid place-items-center transition-transform"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', width: 14, height: 14 }}
          >
            <Icon name="chevronDown" size={14} />
          </span>
        )}
        {children}
      </button>
      {action}
    </div>
  );
}

export function Sidebar({
  store,
  onOpenSearch,
  onOpenAccount,
  onUpgrade,
  onLogin,
  collapsed,
  onToggleCollapsed,
}: {
  store: Store;
  onOpenSearch: () => void;
  onOpenAccount: (anchor: DOMRect) => void;
  onUpgrade: () => void;
  onLogin: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { state, active } = store;
  const [menuFor, setMenuFor] = useState<{ id: string; at: DOMRect } | null>(null);
  const accountRef = useRef<HTMLButtonElement>(null);

  /* الأقسام المطويّة — محفوظة كي لا تُفتح من جديد في كل زيارة */
  const [closed, setClosed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('gpt5.sidebar.closed') || '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const toggle = (k: string) =>
    setClosed((c) => {
      const next = { ...c, [k]: !c[k] };
      try {
        localStorage.setItem('gpt5.sidebar.closed', JSON.stringify(next));
      } catch {
        /* التخزين معطّل */
      }
      return next;
    });
  const isOpen = (k: string) => !closed[k];

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
            aria-label="ChatGPT"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
          >
            <Icon name="chatgpt" size={22} />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Close sidebar"
            aria-label="Close sidebar"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
          >
            <Icon name="sidebar" size={20} />
          </button>
        </div>

        <div className="px-1.5 pt-1">
          <Row icon="create" label="New Chat" trailing="Ctrl + Shift + O" onClick={() => store.newChat()} />
          <Row icon="search" label="Search chats" onClick={onOpenSearch} />
          <Row icon="images" label="Library" onClick={() => store.go('library')} />
          <Row
            icon="temporaryChat"
            label="Temporary chat"
            active={state.temporary}
            onClick={() => store.newChat(null, true)}
          />
        </div>

        {/*
          قسم GPTs أُزيل بطلب: Explore و Example GPT 1/2 عناصر قديمة لم تعد
          في الواجهة الحديثة، ولا وظيفة لها هنا — فكانت صفوفًا تفتح محادثة فارغة.
        */}

        {/* المشاريع */}
        <div className="px-1.5">
          <SectionLabel
            open={isOpen('projects')}
            onToggle={() => toggle('projects')}
            action={
              <button
                type="button"
                title="New project"
                aria-label="New project"
                onClick={() => store.newProject('New project')}
                className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
              >
                <Icon name="add" size={16} />
              </button>
            }
          >
            Projects
          </SectionLabel>
          {!isOpen('projects') ? null : state.projects.map((p) => (
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
                      onMenu={(at) => setMenuFor({ id: c.id, at })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenuFor({ id: c.id, at: new DOMRect(e.clientX, e.clientY, 0, 0) });
                      }}
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* المحادثات */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {pinned.length > 0 && (
            <>
              <SectionLabel open={isOpen('pinned')} onToggle={() => toggle('pinned')}>
                Pinned
              </SectionLabel>
              {isOpen('pinned') &&
                pinned.map((c) => (
                  <Row
                    key={c.id}
                    label={c.title}
                    active={c.id === state.activeId && state.view === 'chat'}
                    onClick={() => store.openChat(c.id)}
                    onMenu={(at) => setMenuFor({ id: c.id, at })}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuFor({ id: c.id, at: new DOMRect(e.clientX, e.clientY, 0, 0) });
                    }}
                    bold
                  />
                ))}
            </>
          )}

          <SectionLabel open={isOpen('chats')} onToggle={() => toggle('chats')}>
            Chats
          </SectionLabel>
          {isOpen('chats') &&
            rest.map((c) => (
              <Row
                key={c.id}
                label={c.title}
                active={c.id === state.activeId && state.view === 'chat'}
                onClick={() => store.openChat(c.id)}
                onMenu={(at) => setMenuFor({ id: c.id, at })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenuFor({ id: c.id, at: new DOMRect(e.clientX, e.clientY, 0, 0) });
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
          {!state.signedIn ? (
            <button
              type="button"
              onClick={onLogin}
              className="flex-1 rounded-[10px] px-3 py-2 text-start text-sm font-medium hover:bg-white/[0.07]"
            >
              Log in
            </button>
          ) : (
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
              style={{ width: 24, height: 24, background: C.avatar, color: '#ffffff' }}
            >
              <Icon name="user" size={14} style={{ opacity: 1 }} />
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
          )}
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
          <ConversationMenu store={store} id={menuFor.id} at={menuFor.at} onClose={() => setMenuFor(null)} />
        )}

        {/*
          زر الإظهار ليس هنا.
          كان داخل الشريط المطوي، والشريط عرضه صفر مع overflow مخفي — فكان
          الزر مقصوصًا لا يمكن بلوغه. وهو في ترويسة التطبيق حيث يبقى ظاهرًا.
        */}
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

function ConversationMenu({
  store,
  id,
  at,
  onClose,
}: {
  store: Store;
  id: string;
  at: DOMRect;
  onClose: () => void;
}) {
  const conv = store.state.conversations.find((c) => c.id === id);
  if (!conv) return null;
  const item = 'w-full rounded-[8px] px-3 py-2 text-start hover:bg-white/10';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 w-48 overflow-hidden rounded-xl p-1"
        style={{
          background: C.menu,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          left: Math.max(8, Math.min(at.left, 60)),
          top: Math.min(at.bottom + 4, window.innerHeight - 240),
        }}
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
