/**
 * قياس الحلقة — **تكرار متتالٍ**، لا تكرار متناثر.
 *
 * والمحاولة الأولى كانت خاطئة: كنت أعدّ تكرار أي ٥ كلمات في النصّ كلّه،
 * فاتّهمت أربعة ردود سليمة من أصل ٢٧ — صفوف جداول وبيانات متشابهة تتكرّر
 * بطبيعتها (`{left: "Opened", right: ...}` عشر مرّات). **التشابه ليس حلقة.**
 *
 * والحلقة الحقيقية متتالية: النموذج يعيد الكتلة نفسها مرّة بعد مرّة بلا تقدّم.
 * فهنا ثلاثة مقاييس، والحكم على الأوّلين:
 *
 *   ١) `maxLineRun`   — أطول سطر متطابق متتالٍ.
 *   ٢) `maxPeriodRun` — أطول تكرار متتالٍ بفاصل ١..٥ أسطر. ويلتقط النمط
 *      الذي رأيناه فعلًا: «Let me do it. Let me write. Let me call.» × ن.
 *   ٣) `topShingle`   — أكثر ٥ كلمات تكرارًا في النصّ كلّه. **للعلم فقط**:
 *      يقيس قلّة التنوّع، ويرتفع في الجداول السليمة، فلا يُحكم به.
 */

export function loopiness(text) {
  const lines = text.split('\n').map((l) => l.trim());
  let run = 1;
  let maxLineRun = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] && lines[i] === lines[i - 1]) ((run += 1), (maxLineRun = Math.max(maxLineRun, run)));
    else run = 1;
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  let maxPeriodRun = 1;
  let period = 0;
  for (let k = 1; k <= 5; k++) {
    const streak = new Array(sentences.length).fill(1);
    for (let i = k; i < sentences.length; i++) {
      if (sentences[i] === sentences[i - k]) {
        streak[i] = streak[i - k] + 1;
        if (streak[i] > maxPeriodRun) ((maxPeriodRun = streak[i]), (period = k));
      }
    }
  }

  const words = text.split(/\s+/).filter(Boolean);
  const counts = new Map();
  for (let i = 0; i + 5 <= words.length; i++) {
    const k = words.slice(i, i + 5).join(' ');
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let topShingle = 0;
  let worstShingle = '';
  for (const [k, n] of counts) if (n > topShingle) ((topShingle = n), (worstShingle = k));

  return { maxLineRun, maxPeriodRun, period, topShingle, worstShingle, sentences: sentences.length };
}

/** الحلقة = تكرار متتالٍ، لا تكرار متناثر */
export const isLoop = (r) => r.maxLineRun >= 3 || r.maxPeriodRun >= 3;
