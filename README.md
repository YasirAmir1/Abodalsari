# نظام الساري للبث الأرضي (Al-Sari Terrestrial Broadcast)

نظام متكامل لإدارة مراكز بث واستقبال القنوات الأرضية في العراق، يدعم إدارة المبيعات، الوكلاء المعتمدين، الديون والذمم المالية، بيانات المشتركين، أجهزة الاستقبال والباركود، وجدولة الأسعار بالدينار العراقي (د.ع).

---

## 🚀 المميزات الرئيسية
- **واجهة عربية بالكامل (RTL)** متوافقة مع الهوية البصرية الزرقاء الهادئة مع دعم الوضع الليلي والنهاري (◐).
- **تطبيق ويب تقدمي (PWA)**: قابل للتثبيت كبرنامج مستقل على الهاتف أو الحاسوب، ويدعم العمل بدون إنترنت (Offline Cache First).
- **قاعدة بيانات سحابية متزامنة (Firebase Firestore + Auth)** مع تخزين محلي فوري على المتصفح عبر المفتاح `sari-app-v1`.
- **تجربتان مستقلتان (RBAC)**:
  - **لوحة الأدمن الرئيسي**: إدارة المبيعات والوكلاء والديون والباركود والتقارير والأسعار والمستخدمين.
  - **لوحة الوكيل الميداني**: متابعة رصيد الديون والمبيعات الخاصة به وتقديم طلبات بيع وتجديد الاشتراكات لاعتمادها من الأدمن.
- **توليد وطباعة الباركود (16 خانة)** وبطاقات QR مع خيارات أحجام الطباعة عالية الدقة (220px, 280px, 340px) باللون الأسود النقي.
- **تصدير واستيراد Excel (SheetJS)** لبيانات المبيعات والمشتركين والديون، مع مسح الباركود بالكاميرا أو أجهزة الـ USB السلكية.
- **ربط مباشر مع WhatsApp** للأرقام العراقية بالصيغة الدولية (+964).

---

## 🛠️ التشغيل المحلي (Local Run)

### الخيار 1: باستخدام سيرفر بايثون البسيط
```bash
# افتح مجلد المشروع في الطرفية:
python -m http.server 8000

# ثم افتح المتصفح على:
# http://localhost:8000
```

### الخيار 2: باستخدام Node.js و Vite
```bash
# تثبيت الحزم
npm install

# تشغيل سيرفر التطوير المحلي على المنفذ 3000
npm run dev
```

---

## 📱 دليل تثبيت التطبيق كـ PWA عبر HTTPS

يعمل التطبيق كبرنامج مستقل بمجرد استضافته على خادم يدعم اتصال SSL/HTTPS:

### 1. هواتف الأندرويد (Android - Chrome / Samsung Internet):
1. افتح رابط التطبيق في متصفح Chrome.
2. ستظهر نافذة تلقائية في الأسفل "إضافة إلى الشاشة الرئيسية" أو اضغط على زر **(⇩)** في شريط الأدوات العلوي.
3. أو اضغط على قائمة المتصفح (ثلاث نقاط) واختر **"تثبيت التطبيق"** (Install App).
4. سيظهر تطبيق "الساري" كأيقونة مستقلة في قائمة التطبيقات ويدعم الإشعارات والعمل دون شريط المتصفح.

### 2. هواتف الآيفون (iOS - Safari):
1. افتح رابط التطبيق في متصفح **Safari**.
2. اضغط على زر **المشاركة (Share)** أسفل الشاشة.
3. مرر لأسفل واختر **"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)**.
4. اضغط على "إضافة" (Add) لتثبيت أيقونة التطبيق على شاشة هاتفك الرئيسية.

### 3. أجهزة الكمبيوتر المحمول والديسكتوب (Windows / Mac / Linux - Chrome & Edge):
1. ستلاحظ ظهور أيقونة كمبيوتر صغيرة مع سهم تحميل في شريط العناوين (أو اضغط زر ⇩ في التطبيق).
2. اضغط على **"تثبيت"** (Install).
3. سيعمل التطبيق في نافذة مستقلة مع إمكانية وضعه في شريط المهام (Taskbar).

---

## 🔥 دليل إعداد وتوصيل Firebase (FIREBASE_SETUP)

### 1. إنشاء المشروع وتفعيل المصادقة (Auth):
1. توجه إلى [Firebase Console](https://console.firebase.google.com).
2. أنشئ مشروعاً جديداً باسم `alsari-broadcast`.
3. انتقل إلى قسم **Authentication** واضغط على **Get Started**.
4. فعّل موفر تسجيل الدخول **Email/Password**.

### 2. إنشاء قاعدة بيانات Firestore:
1. توجه إلى قسم **Firestore Database** واضغط على **Create Database**.
2. اختر الموقع الأقرب (مثل `eur3` أو `me-central1` أو `europe-west1`).
3. اختر وضع البداية بنمط الإنتاج (Production Mode).

### 3. نشر قواعد الحماية (Security Rules):
انسخ محتويات الملف `firestore.rules` والصقها في تبويب **Rules** في Firestore واضغط **Publish**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && 
        (get(/databases/$(database)/documents/userRoles/$(request.auth.uid)).data.role in ['admin', 'أدمن', 'مدير رئيسي']);
    }
    match /userRoles/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow write: if false;
    }
    match /appData/{collectionId}/records/{docId} {
      allow read, write: if isAdmin();
    }
    match /agentData/{uid}/{document=**} {
      allow read, write: if request.auth != null && (request.auth.uid == uid || isAdmin());
    }
    match /agentSubmissions/{uid}/items/{submissionId} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if isAdmin();
    }
  }
}
```

### 4. إنشاء الحساب الإداري الأول (Admin Bootstrapping):
1. من لوحة **Authentication** أضف مستخدماً بريدياً مثل: `admin@alsari-broadcast.firebaseapp.com` مع كلمة مرور قوية.
2. انسخ الـ **UID** الخاص بالمستخدم الذي تم إنشاؤه.
3. في Firestore، أنشئ مستنداً داخل المجموعة `userRoles` بالمعرف `UID` نفسه، وضع فيه الحقول التالية:
   - `uid`: المعرف المنسوخ
   - `username`: "admin"
   - `displayName`: "المدير العام"
   - `role`: "admin"
   - `agentName`: ""
   - `agentCode`: ""

### 5. إضافة إعدادات الويب (Web Config):
1. من إعدادات المشروع (Project Settings)، اختر إضافة تطبيق ويب (Web App `</>`).
2. انسخ كائن `firebaseConfig` والصقه إما في `firebase-config.js` أو مباشرة من داخل النظام بالنقر على زر الترس ⚙️ في الشريط العلوي للتطبيق.

---

## 🗄️ هيكلية قاعدة البيانات (Database Schema Documentation)

قاعدة البيانات مصممة لتأمين عزل كامل بين صلاحيات الأدمن والوكلاء مع سرعة فائقة في الاستعلام والمزامنة:

### 1. `userRoles/{uid}`
- `uid`: string (معرف المستخدم في Firebase Auth)
- `username`: string (اسم المستخدم الموحد بدون بريد)
- `displayName`: string (الاسم المعروض)
- `role`: string (`"admin"` أو `"agent"`)
- `agentName`: string (اسم الوكيل الميداني المرتبط)
- `agentCode`: string (رمز الوكيل مثل `"AG-001"`)

### 2. `appData/{collection}/records/{id}` (مجموعات المركز الإداري)
- **`agents`**:
  - `id`: string
  - `code`: string (مثل `"AG-001"`)
  - `name`: string
  - `phone`: string
  - `price`: number (سعر بيع الجهاز للوكيل)
- **`sales`**:
  - `id`: string
  - `code`: string (رمز الفاتورة مثل `"SR-10492"`)
  - `customerName`: string
  - `customerPhone`: string
  - `seller`: string (المركز الرئيسي أو اسم الوكيل)
  - `saleType`: string (`"جهاز جديد"` / `"تجديد اشتراك"` / `"فاتورة وكيل"`)
  - `deviceNumber`: string (رقم الجهاز أو تفاصيل الدفعة)
  - `subscriptionType`: string (`"اشتراك شهر واحد"` / `"اشتراك شهرين"` / `"اشتراك 3 أشهر"`)
  - `startDate`: string (YYYY-MM-DD)
  - `endDate`: string (YYYY-MM-DD)
  - `price`: number (السعر الإجمالي)
  - `paymentStatus`: string (`"تم التسديد"` أو `"دين"`)
  - `paymentMethod`: string (`"نقد"` أو `"دين"`)
  - `agentPaid`: number (المبلغ المسدد فعلياً)
- **`debts`**:
  - `id`: string
  - `saleId`: string
  - `saleCode`: string
  - `customerName`: string
  - `seller`: string
  - `totalAmount`: number
  - `paidAmount`: number
  - `remainingAmount`: number
  - `dueDate`: string
  - `notes`: string
- **`codes`**:
  - `id`: string
  - `number`: string (16 خانة، الرقم الأول لا يبدأ بـ 0)
  - `subscriberName`: string
  - `status`: string (`"مفعل"` / `"جديد"` / `"غير مفعل"`)
- **`subscribers`**:
  - `id`: string
  - `name`: string
  - `phone`: string
  - `deviceNumber`: string (نص محفوظ بدقة الأرقام)
  - `owner`: string
  - `activationDate`: string
  - `expiryDate`: string
  - `status`: string (`"فعال"` أو `"غير فعال"`)
- **`pricing`**:
  - مستند `default` يحتوي أسعار المركز وأسعار الوكلاء للأجهزة والاشتراكات.
- **`agentSettlements`**:
  - `id`: string
  - `date`: string
  - `agentName`: string
  - `linesCount`: number
  - `dueAmount`: number
  - `receivedAmount`: number
  - `variance`: number (الفارق الإيجابي أو السلبي)

### 3. `agentSubmissions/{uid}/items/{id}` (طلبات الوكلاء المعلقة)
- طلبات اعتماد عمليات البيع والتجديد المرسلة من الوكلاء في الميدان قبل تسجيلها رسمياً وتفعيل الاشتراك.

---
---

## 📊 المراقبة وتتبع الأخطاء في الوقت الفعلي (Monitoring & Analytics)

للحفاظ على أعلى مستوى من الاستقرار والأداء المالي السلس:
1. **Vercel Web Analytics & Speed Insights**:
   مفعلة تلقائياً لقياس سرعة تحميل الشاشات، استجابة قاعدة البيانات، وأوقات تفاعل المستخدم (Core Web Vitals).
2. **تتبع أخطاء المتصفح (Error Tracking)**:
   يمكن إضافة مكتبة **Sentry** عبر وضع السطر التالي في `index.html` قبل السكربتات لتسجيل أي خطأ استثنائي أو انقطاع اتصال لحظي:
   ```html
   <script src="https://browser.sentry-cdn.com/7.x/bundle.min.js"></script>
   ```
3. **مراقبة عمليات Firebase Console**:
   توفر لوحة تحكم Firestore مقاييس حية لعدد القراءات والكتابات اليومية، واستهلاك الحصص المجانية وتنبيهات الأمان.
