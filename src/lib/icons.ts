/**
 * الأيقونات: تُقرأ وقت التشغيل لا وقت البناء.
 *
 * كانت تُجمع بـ`import.meta.glob`، وهي طريقة Vite السليمة عمومًا. لكن كل
 * إعادة توليد تعيد تسمية مئات الملفات (لأن الاسم يحمل بصمة المحتوى)، فيبقى
 * خادم التطوير عالقًا على قائمة قديمة ويعرض الشاشات بلا أيقونات — وقد حدث
 * فعلًا، وبدا كخلل في العارض لا في التخزين.
 *
 * فالملفات الآن تُقدَّم ساكنة، والقائمة تُجلب من الشبكة. والاسم يحمل بصمة
 * محتواه أصلًا، فالتخزين المؤقت سليم بلا أي تحايل.
 */

const BASE = import.meta.env.BASE_URL || '/';

/** الاسم → الرابط. تبدأ فارغة وتُملأ بعد `loadIcons`. */
export const iconUrls: Record<string, string> = {};

let pending: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** رقم يزداد عند كل تحميل — تستعمله الواجهة لإعادة الرسم */
export function iconsVersion(): number {
  return version;
}

export function onIconsLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadIcons(): Promise<void> {
  if (pending) return pending;

  pending = fetch(BASE + 'generated-icons/catalog.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('catalog ' + res.status))))
    .then((catalog: Record<string, string>) => {
      for (const [name, path] of Object.entries(catalog)) {
        iconUrls[name] = BASE + path;
      }
      version++;
      for (const fn of listeners) fn();
    })
    .catch((e) => {
      // فشل الأيقونات لا يُسقط الشاشة: النص والتخطيط يظهران، والأيقونة تغيب
      console.error('[icons] could not load the catalog:', e);
      pending = null;
    });

  return pending;
}

/** يُستدعى مرة واحدة عند الإقلاع */
export function preloadIcons(): void {
  void loadIcons();
}
