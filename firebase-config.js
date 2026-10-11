/**
 * Firebase Public Web Configuration
 * Al-Sari Terrestrial Broadcast Management System
 * الساري للبث الأرضي
 */

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "gen-lang-client-0813045373",
  appId: "1:792941967871:web:82e0118def102f59c4cfca",
  apiKey: "AIzaSyC-XfUAR2_Yy1QI6auVeNZzdvMnUiE0M9w",
  authDomain: "gen-lang-client-0813045373.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-0c2caad1-c1ee-4aef-b0cc-d86c54f7310d",
  storageBucket: "gen-lang-client-0813045373.firebasestorage.app",
  messagingSenderId: "792941967871",
  measurementId: ""
};

// Check if localStorage has saved custom config
function getStoredFirebaseConfig() {
  try {
    const saved = localStorage.getItem('sari_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Automatically purge legacy/invalid project configurations
      if (!parsed || parsed.projectId === 'alsari-broadcast' || !parsed.apiKey || parsed.apiKey.includes('bHTns9GolVArrT3qnCNUOsKkK1FGFAA')) {
        localStorage.removeItem('sari_firebase_config');
        return DEFAULT_FIREBASE_CONFIG;
      }
      if (parsed.apiKey && parsed.apiKey.length > 5) {
        return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Error reading stored Firebase config', e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

window.FIREBASE_CONFIG = getStoredFirebaseConfig();

window.saveFirebaseConfig = function(config) {
  try {
    localStorage.setItem('sari_firebase_config', JSON.stringify(config));
    window.FIREBASE_CONFIG = config;
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config', e);
    return false;
  }
};

window.isFirebaseConfigured = function() {
  const cfg = window.FIREBASE_CONFIG;
  return Boolean(cfg && cfg.apiKey && cfg.projectId && cfg.apiKey.length > 5);
};
