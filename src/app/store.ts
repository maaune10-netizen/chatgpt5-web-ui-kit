/**
 * حالة التطبيق — من الخادم، لا من المتصفح.
 *
 * كل شيء في قاعدة بيانات على الخادم: المحادثات والرسائل والمشاريع والملفات.
 * فالمتصفح واجهة عرض فقط، ويمكن قراءة كل شيء وتعديله عبر API.
 *
 * والكتابة **متفائلة**: الواجهة تتحدّث فورًا ثم يُرسل الطلب، فإن فشل رُوجع
 * التغيير وأُبلغ المستخدم. فالنقر لا ينتظر الشبكة.
 *
 * والبثّ يُجمَّع: النص يُحدَّث محليًا مع كل وصول، ويُرسل للخادم كل ٤٠٠ ملي
 * ثانية وعند الانتهاء — لأن إرسال كل حرف يعني مئات الطلبات في الرد الواحد.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Role = 'user' | 'assistant' | 'system';

/** استهلاك الردّ — يُخزَّن معه فيُعرف ثمنه لاحقًا */
export interface MsgUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cache_read_input_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

export interface Citation {
  title: string;
  url?: string;
  host?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  createdAt: number;
  streaming?: boolean;
  error?: string;
  stopped?: boolean;
  citations?: Citation[];
  model?: string;
  image?: string;
  /** استهلاك هذا الردّ من النموذج */
  usage?: MsgUsage;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  projectId?: string | null;
  temporary?: boolean;
  pinned?: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  mime?: string;
  size: number;
  kind: 'image' | 'file';
  url: string;
  createdAt: number;
}

export type Theme = 'dark' | 'light' | 'auto';

export interface AppState {
  theme: Theme;
  /** المحادثة المفتوحة */
  activeId: string | null;
  /** المسار المعروض */
  view: 'chat' | 'library' | 'project' | 'image' | 'images' | 'scheduled' | 'plugins' | 'codex' | 'explore';
  viewArg: string | null;
  signedIn: boolean;
  email: string;
  temporary: boolean;
  tempConv: Conversation | null;
  conversations: Conversation[];
  archived: Conversation[];
  projects: Project[];
  files: LibraryItem[];
  model: string;
  ready: boolean;
  offline?: string;
}

const API = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${path} — ردّ غير مفهوم`);
  }
  if (!r.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const uid = (p = 'id'): string =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function useStore() {
  const [state, setState] = useState<AppState>({
    theme: (typeof localStorage !== 'undefined' ? (localStorage.getItem('gpt5.theme') as Theme) : null) || 'auto',
    activeId: null,
    view: 'chat',
    viewArg: null,
    signedIn: typeof localStorage !== 'undefined' ? localStorage.getItem('gpt5.signedIn') !== '0' : true,
    email: 'hello@interactionfaction.com',
    temporary: false,
    tempConv: null,
    conversations: [],
    archived: [],
    projects: [],
    files: [],
    model: '',
    ready: false,
  });

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);
  const errors = useRef<((m: string) => void) | null>(null);

  /* ————— التحميل الأول ————— */
  const load = useCallback(async () => {
    try {
      const s = await req<{
        conversations: Conversation[];
        projects: Project[];
        files: LibraryItem[];
        model: string;
      }>('GET', '/state');
      patch((prev) => ({
        ...prev,
        conversations: (s.conversations || []).map((c) => ({ ...c, messages: c.messages ?? [] })),
        projects: s.projects || [],
        files: s.files || [],
        model: s.model || prev.model,
        ready: true,
        offline: undefined,
      }));
    } catch (e) {
      patch((prev) => ({ ...prev, ready: true, offline: (e as Error).message }));
    }
  }, [patch]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(() => {
    if (state.tempConv) return state.tempConv;
    return state.conversations.find((c) => c.id === state.activeId) ?? null;
  }, [state.tempConv, state.conversations, state.activeId]);

  /* ————— المحادثات ————— */
  const patchConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) =>
      patch((s) =>
        s.tempConv?.id === id
          ? { ...s, tempConv: fn(s.tempConv) }
          : { ...s, conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)) },
      ),
    [patch],
  );

  const patchMessage = useCallback(
    (convId: string, msgId: string, fn: (m: Message) => Message) =>
      patchConversation(convId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)),
      })),
    [patchConversation],
  );

  const api = useMemo(
    () => ({
      async newChat(projectId: string | null = null, temporary = false): Promise<string> {
        /*
         * إن كانت المفتوحة فارغة بالفعل فلا ننشئ أخرى.
         * وكان كل ضغط يُضيف محادثة فارغة، فيمتلئ الشريط بعشرات «New chat»
         * لا معنى لها — وهذا ما يفعله ChatGPT: الضغط وأنت في فارغة لا يفعل شيئًا.
         */
        {
        const c0 = state.tempConv ?? state.conversations.find((c) => c.id === state.activeId);
        if (!temporary && c0 && c0.messages.length === 0 && !c0.projectId && !c0.pinned) {
          patch((s) => ({ ...s, temporary: false, tempConv: null, view: 'chat', viewArg: null }));
          return c0.id;
        }
        }

        const local: Conversation = {
          id: uid('c'),
          title: temporary ? 'Temporary chat' : 'New chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId,
          temporary,
        };
        /* المؤقتة لا تُرسل للخادم إلا عند أول رسالة */
        if (temporary) {
          patch((s) => ({ ...s, temporary: true, tempConv: local, view: 'chat', viewArg: null }));
          return local.id;
        }
        patch((s) => ({ ...s, temporary: false, tempConv: null, activeId: local.id, view: 'chat', viewArg: null }));
        try {
          const saved = await req<Conversation>('POST', '/conversations', { id: local.id, title: local.title, projectId, model: state.model });
          /*
           * الخادم يُعيد المحادثة بلا رسائل — وهي فارغة عند الإنشاء.
           * لكن الاستبدال الأعمى كان يُسقط `messages` فينهار العرض عند أول
           * تكرار عليها. فنحتفظ بما هو موجود محليًا.
           */
          patch((s) => {
            const existing = s.conversations.find((c) => c.id === local.id);
            return {
              ...s,
              conversations: [
                { ...saved, messages: saved.messages ?? existing?.messages ?? [] },
                ...s.conversations.filter((c) => c.id !== local.id),
              ],
            };
          });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
        return local.id;
      },

      openChat(id: string) {
        patch((s) => ({ ...s, temporary: false, tempConv: null, activeId: id, view: 'chat', viewArg: null }));
      },
      closeChat() {
        patch((s) => ({ ...s, activeId: null }));
      },

      async renameChat(id: string, title: string) {
        patchConversation(id, (c) => ({ ...c, title }));
        try {
          await req('PATCH', `/conversations/${id}`, { title });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async deleteChat(id: string) {
        if (state.tempConv?.id === id) {
          patch((s) => ({ ...s, tempConv: null, temporary: false }));
          return;
        }
        patch((s) => ({
          ...s,
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
        try {
          await req('DELETE', `/conversations/${id}`);
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async archiveChat(id: string, archived: boolean) {
        patch((s) => ({
          ...s,
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
        try {
          await req('PATCH', `/conversations/${id}`, { archived });
          await load();
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async togglePin(id: string) {
        const cur = state.conversations.find((c) => c.id === id);
        const pinned = !cur?.pinned;
        patchConversation(id, (c) => ({ ...c, pinned }));
        try {
          await req('PATCH', `/conversations/${id}`, { pinned });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async moveToProject(id: string, projectId: string | null) {
        patchConversation(id, (c) => ({ ...c, projectId }));
        try {
          await req('PATCH', `/conversations/${id}`, { projectId });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      /* ————— الرسائل ————— */
      async addMessage(convId: string, m: Omit<Message, 'id' | 'createdAt'>): Promise<string> {
        const id = uid('m');
        const full: Message = { ...m, id, createdAt: Date.now() };
        patchConversation(convId, (c) => {
          const msgs = [...c.messages, full];
          const firstUser = msgs.find((x) => x.role === 'user');
          const t = c.title === 'New chat' || c.title === 'Temporary chat';
          const title = t && firstUser ? firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 42) : c.title;
          return { ...c, messages: msgs, title: c.temporary ? c.title : title, updatedAt: Date.now() };
        });

        /* المحادثة المؤقتة تُنشأ على الخادم عند أول رسالة، وتُعلَّم مؤقتة */
        if (state.tempConv?.id === convId) {
          try {
            await req('POST', '/conversations', { id: convId, title: 'Temporary chat', temporary: true });
          } catch {
            /* تُحفظ محليًا على الأقل */
          }
        }

        try {
          const saved = await req<Message>('POST', `/conversations/${convId}/messages`, {
            id,
            role: m.role,
            content: m.content,
            image: m.image,
            model: m.model,
          });
          return saved?.id || id;
        } catch (e) {
          errors.current?.((e as Error).message);
          return id;
        }
      },

      patchMessage,

      /** يُرسل النص المتراكم للخادم — يُستدعى دوريًا وعند الانتهاء */
      async flushMessage(convId: string, msgId: string, m: Message) {
        try {
          await req('PATCH', `/conversations/${convId}/messages/${msgId}`, {
            content: m.content,
            reasoning: m.reasoning ?? null,
            error: m.error ?? null,
            stopped: !!m.stopped,
            citations: m.citations ?? null,
            usage: m.usage ?? null,
          });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async removeMessagesFrom(convId: string, msgId: string) {
        patchConversation(convId, (c) => {
          const i = c.messages.findIndex((m) => m.id === msgId);
          return i < 0 ? c : { ...c, messages: c.messages.slice(0, i) };
        });
        try {
          await req('DELETE', `/conversations/${convId}/messages?from=${encodeURIComponent(msgId)}`);
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      /* ————— المشاريع ————— */
      async newProject(name: string): Promise<string> {
        const id = uid('p');
        const local: Project = { id, name: name || 'New project', createdAt: Date.now() };
        patch((s) => ({ ...s, projects: [...s.projects, local] }));
        try {
          await req('POST', '/projects', { id, name: local.name });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
        return id;
      },

      async renameProject(id: string, name: string) {
        patch((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) }));
        try {
          await req('PATCH', `/projects/${id}`, { name });
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      async deleteProject(id: string) {
        patch((s) => ({
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          conversations: s.conversations.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)),
        }));
        try {
          await req('DELETE', `/projects/${id}`);
        } catch (e) {
          errors.current?.((e as Error).message);
        }
      },

      /* ————— الملفات ————— */
      async uploadFile(file: File | Blob, name: string, kind: 'image' | 'file') {
        /* تُعرض فورًا بمصدر محلي، ثم يُستبدل برابط الخادم */
        const localUrl = URL.createObjectURL(file);
        const tempId = uid('f');
        patch((s) => ({
          ...s,
          files: [
            { id: tempId, name, size: file.size, kind, url: localUrl, createdAt: Date.now(), mime: file.type } as LibraryItem,
            ...s.files,
          ],
        }));
        try {
          const r = await fetch(`${API}/files?name=${encodeURIComponent(name)}&kind=${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          });
          const saved = (await r.json()) as LibraryItem;
          patch((s) => ({ ...s, files: s.files.map((f) => (f.id === tempId ? saved : f)) }));
          return saved;
        } catch (e) {
          errors.current?.((e as Error).message);
          return null;
        }
      },

      async removeFile(id: string) {
        patch((s) => ({ ...s, files: s.files.filter((f) => f.id !== id) }));
        try {
          await req('DELETE', `/files/${id}`);
        } catch {
          /* تُزال محليًا على الأقل */
        }
      },

      /* ————— الحساب والوضع ————— */
      setTheme(t: Theme) {
        patch((s) => ({ ...s, theme: t }));
        try {
          localStorage.setItem('gpt5.theme', t);
        } catch {
          /* — */
        }
      },

      signIn(email = 'hello@interactionfaction.com') {
        patch((s) => ({ ...s, signedIn: true, email }));
        try {
          localStorage.setItem('gpt5.signedIn', '1');
        } catch {
          /* — */
        }
      },
      signOut() {
        patch((s) => ({ ...s, signedIn: false }));
        try {
          localStorage.setItem('gpt5.signedIn', '0');
        } catch {
          /* — */
        }
      },
      setTemporary(on: boolean) {
        patch((s) => ({ ...s, temporary: on, tempConv: on ? s.tempConv : null }));
      },
      endTemporary() {
        patch((s) => ({ ...s, temporary: false, tempConv: null, activeId: null }));
      },

      /* ————— تنقّل ————— */
      go(
        view: 'chat' | 'library' | 'project' | 'image' | 'images' | 'scheduled' | 'plugins' | 'codex' | 'explore',
        arg: string | null = null,
      ) {
        patch((s) => ({ ...s, view, viewArg: arg }));
      },
      reload: load,

      /** يستقبل دالة إبلاغ عن الأخطاء من الواجهة */
      onError(fn: (m: string) => void) {
        errors.current = fn;
      },
    }),
    [patch, patchConversation, patchMessage, state.conversations, state.model, state.tempConv, state.activeId, load],
  );

  return { state, active, ...api };
}

export type Store = ReturnType<typeof useStore>;
