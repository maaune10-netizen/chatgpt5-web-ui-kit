import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Sidebar } from './Sidebar';
import { Composer } from './Composer';
import { NewChat } from './NewChat';
import { Tip } from './ui';
import { WorkDialog } from './WorkDialog';
import { MessageRow } from './Message';
import { AccountMenu } from './AccountMenu';
import { SettingsModal } from './Settings';
import { LoginModal, SearchModal, ShareModal, UpgradeModal } from './Modals';
import { Library, ImageViewer, FileViewer, ProjectPage } from './Library';
import { GenUIContext, GenUIPanel, preloadGenUI } from './genui-shared';
import { NotBuilt } from './NotBuilt';
import { useStore, type Citation, type LibraryItem, type Message } from './store';
import { C, L } from '../lib/tokens';
import { ChatStream, loadConfig, saveConfig, isConfigured, type Config, type ChatMessage } from '../lib/llm';
import { exhaustedByThinking, type Usage } from '../lib/models';

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

export function ChatApp({
  theme = 'auto',
  onTheme = () => {},
}: {
  theme?: 'dark' | 'light' | 'auto';
  onTheme?: (t: 'dark' | 'light' | 'auto') => void;
} = {}) {
  const store = useStore();
  const { state } = store;
  const signedIn = state.signedIn;

  const [collapsed, setCollapsed] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  /*
   * الشاشات الضيّقة: الشريط يصير درجًا منسدلًا لا عمودًا.
   * وكان يبقى 260 مثبّتًا فيضغط المحتوى ويُظهر تمريرًا أفقيًا.
   */
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /* على الضيّق يبدأ الشريط مخفيًا */
  useEffect(() => {
    if (narrow) setCollapsed(true);
  }, [narrow]);
  /*
   * عرض الشريط — يُسحب ويُحفظ.
   * منفصل عن الطيّ: الطيّ يخفيه كاملًا، والسحب يضيّقه أو يوسّعه.
   */
  const [sidebarW, setSidebarW] = useState(() => {
    const v = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('gpt5.sidebar.width')) : 0;
    return v >= 200 && v <= 460 ? v : 240; // ٢٤٠ = مقيس من الموقع
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [accountAt, setAccountAt] = useState<DOMRect | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(null);
  const [fileViewer, setFileViewer] = useState<LibraryItem | null>(null);
  /** برنامج OpenUI مفتوح في اللوحة الواسعة */
  const [canvas, setCanvas] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(loadConfig);
  const streamRef = useRef<ChatStream | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const conv = store.active;
  const isEmpty = !conv || conv.messages.length === 0;

  /* لا ننشئ محادثة عند الإقلاع — تُنشأ عند أول رسالة. وإلا امتلأ الشريط بمحادثات فارغة. */

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
      messages
        .filter((m) => !m.error && (m.content || '').trim())
        .map((m) =>
          m.role === 'assistant' && m.reasoning
            ? { role: m.role, content: m.content, reasoning_content: m.reasoning }
            : { role: m.role, content: m.content },
        ),
    [],
  );

  const run = useCallback(
    async (convId: string, msgs: Message[]) => {
      if (!isConfigured(config)) {
        setSettingsOpen(true);
        return;
      }
      const assistantId = await store.addMessage(convId, { role: 'assistant', content: '', streaming: true, model: config.model });
      const stream = new ChatStream();
      streamRef.current = stream;
      setStreaming(true);

      /*
       * البثّ يُجمَّع قبل الإرسال.
       * إرسال كل حرف يعني مئات الطلبات في الرد الواحد — فالنص يُحدَّث محليًا
       * فورًا، ويُرسل للخادم كل ٤٠٠ ملي ثانية وعند الانتهاء.
       */
      /*
       * التجميع محلي لا من الحالة.
       * قراءة `store.state` داخل هذا الإغلاق تعطي **لقطة قديمة** من لحظة
       * إنشاء الدالة، فلا تُجد الرسالة أبدًا ولا يُحفظ شيء. فنجمع هنا.
       */
      let acc = '';
      let accReasoning = '';
      let final: { content: string; citations: ReturnType<typeof citationsFrom>; stopped: boolean } | null = null;
      /*
       * الاستهلاك يُحفظ في متغيّر محليّ لا في الحالة.
       * و`flush` يبني كائنًا من `acc` و`accReasoning`، فكان `usage` يسقط
       * منه ولا يصل الخادم أبدًا — رغم أنّ الردّ يحمله.
       */
      let finalUsage: Message['usage'];
      let flushTimer: number | null = null;

      const flush = () => {
        if (flushTimer) {
          window.clearTimeout(flushTimer);
          flushTimer = null;
        }
        void store.flushMessage(convId, assistantId, {
          id: assistantId,
          role: 'assistant',
          createdAt: 0,
          content: final?.content ?? acc,
          reasoning: accReasoning || undefined,
          citations: final?.citations,
          stopped: final?.stopped,
          usage: finalUsage,
        } as Message);
      };

      await new Promise<void>((resolve) => {
        void stream.send(config, history(msgs), {
          onDelta: (d) => {
            acc += d.content || '';
            accReasoning += d.reasoning || '';
            store.patchMessage(convId, assistantId, (m) => ({
              ...m,
              content: m.content + (d.content || ''),
              reasoning: (m.reasoning || '') + (d.reasoning || ''),
            }));
            if (!flushTimer) flushTimer = window.setTimeout(flush, 400);
          },
          onDone: ({ finish, usage }) => {
            finalUsage = usage as Message['usage'];
            /*
             * الردّ الفارغ له سببان مختلفان، ورسالة واحدة لهما مُضلِّلة:
             *   • التفكير استهلك الحدّ كلّه — فيُقال ذلك ويُقترح العلاج
             *   • لا تفكير ولا نصّ — فالمشكلة في المزوّد
             */
            const spent = exhaustedByThinking(usage as Usage | undefined);
            const content =
              acc.trim() ||
              (spent
                ? 'Thinking used the entire output budget, so no answer was written. ' +
                  'Raise Max output tokens, or set Thinking effort to Low or Off.'
                : accReasoning
                  ? ''
                  : 'No response.');
            final = { content, citations: citationsFrom(content), stopped: finish === 'stopped' };
            store.patchMessage(convId, assistantId, (m) => ({
              ...m,
              streaming: false,
              stopped: final!.stopped,
              content,
              citations: final!.citations,
              /*
               * الاستهلاك يُخزَّن مع الرسالة: فيُعرف كم كلّف كل ردّ،
               * وكم منه جاء من الكاش. والكاش أرخص ٥٠ ضعفًا، فهو ليس تفصيلًا.
               */
              usage: usage as Message['usage'],
            }));
            flush();
            resolve();
          },
          onError: (e) => {
            store.patchMessage(convId, assistantId, (m) => ({ ...m, streaming: false, error: e.message }));
            flush();
            resolve();
          },
        }, convId);
      });

      streamRef.current = null;
      setStreaming(false);
    },
    [config, history, store],
  );

  const send = useCallback(
    async (text?: string, image?: string) => {
      const body = (text ?? input).trim();
      if (!body && !image) return;
      /*
       * ابدأ تحميل حزمة العرض الآن، لا حين تصل الواجهة.
       * النموذج يفكّر ٥ ثوانٍ، والحزمة ١٢ ميجابايت في التطوير — فتحميلها
       * في هذه الثواني يجعلها جاهزة وقت الحاجة بدل أن تنتظر بعد الجواب.
       */
      if (config.genui) preloadGenUI();
      /* غير مسجَّل: لا إرسال — بل دعوة للدخول، كما في التصميم */
      if (!signedIn) {
        setLoginOpen(true);
        return;
      }
      const convId = conv?.id ?? (await store.newChat());
      const base = conv?.id ? conv.messages : [];
      void store.addMessage(convId, { role: 'user', content: body, image });
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
    let firstImage: string | undefined;
    for (const f of files) {
      const kind = f.type.startsWith('image/') ? 'image' : 'file';
      const saved = await store.uploadFile(f, f.name, kind);
      if (kind === 'image' && saved?.url && !firstImage) firstImage = saved.url;
    }
    if (firstImage) void send(undefined, firstImage);
  };

  /*
   * النصّ الملصوق الطويل يُحفظ ملفًّا في المكتبة.
   *
   * والاسم يشتقّ من أوّل كلماته لا من طابع زمني: فـ«pasted-1730...txt»
   * لا يقول شيئًا، و«Coffee shop names ideas.txt» يُعرف من قائمته.
   */
  const attachText = async (text: string) => {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
    const base = (words || 'Pasted text').replace(/[\\/:*?"<>|]/g, '').slice(0, 60).trim();
    const name = `${base || 'Pasted text'}${text.length > 200 ? '' : ' '} — ${text.length.toLocaleString()} chars.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    await store.uploadFile(blob, name, 'file');
  };

  const pasteImage = async (dataUrl: string) => {
    /* نُحوّل data URL إلى Blob كي يُرفع كملف حقيقي لا نصًّا في قاعدة البيانات */
    const blob = await (await fetch(dataUrl)).blob();
    const saved = await store.uploadFile(blob, `pasted-${Date.now()}.png`, 'image');
    void send(undefined, saved?.url ?? dataUrl);
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

  /* أفعال الواجهة المولَّدة — ثابتة ما لم يتغيّر `send`، فلا يُعاد رسم الشجرة */
  const genuiActions = useMemo(
    () => ({ onSend: (t: string) => void send(t), onExpand: (code: string) => setCanvas(code) }),
    [send],
  );

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSend={(t) => void send(t)}
      onStop={() => streamRef.current?.stop()}
      streaming={streaming}
      onAttach={(f) => void onAttach(f)}
      onAttachText={(t) => void attachText(t)}
      onPasteImage={pasteImage}
      thinking={config.reasoningEffort}
      onThinking={(v: Config['reasoningEffort']) => setCfg({ ...config, reasoningEffort: v })}
    />
  );

  return (
    /*
     * الجسر إلى عارض OpenUI: زرّ في واجهة مولَّدة يُرسل رسالة،
     * و«Canvas» يفتح البرنامج على عرض أوسع. والسياق بلا وزن —
     * العارض نفسه يُحمَّل عند الطلب.
     */
    <GenUIContext.Provider value={genuiActions}>
    <div className="flex h-full" style={{ background: C.body, color: C.text }}>
      {/*
       * الشريط يظهر في الوضعين. كنت أخفيه لغير المسجَّل اعتمادًا على شاشة
       * Figma، لكن الموقع الحقيقي يُظهره بسبعة عناصر مختلفة:
       * New chat · Images · Plugins · Deep research ·
       * See plans and pricing ↗ · Help ↗ · Settings.
       */}
      <Sidebar
        store={store}
        collapsed={collapsed}
        width={sidebarW}
        onWidth={setSidebarW}
        overlay={narrow}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAccount={setAccountAt}
        onUpgrade={() => setUpgradeOpen(true)}
        onLogin={() => setLoginOpen(true)}
        onShare={(id) => setShareFor(id)}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* حاجب يُغلق الدرج بالنقر — على الضيّق فقط */}
      {narrow && !collapsed && (
        <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setCollapsed(true)} aria-hidden />
      )}

      <div className="app-header flex min-w-0 flex-1 flex-col">
        {/* الترويسة — 52px، App Header */}
        <header
          className="relative flex shrink-0 items-center justify-between px-3"
          style={{ height: L.headerH }}
        >
          <div className="flex items-center gap-1">
            {/*
              زرّ الطيّ **مرّة واحدة**: في الشريط المطويّ عند (8,8). وكان
              يظهر هنا أيضًا فيصير اثنين. ويبقى هنا للجوال وحده، لأنّ الشريط
              يصير درجًا مخفيًّا.
            */}
            {signedIn && narrow && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                aria-label="Open sidebar"
              >
                <Icon name="sidebar" size={20} />
              </button>
            )}
            {/*
              لا شعار ولا منتقي نموذج في ترويسة المحتوى: الموقع يضع الشعار في
              الشريط الجانبي فقط. ومنتقي النموذج باقٍ في الإعدادات.
            */}
          </div>

          {/*
            المفتاح المقطعي `Chat | Work` — موسّط في الترويسة.
            ومقيس من اللقطة: الحاوية #f4f4f4، والقرص النشط أبيض بظلّ خفيف.
            و«Work» مُعطَّل: ليس سطحًا في هذه النسخة، ولا نُظهر سطحًا وهميًّا.
          */}
          {signedIn && (
            <div
              className="composer-mode absolute left-1/2 flex -translate-x-1/2 items-center"
              style={{ background: C.segment, height: 36, borderRadius: 9999, padding: 0 }}
              /* مقيس: DIV role=group «Composer mode» 224×36 */
              role="group"
              aria-label="Composer mode"
            >
              {/*
                مقيس من capture على `/`: الحاوية 224×36 @ (773,8)، والنصفان
                112×36 — لا 32 مع حشو. والنشط أبيض صافٍ، والخامل rgb(205,205,205).
              */}
              <button
                type="button"
                role="tab"
                aria-selected
                className="text-sm font-medium"
                style={{ width: 112, height: 36, borderRadius: 9999, background: 'var(--c-modal)', color: '#ffffff' }}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                onClick={() => setWorkOpen(true)}
                className="flex items-center justify-center gap-1.5 text-sm font-medium"
                /* رماديّ: يحتاج Plus — لا بلون التبويب العاديّ */
                style={{ position: 'relative', width: 112, height: 36, borderRadius: 9999, color: C.dim }}
              >
                <Icon name="upgradeSparkle" size={14} style={{ opacity: 0.75 }} />
                Work
                {/* مقيس: SPAN 1×1 — نصّ لقارئ الشاشة، لا مرئيّ */}
                <span
                  /* مقيس: 1×1 عند x=1102 داخل نصف يبدأ 1076 ← 26 من بدايته */
                  style={{ position: 'absolute', insetInlineStart: 26, top: 18, width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}
                >
                  Requires upgrade
                </span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {signedIn ? (
              <>
                {/*
                  مقيس على `/`: 104×34 @ (1374,9) · 14/20 w500 · rgb(99,168,248).
                  نصّ أزرق بلا خلفية — لا شرارة ولا قرص.
                */}
                <button
                  type="button"
                  onClick={() => void store.newChat(null, true)}
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{ width: 104, height: 34, color: 'rgb(99, 168, 248)', fontSize: 14, lineHeight: '20px', fontWeight: 500, display: 'none' }}
                />
                <Tip label="Turn off temporary chat">
                <button
                  type="button"
                  onClick={() => void store.newChat(null, true)}
                  aria-label="Temporary chat"
                  className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                  style={{ color: C.muted }}
                >
                  <Icon name="temporaryChat" size={20} />
                </button>
                </Tip>
                {/*
                  «Share» كان هنا — **وليس في الموقع**. وأقصى الطرف هو
                  `Temporary chat` ولا شيء بعده. والمشاركة تبقى في قائمة
                  المحادثة، لا في الترويسة.
                */}
                {/*
                  أيقونة الإعدادات كانت هنا — وليست في الترويسة في الموقع.
                  والإعدادات تبقى في مكانها الطبيعي: قائمة الحساب أسفل الشريط.
                */}
              </>
            ) : (
              /* الوضع غير المسجَّل: زرّا الدخول في الترويسة — من New Chat - Logged Out */
              <>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="h-9 rounded-full px-4 text-sm font-semibold"
                  style={{ background: 'var(--c-text)', color: 'var(--c-body)' }}
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
                {/*
                  أيقونة الإعدادات كانت هنا — وليست في الترويسة في الموقع.
                  والإعدادات تبقى في مكانها الطبيعي: قائمة الحساب أسفل الشريط.
                */}
              </>
            )}
          </div>

        </header>

        {(['images', 'scheduled', 'plugins', 'codex', 'explore'] as const).includes(state.view as never) ? (
          <NotBuilt
            title={
              {
                images: '/images — توليد الصور',
                scheduled: '/scheduled — المحادثات المجدولة',
                plugins: '/plugins — دليل الإضافات',
                codex: '/codex',
                explore: '/explore',
              }[state.view as 'images']
            }
            needs={
              {
                images: 'لقطة للصفحة — عندنا `/library` فقط، وهي ليست هي',
                scheduled: 'لقطة للصفحة',
                plugins: 'لقطة — والمسار فيه ١١٦ رابطًا و١٦٦ تابًا',
                codex: 'لقطة للصفحة',
                explore: 'لقطة للصفحة',
              }[state.view as 'images']
            }
            onLibrary={() => store.go('library')}
          />
        ) : state.view === 'library' ? (
          <Library store={store} onOpenImage={(src, title) => setViewer({ src, title })} onOpenFile={(it) => setFileViewer(it)} />
        ) : state.view === 'project' && state.viewArg ? (
          <ProjectPage store={store} projectId={state.viewArg} onOpenChat={(id) => store.openChat(id)} />
        ) : isEmpty ? (
          <>
            <NewChat
              signedIn={signedIn}
              value={input}
              onChange={setInput}
              onSend={(t) => void send(t)}
              onStop={() => streamRef.current?.stop()}
              streaming={streaming}
              /*
               * النقر على اقتراح **يُعبّئ الحقل ولا يُرسل**: الموقع يكبّر
               * الصندوق في مكانه، ولا يُنزل الشريط بفتح محادثة.
               */
              onSuggestion={(t) => setInput(t)}
              onAttach={(f) => void onAttach(f)}
              onAttachText={(t) => void attachText(t)}
              onPasteImage={pasteImage}
              thinking={config.reasoningEffort}
              onThinking={(v: Config['reasoningEffort']) => setCfg({ ...config, reasoningEffort: v })}
            />
            {/*
              جملة «ChatGPT can make mistakes…» **ليست في الملفّ** — بحثت في
              ٩١ ميجا فلم أجدها. فحُذفت للمسجَّل، وبقيت جملة الشروط للزائر.
            */}
            {!signedIn && (
              <div className="shrink-0 px-4 pb-3 text-center" style={{ fontSize: 12, color: C.muted, lineHeight: '16px' }}>
                By messaging ChatGPT, you agree to our Terms and have read our Privacy Policy.
              </div>
            )}
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
                  style={{ maxWidth: L.threadW, background: 'var(--c-hover)', fontSize: 12, color: C.muted }}
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
          onTemporary={() => {
            setAccountAt(null);
            void store.newChat(null, true);
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
      {settingsOpen && (
        <SettingsModal
          config={config}
          onConfig={setCfg}
          theme={theme}
          onTheme={onTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
      {fileViewer && <FileViewer key={fileViewer.id} item={fileViewer} onClose={() => setFileViewer(null)} />}
      {canvas && (
        <Suspense fallback={null}>
          <GenUIPanel code={canvas} onClose={() => setCanvas(null)} />
        </Suspense>
      )}
      {workOpen && <WorkDialog onClose={() => setWorkOpen(false)} />}
    </div>
    </GenUIContext.Provider>
  );
}
