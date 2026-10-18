import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Sidebar } from './Sidebar';
import { Composer } from './Composer';
import { MessageRow } from './Message';
import { AccountMenu } from './AccountMenu';
import { ModelMenu, SettingsModal } from './Settings';
import { LoginModal, SearchModal, ShareModal, UpgradeModal } from './Modals';
import { Library, ImageViewer, ProjectPage } from './Library';
import { useStore, type Message } from './store';
import { C, L, T } from '../lib/tokens';
import { ChatStream, loadConfig, saveConfig, isConfigured, type Config, type ChatMessage } from '../lib/llm';

const SUGGESTIONS = [
  { icon: 'image', title: 'Create an image', sub: 'of a cat riding a bike' },
  { icon: 'brain', title: 'Brainstorm', sub: 'names for a coffee shop' },
  { icon: 'edit', title: 'Help me write', sub: 'a thank-you note' },
  { icon: 'code', title: 'Write code', sub: 'to reverse a string' },
];

export function ChatApp() {
  const store = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [accountAt, setAccountAt] = useState<DOMRect | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null);
  const [config, setConfig] = useState<Config>(loadConfig);
  const streamRef = useRef<ChatStream | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const conv = store.active;

  /* إن لم توجد محادثة مفتوحة، افتح واحدة */
  useEffect(() => {
    if (store.state.view !== 'chat') return;
    if (!conv && store.state.conversations.length >= 0) store.newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state.view]);

  /* ابقَ في الأسفل أثناء البثّ */
  useEffect(() => {
    if (stick) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [conv?.messages, stick]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const history = useCallback(
    (messages: Message[]): ChatMessage[] =>
      messages
        .filter((m) => !m.error && (m.content || '').trim())
        .map((m) => ({ role: m.role, content: m.content })),
    [],
  );

  const run = useCallback(
    async (convId: string, msgs: Message[]) => {
      if (!isConfigured(config)) {
        setSettingsOpen(true);
        return;
      }
      const assistantId = store.addMessage(convId, { role: 'assistant', content: '', streaming: true, model: config.model });
      const stream = new ChatStream();
      streamRef.current = stream;
      setStreaming(true);

      await new Promise<void>((resolve) => {
        void stream.send(config, history(msgs), {
          onDelta: (d) =>
            store.patchMessage(convId, assistantId, (m) => ({
              ...m,
              content: m.content + (d.content || ''),
              reasoning: (m.reasoning || '') + (d.reasoning || ''),
            })),
          onDone: ({ finish }) => {
            store.patchMessage(convId, assistantId, (m) => ({
              ...m,
              streaming: false,
              stopped: finish === 'stopped',
              /* التفكير في الحقل المستقل، لا مخلوطًا بالجواب */
              content: m.content.trim() || (m.reasoning ? '' : 'No response.'),
            }));
            resolve();
          },
          onError: (e) => {
            store.patchMessage(convId, assistantId, (m) => ({ ...m, streaming: false, error: e.message }));
            resolve();
          },
        });
      });

      streamRef.current = null;
      setStreaming(false);
    },
    [config, history, store],
  );

  const send = useCallback(
    (text?: string, image?: string) => {
      const body = (text ?? input).trim();
      if (!body && !image) return;
      const convId = conv?.id ?? store.newChat();
      const base = conv?.id ? conv.messages : [];

      store.addMessage(convId, { role: 'user', content: body, image });
      setInput('');
      setStick(true);

      const withNew: Message[] = [
        ...base,
        { id: 'tmp', role: 'user', content: body, createdAt: Date.now() },
      ];
      void run(convId, withNew);
    },
    [conv, input, run, store],
  );

  const stop = () => streamRef.current?.stop();

  const retry = (msgIndex: number) => {
    if (!conv) return;
    const before = conv.messages.slice(0, msgIndex);
    store.removeMessagesFrom(conv.id, conv.messages[msgIndex].id);
    void run(conv.id, before);
  };

  const onAttach = async (files: File[]) => {
    const imgs: Array<{ src: string; title: string; kind: 'image' | 'file' }> = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        const src = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.readAsDataURL(f);
        });
        imgs.push({ src, title: f.name, kind: 'image' });
      } else {
        imgs.push({ src: '', title: f.name, kind: 'file' });
      }
    }
    store.addLibrary(imgs);
    const first = imgs.find((i) => i.kind === 'image');
    if (first) send(undefined, first.src);
  };

  const shareTarget = useMemo(
    () => store.state.conversations.find((c) => c.id === shareFor) ?? null,
    [shareFor, store.state.conversations],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        store.newChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const setCfg = (c: Config) => {
    setConfig(c);
    saveConfig(c);
  };

  /* ————— العرض ————— */
  const showEmpty = !conv || conv.messages.length === 0;

  return (
    <div className="flex h-full" style={{ background: C.body, color: C.text }}>
      <Sidebar
        store={store}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAccount={setAccountAt}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* الترويسة — 52px من تصميم App Header */}
        <header
          className="relative flex shrink-0 items-center justify-between px-3"
          style={{ height: L.headerH, borderBottom: `1px solid ${C.line}` }}
        >
          <div className="flex items-center gap-2">
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                aria-label="Open sidebar"
              >
                <Icon name="sidebar" size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setModelOpen((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 hover:bg-white/[0.07]"
            >
              <span className="truncate" style={{ fontSize: 15 }}>
                {config.model}
              </span>
              <Icon name="chevronDown" size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => conv && setShareFor(conv.id)}
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm hover:bg-white/10"
            >
              <Icon name="share" size={18} />
              Share
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
              aria-label="Settings"
            >
              <Icon name="settings" size={18} />
            </button>
          </div>

          {modelOpen && <ModelMenu config={config} onConfig={setCfg} onClose={() => setModelOpen(false)} />}
        </header>

        {/* المحتوى */}
        {store.state.view === 'library' ? (
          <Library store={store} onOpenImage={(src, title) => setViewer({ src, title })} />
        ) : store.state.view === 'project' && store.state.viewArg ? (
          <ProjectPage store={store} projectId={store.state.viewArg} onOpenChat={(id) => store.openChat(id)} />
        ) : (
          <>
            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
              {showEmpty ? (
                <div className="grid h-full place-items-center px-6">
                  <div className="w-full" style={{ maxWidth: L.threadW }}>
                    <h1 className="text-center" style={{ fontSize: T.h3.size, lineHeight: `${T.h3.lh}px`, letterSpacing: T.h3.ls, fontWeight: 600 }}>
                      Ready when you are.
                    </h1>
                    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.title}
                          type="button"
                          onClick={() => send(`${s.title} ${s.sub}`)}
                          className="rounded-2xl p-3 text-start transition-colors hover:bg-white/[0.07]"
                          style={{ border: `1px solid ${C.line}` }}
                        >
                          <Icon name={s.icon} size={20} />
                          <p className="mt-2" style={{ fontSize: 14 }}>
                            {s.title}
                          </p>
                          <p style={{ fontSize: 12, color: C.muted }}>{s.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto px-6 py-4" style={{ maxWidth: L.threadW }}>
                  {conv!.messages.map((m, i) => (
                    <MessageRow
                      key={m.id}
                      m={m}
                      onCopy={() => {}}
                      onShare={() => setShareFor(conv!.id)}
                      onRetry={() => retry(i)}
                      onMore={() => setShareFor(conv!.id)}
                      onOpenImage={(src) => setViewer({ src, title: 'Image' })}
                    />
                  ))}
                  <div ref={bottomRef} style={{ height: 24 }} />
                </div>
              )}
            </div>

            {/* صندوق الإدخال */}
            <div className="shrink-0 px-6 pb-4" style={{ paddingTop: 8 }}>
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => send()}
                onStop={stop}
                streaming={streaming}
                onAttach={(f) => void onAttach(f)}
                onPasteImage={(src) => {
                  store.addLibrary([{ src, title: 'Pasted image', kind: 'image' }]);
                  send(undefined, src);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* النوافذ */}
      {accountAt && (
        <AccountMenu
          anchor={accountAt}
          email="hello@interactionfaction.com"
          onClose={() => setAccountAt(null)}
          onSettings={() => {
            setAccountAt(null);
            setSettingsOpen(true);
          }}
          onLibrary={() => {
            setAccountAt(null);
            store.go('library');
          }}
          onUpgrade={() => {
            setAccountAt(null);
            setUpgradeOpen(true);
          }}
          onLogout={() => {
            setAccountAt(null);
            setLoginOpen(true);
          }}
        />
      )}
      {settingsOpen && <SettingsModal config={config} onConfig={setCfg} onClose={() => setSettingsOpen(false)} />}
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          conversations={store.state.conversations}
          onPick={(id) => store.openChat(id)}
        />
      )}
      {shareTarget && (
        <ShareModal
          onClose={() => setShareFor(null)}
          title={shareTarget.title}
          body={shareTarget.messages.map((m) => `${m.role === 'user' ? 'You' : 'ChatGPT'}: ${m.content}`).join('\n\n')}
        />
      )}
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={() => setLoginOpen(false)} />}
      {viewer && <ImageViewer src={viewer.src} title={viewer.title} onClose={() => setViewer(null)} />}
    </div>
  );
}
