import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { C, FONT, MENU_SHADOW, T } from '../lib/tokens';

/* ————— غلاف النافذة ————— */
function Overlay({
  onClose,
  children,
  width = 448,
  align = 'center',
}: {
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: 'center' | 'top';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={'fixed inset-0 z-[100] flex justify-center bg-black/60 backdrop-blur-[2px] ' + (align === 'center' ? 'items-center' : 'items-start pt-[8vh]')}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden rounded-2xl"
        style={{ width, background: '#2b2b2b', boxShadow: MENU_SHADOW, border: `1px solid ${C.line}`, maxHeight: '85vh' }}
      >
        {children}
      </div>
    </div>
  );
}

/* ————— نافذة تسجيل الدخول — 448x368 من Figma ————— */
export function LoginModal({ onClose, onLogin, hero }: { onClose: () => void; onLogin: () => void; hero?: string }) {
  return (
    <Overlay onClose={onClose} width={448}>
      <div style={{ height: 197, background: '#1d1d1d', overflow: 'hidden' }}>
        {hero ? (
          <img src={hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : null}
      </div>
      <div className="px-6 py-5">
        <h2 style={{ fontSize: 18, lineHeight: '28px', fontWeight: 600 }}>Try advanced features for free</h2>
        <p className="mt-2" style={{ fontSize: T.bodySm.size, lineHeight: '20px', color: C.muted }}>
          Get smarter responses, upload files, create images, and more by logging in.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-[0.98]"
            style={{ background: '#ffffff', color: '#000000' }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
            style={{ border: `1px solid ${C.line}` }}
          >
            Sign up for free
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ————— نافذة المشاركة — 646x627 ————— */
export function ShareModal({ onClose, title, body }: { onClose: () => void; title: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof location !== 'undefined' ? location.href : '';

  const options: Array<{ icon: string; label: string; act: () => void }> = [
    {
      icon: 'link',
      label: 'Copy link',
      act: () => {
        void navigator.clipboard.writeText(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
    },
    { icon: 'linkExternal', label: 'X', act: () => window.open('https://x.com/intent/post?text=' + encodeURIComponent(title), '_blank') },
    { icon: 'linkedin', label: 'LinkedIn', act: () => window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(link), '_blank') },
    { icon: 'microsoft', label: 'Reddit', act: () => window.open('https://www.reddit.com/submit?title=' + encodeURIComponent(title), '_blank') },
    {
      icon: 'download',
      label: 'Download',
      act: () => {
        const blob = new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title.replace(/[^\w\u0600-\u06FF -]/g, '') + '.md';
        a.click();
        URL.revokeObjectURL(a.href);
      },
    },
  ];

  return (
    <Overlay onClose={onClose} width={646}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Share</h2>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="p-4">
        <div className="rounded-xl" style={{ background: '#232323', border: `1px solid ${C.line}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>{title}</p>
          </div>
          <div className="max-h-56 overflow-hidden px-4 py-3" style={{ fontSize: 13, lineHeight: '19px', color: C.muted, whiteSpace: 'pre-wrap' }}>
            {body.slice(0, 600) || 'Empty conversation.'}
          </div>
          <div className="flex justify-end px-4 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: C.faint }}>ChatGPT</span>
          </div>
        </div>

        <div className="mt-6 flex items-start justify-center gap-6">
          {options.map((o) => (
            <button key={o.label} type="button" onClick={o.act} className="flex w-20 flex-col items-center gap-2 rounded-lg py-2 hover:bg-white/[0.06]">
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: C.raised }}>
                <Icon name={o.icon} size={20} />
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>{o.label}</span>
            </button>
          ))}
        </div>
        {copied && (
          <p className="mt-3 text-center" style={{ fontSize: 12, color: '#8ee6a0' }}>
            Link copied
          </p>
        )}
      </div>
    </Overlay>
  );
}

/* ————— نافذة البحث — 665x431 ————— */
export function SearchModal({
  onClose,
  conversations,
  onPick,
}: {
  onClose: () => void;
  conversations: Array<{ id: string; title: string; updatedAt: number }>;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hits = conversations
    .filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);

  return (
    <Overlay onClose={onClose} width={665} align="top">
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <Icon name="search" size={20} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="flex-1 bg-transparent outline-none placeholder:text-[#8f8f8f]"
          style={{ fontSize: 15 }}
        />
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="max-h-[340px] overflow-y-auto p-2">
        {hits.length === 0 ? (
          <p className="px-3 py-6 text-center" style={{ fontSize: 13, color: C.dim }}>
            No chats found.
          </p>
        ) : (
          hits.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c.id);
                onClose();
              }}
              className="w-full rounded-lg px-3 py-2.5 text-start hover:bg-white/[0.07]"
              style={{ fontSize: 14 }}
            >
              {c.title}
            </button>
          ))
        )}
      </div>
    </Overlay>
  );
}

/* ————— نافذة الترقية ————— */
export function UpgradeModal({ onClose }: { onClose: () => void }) {
  const rows = [
    ['chatgpt', 'ChatGPT Plus', 'Our smartest model & more', 'Upgrade'],
    ['chatgpt', 'ChatGPT', 'Great for everyday tasks', ''],
  ];
  return (
    <Overlay onClose={onClose} width={420}>
      <div className="p-5">
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Upgrade your plan</h2>
        <p className="mt-1" style={{ fontSize: 13, color: C.muted }}>
          This is a UI kit — no payment is taken.
        </p>
        <div className="mt-4 space-y-2">
          {rows.map(([icon, title, sub, cta]) => (
            <div key={title} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: C.raised }}>
              <Icon name={icon} size={20} />
              <div className="flex-1">
                <p style={{ fontSize: 14, fontWeight: 600 }}>{title}</p>
                <p style={{ fontSize: 12, color: C.muted }}>{sub}</p>
              </div>
              {cta ? (
                <span className="rounded-full px-3 py-1 text-xs" style={{ background: 'var(--c-active)' }}>
                  {cta}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full py-2.5 text-sm font-medium"
          style={{ background: '#ffffff', color: '#000' }}
        >
          Close
        </button>
      </div>
    </Overlay>
  );
}
