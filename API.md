# API

كل شيء يمرّ من هنا. لا شيء محبوس في متصفح أحد.

## القراءة

```bash
curl localhost:5199/api/state        # كل شيء: محادثات · رسائل · مشاريع · ملفات
curl localhost:5199/api/export       # نفس الشيء مع عدّادات
curl localhost:5199/api/health       # الحالة والإصدار
curl "localhost:5199/api/events?limit=50"   # سجل كل عملية
```

## المحادثات

```
POST   /api/conversations                  { title, projectId?, temporary? }
GET    /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id              { title?, projectId?, pinned?, temporary?, model? }
DELETE /api/conversations/:id
```

## الرسائل

```
POST   /api/conversations/:id/messages     { role, content, reasoning?, citations?, image? }
PATCH  /api/conversations/:id/messages/:mid   { content?, reasoning?, stopped?, citations? }
DELETE /api/conversations/:id/messages/:mid
DELETE /api/conversations/:id/messages?from=<mid>   # حذف من رسالة فصاعدًا
```

## المشاريع والملفات

```
GET|POST         /api/projects
PATCH|DELETE     /api/projects/:id
GET              /api/files
POST             /api/files?name=x.png&kind=image     # الجسم = بايتات الملف
GET              /api/files/:id/raw
DELETE           /api/files/:id
```

## النموذج

```
GET  /api/models      قائمة النماذج المتاحة
POST /api/chat        بثّ SSE — { model, messages, stream:true }
```

## قاعدة البيانات

`data/gpt5.db` — SQLite. الجداول: `projects` · `conversations` · `messages` · `files` · `events`.

```bash
sqlite3 data/gpt5.db "SELECT title, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 5"
```

## مثال: تصحيح محادثة من الخارج

```bash
MID=$(curl -s localhost:5199/api/conversations | jq -r '.[0].id')
curl -s localhost:5199/api/conversations/$MID | jq '.messages[-1].content'
curl -X PATCH localhost:5199/api/conversations/$MID/messages/$MSGID \
  -H 'Content-Type: application/json' -d '{"content":"نص مصحَّح"}'
```
