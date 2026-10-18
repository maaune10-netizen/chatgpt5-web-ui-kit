/**
 * حالة التطبيق: محادثات، مشاريع، مكتبة.
 *
 * مخزّنة في localStorage لأن التطبيق بلا خادم خلفي. والبثّ يُحدّث الرسالة
 * الأخيرة مباشرةً عبر `patchMessage` بدل إعادة بناء القائمة كلها.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Role = 'user' | 'assistant' | 'system';

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
  /** ما زال يتدفّق */
  streaming?: boolean;
  error?: string;
  stopped?: boolean;
  citations?: Citation[];
  model?: string;
  /** صورة مرفقة أو ملصقة */
  image?: string;
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
  src: string;
  title: string;
  createdAt: number;
  kind: 'image' | 'file';
}

export interface AppState {
  conversations: Conversation[];
  projects: Project[];
  library: LibraryItem[];
  activeId: string | null;
  /** مسار العرض */
  view: 'chat' | 'library' | 'project' | 'image';
  viewArg: string | null;
}

const LS = 'gpt5.app.state.v1';

export const uid = (p = 'id'): string =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function titleFrom(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (!s) return 'New chat';
  return s.length > 42 ? s.slice(0, 42).trimEnd() + '…' : s;
}

function seed(): AppState {
  const projects: Project[] = [
    { id: 'p1', name: 'Example Project 1', createdAt: Date.now() - 86400000 },
    { id: 'p2', name: 'Example Project 2', createdAt: Date.now() - 43200000 },
  ];
  const conversations: Conversation[] = [
    {
      id: uid('c'),
      title: 'Example Chat 1',
      messages: [
        {
          id: uid('m'),
          role: 'user',
          content: 'ChatGPT edge cases',
          createdAt: Date.now() - 90000,
        },
      ],
      createdAt: Date.now() - 90000,
      updatedAt: Date.now() - 90000,
      projectId: 'p1',
    },
    { id: uid('c'), title: 'Response Types', messages: [], createdAt: Date.now() - 80000, updatedAt: Date.now() - 80000 },
    { id: uid('c'), title: 'Loading Animations', messages: [], createdAt: Date.now() - 70000, updatedAt: Date.now() - 70000 },
  ];
  return { conversations, projects, library: [], activeId: null, view: 'chat', viewArg: null };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return seed();
    const j = JSON.parse(raw) as AppState;
    /* لا تستأنف رسالة كانت تتدفّق */
    for (const c of j.conversations || []) {
      for (const m of c.messages || []) if (m.streaming) m.streaming = false;
    }
    return {
      conversations: j.conversations || [],
      projects: j.projects || [],
      library: j.library || [],
      activeId: j.activeId ?? null,
      view: j.view || 'chat',
      viewArg: j.viewArg ?? null,
    };
  } catch {
    return seed();
  }
}

export function useStore() {
  const [state, setState] = useState<AppState>(load);
  const saveTimer = useRef<number | null>(null);

  /* كتابة مؤجّلة: البثّ يحدّث كثيرًا، ولا يصحّ كتابة القرص مع كل حرف */
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(LS, JSON.stringify(state));
      } catch {
        /* ممتلئ أو معطّل — نتجاهل */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const active = useMemo(
    () => state.conversations.find((c) => c.id === state.activeId) ?? null,
    [state.conversations, state.activeId],
  );

  const patch = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const patchConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) =>
      patch((s) => ({
        ...s,
        conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)),
      })),
    [patch],
  );

  const patchMessage = useCallback(
    (convId: string, msgId: string, fn: (m: Message) => Message) =>
      patchConversation(convId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)),
      })),
    [patchConversation],
  );

  const api = useMemo(
    () => ({
      /* —— محادثات —— */
      newChat(projectId: string | null = null, temporary = false) {
        const c: Conversation = {
          id: uid('c'),
          title: temporary ? 'Temporary chat' : 'New chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId,
          temporary,
        };
        patch((s) => ({ ...s, conversations: [c, ...s.conversations], activeId: c.id, view: 'chat', viewArg: null }));
        return c.id;
      },
      openChat(id: string) {
        patch((s) => ({ ...s, activeId: id, view: 'chat', viewArg: null }));
      },
      renameChat(id: string, title: string) {
        patchConversation(id, (c) => ({ ...c, title }));
      },
      deleteChat(id: string) {
        patch((s) => ({
          ...s,
          conversations: s.conversations.filter((c) => c.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
      },
      togglePin(id: string) {
        patchConversation(id, (c) => ({ ...c, pinned: !c.pinned }));
      },
      moveToProject(id: string, projectId: string | null) {
        patchConversation(id, (c) => ({ ...c, projectId }));
      },

      /* —— رسائل —— */
      addMessage(convId: string, m: Omit<Message, 'id' | 'createdAt'>): string {
        const id = uid('m');
        patchConversation(convId, (c) => {
          const msgs = [...c.messages, { ...m, id, createdAt: Date.now() }];
          const firstUser = msgs.find((x) => x.role === 'user');
          const title =
            c.title === 'New chat' || c.title === 'Temporary chat'
              ? titleFrom(firstUser?.content || '')
              : c.title;
          return { ...c, messages: msgs, title: c.temporary ? c.title : title, updatedAt: Date.now() };
        });
        return id;
      },
      updateMessage: patchMessage,
      patchMessage,
      removeMessagesFrom(convId: string, msgId: string) {
        patchConversation(convId, (c) => {
          const i = c.messages.findIndex((m) => m.id === msgId);
          return i < 0 ? c : { ...c, messages: c.messages.slice(0, i) };
        });
      },

      /* —— مشاريع —— */
      newProject(name: string) {
        const p: Project = { id: uid('p'), name: name || 'New project', createdAt: Date.now() };
        patch((s) => ({ ...s, projects: [...s.projects, p] }));
        return p.id;
      },
      renameProject(id: string, name: string) {
        patch((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) }));
      },
      deleteProject(id: string) {
        patch((s) => ({
          ...s,
          projects: s.projects.filter((p) => p.id !== id),
          conversations: s.conversations.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)),
        }));
      },

      /* —— مكتبة —— */
      addLibrary(items: Omit<LibraryItem, 'id' | 'createdAt'>[]) {
        const add = items.map((it) => ({ ...it, id: uid('lib'), createdAt: Date.now() }));
        patch((s) => ({ ...s, library: [...add, ...s.library] }));
      },
      removeLibrary(id: string) {
        patch((s) => ({ ...s, library: s.library.filter((x) => x.id !== id) }));
      },

      /* —— تنقّل —— */
      go(view: AppState['view'], arg: string | null = null) {
        patch((s) => ({ ...s, view, viewArg: arg }));
      },
      clearAll() {
        const s = seed();
        setState({ ...s, conversations: [], projects: [], library: [] });
      },
    }),
    [patch, patchConversation],
  );

  return { state, active, ...api };
}

export type Store = ReturnType<typeof useStore>;
