# الروابط

| | |
|---|---|
| **التطبيق (استعمل هذا)** | `https://bahr-vps.tail18374c.ts.net:8446/` |
| **بديل بلا وسيط** | `http://100.80.248.51:5180/` |
| الشاشات المستخرجة | `https://bahr-vps.tail18374c.ts.net:8446/#design` |
| التشخيص | `https://bahr-vps.tail18374c.ts.net:8446/diag.html` |
| رفع الملفات | `https://bahr-vps.tail18374c.ts.net:8445/` |
| أداة Figma | `https://bahr-vps.tail18374c.ts.net:8445/files/design-dump-plugin.zip` |

## إن ظهر ERR_TUNNEL_CONNECTION_FAILED

هذه الرسالة تعني أن **متصفحك يمرّ بوسيط (proxy) لا يعمل** — لا أن الخادم معطّل.
وتظهر غالبًا بعد استعمال أداة اعتراض (Burp · Fiddler · Caido · ZAP) ونسيان
تشغيلها.

**الفحص:** إعدادات ويندوز ← الشبكة والإنترنت ← الوسيط. أو
`chrome://settings/system` ← «Open your computer's proxy settings».

**والبديل الفوري الذي لا يمرّ بوسيط:**

```
http://100.80.248.51:5180/
```

عنوان IP مباشر بلا اسم نطاق وبلا TLS، فلا يحتاج وسيطًا ولا شهادة.

## لماذا 8446 لا 5180؟

المنفذ 5180 يخدم HTTP فقط. والمتصفحات الحديثة **تفرض HTTPS** وتحوّل العنوان
تلقائيًا، فيفشل الاتصال بلا رسالة واضحة. و`tailscale serve` يضيف طبقة TLS
فيعمل العنوان في كل متصفح.

## التشغيل

```bash
tools/serve.sh          # الوسيط + التطبيق + HTTPS
tools/serve.sh --watch  # مع إعادة تشغيل تلقائية
```
