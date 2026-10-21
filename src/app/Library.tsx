import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { C, FONT } from '../lib/tokens';
import type { LibraryItem, Store } from './store';

/** حجم مقروء — لا «3360 بايت» بل «3.3 KB» */
function fmtSize(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/*
 * الامتدادات التي نعرض محتواها نصًّا. والاعتماد على `mime` وحده لا يكفي:
 * كثير من الملفّات تُرفع بـ`application/octet-stream` فيضيع نوعها،
 * ويبقى الامتداد هو الدليل.
 */
const TEXT_EXT =
  /\.(txt|text|md|markdown|mdx|json|jsonl|ndjson|csv|tsv|log|yml|yaml|toml|ini|cfg|conf|env|xml|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|swift|sh|bash|zsh|fish|sql|graphql|gql|diff|patch|srt|vtt)$/i;

const MAX_PREVIEW = 200_000; // حرفًا — أبعد من هذا عرضٌ لا قراءة

type PreviewKind = 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'none';

function previewKind(it: LibraryItem): PreviewKind {
  const mime = (it.mime || '').toLowerCase();
  const name = (it.name || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || TEXT_EXT.test(name)) return 'text';
  return 'none';
}

/**
 * المكتبة — شبكة صور بلا فواصل، كما في تصميم Library.
 * ويظهر الرسم البديل الرمادي حين لا توجد صورة، وهو ما يستعمله التصميم نفسه.
 */
export function Library({
  store,
  onOpenImage,
  onOpenFile,
}: {
  store: Store;
  onOpenImage: (src: string, title: string) => void;
  onOpenFile: (it: LibraryItem) => void;
}) {
  const [tab, setTab] = useState<'images' | 'files'>('images');
  const { files } = store.state;

  const items = useMemo(
    () => files.filter((f) => (tab === 'images' ? f.kind === 'image' : f.kind === 'file')),
    [files, tab],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 pt-4">
        {(['images', 'files'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="rounded-full px-3 py-1.5 text-sm transition-colors"
            style={{
              background: tab === t ? 'var(--c-active)' : 'transparent',
              color: tab === t ? C.text : C.muted,
            }}
          >
            {t === 'images' ? 'Images' : 'Files'}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => store.go('chat')}
          className="rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
          style={{ color: C.muted }}
        >
          Back to chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <div>
              <Icon name={tab === 'images' ? 'images' : 'document'} size={40} />
              <p className="mt-3" style={{ fontSize: 15 }}>
                Nothing here yet
              </p>
              <p className="mt-1" style={{ fontSize: 13, color: C.muted }}>
                {tab === 'images'
                  ? 'Attach or paste an image in a chat and it lands here.'
                  : 'Attach a file, or paste a long block of text, and it lands here.'}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              /* الصور بلا فواصل كما في التصميم، والملفّات بطاقات لها فواصل */
              gap: tab === 'images' ? 1 : 8,
            }}
          >
            {items.map((it) =>
              it.kind === 'image' ? (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onOpenImage(it.url, it.name)}
                  className="group relative aspect-square overflow-hidden"
                  style={{ background: 'var(--c-pill)' }}
                  title={it.name}
                >
                  <img src={it.url} alt={it.name} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                  <span
                    className="absolute inset-x-0 bottom-0 truncate px-2 py-1 text-start opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', fontSize: 12 }}
                  >
                    {it.name}
                  </span>
                </button>
              ) : (
                /*
                 * الاسم ظاهر دائمًا، لا عند المرور فقط.
                 * فبطاقةٌ لا تُعرف إلا بالتحويم تُخفي الملفّ عن صاحبه،
                 * والنقر يفتح العارض.
                 */
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onOpenFile(it)}
                  className="flex aspect-square flex-col items-start justify-between overflow-hidden rounded-xl p-3 text-start transition-colors hover:bg-[var(--c-hover)]"
                  style={{ background: C.raised, border: '1px solid var(--c-line)' }}
                  title={`${it.name} — ${fmtSize(it.size)}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--c-active)' }}>
                    <Icon name="document" size={20} />
                  </span>
                  <span className="w-full">
                    <span dir="auto" className="line-clamp-2 w-full break-words" style={{ fontSize: 13, lineHeight: '17px' }}>
                      {it.name}
                    </span>
                    <span className="mt-1 block" style={{ fontSize: 11, color: C.muted }}>
                      {fmtSize(it.size)}
                    </span>
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** عارض الصور — خلفية سوداء، وإغلاق بالنقر خارجها أو Esc */
export function ImageViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
            <Icon name="close" size={20} />
          </button>
          <span style={{ fontSize: 14 }}>{title}</span>
        </div>
        <a href={src} download className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Download">
          <Icon name="download" size={20} />
        </a>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-4">
        <img src={src} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

/**
 * عارض الملفّات — لأنّ المكتبة كانت تعرض الاسم عند المرور فقط، والنقر
 * لا يفعل شيئًا لغير الصور. فملفٌّ لا يُفتح ليس ملفًّا محفوظًا، بل أيقونة.
 *
 * ونعرض ما يستطيع المتصفّح عرضه أصلًا: نصّ، صورة، PDF، صوت، فيديو.
 * وما لا يُعرض يُشرح سببه مع زرّ تنزيل — لا مربّع فارغ.
 */
export function FileViewer({ item, onClose }: { item: LibraryItem; onClose: () => void }) {
  const kind = previewKind(item);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* النصّ يُجلب من الخادم — لا من الذاكرة، فالمكتبة تبقى بعد إغلاق المتصفح */
  useEffect(() => {
    if (kind !== 'text') return;
    let alive = true;
    fetch(item.url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => {
        if (alive) setText(t);
      })
      .catch((e) => {
        if (alive) setErr((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [item.url, kind]);

  const truncated = text !== null && text.length > MAX_PREVIEW;

  const copy = () => {
    if (text == null) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={onClose}>
      <div
        className="mx-auto my-6 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl"
        style={{ maxWidth: 900, background: 'var(--c-modal)', border: '1px solid var(--c-line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--c-line)' }}>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--c-active)' }}>
            <Icon name="document" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate" style={{ fontSize: 14 }}>
              {item.name}
            </span>
            <span className="block truncate" style={{ fontSize: 11, color: C.muted }}>
              {fmtSize(item.size)}
              {item.mime ? ` · ${item.mime}` : ''}
            </span>
          </span>
          {kind === 'text' && (
            <button
              type="button"
              onClick={copy}
              disabled={text == null}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10 disabled:opacity-40"
              aria-label="Copy"
              title={copied ? 'Copied' : 'Copy'}
            >
              <Icon name={copied ? 'check' : 'copy'} size={18} />
            </button>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Open in new tab"
            title="Open in new tab"
          >
            <Icon name="linkExternal" size={18} />
          </a>
          <a
            href={item.url}
            download={item.name}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Download"
            title="Download"
          >
            <Icon name="download" size={18} />
          </a>
        </div>

        <div className="min-h-0 flex-1 overflow-auto" style={{ background: 'var(--c-modal-2)' }}>
          {kind === 'image' && (
            <div className="grid h-full place-items-center p-4">
              <img src={item.url} alt={item.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}

          {kind === 'pdf' && <iframe title={item.name} src={item.url} className="h-full w-full" style={{ border: 0 }} />}

          {kind === 'audio' && (
            <div className="grid h-full place-items-center p-6">
              <audio controls src={item.url} className="w-full" style={{ maxWidth: 480 }} />
            </div>
          )}

          {kind === 'video' && (
            <div className="grid h-full place-items-center p-4">
              <video controls src={item.url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </div>
          )}

          {kind === 'text' &&
            (err ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <p style={{ fontSize: 14 }}>Could not read this file</p>
                  <p className="mt-1" style={{ fontSize: 12, color: C.muted }}>
                    {err}
                  </p>
                </div>
              </div>
            ) : text == null ? (
              <div className="grid h-full place-items-center p-6" style={{ fontSize: 13, color: C.muted }}>
                Loading…
              </div>
            ) : (
              <pre
                dir="auto"
                className="m-0 p-4"
                style={{
                  fontSize: 13,
                  lineHeight: '20px',
                  fontFamily: FONT.mono,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: C.text,
                }}
              >
                {truncated ? text.slice(0, MAX_PREVIEW) : text}
                {truncated && (
                  <span style={{ color: C.muted }}>
                    {'\n\n'}… showing the first {MAX_PREVIEW.toLocaleString()} of {text.length.toLocaleString()} characters. Download the file for the
                    rest.
                  </span>
                )}
              </pre>
            ))}

          {kind === 'none' && (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-sm">
                <Icon name="document" size={40} />
                <p className="mt-3" style={{ fontSize: 15 }}>
                  No preview for this file type
                </p>
                <p className="mt-1" style={{ fontSize: 13, color: C.muted }}>
                  {item.mime || 'Unknown type'} · {fmtSize(item.size)}. Download it to open on your device.
                </p>
                <a
                  href={item.url}
                  download={item.name}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: 'var(--c-active)', fontSize: 13 }}
                >
                  <Icon name="download" size={16} />
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** صفحة المشروع — رأس + محادثات + ملفات */
export function ProjectPage({ store, projectId, onOpenChat }: { store: Store; projectId: string; onOpenChat: (id: string) => void }) {
  const project = store.state.projects.find((p) => p.id === projectId);
  const chats = store.state.conversations.filter((c) => c.projectId === projectId);
  const [name, setName] = useState(project?.name ?? '');

  if (!project) {
    return (
      <div className="grid h-full place-items-center" style={{ color: C.muted }}>
        Project not found
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mx-auto" style={{ maxWidth: 768 }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: C.raised }}>
            <Icon name="folder" size={22} />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => store.renameProject(project.id, name || 'Untitled project')}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 26, fontWeight: 600 }}
          />
          <button
            type="button"
            onClick={() => {
              void store.newChat(project.id).then(onOpenChat);
            }}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--c-text)', color: 'var(--c-body)' }}
          >
            New chat
          </button>
        </div>

        <h3 className="mt-8 mb-2" style={{ fontSize: 13, color: C.dim }}>
          CHATS · {chats.length}
        </h3>
        <div className="space-y-1">
          {chats.length === 0 ? (
            <p style={{ fontSize: 14, color: C.muted }}>No chats in this project yet.</p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenChat(c.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start hover:bg-white/[0.06]"
              >
                <Icon name="chatBubble" size={18} />
                <span className="flex-1 truncate" style={{ fontSize: 15 }}>
                  {c.title}
                </span>
                <span style={{ fontSize: 12, color: C.dim }}>{new Date(c.updatedAt).toLocaleDateString()}</span>
              </button>
            ))
          )}
        </div>

        <h3 className="mt-8 mb-2" style={{ fontSize: 13, color: C.dim }}>
          FILES
        </h3>
        <p style={{ fontSize: 14, color: C.muted }}>Files you add in a project chat show up here.</p>

        <button
          type="button"
          onClick={() => store.deleteProject(project.id)}
          className="mt-10 rounded-full px-4 py-2 text-sm"
          style={{ background: 'color-mix(in srgb, var(--c-danger) 14%, transparent)', color: 'var(--c-danger)' }}
        >
          Delete project
        </button>
      </div>
    </div>
  );
}
