import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, ITEM } from '../lib/tokens';
import type { Store, Conversation } from './store';

/**
 * الشريط الجانبي.
 *
 * ثلاثة أشياء تُدار هنا ويجب أن تبقى منفصلة:
 *
 * ١) **العرض** — يُسحب من حافته اليمنى بين حدّين، ويُحفظ في المتصفح.
 * ٢) **الطيّ** — زر في الترويسة يخفيه كاملًا.
 * ٣) **الأقسام** — لكل قسم سهم يطويه، وحالته محفوظة.
 *
 * وكلها مستقلّة: طيّ قسم لا يغيّر العرض، وسحب العرض لا يفتح قسمًا.
 */

const MIN_W = 200;
const MAX_W = 460;
const LS_WIDTH = 'gpt5.sidebar.width';
const LS_CLOSED = 'gpt5.sidebar.closed';

/* ————— صفّ ————— */
function Row({
  icon,
  label,
  trailing,
  active,
  pinned,
  onClick,
  onMenu,
  onTogglePin,
  muted,
  bold,
  renaming,
  onRename,
  onRenameCancel,
  compact,
}: {
  icon?: string;
  label: string;
  trailing?: string;
  active?: boolean;
  pinned?: boolean;
  onClick?: () => void;
  onMenu?: (at: DOMRect) => void;
  onTogglePin?: () => void;
  muted?: boolean;
  bold?: boolean;
  renaming?: boolean;
  onRename?: (v: string) => void;
  onRenameCancel?: () => void;
  /** الشريط ضيّق: الاختصار يُخفى بدل أن يزاحم الاسم */
  compact?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(label);

  useEffect(() => {
    if (renaming) {
      setDraft(label);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [renaming, label]);

  if (renaming) {
    return (
      <div className="px-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onRename?.(draft.trim() || label)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename?.(draft.trim() || label);
            if (e.key === 'Escape') onRenameCancel?.();
          }}
          className="w-full rounded-[10px] px-2.5 outline-none"
          style={{
            height: ITEM.h,
            background: C.input,
            fontSize: ITEM.labelSize,
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="group/row relative">
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onDoubleClick={() => onMenu && ref.current && onMenu(ref.current.getBoundingClientRect())}
        /*
         * الحشو الأيمن يحجز مكان **زرّين** (تثبيت + المزيد) لا زرّ واحد.
         * كان 32px والزرّان يشغلان 58 — فيركب السهم على آخر الكلام.
         */
        className="flex w-full items-center gap-2 rounded-[10px] ps-2.5 text-start transition-colors hover:bg-white/[0.07]"
        data-actions={onMenu || onTogglePin ? '2' : '0'}
        style={{
          height: ITEM.h,
          /* زرّان (٢٨+٢+٢٨) + هامش ٤ = ٦٢. والحشو ٦٠ كان يترك تراكبًا بكسلين */
          paddingInlineEnd: onMenu && onTogglePin ? 64 : onMenu || onTogglePin ? 34 : 10,
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
        {trailing && !onMenu && !onTogglePin && !compact ? (
          <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>{trailing}</span>
        ) : null}
      </button>

      {/* الإجراءات تظهر عند المرور — فلا يزدحم الشريط */}
      <div className="absolute end-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover/row:flex">
        {onTogglePin && (
          <button
            type="button"
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? `Unpin ${label}` : `Pin ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/15"
            style={{ color: pinned ? '#fff' : C.muted }}
          >
            <Icon name={pinned ? 'pinFilled' : 'pin'} size={16} />
          </button>
        )}
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
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/15"
          >
            <Icon name="overflow" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ————— عنوان قسم قابل للطيّ ————— */
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
        className={'flex items-center gap-1 rounded-md py-0.5 ' + (collapsible ? 'hover:text-white/80' : 'cursor-default')}
        style={{ fontSize: 13, color: C.dim }}
        aria-expanded={collapsible ? open : undefined}
      >
        {collapsible && (
          <span
            className="grid place-items-center transition-transform duration-150"
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

/* ————— الشريط ————— */
export function Sidebar({
  store,
  onOpenSearch,
  onOpenAccount,
  onUpgrade,
  onLogin,
  onShare,
  collapsed,
  onToggleCollapsed,
  width,
  onWidth,
  overlay,
}: {
  store: Store;
  onOpenSearch: () => void;
  onOpenAccount: (anchor: DOMRect) => void;
  onUpgrade: () => void;
  onLogin: () => void;
  onShare: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
  onWidth: (w: number) => void;
  /** على الشاشات الضيّقة يصير درجًا منسدلًا فوق المحتوى لا عمودًا بجانبه */
  overlay?: boolean;
}) {
  const { state } = store;
  /*
   * عرض أقل من ٢٩٠ لا يكفي للاسم والاختصار معًا.
   * وكان الاختصار يبقى فينكمش «New Chat» إلى حرف واحد — وهو أسوأ من إخفائه.
   */
  const compact = width < 290;
  const [menuFor, setMenuFor] = useState<{ id: string; at: DOMRect } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const accountRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  const [closed, setClosed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_CLOSED) || '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const toggle = (k: string) =>
    setClosed((c) => {
      const next = { ...c, [k]: !c[k] };
      try {
        localStorage.setItem(LS_CLOSED, JSON.stringify(next));
      } catch {
        /* — */
      }
      return next;
    });
  const isOpen = (k: string) => !closed[k];

  /* السحب لتغيير العرض */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      /*
       * نتذكّر آخر عرض لا موضع الضغط.
       * الحفظ كان يقرأ `e.clientX` من حدث الضغط — أي الموضع الابتدائي — فيُحفظ
       * العرض القديم ويُفقد ما سحبه المستخدم.
       */
      let latest = Math.min(MAX_W, Math.max(MIN_W, e.clientX));

      const move = (ev: PointerEvent) => {
        if (!dragging.current) return;
        latest = Math.min(MAX_W, Math.max(MIN_W, ev.clientX));
        onWidth(latest);
      };
      const up = () => {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        try {
          localStorage.setItem(LS_WIDTH, String(Math.round(latest)));
        } catch {
          /* — */
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [onWidth],
  );

  /*
   * المحادثة تظهر في قسم واحد فقط.
   * المثبّتة في «Pinned»، وما له مشروع داخل مشروعه، والباقي في «Chats».
   * وكانت المشاريع تظهر مرّتين لأن الشرط لم يكن يستثني.
   */
  const { pinned, rest } = useMemo(() => {
    const free = state.conversations.filter((c) => !c.projectId);
    return {
      pinned: free.filter((c) => c.pinned),
      rest: free.filter((c) => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    };
  }, [state.conversations]);

  const chatRow = (c: Conversation, inPinned = false) => (
    <Row
      key={c.id}
      label={c.title}
      active={c.id === state.activeId && state.view === 'chat'}
      pinned={inPinned}
      bold={inPinned}
      onClick={() => store.openChat(c.id)}
      renaming={renaming === c.id}
      onRename={(v) => {
        store.renameChat(c.id, v);
        setRenaming(null);
      }}
      onRenameCancel={() => setRenaming(null)}
      onTogglePin={() => store.togglePin(c.id)}
      onMenu={(at) => setMenuFor({ id: c.id, at })}
    />
  );

  return (
    <aside
      className={'flex h-full flex-col ' + (overlay ? 'fixed inset-y-0 start-0 z-[90] transition-transform duration-200' : 'relative shrink-0')}
      style={{
        width: overlay ? Math.min(width, 320) : collapsed ? 0 : width,
        background: C.sidebar,
        borderRight: !overlay && !collapsed ? `1px solid ${C.line}` : 'none',
        overflow: !overlay && collapsed ? 'hidden' : undefined,
        boxShadow: overlay ? '0 12px 40px rgba(0,0,0,0.6)' : undefined,
        transform: overlay ? `translateX(${collapsed ? '-100%' : '0'})` : undefined,
      }}
      aria-hidden={collapsed}
    >
      <div className="flex h-full flex-col" style={{ width: overlay ? Math.min(width, 320) : width }}>
        {/* الترويسة */}
        <div className="flex items-center justify-between px-2.5 pt-2">
          <button
            type="button"
            onClick={() => void store.newChat()}
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
          <Row icon="create" label="New Chat" trailing="Ctrl + Shift + O" compact={compact} onClick={() => void store.newChat()} />
          <Row icon="search" label="Search chats" onClick={onOpenSearch} />
          <Row icon="images" label="Library" onClick={() => store.go('library')} />
          <Row icon="temporaryChat" label="Temporary chat" onClick={() => void store.newChat(null, true)} />
        </div>

        {/* المثبّتة — قسم مستقل في الأعلى */}
        {pinned.length > 0 && (
          <div className="px-1.5">
            <SectionLabel open={isOpen('pinned')} onToggle={() => toggle('pinned')}>
              Pinned
            </SectionLabel>
            {isOpen('pinned') && pinned.map((c) => chatRow(c, true))}
          </div>
        )}

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
                onClick={() => void store.newProject('New project')}
                className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
              >
                <Icon name="add" size={16} />
              </button>
            }
          >
            Projects
          </SectionLabel>
          {isOpen('projects') &&
            state.projects.map((p) => (
              <div key={p.id}>
                <Row icon="folder" label={p.name} onClick={() => store.go('project', p.id)} />
                {state.conversations
                  .filter((c) => c.projectId === p.id)
                  .map((c) => (
                    <div key={c.id} className="ps-4">
                      {chatRow(c)}
                    </div>
                  ))}
              </div>
            ))}
        </div>

        {/* المحادثات */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          <SectionLabel open={isOpen('chats')} onToggle={() => toggle('chats')}>
            Chats
          </SectionLabel>
          {isOpen('chats') && rest.map((c) => chatRow(c))}
          {isOpen('chats') && rest.length === 0 && pinned.length === 0 && (
            <p className="px-2.5 py-2" style={{ fontSize: 12, color: C.dim }}>
              No chats yet.
            </p>
          )}

          {/* الأرشيف */}
          {state.archived.length > 0 && (
            <>
              <SectionLabel open={archiveOpen} onToggle={() => setArchiveOpen((v) => !v)}>
                Archived · {state.archived.length}
              </SectionLabel>
              {archiveOpen &&
                state.archived.map((c) => (
                  <Row
                    key={c.id}
                    label={c.title}
                    muted
                    onClick={() => store.openChat(c.id)}
                    onMenu={() => store.archiveChat(c.id, false)}
                  />
                ))}
            </>
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
                style={{ width: 24, height: 24, background: C.avatar, color: '#fff' }}
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
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/15"
            style={{ background: 'rgba(255,255,255,0.10)', border: `1px solid ${C.line}` }}
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* مقبض السحب — يغيّر العرض لا الطيّ */}
      {!collapsed && !overlay && (
        <div
          onPointerDown={onPointerDown}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
          className="group/resize absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize"
        >
          <span className="absolute inset-y-0 right-1 w-px transition-colors group-hover/resize:bg-white/40" />
        </div>
      )}

      {menuFor && (
        <ChatMenu
          store={store}
          id={menuFor.id}
          at={menuFor.at}
          onClose={() => setMenuFor(null)}
          onRename={() => setRenaming(menuFor.id)}
          onShare={() => onShare(menuFor.id)}
        />
      )}
    </aside>
  );
}

/* ————— قائمة المحادثة ————— */
function ChatMenu({
  store,
  id,
  at,
  onClose,
  onRename,
  onShare,
}: {
  store: Store;
  id: string;
  at: DOMRect;
  onClose: () => void;
  onRename: () => void;
  onShare: () => void;
}) {
  const conv = store.state.conversations.find((c) => c.id === id) ?? store.state.archived.find((c) => c.id === id);
  const [sub, setSub] = useState<'project' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' ? onClose() : null);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!conv) return null;

  const item = 'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-start hover:bg-white/10';
  const style = { fontSize: 14 } as const;

  /* يبقى داخل الشاشة */
  const top = Math.min(at.bottom + 4, window.innerHeight - 300);
  const left = Math.min(at.left, window.innerWidth - 280);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[200] w-[248px] overflow-hidden rounded-xl p-1"
      style={{ background: C.menu, boxShadow: '0 12px 32px rgba(0,0,0,0.55)', border: `1px solid ${C.line}`, top, left }}
    >
      {sub === null ? (
        <>
          {/*
            الترتيب كما هو في ChatGPT — مقسّمًا بخطوط:
              Rename · Pin
              ──────
              Share
              ──────
              Archive · Delete
              ──────
              Move to project ›
          */}
          <button type="button" className={item} style={style} onClick={() => { onRename(); onClose(); }}>
            <Icon name="edit" size={18} /> Rename
          </button>
          <button type="button" className={item} style={style} onClick={() => { void store.togglePin(id); onClose(); }}>
            <Icon name={conv.pinned ? 'pinFilled' : 'pin'} size={18} /> {conv.pinned ? 'Unpin' : 'Pin'}
          </button>

          <Divider />

          <button type="button" className={item} style={style} onClick={() => { onShare(); onClose(); }}>
            <Icon name="share" size={18} /> Share
          </button>

          <Divider />

          <button type="button" className={item} style={style} onClick={() => { void store.archiveChat(id, true); onClose(); }}>
            <Icon name="archive" size={18} /> Archive
          </button>
          <button
            type="button"
            className={item}
            style={{ ...style, color: confirm ? '#ff8a8a' : undefined }}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              void store.deleteChat(id);
              onClose();
            }}
            onBlur={() => setConfirm(false)}
          >
            <Icon name="delete" size={18} />
            {confirm ? 'Confirm delete' : 'Delete'}
          </button>

          <Divider />

          <button type="button" className={item} style={style} onClick={() => setSub('project')}>
            <Icon name="move" size={18} />
            <span className="flex-1">{conv.projectId ? 'Move to another project' : 'Move to project'}</span>
            <Icon name="chevronRight" size={14} />
          </button>
        </>
      ) : (
        <>
          {/* القائمة الفرعية: مشروع موجود، أو إنشاء مشروع جديد */}
          <button type="button" className={item} style={{ ...style, color: C.muted }} onClick={() => setSub(null)}>
            <Icon name="chevronLeft" size={16} /> Move to project
          </button>
          <Divider />
          {conv.projectId && (
            <button
              type="button"
              className={item}
              style={style}
              onClick={() => { void store.moveToProject(id, null); onClose(); }}
            >
              <Icon name="close" size={16} /> Remove from project
            </button>
          )}
          <button
            type="button"
            className={item}
            style={style}
            onClick={async () => {
              const pid = await store.newProject('New project');
              void store.moveToProject(id, pid);
              onClose();
            }}
          >
            <Icon name="folderAdd" size={16} /> New project
          </button>
          {store.state.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={item}
              style={style}
              onClick={() => { void store.moveToProject(id, p.id); onClose(); }}
            >
              <Icon name="folder" size={16} /> {p.name}
              {conv.projectId === p.id && <Icon name="check" size={14} style={{ marginInlineStart: 'auto' }} />}
            </button>
          ))}
          {store.state.projects.length === 0 && (
            <p className="px-3 py-2" style={{ fontSize: 12, color: C.dim }}>
              No projects yet — create one above.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* فاصل داخل القائمة — نفس لون فواصل الشريط */
function Divider() {
  return <div className="my-1 h-px" style={{ background: C.line }} />;
}

