# ChatGPT 5 — Web UI Kit

تطبيق محادثة يعمل، مبنيّ من ملف Figma حقيقي. وضعان:

- **App** — تطبيق تفاعلي: اكتب، أرسل، واستقبل من النموذج بثًّا.
- **Design** — الشاشات الأربع والعشرون المُستخرجة من Figma بكسلًا ببكسل.

المبدّل أسفل يمين الشاشة.

## التشغيل

```bash
npm install
cp .env.example .env.local     # ثم ضع المفتاح
node server/proxy.mjs &        # الوسيط — يحمل المفتاح
npm run dev                    # http://localhost:5180
```

## لماذا وسيط؟

سببان، وأولهما ليس الأهم:

1. **المفتاح لا يصل المتصفح.** لو نادى المتصفح المزوّد مباشرةً لكان المفتاح
   في الصفحة لكل من يفتح أدوات المطوّر.
2. المزوّد لا يسمح بأصل المتصفح (CORS)، فالطلب المباشر يفشل أصلًا.

## البنية

```
public/screens/         ٢٤ شاشة مستخرجة (بيانات، تُقرأ وقت التشغيل)
public/generated-icons/ ٢٥١ أيقونة من Figma
public/generated-images/٤٧ صورة من Figma
src/app/                التطبيق التفاعلي
src/lib/                الرموز، عميل النموذج، عارض الشاشات
tools/                  مولّدات وأدوات فحص
figma-plugin/           إضافة التصدير (v3.8)
```

## الأدوات

```bash
node tools/gen.mjs              # أعِد توليد الشاشات من التصدير
node tools/build-icon-map.mjs   # ولّد خريطة الأيقونات
node tools/build-account-menu.mjs
node tools/sweep.mjs            # افتح كل الشاشات وتحقّق منها
node tools/merge-icons.mjs      # ادمج تصدير أصول في تصدير سابق
```
