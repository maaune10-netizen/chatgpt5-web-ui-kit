/**
 * الحدود الحقيقية للنماذج — مقروءة من مخزن نماذج Pi نفسه، لا مُقدَّرة.
 *
 * `/home/deploy/.pi/agent/models-store.json` يحمل لكل نموذج:
 *   contextWindow · maxTokens · input types · cost (including cacheRead)
 *
 * وقد كنت أضع `maxTokens: 8192` **اختراعًا** — والحدّ الحقيقي ٣٨٤٬٠٠٠،
 * أي أنّ رقمي كان أصغر ٤٧ مرّة. والأسوأ أنّ الواجهة كانت تعرضه كأنّه حقيقة.
 */

export interface ModelLimits {
  /** أقصى سياق يُقبل، بالتوكن */
  contextWindow: number;
  /** أقصى ما يمكن أن يُولَّد في ردّ واحد */
  maxTokens: number;
  /** الأنواع المقبولة مدخلًا */
  input: Array<'text' | 'image'>;
  /** هل يُنتج تفكيرًا منفصلًا؟ */
  reasoning: boolean;
  /** سعر المليون توكن بالدولار */
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** الحدود المعروفة. ما ليس هنا يُعامَل بحذر. */
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  'deepseek-v4.1-flash': {
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    input: ['text', 'image'],
    reasoning: true,
    cost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 },
  },
  'deepseek-v4-pro': {
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    input: ['text', 'image'],
    reasoning: true,
    cost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 },
  },
};

/** احتياط محافظ حين لا نعرف النموذج: لا نقترح عليه حدًّا كبيرًا */
export const UNKNOWN_LIMITS: ModelLimits = {
  contextWindow: 128_000,
  maxTokens: 16_384,
  input: ['text'],
  reasoning: false,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

export function limitsFor(model: string): ModelLimits {
  return MODEL_LIMITS[model] ?? UNKNOWN_LIMITS;
}

export function isKnown(model: string): boolean {
  return model in MODEL_LIMITS;
}

/**
 * الافتراضي للإخراج.
 *
 * ليس الحدّ الأقصى: ٣٨٤ ألف توكن في ردّ محادثة يعني انتظارًا طويلًا وفاتورة
 * كبيرة إن أخطأ النموذج في الاستمرار. ولا ٨١٩٢ الذي اخترعته — فهو يقطع
 * الردود الطويلة والتفكير يأكل منه.
 */
export const DEFAULT_MAX_TOKENS = 32_768;

/** أقلّ من هذا يستهلكه التفكير قبل أن يكتب النموذج حرفًا */
export const MIN_USEFUL_MAX_TOKENS = 1024;

/* ————— حساب الكلفة والكاش ————— */

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cache_read_input_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

export function cachedTokens(u: Usage | undefined): number {
  if (!u) return 0;
  return u.prompt_tokens_details?.cached_tokens ?? u.cache_read_input_tokens ?? 0;
}

export function reasoningTokens(u: Usage | undefined): number {
  return u?.completion_tokens_details?.reasoning_tokens ?? 0;
}

/** الكلفة بالدولار. والكاش يُحسب بسعره لا بسعر الإدخال. */
export function costOf(u: Usage | undefined, model: string): number {
  if (!u) return 0;
  const l = limitsFor(model);
  const prompt = u.prompt_tokens ?? 0;
  const cached = cachedTokens(u);
  const fresh = Math.max(0, prompt - cached);
  return (
    (fresh * l.cost.input + cached * l.cost.cacheRead + (u.completion_tokens ?? 0) * l.cost.output) / 1_000_000
  );
}

/**
 * نسبة ما وُفِّر بالكاش **على الإدخال وحده**.
 *
 * وكانت تُحسب على الكلفة كلها، فتظهر «٦٧٪ مخزَّن · ٠٪ موفَّر» — وهي صحيحة
 * حسابيًّا وكاذبة معنويًّا: الإخراج ٢٨٬٣٩١ توكن يغرق توفير الإدخال (٣٨٢ توكن)
 * فيصير التوفير صفرًا بعد التقريب.
 *
 * والكاش لا يمسّ الإخراج أصلًا — فقياسه على الإدخال هو القياس الصحيح.
 */
export function savings(u: Usage | undefined, model: string): number {
  if (!u) return 0;
  const l = limitsFor(model);
  const prompt = u.prompt_tokens ?? 0;
  const cached = cachedTokens(u);
  if (prompt <= 0 || cached <= 0 || l.cost.input <= 0) return 0;
  const full = prompt * l.cost.input;
  const real = (prompt - cached) * l.cost.input + cached * l.cost.cacheRead;
  return full > 0 ? 1 - real / full : 0;
}

/**
 * هل استُهلك حدّ الإخراج في التفكير وحده؟
 *
 * يحدث فعلًا: `28,391 out` كلها `thinking` وصفر حرف جواب. والردّ يصل فارغًا
 * بلا خطأ، فيبدو كأنّ شيئًا لم يحدث.
 */
export function exhaustedByThinking(u: Usage | undefined): boolean {
  if (!u) return false;
  const out = u.completion_tokens ?? 0;
  const think = reasoningTokens(u);
  return out > 0 && think > 0 && think >= out * 0.98;
}
