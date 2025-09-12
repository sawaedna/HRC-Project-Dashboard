# لوحة معلومات المشاريع — Arabic Interactive Dashboard (Next.js)

هذا المشروع جاهز للعمل كـ Full‑Stack app باستخدام **Next.js**:
- الواجهة بالعربية.
- جلب بيانات من **Google Sheets** عبر API server-side (Service Account).
- تخزين/تهيئة بيانات إلى **Neon (Postgres)** عبر API route محمي.
- واجهة تفاعلية تعتمد على الكود الذي زودتني به مع تحسينات للـ parsing والتواريخ.

## بنية المشروع
```
project-dashboard-ar/
├─ pages/
│  ├─ index.js
│  └─ api/
│     ├─ sheets.js
│     └─ seed.js
├─ public/
│  └─ js/
│     └─ app.js
├─ lib/
│  └─ db.js
├─ migrations/
│  └─ init.sql
├─ package.json
└─ README.md
```

## قبل التشغيل — المتغيرات المطلوبة
إنشئ ملف `.env.local` في جذر المشروع يحتوي القيم التالية (لا ترفع الملف لـ GitHub):

```
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }'  # الصق JSON كاملاً كسطر واحد
SHEET_ID=your_google_sheet_id_here
DATABASE_URL=postgres://user:pass@host:port/dbname
ADMIN_SECRET=choose_a_strong_secret
NEXT_PUBLIC_DEFAULT_THEME=dark
```

## تشغيل محلي
1. تنصيب الحزم:
```bash
npm install
```
2. تشغيل التطبيق:
```bash
npm run dev
```
3. افتح المتصفح: http://localhost:3000

## نشر على GitHub وVercel
1. ارفع الكود إلى repo على GitHub (`git init`، `git add .`, `git commit -m "init"`, ثم `git push`).
2. على Vercel: أنشئ مشروع جديد واربطه بالـ repo.
3. أضف المتغيرات البيئية (`GOOGLE_SERVICE_ACCOUNT_KEY`, `SHEET_ID`, `DATABASE_URL`, `ADMIN_SECRET`, `NEXT_PUBLIC_DEFAULT_THEME`) في إعدادات المشروع على Vercel.
4. نشر — Vercel سيبني التطبيق تلقائيًا.

## ملاحظات هامة للأمان
- لا تقم بعمل commit للمفتاح JSON أو `.env.local`.
- استعمل `ADMIN_SECRET` لحماية endpoint تهيئة DB (`/api/seed`).

---

سأرشدك خطوة-بخطوة حالما تخبرني أنّك حمّلت المشروع محليًا وننتقل لإعداد Google API Service Account وربطه.
