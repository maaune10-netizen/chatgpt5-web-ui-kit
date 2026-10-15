import { useCallback, useState } from 'react';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import PromptInput from './components/PromptInput';
import { SCREENS, PENDING, type ScreenId } from './screens';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const reply = (q: string) =>
  `This is a UI-kit build, so there is no model behind it yet.\n\nYou asked: “${q}”\n\n` +
  'The layout, typography, colours and shadows here come straight from the ' +
  '“ChatGPT 5 Web — Free UI Kit” Figma file.';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [screen, setScreen] = useState<ScreenId>('new-chat');
  const [activeNav, setActiveNav] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [temporary, setTemporary] = useState(false);
  const [upgrade, setUpgrade] = useState(false);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: 'user', text },
      { id: crypto.randomUUID(), role: 'assistant', text: reply(text) },
    ]);
    setInput('');
    setScreen('thread');
    setActiveNav('thread');
  }, [input]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setScreen('new-chat');
    setActiveNav('new-chat');
  }, []);

  const selectNav = useCallback((id: string) => {
    setActiveNav(id);
    const known: ScreenId[] = ['thread', 'library', 'explore', 'project-page'];
    if (id === 'library') setScreen('library');
    else if (id === 'explore') setScreen('explore');
    else if (id.startsWith('project')) setScreen('project-page');
    else if (id.startsWith('chat') || id.includes('chat')) setScreen('thread');
    else setScreen(known.includes(id as ScreenId) ? (id as ScreenId) : 'thread');
  }, []);

  const isNewChat = screen === 'new-chat';
  const hasThread = messages.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden bg-body text-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={activeNav}
        onSelect={selectNav}
        onNewChat={newChat}
        onUpgrade={() => setUpgrade(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          temporary={temporary}
          onToggleTemporary={() => setTemporary((v) => !v)}
          onUpsell={() => setUpgrade(true)}
        />

        {temporary && (
          <div className="flex shrink-0 items-center justify-center gap-2 border-b border-line bg-sidebar py-2 text-[12px] leading-[15.6px] text-muted">
            Temporary chat — it won&apos;t appear in your history or be used to train models.
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col items-center pb-[50px]">
          {isNewChat || hasThread ? (
            hasThread ? (
              <>
                {/* Thread */}
                <div className="min-h-0 w-full flex-1 overflow-y-auto">
                  <div className="mx-auto w-[768px] max-w-full px-4 py-8">
                    {messages.map((m) =>
                      m.role === 'user' ? (
                        <div key={m.id} className="mb-6 flex justify-end">
                          <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-input px-4 py-2.5 text-[15px] leading-6">
                            {m.text}
                          </div>
                        </div>
                      ) : (
                        <div key={m.id} className="mb-6 whitespace-pre-wrap text-[15px] leading-7">
                          {m.text}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="w-full shrink-0 pb-6">
                  <div className="mx-auto w-[768px] max-w-full px-4">
                    <PromptInput value={input} onChange={setInput} onSubmit={send} />
                  </div>
                </div>
              </>
            ) : (
              /* New chat */
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-16 pt-4">
                <div className="w-[768px] max-w-full px-4">
                  <div className="mb-2 pb-7 text-center">
                    <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-white">
                      Ready when you are.
                    </h1>
                  </div>
                  <PromptInput
                    value={input}
                    onChange={setInput}
                    onSubmit={send}
                    autoFocus
                  />
                </div>
              </div>
            )
          ) : (
            /* Screens that still need their Figma data */
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
              <h1 className="text-[30px] font-semibold leading-9 text-white">
                {SCREENS[screen]?.title ?? 'Screen'}
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-[19.7px] text-muted">
                {PENDING}
              </p>
            </div>
          )}
        </main>
      </div>

      {upgrade && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setUpgrade(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-sidebar p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold">Get Plus</h2>
            <p className="mt-2 text-[14px] leading-[19.7px] text-muted">
              Demo only — there is no checkout in this build.
            </p>
            <button
              type="button"
              onClick={() => setUpgrade(false)}
              className="mt-5 h-9 w-full rounded-full bg-white text-[14px] font-medium text-black transition hover:bg-white/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
