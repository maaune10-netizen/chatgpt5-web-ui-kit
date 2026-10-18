# الروابط

| | |
|---|---|
| **التطبيق (استعمل هذا)** | `https://bahr-vps.tail18374c.ts.net:8446/` |
| الشاشات المستخرجة | `https://bahr-vps.tail18374c.ts.net:8446/#design` |
| التشخيص | `https://bahr-vps.tail18374c.ts.net:8446/diag.html` |
| رفع الملفات | `https://bahr-vps.tail18374c.ts.net:8445/` |
| أداة Figma | `https://bahr-vps.tail18374c.ts.net:8445/files/design-dump-plugin.zip` |

## لماذا 8446 لا 5180؟

المنفذ 5180 يخدم HTTP فقط. والمتصفحات الحديثة **تفرض HTTPS** وتحوّل العنوان
تلقائيًا، فيفشل الاتصال بلا رسالة واضحة. و`tailscale serve` يضيف طبقة TLS
فيعمل العنوان في كل متصفح.

## التشغيل

```bash
tools/serve.sh          # الوسيط + التطبيق + HTTPS
tools/serve.sh --watch  # مع إعادة تشغيل تلقائية
```
