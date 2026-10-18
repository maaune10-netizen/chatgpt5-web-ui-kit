import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Sidebar } from './Sidebar';
import { Composer } from './Composer';
import { NewChat } from './NewChat';
import { MessageRow } from './Message';
import { AccountMenu } from './AccountMenu';
import { ModelMenu, SettingsModal } from './Settings';
import { LoginModal, SearchModal, ShareModal, UpgradeModal } from './Modals';
import { Library, ImageViewer, ProjectPage } from './Library';
import { useStore, type Citation, type Message } from './store';
import { C, L } from '../lib/tokens';
import { ChatStream, loadConfig, saveConfig, isConfigured, type Config, type ChatMessage } from '../lib/llm';

/**
 * يستخرج المصادر من نصّ الرد.
 * التصميم يعرض «Sources» بأقراص مرقّمة، ولا يعطيها النموذج في حقل مستقل.
 */
function citationsFrom(text: string): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const m of text.matchAll(/\[([^\]]{2,80})\]\((https?:\/\/[^)]+)\)/g)) {
    const url = m[2];
    if (seen.has(url)) continue;
    seen.add(url);
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* رابط غير صالح */
    }
    out.push({ title: m[1], url, host });
    if (out.length >= 8) break;
  }
  return out;
}

export function ChatApp() {
  const store = useStore();
  const { state } = store;
  const signedIn = state.signedIn;

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
  const isEmpty = !conv || conv.messages.length === 0;

  useEffect(() => {
    if (state.view !== 'chat' || !signedIn) return;
    if (!conv) store.newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view, signedIn]);

  useEffect(() => {
    if (stick && !isEmpty) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [conv?.messages, stick, isEmpty]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const history = useCallback(
    (messages: Message[]): ChatMessage[] =>
      messages.filter((m) => !m.error && (m.content || '').trim()).map((m) => ({ role: m.role, content: m.content })),
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
            store.patchMessage(convId, assistantId, (m) => {
              const content = m.content.trim() || (m.reasoning ? '' : 'No response.');
              return { ...m, streaming: false, stopped: finish === 'stopped', content, citations: citationsFrom(content) };
            });
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
      /* غير مسجَّل: لا إرسال — بل دعوة للدخول، كما في التصميم */
      if (!signedIn) {
        setLoginOpen(true);
        return;
      }
      const convId = conv?.id ?? store.newChat();
      const base = conv?.id ? conv.messages : [];
      store.addMessage(convId, { role: 'user', content: body, image });
      setInput('');
      setStick(true);
      void run(convId, [...base, { id: 'tmp', role: 'user', content: body, createdAt: Date.now() }]);
    },
    [conv, input, run, signedIn, store],
  );

  const retry = (i: number) => {
    if (!conv) return;
    const before = conv.messages.slice(0, i);
    store.removeMessagesFrom(conv.id, conv.messages[i].id);
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

  const pasteImage = (src: string) => {
    store.addLibrary([{ src, title: 'Pasted image', kind: 'image' }]);
    send(undefined, src);
  };

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

  const shareTarget = useMemo(() => state.conversations.find((c) => c.id === shareFor) ?? null, [shareFor, state.conversations]);

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSend={() => send()}
      onStop={() => streamRef.current?.stop()}
      streaming={streaming}
      onAttach={(f) => void onAttach(f)}
      onPasteImage={pasteImage}
    />
  );

  return (
    <div className="flex h-full" style={{ background: C.body, color: C.text }}>
      {/* الشريط الجانبي للمسجَّل فقط — الوضع غير المسجَّل بعرض كامل في التصميم */}
      {signedIn && (
        <Sidebar
          store={store}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAccount={setAccountAt}
          onUpgrade={() => setUpgradeOpen(true)}
          onLogin={() => setLoginOpen(true)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* الترويسة — 52px، App Header */}
        <header
          className="relative flex shrink-0 items-center justify-between px-3"
          style={{ height: L.headerH }}
        >
          <div className="flex items-center gap-1">
            {signedIn && collapsed && (
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
              {/* التصميم يكتب «ChatGPT» هنا لا اسم النموذج */}
              <span style={{ fontSize: 15, fontWeight: 500 }}>ChatGPT</span>
              <Icon name="chevronDown" size={16} />
            </button>
          </div>

          {/* «Get Plus» موسّطة في الترويسة — Upsell Button 123x36 عند x=528 من 1180 */}
          {signedIn && (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full px-3 py-2 hover:brightness-110 sm:flex"
              style={{ background: C.upsell, height: 36, color: '#ffffff' }}
            >
              <Icon name="upgradeSparkleSolid" size={20} style={{ opacity: 1 }} />
              <span style={{ fontSize: 14 }}>Get Plus</span>
              <Icon name="close" size={14} />
            </button>
          )}

          <div className="flex items-center gap-2">
            {signedIn ? (
              <>
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
              </>
            ) : (
              /* الوضع غير المسجَّل: زرّا الدخول في الترويسة — من New Chat - Logged Out */
              <>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="h-9 rounded-full px-4 text-sm font-semibold"
                  style={{ background: '#ffffff', color: '#000000' }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="h-9 rounded-full px-4 text-sm font-semibold hover:bg-white/10"
                  style={{ border: `1px solid ${C.line}` }}
                >
                  Sign up for free
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                  aria-label="Settings"
                >
                  <Icon name="settings" size={18} />
                </button>
              </>
            )}
          </div>

          {modelOpen && <ModelMenu config={config} onConfig={setCfg} onClose={() => setModelOpen(false)} />}
        </header>

        {state.view === 'library' ? (
          <Library store={store} onOpenImage={(src, title) => setViewer({ src, title })} />
        ) : state.view === 'project' && state.viewArg ? (
          <ProjectPage store={store} projectId={state.viewArg} onOpenChat={(id) => store.openChat(id)} />
        ) : isEmpty ? (
          <>
            <NewChat
              signedIn={signedIn}
              value={input}
              onChange={setInput}
              onSend={() => send()}
              onStop={() => streamRef.current?.stop()}
              streaming={streaming}
              onSuggestion={(t) => send(t)}
              onAttach={(f) => void onAttach(f)}
              onPasteImage={pasteImage}
            />
            <div className="shrink-0 px-6 pb-3 text-center" style={{ fontSize: 12, color: C.muted }}>
              {signedIn
                ? 'ChatGPT can make mistakes. Check important info.'
                : 'By messaging ChatGPT, you agree to our Terms and have read our Privacy Policy.'}
            </div>
          </>
        ) : (
          <>
            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
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
            </div>

            {state.temporary && (
              <div className="px-6">
                <div
                  className="mx-auto flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ maxWidth: L.threadW, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: C.muted }}
                >
                  <Icon name="temporaryChat" size={16} />
                  <span className="flex-1">This chat won’t appear in your history.</span>
                  <button type="button" onClick={() => store.endTemporary()} className="rounded-md px-2 py-1 hover:bg-white/10">
                    Turn off
                  </button>
                </div>
              </div>
            )}

            <div className="shrink-0 px-6 pb-4" style={{ paddingTop: 8 }}>
              {composer}
            </div>
          </>
        )}
      </div>

      {/* النوافذ */}
      {accountAt && (
        <AccountMenu
          anchor={accountAt}
          email={state.email}
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
            store.signOut();
            setLoginOpen(true);
          }}
        />
      )}
      {settingsOpen && <SettingsModal config={config} onConfig={setCfg} onClose={() => setSettingsOpen(false)} />}
      {searchOpen && (
        <SearchModal onClose={() => setSearchOpen(false)} conversations={state.conversations} onPick={(id) => store.openChat(id)} />
      )}
      {shareTarget && (
        <ShareModal
          onClose={() => setShareFor(null)}
          title={shareTarget.title}
          body={shareTarget.messages.map((m) => `${m.role === 'user' ? 'You' : 'ChatGPT'}: ${m.content}`).join('\n\n')}
        />
      )}
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={() => {
            store.signIn();
            setLoginOpen(false);
          }}
        />
      )}
      {viewer && <ImageViewer src={viewer.src} title={viewer.title} onClose={() => setViewer(null)} />}
    </div>
  );
}
