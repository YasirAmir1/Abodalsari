/**
 * Serverless API: /api/manage-user
 * Runtime: Node.js (Vercel Serverless Function)
 * Manages Firebase Auth user accounts and userRoles documents.
 * Requires Admin ID Token for authorization.
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin once using environment variables
function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Handle newline escapes in private key
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'طريقة الطلب غير مسموح بها' });
  }

  const app = getAdminApp();
  if (!app) {
    return res.status(503).json({
      error: 'متغيرات بيئة Firebase Admin غير متوفرة على الخادم (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'جلسة العمل منتهية أو غير مصرح بها. يرجى تسجيل الدخول مجدداً.' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'رمز الجلسة غير صالح أو منتهي الصلاحية.' });
  }

  // Verify caller is admin via userRoles collection
  const db = admin.firestore();
  try {
    const callerDoc = await db.collection('userRoles').doc(decodedToken.uid).get();
    const callerData = callerDoc.data();
    const isAdmin = callerData && (callerData.role === 'admin' || callerData.role === 'أدمن' || callerData.role === 'مدير رئيسي');
    if (!isAdmin) {
      return res.status(403).json({ error: 'صلاحية غير كافية: هذا الإجراء مخصص لمدير النظام فقط.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في التحقق من صلاحيات الحساب.' });
  }

  const { action, userData } = req.body || {};

  if (!action || !userData) {
    return res.status(400).json({ error: 'بيانات الطلب غير مكتملة (action, userData).' });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;

  try {
    // 1. CREATE USER
    if (action === 'create') {
      const { username, password, displayName, role, agentName, agentCode } = userData;

      if (!username || !password || username.length < 3 || password.length < 6) {
        return res.status(400).json({ error: 'اسم الحساب يجب أن يكون 3 أحرف على الأقل، وكلمة المرور 6 أحرف على الأقل.' });
      }

      const email = `${username.toLowerCase()}@${projectId}.firebaseapp.com`;

      const newUser = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || username,
        disabled: false
      });

      // Save role doc
      await db.collection('userRoles').doc(newUser.uid).set({
        uid: newUser.uid,
        username: username.toLowerCase(),
        displayName: displayName || username,
        role: role || 'agent',
        agentName: agentName || '',
        agentCode: agentCode || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح',
        user: {
          uid: newUser.uid,
          username: username.toLowerCase(),
          displayName: displayName || username,
          role: role || 'agent',
          agentName: agentName || '',
          agentCode: agentCode || ''
        }
      });
    }

    // 2. UPDATE USER
    if (action === 'update') {
      const { uid, username, password, displayName, role, agentName, agentCode } = userData;
      if (!uid) {
        return res.status(400).json({ error: 'معرف المستخدم (UID) مطلوب للتحديث.' });
      }

      const updatePayload = {};
      if (displayName) updatePayload.displayName = displayName;
      if (password && password.length >= 6) updatePayload.password = password;
      if (username) {
        updatePayload.email = `${username.toLowerCase()}@${projectId}.firebaseapp.com`;
      }

      if (Object.keys(updatePayload).length > 0) {
        await admin.auth().updateUser(uid, updatePayload);
      }

      // Update Firestore userRoles
      await db.collection('userRoles').doc(uid).set({
        uid,
        username: username ? username.toLowerCase() : '',
        displayName: displayName || '',
        role: role || 'agent',
        agentName: agentName || '',
        agentCode: agentCode || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(200).json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح' });
    }

    // 3. DELETE USER
    if (action === 'delete') {
      const { uid } = userData;
      if (!uid) {
        return res.status(400).json({ error: 'معرف المستخدم (UID) مطلوب للحذف.' });
      }

      await admin.auth().deleteUser(uid);
      await db.collection('userRoles').doc(uid).delete();

      return res.status(200).json({ success: true, message: 'تم حذف الحساب بنجاح' });
    }

    return res.status(400).json({ error: 'نوع الإجراء المطلوب غير مدعوم.' });
  } catch (err) {
    console.error('manage-user error:', err);
    return res.status(500).json({ error: err.message || 'حدث خطأ أثناء معالجة حساب المستخدم' });
  }
}
