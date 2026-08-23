# 🛒 سوق صقر — تطبيق البيع والشراء المحلي

> **أولاد صقر · كفر صقر · نطاق 30 كم**

تطبيق ويب (PWA) للبيع والشراء في منطقتك، شبيه بـ OLX لكن محلي 100%.

---

## ✅ خطوة واحدة تفصلك عن التشغيل

### 1️⃣ ضع بيانات Firebase الخاصة بك

افتح ملف [`firebase.js`](./firebase.js) وابحث عن هذا القسم:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

استبدله ببياناتك من:
**Firebase Console → Project Settings → Your Apps → Web App → firebaseConfig**

---

## 🔥 إعداد Firebase (مرة واحدة)

### في Firebase Console:

1. **Authentication** → Sign-in method → فعّل **Google**
2. **Firestore Database** → Create database → Start in **test mode**
3. **Storage** → Get started

### ضع قواعد الأمان:

- **Firestore Rules**: انسخ محتوى [`firestore.rules`](./firestore.rules)
- **Storage Rules**: انسخ محتوى [`storage.rules`](./storage.rules)

---

## 🚀 النشر على Vercel

```bash
# 1. رفع المشروع على GitHub
git init
git add .
git commit -m "first commit"
git push

# 2. اربط Vercel بـ GitHub من vercel.com
# 3. اختر المشروع → Deploy
# سيعطيك رابط مجاني زي: souq-saqr.vercel.app
```

---

## 📁 هيكل الملفات

```
doc app/
├── index.html          ← الصفحة الرئيسية
├── style.css           ← التصميم الكامل
├── app.js              ← المنطق الرئيسي
├── firebase.js         ← ⚠️ ضع بياناتك هنا
├── manifest.json       ← PWA (تثبيت على الهاتف)
├── sw.js               ← Service Worker
├── firestore.rules     ← قواعد أمان قاعدة البيانات
├── storage.rules       ← قواعد أمان التخزين
└── README.md           ← هذا الملف
```

---

## ⭐ المميزات

- 🔐 تسجيل دخول بـ Google
- 📍 فلترة الإعلانات بالموقع الجغرافي (30 كم)
- 📸 رفع حتى 5 صور لكل إعلان
- 💰 بيع بسعر ثابت أو مزاد
- 🔨 نظام مزاد في التعليقات مع عد تنازلي
- ❤️ لايك وشير لكل إعلان
- 💬 تعليقات في الوقت الحقيقي
- 📱 PWA (يعمل كتطبيق موبايل)
- 🆓 مجاني 100% مع Firebase + Vercel

---

## 💡 خطوات مستقبلية

- [ ] إشعارات Push للمزايدات الجديدة
- [ ] شات داخلي بين البائع والمشتري
- [ ] تقييم البائعين
- [ ] نظام "تم البيع"
- [ ] تصفية بالسعر والمسافة
