/**
 * عميل OpenCode Go — بثّ عبر واجهة متوافقة مع OpenAI.
 *
 * المزوّد: opencode.ai/zen/v1 · النموذج: deepseek-v4.1-flash
 * والنموذج يُعيد `reasoning_content` منفصلًا عن `content`، فنعرضهما معًا
 * لكن في مكانين مختلفين — التفكير ليس جوابًا.
 */

export interface Config {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamDelta {
  /** النص الظاهر */
  content?: string;
  /** التفكير — لا يُعرض كجواب */
  reasoning?: string;
}

export interface StreamHandlers {
  onDelta: (d: StreamDelta) => void;
  onDone: (info: { usage?: Record<string, number>; finish?: string }) => void;
  onError: (e: Error) => void;
}

/**
 * الافتراضي مسار نسبي إلى الوسيط، لا إلى المزوّد.
 * فالوسيط يحمل المفتاح ويمرّر البثّ، والمتصفح لا يرى المفتاح ولا يصطدم بـCORS.
 */
export const PROXY_BASE = '/api';

export const DEFAULT_CONFIG: Config = {
  baseUrl: PROXY_BASE,
  apiKey: '',
  model: (import.meta.env.VITE_LLM_MODEL as string) || 'deepseek-v4.1-flash',
};

/** الإعداد محفوظ في المتصفح، والافتراضي من متغيرات البيئة */
const LS_KEY = 'gpt5.llm.config';

export function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw) as Partial<Config>;
    /* ارفض ما يوجّه الطلب بعيدًا عن الوسيط: المفتاح في الخادم لا في الصفحة */
    const keepProxy = !saved.baseUrl || saved.baseUrl === PROXY_BASE;
    return {
      baseUrl: PROXY_BASE,
      apiKey: '',
      model: saved.model || DEFAULT_CONFIG.model,
      ...(keepProxy ? {} : {}),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(c: Config): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {
    /* التخزين قد يكون معطّلًا — لا يستحق إسقاط التطبيق */
  }
}

/** مع الوسيط لا يلزم مفتاح في المتصفح — الخادم يحمله */
export function isConfigured(c: Config): boolean {
  return Boolean(c.baseUrl && c.model);
}

/** يتحقق من الواجهة ويجلب النماذج المتاحة */
export async function listModels(c: Config): Promise<string[]> {
  const res = await fetch(`${c.baseUrl.replace(/\/$/, '')}/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status} من ${c.baseUrl}/models`);
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return (data.data || []).map((m) => m.id);
}

export class ChatStream {
  private ctrl: AbortController;
  readonly signal: AbortSignal;

  constructor() {
    this.ctrl = new AbortController();
    this.signal = this.ctrl.signal;
  }

  stop(): void {
    this.ctrl.abort();
  }

  async send(config: Config, messages: ChatMessage[], h: StreamHandlers): Promise<void> {
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: this.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });
    } catch (e) {
      console.log('[llm] FETCH THREW', (e as Error).name, (e as Error).message);
      if ((e as Error).name === 'AbortError') return h.onDone({ finish: 'stopped' });
      return h.onError(new Error('تعذّر الوصول إلى النموذج: ' + (e as Error).message));
    }
    console.log('[llm] RESPONSE', res.status);

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j.error?.message) detail = j.error.message;
      } catch {
        /* الرد ليس JSON */
      }
      return h.onError(new Error(detail));
    }
    if (!res.body) return h.onError(new Error('لا يوجد بثّ في الرد'));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: Record<string, number> | undefined;
    let finish: string | undefined;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        /* الحزم مفصولة بسطرين فارغين؛ قد يصل الجزء الأخير مبتورًا */
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const j = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string | null; reasoning_content?: string | null };
                finish_reason?: string | null;
              }>;
              usage?: Record<string, number>;
            };
            if (j.usage) usage = j.usage;
            const ch = j.choices?.[0];
            if (ch?.finish_reason) finish = ch.finish_reason;
            if (ch?.delta) {
              const d: StreamDelta = {};
              if (ch.delta.content) d.content = ch.delta.content;
              if (ch.delta.reasoning_content) d.reasoning = ch.delta.reasoning_content;
              if (d.content || d.reasoning) h.onDelta(d);
            }
          } catch {
            /* حزمة غير مكتملة — تُتجاهل، والتالية تكمل */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return h.onDone({ usage, finish: 'stopped' });
      return h.onError(e as Error);
    }

    h.onDone({ usage, finish });
  }
}
