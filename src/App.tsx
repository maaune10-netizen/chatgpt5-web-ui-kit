import { useEffect, useMemo, useRef, useState } from 'react';
import { renderScreen, type ScreenData, type ScreenNode } from './lib/render';
import { preloadIcons, onIconsLoaded } from './lib/icons';

/* كل الشاشات المُستخرجة من ملف Figma */
const BASE = import.meta.env.BASE_URL || '/';

type IndexEntry = { slug: string; name: string; node: string; count: number };

/**
 * بيانات الشاشات تُجلب وقت التشغيل لا وقت البناء.
 *
 * كانت تُجمَع بـ`import.meta.glob`، وهي طريقة Vite السليمة عمومًا. لكن كل
 * إعادة توليد تعيد كتابة ٢٣ ملفًا، ويبقى خادم التطوير على الوحدات المخزّنة.
 * وقد حدث ثلاث مرات، وفي كل مرة بدا الخلل في العارض لا في التخزين.
 */
let SCREENS: ScreenData[] = [];
const screenListeners = new Set<() => void>();

function notifyScreens() {
  for (const fn of screenListeners) fn();
}

export function onScreensLoaded(fn: () => void): () => void {
  screenListeners.add(fn);
  return () => screenListeners.delete(fn);
}

/** هل وصلت الشاشات؟ */
export function screensLoaded(): boolean {
  return SCREENS.length > 0;
}

let screensPending: Promise<void> | null = null;
export function loadScreens(): Promise<void> {
  if (screensPending) return screensPending;
  screensPending = fetch(BASE + 'screens/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('index ' + r.status))))
    .then(async (index: IndexEntry[]) => {
      const loaded = await Promise.all(
        index.map((e) =>
          fetch(BASE + 'screens/' + e.slug + '.json', { cache: 'no-cache' }).then((r) => r.json() as Promise<ScreenData>),
        ),
      );
      SCREENS = loaded;
      notifyScreens();
    })
    .catch((e) => {
      console.error('[screens] could not load:', e);
      screensPending = null;
    });
  return screensPending;
}

/*
 * التنقّل: عناصر الشريط الجانبي في التصميم تنتقل إلى الشاشة المقابلة.
 * الربط بالاسم لأن التصميم مبني من مكوّنات قابلة لإعادة الاستخدام.
 */
const NAV_TARGETS: Record<string, string> = {
  'New Chat': 'new-chat-logged-in',
  'Search chats': 'library',
  Library: 'library',
  'Example Project 1': 'project-page',
  'Project Chat 1': 'project-chat',
  'Project Chat 2': 'project-chat',
  'Example Chat 1': 'thread-logged-in',
  'Response Types': 'thread-response-types',
  'Loading Animations': 'thread-loading-animations',
  'Example GPT 1': 'gpt-chat',
  'Example GPT 2': 'gpt-chat',
};

export default function App() {
  /*
   * الأيقونات تُحمَّل بعد الإقلاع. الواجهة تُعيد الرسم عند وصولها،
   * فلا حاجة إلى إعادة تشغيل الخادم بعد كل إعادة توليد.
   */
  const [ready, setReady] = useState(0);
  useEffect(() => {
    preloadIcons();
    loadScreens();
    const offIcons = onIconsLoaded(() => setReady((n) => n + 1));
    const offScreens = onScreensLoaded(() => setReady((n) => n + 1));
    return () => { offIcons(); offScreens(); };
  }, []);

  const [slug, setSlug] = useState('');
  useEffect(() => {
    if (!slug && SCREENS.length) setSlug(SCREENS[0].slug);
  }, [ready, slug]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);

  const screen = useMemo(
    () => SCREENS.find((s) => s.slug === slug) ?? SCREENS[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, ready],
  );

  /* ملاءمة العرض تلقائيًا */
  useEffect(() => {
    if (!fit || !screen) return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const pad = 48;
      const s = Math.min((el.clientWidth - pad) / screen.w, (el.clientHeight - pad) / screen.h);
      setZoom(Math.max(0.15, Math.round(s * 1000) / 1000));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const clickable = (n: ScreenNode) => !!NAV_TARGETS[n.n];
  const onNodeClick = (n: ScreenNode) => {
    const target = NAV_TARGETS[n.n];
    if (target && SCREENS.some((s) => s.slug === target)) {
      setSlug(target);
      setPickerOpen(false);
    }
  };

  /* Ctrl/Cmd + عجلة = تكبير يدوي */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setFit(false);
      setZoom((z) => Math.min(3, Math.max(0.15, z - e.deltaY * 0.0015)));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  if (!screen) {
    return <div className="grid h-full place-items-center text-white/70">No screens found.</div>;
  }

  return (
    <div className="flex h-full flex-col bg-[#0b0b0b] text-white">
      {/* الشريط العلوي */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex h-8 items-center gap-2 rounded-lg bg-white/10 px-3 text-[12px] font-medium transition hover:bg-white/15"
        >
          <span className="grid grid-cols-2 gap-[2px]">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-[3px] w-[3px] rounded-full bg-white/80" />
            ))}
          </span>
          Screens
          <span className="text-white/50">{SCREENS.length}</span>
        </button>

        <div className="min-w-0 flex-1 truncate text-[13px]">
          <span className="font-medium">{screen.name}</span>
          <span className="ml-2 text-white/40">
            {screen.w}×{screen.h} · {screen.nodes.length} nodes
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setFit(false);
              setZoom((z) => Math.max(0.15, Math.round((z - 0.05) * 100) / 100));
            }}
            className="h-8 w-8 rounded-lg bg-white/5 transition hover:bg-white/15"
            title="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center text-[11px] tabular-nums text-white/60">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              setFit(false);
              setZoom((z) => Math.min(3, Math.round((z + 0.05) * 100) / 100));
            }}
            className="h-8 w-8 rounded-lg bg-white/5 transition hover:bg-white/15"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setFit((v) => !v)}
            className={`ml-1 h-8 rounded-lg px-3 text-[12px] transition ${
              fit ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/15'
            }`}
          >
            Fit
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* قائمة الشاشات */}
        {pickerOpen && (
          <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-[#121212]">
            <div className="border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wider text-white/40">
              Extracted screens
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {SCREENS.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => {
                    setSlug(s.slug);
                  }}
                  className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-[12px] transition ${
                    s.slug === slug ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <div className="truncate font-medium">{s.name}</div>
                  <div
                    className={`text-[10px] ${s.slug === slug ? 'text-black/50' : 'text-white/40'}`}
                  >
                    {s.nodes.length} nodes
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {!screen ? (
          <div className="flex flex-1 items-center justify-center text-sm text-white/40">
            Loading screens…
          </div>
        ) : (
        <>
                {/* المسرح */}
        <div ref={stageRef} className="relative min-h-0 flex-1 overflow-auto">
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: screen.w * zoom,
              height: screen.h * zoom,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              id="screen-frame"
              style={{
                width: screen.w,
                height: screen.h,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                position: 'relative',
                background: screen.bg || '#212121',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              }}
            >
              {renderScreen(screen, { clickable, onNodeClick })}
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
