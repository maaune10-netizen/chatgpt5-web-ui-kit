import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { C } from '../lib/tokens';
import type { Store } from './store';

/**
 * المكتبة — شبكة صور بلا فواصل، كما في تصميم Library.
 * ويظهر الرسم البديل الرمادي حين لا توجد صورة، وهو ما يستعمله التصميم نفسه.
 */
export function Library({ store, onOpenImage }: { store: Store; onOpenImage: (src: string, title: string) => void }) {
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
              <Icon name="images" size={40} />
              <p className="mt-3" style={{ fontSize: 15 }}>
                Nothing here yet
              </p>
              <p className="mt-1" style={{ fontSize: 13, color: C.muted }}>
                Attach or paste an image in a chat and it lands here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => (it.kind === 'image' ? onOpenImage(it.url, it.name) : undefined)}
                className="group relative aspect-square overflow-hidden"
                style={{ background: it.kind === 'image' ? '#3a3a3a' : C.raised }}
                title={it.name}
              >
                {it.kind === 'image' ? (
                  <img src={it.url} alt={it.name} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                ) : (
                  <span className="grid h-full place-items-center">
                    <Icon name="document" size={28} />
                  </span>
                )}
                <span
                  className="absolute inset-x-0 bottom-0 truncate px-2 py-1 text-start opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', fontSize: 12 }}
                >
                  {it.name}
                </span>
              </button>
            ))}
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
            style={{ background: '#fff', color: '#000' }}
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
