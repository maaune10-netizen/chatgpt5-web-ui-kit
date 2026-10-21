# جرد المسارات — من لقطات المستخدم (٢١ أكتوبر)

**المصدر:** ١٢ صفحة + ١٩ لقطة رفعها المستخدم من متصفّحه وهو مسجَّل بحساب
`@maaune10`، مع ملفّ `chatgpt-pages.md` فيه الروابط وعناوينها.
**لا زحف:** كل النطاقات تُعيد 403. هذه الصفحات **قِيست بالعين** من اللقطات.

> **وهي تُصحّح `specs/FLOW.md`:** ذلك الملفّ بُني من ملفّ Figma صُمّم في عهد
> GPT-5. والموقع الحالي يختلف في الهيكل لا في اللون. وهذا الملفّ يحلّ محلّه
> في ما يخصّ **عدد الصفحات وأسماءها**.

---

## ١. المسارات المُلتقَطة — ١٢

| # | المسار | الصفحة | ما فيها |
|---|---|---|---|
| 1 | `/` | Home / new chat | «What's on your mind today?» + شريط + منتقي **Chat \| Work** |
| 2 | `/library` | Library | تبويبات Suggested · Favorites · Folders · Images · All |
| 3 | `/plugins` | Plugins | Popular · New & Noteworthy · Small Business + تابات **Plugins \| Skills** |
| 4 | `/c/:id` | محادثة | ردّ + كتلة كود + صفّ أفعال + شريط |
| 5 | `/settings/general-settings` | General | اللغة فقط |
| 6 | `/settings/appearance` | Appearance | Mode (٣ صور) · Theme · Accent · Background · Foreground |
| 7 | `/u/:handle` | Profile | صورة · إحصاءات · Showcase · **Token activity** (خريطة حرارية) |
| 8 | `/settings/account` | Account | Name · Username · Email · Status · GPT builder profile · Age · Delete |
| 9 | `/settings/archived-chats` | Archived chats | «No archived chats» |
| 10 | `/settings/voice` | Voice | Voice · Language · Dictation · Recent recordings |
| 11 | `/settings/storage` | Storage | `2.67 MB of 512 MB` + Files / Images |
| 12 | `/settings/usage` | Usage | تابات Overview/Analytics · Plan limits · Resets |
| — | `/auth/login` | Log in or sign up | **صفحة كاملة** (لا نافذة) |

**ولا يظهر `/g/…` في أيٍّ منها** — وهو الدليل الذي طلبته على إزالة عائلة GPTs.

## ٢. شريط الإعدادات — ١٧+ صفحة

الشريط الأيسر داخل `/settings/*` ثابت في كل الصفحات (٣٣٥ بكسلًا):

**Personal:** General · Appearance · Notifications · Profile ↗ · Security and login ·
Account · Archived chats · Parental controls · Trusted contact · Voice · Storage ·
Personalization · **Pets** · Keyboard · Usage · Billing · Data controls

**Integrations:** Plugins · (وتحته ما لم تُصوَّر)

> **هذا أهمّ رقم في الملفّ:** عندنا **صفحة إعدادات واحدة** (نافذة). والموقع
> الحقيقي له **١٧ صفحة على الأقلّ**، لكلٍّ تخطيط مستقلّ.

## ٣. الشريط الجانبي — حالتان

**مسجَّل (٢٦٠ بكسل، بأسماء):**
`New chat · Images · Scheduled · Library · Plugins · Codex · Explore`
ثم قسم **Projects** (و«No projects») ثم قسم **Recents**
وأسفلَه: الصورة + الاسم + الخطة + زرّ Upgrade.
والترويسة: كلمة **ChatGPT** + أيقونة بحث + أيقونة طيّ.

**زائر (٢٦٠ بكسل، بأسماء):** (من لقطة `/plugins` وهو غير مسجَّل)
`New chat · Images · Plugins · Deep research · See plans and pricing ↗ · Settings · Help ↗`
وأسفلَه بلوك «Get responses tailored to you» + زرّ Log in **بإطار**.

**مطويّ:** أيقونات فقط بعرض ~٦٤ — وهي الحالة التي ظهرت في لقطة `/` و`/images`.

## ٤. ما لم يُصوَّر بعد

| المسار | الدليل على وجوده |
|---|---|
| `/skills` | مذكور في `chatgpt-pages.md` (من صفحة البروفايل) وفي تابّ Plugins |
| `/settings/plugins-settings` | مذكور في الملفّ |
| `/scheduled` | في الشريط الجانبي |
| `/codex` | في الشريط الجانبي |
| `/explore` | في الشريط الجانبي |
| `/settings/notifications` · `security-and-login` · `parental-controls` · `trusted-contact` · `personalization` · `pets` · `keyboard` · `billing` · `data-controls` | في شريط الإعدادات، ظاهرة بأسمائها |
| `/pricing` · `/download` | انتقلا إلى `openai.com` |
| تفاصيل `plugin_*` | ١١٦ رابطًا في `/plugins` |

## ٥. العدد

| | |
|---|---|
| مُلتقَط ومُقاس | **١٢** |
| مؤكَّد الوجود بلا لقطة | **~١٤** |
| **المجموع المعروف** | **~٢٦ مسارًا** |

مقابل **٥ مسارات** في تطبيقنا. أي أنّ ما بنيناه يغطّي **خُمس** السطح الحقيقي.
