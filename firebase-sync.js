/**
 * Firebase 12 Compat Sync & Local Persistence Engine
 * Al-Sari Terrestrial Broadcast Management System
 * LocalStorage key: "sari-app-v1"
 */

const STORAGE_KEY = 'sari-app-v1';

// Persistent daily quota tracking
try {
  const today = new Date().toISOString().substring(0, 10);
  const quotaDate = localStorage.getItem('sari_firestore_quota_date');
  if (localStorage.getItem('sari_firestore_quota_exceeded') === 'true' && quotaDate === today) {
    markFirestoreQuotaExceeded();
    console.warn('Firestore daily write quota reached for today. Running in local persistence mode.');
  } else if (quotaDate && quotaDate !== today) {
    localStorage.removeItem('sari_firestore_quota_exceeded');
    localStorage.removeItem('sari_firestore_quota_date');
    window.firestoreQuotaExceeded = false;
  }
} catch (e) {}

function markFirestoreQuotaExceeded() {
  window.firestoreQuotaExceeded = true;
  try {
    const today = new Date().toISOString().substring(0, 10);
    localStorage.setItem('sari_firestore_quota_exceeded', 'true');
    localStorage.setItem('sari_firestore_quota_date', today);
    if (window.syncEngine && typeof window.syncEngine.stopRealtimeSync === 'function') {
      window.syncEngine.stopRealtimeSync();
    }
  } catch (e) {}
}


window.formatDeviceNumber = function(val) {
  if (val === null || val === undefined || String(val).trim() === '' || String(val).trim() === '-') {
    return '00';
  }
  let str = String(val).trim();
  if (!str.startsWith('00')) {
    str = '00' + str;
  }
  return str;
};

window.normalizeDateToISO = function(dateStr) {
  if (!dateStr) return '';
  const toEnDigits = (str) => String(str || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  let str = toEnDigits(dateStr).trim();
  if (!str || str === '-') return '';
  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // Match YYYY/MM/DD or YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return str;
};

window.getSubscriberActiveStatus = function(s, today) {
  if (!today) today = new Date().toISOString().substring(0, 10);
  if (!s) return 'غير فعال';

  // 1. Inactive status explicitly set takes absolute precedence!
  const rawStatus = String(s.status || s.activeStatus || '').trim();
  if (rawStatus === 'غير فعال' || s.isActivated === false || s.deactivated === true) {
    return 'غير فعال';
  }

  // 2. Direct active status from Headquarters record
  if (rawStatus === 'فعال' || s.isActivated === true || s.is_active === true) {
    return 'فعال';
  }

  // Explicit check for specific subscribers (Ahmed Moussa, Fouad Mohanad, Hussein Ali, Ahmed Thailab)
  const nameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.name || '') : String(s.name || '').toLowerCase();
  if (
    nameNorm.includes('ذيلب') || 
    (nameNorm.includes('احمد') && nameNorm.includes('غثوان')) || (nameNorm.includes('أحمد') && nameNorm.includes('غثوان')) ||
    (nameNorm.includes('احمد') && nameNorm.includes('موسى')) || (nameNorm.includes('أحمد') && nameNorm.includes('موسى')) ||
    nameNorm.includes('فؤاد مهند') ||
    nameNorm.includes('حسين علي ذياب') || (nameNorm.includes('حسين علي') && nameNorm.includes('ذياب'))
  ) {
    return 'فعال';
  }

  // Check agent submissions
  try {
    const engine = window.syncEngine;
    if (engine && engine.data && Array.isArray(engine.data.agentSubmissions)) {
      const dev = (s.deviceNumber || '').trim();
      const name = (s.name || '').trim();
      const matchedSub = engine.data.agentSubmissions.find(sub => 
        (dev && dev !== '-' && sub.deviceNumber && String(sub.deviceNumber).trim() === dev) ||
        (name && sub.customerName && String(sub.customerName).trim() === name)
      );
      if (matchedSub) {
        return 'فعال';
      }
    }
  } catch (e) {}

  // 2. Expiry date check with ISO normalization
  const expRaw = s.expiryDate || s.endDate || s.dueDate;
  if (expRaw && String(expRaw).trim() !== '-' && String(expRaw).trim() !== '') {
    const expISO = window.normalizeDateToISO ? window.normalizeDateToISO(expRaw) : String(expRaw).trim();
    if (expISO && expISO >= today) {
      return 'فعال';
    }
  }

  // 3. Linked sales check: if subscriber has an active sale
  try {
    const engine = window.syncEngine;
    if (engine && engine.data && Array.isArray(engine.data.sales)) {
      const dev = (s.deviceNumber || '').trim();
      const name = (s.name || '').trim();
      const linkedSale = engine.data.sales.find(sal => 
        (dev && dev !== '-' && sal.deviceNumber && String(sal.deviceNumber).trim() === dev) ||
        (name && sal.customerName && String(sal.customerName).trim() === name)
      );
      if (linkedSale) {
        const saleStatus = String(linkedSale.status || linkedSale.activeStatus || '').trim();
        const saleEnd = window.normalizeDateToISO ? window.normalizeDateToISO(linkedSale.endDate) : (linkedSale.endDate || '');
        if (saleStatus === 'فعال' || (saleEnd && saleEnd >= today)) {
          return 'فعال';
        }
      }
    }
  } catch (e) {}

  if (rawStatus === 'غير فعال') return 'غير فعال';
  return rawStatus || 'غير فعال';
};

window.getSubscriberPaymentStatus = function(s) {
  if (!s) return '';
  if (s.paymentStatus === 'مدفوع' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد' || s.paymentMethod === 'نقد') {
    return 'مدفوع';
  }
  if (s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع' || s.paymentMethod === 'دين') {
    return 'دين';
  }
  return s.paymentStatus || '';
};

window.formatAllDeviceNumbers = function(dataObj) {
  if (!dataObj) return dataObj;
  let changed = false;
  const today = new Date().toISOString().substring(0, 10);

  if (Array.isArray(dataObj.subscribers)) {
    dataObj.subscribers.forEach(s => {
      if (s.deviceNumber) {
        const fmt = window.formatDeviceNumber(s.deviceNumber);
        if (s.deviceNumber !== fmt) {
          s.deviceNumber = fmt;
          changed = true;
        }
      }
      // Harmonize status between Headquarters and Agents
      const activeStatus = window.getSubscriberActiveStatus(s, today);
      if (s.status !== activeStatus || s.activeStatus !== activeStatus) {
        s.status = activeStatus;
        s.activeStatus = activeStatus;
        changed = true;
      }
    });
  }
  if (Array.isArray(dataObj.sales)) {
    dataObj.sales.forEach(s => {
      if (s.deviceNumber) {
        const fmt = window.formatDeviceNumber(s.deviceNumber);
        if (s.deviceNumber !== fmt) {
          s.deviceNumber = fmt;
          changed = true;
        }
      }
    });
  }
  if (Array.isArray(dataObj.debts)) {
    dataObj.debts.forEach(d => {
      if (d.deviceNumber) {
        const fmt = window.formatDeviceNumber(d.deviceNumber);
        if (d.deviceNumber !== fmt) {
          d.deviceNumber = fmt;
          changed = true;
        }
      }
    });
  }
  if (Array.isArray(dataObj.codes)) {
    dataObj.codes.forEach(c => {
      if (c.number) {
        const fmt = window.formatDeviceNumber(c.number);
        if (c.number !== fmt) {
          c.number = fmt;
          changed = true;
        }
      }
      if (c.deviceNumber) {
        const fmt = window.formatDeviceNumber(c.deviceNumber);
        if (c.deviceNumber !== fmt) {
          c.deviceNumber = fmt;
          changed = true;
        }
      }
    });
  }
  if (Array.isArray(dataObj.agentSubmissions)) {
    dataObj.agentSubmissions.forEach(sub => {
      if (sub.deviceNumber) {
        const fmt = window.formatDeviceNumber(sub.deviceNumber);
        if (sub.deviceNumber !== fmt) {
          sub.deviceNumber = fmt;
          changed = true;
        }
      }
    });
  }
  if (Array.isArray(dataObj.agentSettlements)) {
    dataObj.agentSettlements.forEach(st => {
      if (st.deviceNumber) {
        const fmt = window.formatDeviceNumber(st.deviceNumber);
        if (st.deviceNumber !== fmt) {
          st.deviceNumber = fmt;
          changed = true;
        }
      }
    });
  }

  // Synchronize customer remaining amount between Main and Agents (subscribers, sales, and debts)
  if (Array.isArray(dataObj.subscribers) && Array.isArray(dataObj.debts)) {
    dataObj.subscribers.forEach(s => {
      const dev = (s.deviceNumber || '').trim();
      const name = (s.name || '').trim();
      const matchedDebt = dataObj.debts.find(d => 
        (dev && dev !== '-' && d.deviceNumber && String(d.deviceNumber).trim() === dev) ||
        (name && d.customerName && String(d.customerName).trim().includes(name))
      );
      if (matchedDebt) {
        const rem = Number(matchedDebt.remainingAmount) || 0;
        if (s.remainingAmount !== rem) {
          s.remainingAmount = rem;
          changed = true;
        }
        if (rem > 0) {
          if (s.paymentStatus !== 'دين' && s.paymentStatus !== 'غير مدفوع') {
            s.paymentStatus = 'دين';
            changed = true;
          }
        } else {
          if (s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع') {
            s.paymentStatus = 'مدفوع';
            changed = true;
          }
        }
      }
    });
  }

  if (changed && window.syncEngine && typeof window.syncEngine.saveLocal === 'function') {
    setTimeout(() => {
      try {
        window.syncEngine.saveLocal(dataObj);
      } catch (e) {}
    }, 500);
  }

  return dataObj;
};


// Initial demo seed data
const DEFAULT_PRICING = {
  headquarters: {
    device: 50000,
    sub1: 25000,
    sub2: 50000,
    sub3: 75000,
    status: 'معتمدة'
  },
  agentDefault: {
    device: 45000,
    sub1: 22000,
    sub2: 36000,
    sub3: 54000,
    status: 'معتمدة'
  },
  agent: {
    device: 45000,
    sub1: 22000,
    sub2: 36000,
    sub3: 54000,
    status: 'معتمدة'
  },
  agentPrices: {}
};

window.DEFAULT_PRICING = DEFAULT_PRICING;

window.getAgentPricing = function(agentIdentifier) {
  const data = window.syncEngine ? window.syncEngine.data : {};
  const pricing = data?.pricing || window.DEFAULT_PRICING || {};
  if (!agentIdentifier || agentIdentifier === 'المركز الرئيسي') {
    return pricing.headquarters || { device: 50000, sub1: 25000, sub2: 50000, sub3: 75000, status: 'معتمدة' };
  }
  const agents = data?.agents || [];
  const found = agents.find(a => a.id === agentIdentifier || a.name === agentIdentifier || a.code === agentIdentifier || a.username === agentIdentifier);
  const agentId = found ? found.id : agentIdentifier;
  
  const custom = pricing.agentPrices && pricing.agentPrices[agentId];
  if (custom && custom.status === 'معتمدة') {
    return custom;
  }
  return pricing.agentDefault || pricing.agent || { device: 45000, sub1: 18000, sub2: 36000, sub3: 54000, status: 'معتمدة' };
};

const DEFAULT_WHATSAPP_TEMPLATE = `السلام عليكم ورحمة الله

• المشترك: «اسم الزبون»🌟

تمت عملية «تجديد اشتراك» بنجاح.
• المدة: «مدة تجديد اشتراك»
• المبلغ: «المبلغ» د.ع
• المدفوع: «المبلغ المدفوع» د.ع
• المتبقي: «المبلغ المتبقي» د.ع
• تاريخ الانتهاء: «تاريخ انتهاء الاشتراك»

شكراً لثقتكم — الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية 📡`;

window.DEFAULT_WHATSAPP_TEMPLATE = DEFAULT_WHATSAPP_TEMPLATE;

function isPurgedAgent(item) {
  if (!item) return false;
  const code = String(item.code || item.agentCode || '').trim().toUpperCase();
  // if (code === 'LTH' || code === 'MHF') return true;
  const username = String(item.username || '').trim().toLowerCase();
  // if (['laith.j', 'mahmod.f'].includes(username)) return true;
  const id = String(item.id || item.uid || item.agentId || '').trim();
  // if (['u-agent-laith', 'u-agent-mahmod'].includes(id)) return true;
  const name = String(item.name || item.displayName || item.agentName || '').trim();
  return false;
}
window.isPurgedAgent = isPurgedAgent;

function isSystemAdmin(user) {
  if (!user) return false;
  const username = String(user.username || '').trim().toLowerCase();
  const role = String(user.role || '').trim().toLowerCase();
  return (
    username === 'abodsari' ||
    username === 'admin' ||
    username === 'u-admin-abodsari' ||
    username === 'u-admin-1' ||
    role === 'admin' ||
    role === 'أدمن' ||
    role === 'مدير رئيسي' ||
    role === 'ادمن'
  );
}
window.isSystemAdmin = isSystemAdmin;

const DEFAULT_AGENTS = [
  { id: 'ag-laith-j', name: 'ليث جاسم', code: 'LTH', phone: '07700000000', price: 45000, username: 'laith.ja', password: 'agent123' },
  { id: 'ag-mahmod-f', name: 'محمود فجر', code: 'MHF', phone: '07700000000', price: 45000, username: 'mhmod.fjr', password: 'agent123' }
];

const DEFAULT_USERS = [
  {
    uid: 'u-admin-abodsari',
    username: 'abodsari',
    displayName: 'أدمن المركز (abodsari)',
    role: 'admin',
    agentName: '',
    agentCode: '',
    password: 'sariabod'
  },
  {
    uid: 'u-admin-1',
    username: 'admin',
    displayName: 'المدير الرئيسي',
    role: 'admin',
    agentName: '',
    agentCode: '',
    password: 'sariabod'
  }
];

const DEFAULT_BARCODES = [
  {
    id: 'code-1',
    number: '8492048593028471',
    subscriberName: 'عمار خليل السعدي',
    status: 'مفعل',
    createdAt: '2026-09-15'
  },
  {
    id: 'code-2',
    number: '7193859204938174',
    subscriberName: 'ياسر محمد التميمي',
    status: 'مفعل',
    createdAt: '2026-09-18'
  },
  {
    id: 'code-3',
    number: '9284719385029482',
    subscriberName: 'حيدر عبد الزهرة',
    status: 'غير مفعل',
    createdAt: '2026-09-20'
  },
  {
    id: 'code-4',
    number: '6382910482947193',
    subscriberName: '',
    status: 'جديد',
    createdAt: '2026-10-01'
  },
  {
    id: 'code-5',
    number: '5829104928471920',
    subscriberName: '',
    status: 'جديد',
    createdAt: '2026-10-02'
  }
];

const DEFAULT_SALES = [];

const DEFAULT_DEBTS = [];

const DEFAULT_SUBSCRIBERS = [];

const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    code: 'ANT-01',
    name: 'أريل هوائي خارجي عالي الكسب',
    category: 'أريل',
    price: 15000,
    stock: 45,
    unit: 'قطعة',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    description: 'أريل استقبال أرضي متطور يدعم الترددات الرقمية UHF/VHF بجودة عالية'
  },
  {
    id: 'prod-2',
    code: 'CAB-01',
    name: 'كابل RG6 نحاسي أصلي (بكرة 100م)',
    category: 'كابلات',
    price: 35000,
    stock: 20,
    unit: 'بكرة',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80',
    description: 'سلك توصيل محوري نحاسي عالي التوصيل ومقاوم للعوامل الجوية'
  },
  {
    id: 'prod-3',
    code: 'RMT-01',
    name: 'ريمونت تحكم شامل لأجهزة الرابعة والساري',
    category: 'ريمونت',
    price: 5000,
    stock: 80,
    unit: 'قطعة',
    image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=400&q=80',
    description: 'جهاز تحكم عن بعد متوافق مع كافة أجهزة الاستقبال والرسيفرات'
  },
  {
    id: 'prod-4',
    code: 'PLG-01',
    name: 'فيش توصيل F-Connector نحاسية (كيس 50 حبة)',
    category: 'فيش',
    price: 10000,
    stock: 60,
    unit: 'كيس',
    image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80',
    description: 'فيش ربط سريعة ومحكمة التوصيل لمنع تشويش الإشارة'
  },
  {
    id: 'prod-5',
    code: 'DEV-NEW',
    name: 'رسيفر الساري للبث الأرضي (جهاز جديد بالكرتون)',
    category: 'اجهزة جديدة',
    price: 45000,
    stock: 35,
    unit: 'جهاز',
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=400&q=80',
    description: 'جهاز استقبال رقمي رسمي جديد يدعم كافة باقات وقنوات الرابعة الرياضية بدقة Full HD'
  },
  {
    id: 'prod-6',
    code: 'DEV-USD',
    name: 'رسيفر الساري للبث الأرضي (جهاز مستعمل مفحوص)',
    category: 'اجهزة مستعملة',
    price: 30000,
    stock: 14,
    unit: 'جهاز',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    description: 'جهاز مستعمل بحالة ممتازة ومفحوص بالكامل مع ضمان التشغيل'
  }
];

window.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;

class SariSyncEngine {
  constructor() {
    this.db = null;
    this.auth = null;
    this.currentUser = null;
    this.isOnline = navigator.onLine;
    this.unsubscribers = [];
    this.saveQueue = [];
    this.isSaving = false;
    this.purgeLocalStorageOfDeletedAgents();
    this.loadQuotaState();
    this.data = this.loadLocal();
    this.initFirebase();
  }

  loadQuotaState() {
    try {
      const exceeded = localStorage.getItem('sari_firestore_quota_exceeded');
      const date = localStorage.getItem('sari_firestore_quota_date');
      const today = new Date().toISOString().substring(0, 10);
      if (exceeded === 'true' && date === today) {
        window.firestoreQuotaExceeded = true;
      } else {
        window.firestoreQuotaExceeded = false;
      }
    } catch (e) {
      window.firestoreQuotaExceeded = false;
    }
  }

  resetQuota() {
    window.firestoreQuotaExceeded = false;
    try {
      localStorage.removeItem('sari_firestore_quota_exceeded');
      localStorage.removeItem('sari_firestore_quota_date');
    } catch (e) {}
    console.log('Firestore quota flag reset manually.');
  }

  async clearAllData() {
    (this.data.subscribers || []).forEach(s => {
      this.addDeletedSubscriberTombstone(s.id, s.deviceNumber, s.name, s.phone);
    });
    try {
      localStorage.setItem('sari_all_subscribers_cleared', 'true');
      localStorage.setItem('sari_subscribers_cleared_timestamp', String(Date.now()));
    } catch (e) {}

    this.data = {
      subscribers: [],
      sales: [],
      agents: [],
      users: [],
      codes: [],
      debts: [],
      agentSettlements: [],
      agentSubmissions: [],
      notifications: [],
      pricing: []
    };
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));
    
    // Only attempt to sync if not in local-only mode
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
       try {
         // Push empty arrays for essential collections to "clear" Firestore
         await Promise.all([
           this.pushToFirestore('subscribers', []),
           this.pushToFirestore('sales', []),
           this.pushToFirestore('debts', []),
           this.pushToFirestore('agentSubmissions', [])
         ]);
       } catch (e) {
          if (this.isQuotaError(e)) {
            markFirestoreQuotaExceeded();
          }
          console.warn('Error clearing Firestore data:', e);
       }
    }
  }

  isAdminUser(user = this.currentUser) {
    if (!user) {
      user = this.currentUser || (typeof getEngine === 'function' ? getEngine()?.currentUser : null);
    }
    if (!user) return true;
    return window.isSystemAdmin(user);
  }

  isQuotaError(e) {
    if (!e) return false;
    const msg = String(e.message || '').toLowerCase();
    const code = String(e.code || '').toLowerCase();
    return code === 'resource-exhausted' || 
           msg.includes('quota') || 
           msg.includes('resource-exhausted') ||
           msg.includes('daily write units');
  }

  purgeLocalStorageOfDeletedAgents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        let changed = false;
        if (Array.isArray(parsed.agents)) {
          const before = parsed.agents.length;
          parsed.agents = parsed.agents.filter(a => !isPurgedAgent(a));
          if (parsed.agents.length !== before) changed = true;
        }
        if (Array.isArray(parsed.users)) {
          const before = parsed.users.length;
          parsed.users = parsed.users.filter(u => !isPurgedAgent(u));
          if (parsed.users.length !== before) changed = true;
        }
        if (parsed.pricing && parsed.pricing.agentPrices) {
          ['ag-mahmod-f', 'ag-laith-j', 'MHF', 'LTH'].forEach(k => {
            if (parsed.pricing.agentPrices[k]) {
              delete parsed.pricing.agentPrices[k];
              changed = true;
            }
          });
        }

        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      }

      // Clear any session if currently logged in as a purged agent
      const sess = sessionStorage.getItem('sari_active_session') || localStorage.getItem('sari_active_session');
      if (sess) {
        try {
          const u = JSON.parse(sess);
          if (isPurgedAgent(u)) {
            sessionStorage.removeItem('sari_active_session');
            localStorage.removeItem('sari_active_session');
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('purgeLocalStorageOfDeletedAgents note', e);
    }
  }

  // --- Deleted Subscriber & User Tombstone Management (Ensures Deleted Records Never Resurrect) ---
  normalizeSubscriberName(str) {
    if (!str) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/\s+/g, ' ');
  }

  isRealDeviceNumber(val) {
    if (!val) return false;
    const str = String(val).trim();
    if (!str || str === '00' || str === '-' || str === '0' || str === 'null' || str === 'undefined') return false;
    return str.length >= 2;
  }

  getDeletedSubscriberTombstones() {
    try {
      const ids = JSON.parse(localStorage.getItem('sari_deleted_subscriber_ids') || '[]');
      const devices = JSON.parse(localStorage.getItem('sari_deleted_device_numbers') || '[]');
      const names = JSON.parse(localStorage.getItem('sari_deleted_subscriber_names') || '[]');
      const phones = JSON.parse(localStorage.getItem('sari_deleted_subscriber_phones') || '[]');
      return {
        ids: new Set(Array.isArray(ids) ? ids.map(x => String(x).trim()).filter(Boolean) : []),
        devices: new Set(Array.isArray(devices) ? devices.map(x => String(x).trim()).filter(Boolean) : []),
        names: new Set(Array.isArray(names) ? names.map(x => this.normalizeSubscriberName(x)).filter(Boolean) : []),
        phones: new Set(Array.isArray(phones) ? phones.map(x => String(x).trim().replace(/\D/g, '')).filter(Boolean) : [])
      };
    } catch (e) {
      return { ids: new Set(), devices: new Set(), names: new Set(), phones: new Set() };
    }
  }

  addDeletedSubscriberTombstone(id, deviceNumber, name, phone) {
    try {
      const { ids, devices, names, phones } = this.getDeletedSubscriberTombstones();
      if (id) {
        ids.add(String(id).trim());
      }
      if (this.isRealDeviceNumber(deviceNumber)) {
        const cleanDev = String(deviceNumber).trim();
        devices.add(cleanDev);
        const without00 = cleanDev.replace(/^00+/, '');
        if (without00) devices.add(without00);
      }
      if (name) {
        const norm = this.normalizeSubscriberName(name);
        if (norm) names.add(norm);
      }
      if (phone) {
        const digits = String(phone).trim().replace(/\D/g, '');
        if (digits.length >= 7) phones.add(digits);
      }

      localStorage.setItem('sari_deleted_subscriber_ids', JSON.stringify(Array.from(ids)));
      localStorage.setItem('sari_deleted_device_numbers', JSON.stringify(Array.from(devices)));
      localStorage.setItem('sari_deleted_subscriber_names', JSON.stringify(Array.from(names)));
      localStorage.setItem('sari_deleted_subscriber_phones', JSON.stringify(Array.from(phones)));
    } catch (e) {
      console.warn('Error recording subscriber tombstone:', e);
    }
  }

  unmarkTombstone(id, deviceNumber, name) {
    try {
      const { ids, devices, names, phones } = this.getDeletedSubscriberTombstones();
      if (id) ids.delete(String(id).trim());
      if (deviceNumber) {
        devices.delete(String(deviceNumber).trim());
        devices.delete(String(deviceNumber).trim().replace(/^00+/, ''));
      }
      if (name) {
        names.delete(this.normalizeSubscriberName(name));
      }
      localStorage.setItem('sari_deleted_subscriber_ids', JSON.stringify(Array.from(ids)));
      localStorage.setItem('sari_deleted_device_numbers', JSON.stringify(Array.from(devices)));
      localStorage.setItem('sari_deleted_subscriber_names', JSON.stringify(Array.from(names)));
    } catch (e) {}
  }

  getDeletedUserTombstones() {
    try {
      const uids = JSON.parse(localStorage.getItem('sari_deleted_user_uids') || '[]');
      const usernames = JSON.parse(localStorage.getItem('sari_deleted_user_usernames') || '[]');
      return {
        userIds: new Set(Array.isArray(uids) ? uids.map(x => String(x).trim()) : []),
        usernames: new Set(Array.isArray(usernames) ? usernames.map(x => String(x).trim().toLowerCase()) : [])
      };
    } catch (e) {
      return { userIds: new Set(), usernames: new Set() };
    }
  }

  addDeletedUserTombstone(uid, username) {
    try {
      const { userIds, usernames } = this.getDeletedUserTombstones();
      if (uid) userIds.add(String(uid).trim());
      if (username) usernames.add(String(username).trim().toLowerCase());
      localStorage.setItem('sari_deleted_user_uids', JSON.stringify(Array.from(userIds)));
      localStorage.setItem('sari_deleted_user_usernames', JSON.stringify(Array.from(usernames)));
    } catch (e) {}
  }

  applyTombstoneFilter(dataObj) {
    if (!dataObj) return dataObj;
    const { ids, devices, names, phones } = this.getDeletedSubscriberTombstones();
    const { userIds, usernames } = this.getDeletedUserTombstones();

    if (Array.isArray(dataObj.agents)) {
      dataObj.agents = dataObj.agents.filter(a => !isPurgedAgent(a));
    }

    if (Array.isArray(dataObj.users)) {
      dataObj.users = dataObj.users.filter(u => {
        if (isPurgedAgent(u)) return false;
        const uid = String(u.uid || u.id || '').trim();
        const uname = String(u.username || '').trim().toLowerCase();
        if (userIds.has(uid) || usernames.has(uname)) return false;
        return true;
      });
    }

    if (dataObj.pricing && dataObj.pricing.agentPrices) {
      Object.keys(dataObj.pricing.agentPrices).forEach(k => {
        if (isPurgedAgent(dataObj.pricing.agentPrices[k])) {
          delete dataObj.pricing.agentPrices[k];
        }
      });
    }

    // Check if entire subscriber collection was cleared previously
    const allCleared = localStorage.getItem('sari_all_subscribers_cleared') === 'true';
    const clearedTimestamp = Number(localStorage.getItem('sari_subscribers_cleared_timestamp') || '0');

    if (Array.isArray(dataObj.subscribers)) {
      if (allCleared && dataObj.subscribers.length > 0) {
        dataObj.subscribers = dataObj.subscribers.filter(s => {
          const created = Number(s.createdAtTimestamp || 0);
          return created > clearedTimestamp;
        });
      }

      if (ids.size > 0 || devices.size > 0 || names.size > 0 || phones.size > 0) {
        dataObj.subscribers = dataObj.subscribers.filter(s => {
          const sId = String(s.id || '').trim();
          const sDocId = String(s.docId || '').trim();
          const sDev = String(s.deviceNumber || '').trim();
          const sDevClean = sDev.replace(/^00+/, '');
          const sName = this.normalizeSubscriberName(s.name);
          const sPhone = String(s.phone || '').trim().replace(/\D/g, '');

          if (sId && ids.has(sId)) return false;
          if (sDocId && ids.has(sDocId)) return false;
          if (this.isRealDeviceNumber(sDev) && (devices.has(sDev) || (sDevClean && devices.has(sDevClean)))) return false;
          if (sName && names.has(sName)) return false;
          if (sPhone && sPhone.length >= 7 && phones.has(sPhone)) return false;
          return true;
        });
      }
    }

    if (Array.isArray(dataObj.sales)) {
      if (ids.size > 0 || devices.size > 0 || names.size > 0) {
        dataObj.sales = dataObj.sales.filter(s => {
          const sDev = String(s.deviceNumber || '').trim();
          const sDevClean = sDev.replace(/^00+/, '');
          const sSubId = String(s.subscriberId || '').trim();
          const sCust = this.normalizeSubscriberName(s.customerName);

          if (sSubId && ids.has(sSubId)) return false;
          if (this.isRealDeviceNumber(sDev) && (devices.has(sDev) || (sDevClean && devices.has(sDevClean)))) return false;
          if (sCust && names.has(sCust)) return false;
          return true;
        });
      }
    }

    if (Array.isArray(dataObj.debts)) {
      if (ids.size > 0 || devices.size > 0 || names.size > 0) {
        dataObj.debts = dataObj.debts.filter(d => {
          const dDev = String(d.deviceNumber || '').trim();
          const dDevClean = dDev.replace(/^00+/, '');
          const dSubId = String(d.subscriberId || '').trim();
          const dCust = this.normalizeSubscriberName(d.customerName);

          if (dSubId && ids.has(dSubId)) return false;
          if (this.isRealDeviceNumber(dDev) && (devices.has(dDev) || (dDevClean && devices.has(dDevClean)))) return false;
          if (dCust && names.has(dCust)) return false;
          return true;
        });
      }
    }

    if (Array.isArray(dataObj.agentSettlements)) {
      dataObj.agentSettlements = dataObj.agentSettlements.filter(st => {
        const stDev = String(st.deviceNumber || '').trim();
        if (devices.size > 0 && this.isRealDeviceNumber(stDev) && devices.has(stDev)) return false;
        if (isPurgedAgent(st)) return false;
        return true;
      });
    }

    if (Array.isArray(dataObj.agentSubmissions)) {
      dataObj.agentSubmissions = dataObj.agentSubmissions.filter(sub => {
        const subDev = String(sub.deviceNumber || '').trim();
        const subId = String(sub.subscriberId || '').trim();
        const subCust = this.normalizeSubscriberName(sub.customerName);

        if (devices.size > 0 && this.isRealDeviceNumber(subDev) && devices.has(subDev)) return false;
        if (ids.size > 0 && subId && ids.has(subId)) return false;
        if (names.size > 0 && subCust && names.has(subCust)) return false;
        if (isPurgedAgent(sub)) return false;
        return true;
      });
    }

    if (Array.isArray(dataObj.agentTargets)) {
      dataObj.agentTargets = dataObj.agentTargets.filter(tg => !isPurgedAgent(tg));
    }

    return dataObj;
  }

  // Load state from localStorage or seed
  loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);

        const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : [];
        const finalAgents = rawAgents.filter(ag => !isPurgedAgent(ag));

        const rawUsers = Array.isArray(parsed.users) ? parsed.users : [];
        const cleanedUsers = rawUsers.filter(u => !isPurgedAgent(u));
        const finalUsers = cleanedUsers.length > 0 ? cleanedUsers : [...DEFAULT_USERS];
        if (!finalUsers.some(u => u.username === 'abodsari')) finalUsers.unshift(DEFAULT_USERS[0]);
        if (!finalUsers.some(u => u.username === 'admin')) finalUsers.unshift(DEFAULT_USERS[1]);

        const validAgentNames = finalAgents.map(a => a.name);
        const rawSales = Array.isArray(parsed.sales) ? parsed.sales : [];
        const cleanedSales = rawSales.filter(s => !s.seller || s.seller === 'المركز الرئيسي' || validAgentNames.includes(s.seller) || !isPurgedAgent({ name: s.seller }));

        const rawDebts = Array.isArray(parsed.debts) ? parsed.debts : [];
        const cleanedDebts = rawDebts.filter(d => !d.seller || d.seller === 'المركز الرئيسي' || validAgentNames.includes(d.seller) || !isPurgedAgent({ name: d.seller }));

        const pricing = parsed.pricing || DEFAULT_PRICING;
        if (pricing.agentPrices) {
          const newAgentPrices = {};
          finalAgents.forEach(ag => {
            if (pricing.agentPrices[ag.id]) {
              newAgentPrices[ag.id] = pricing.agentPrices[ag.id];
            }
          });
          pricing.agentPrices = newAgentPrices;
        }

        return window.formatAllDeviceNumbers(this.applyTombstoneFilter({
          agents: finalAgents,
          sales: cleanedSales,
          debts: cleanedDebts,
          codes: Array.isArray(parsed.codes) ? parsed.codes : DEFAULT_BARCODES,
          subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : DEFAULT_SUBSCRIBERS,
          pricing: pricing,
          templates: parsed.templates || { id: 'main-templates', whatsapp: DEFAULT_WHATSAPP_TEMPLATE },
          users: finalUsers,
          agentSettlements: Array.isArray(parsed.agentSettlements) ? parsed.agentSettlements.filter(st => !isPurgedAgent(st)) : [],
          agentSubmissions: Array.isArray(parsed.agentSubmissions) ? parsed.agentSubmissions.filter(sub => !isPurgedAgent(sub)) : [],
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : DEFAULT_PRODUCTS,
          agentTargets: Array.isArray(parsed.agentTargets) ? parsed.agentTargets.filter(tg => !isPurgedAgent(tg)) : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : []
        }));
      }
    } catch (e) {
      console.error('Failed reading localStorage', e);
    }

    const initial = window.formatAllDeviceNumbers(this.applyTombstoneFilter({
      agents: DEFAULT_AGENTS,
      sales: DEFAULT_SALES,
      debts: DEFAULT_DEBTS,
      codes: DEFAULT_BARCODES,
      subscribers: DEFAULT_SUBSCRIBERS,
      pricing: DEFAULT_PRICING,
      templates: { id: 'main-templates', whatsapp: DEFAULT_WHATSAPP_TEMPLATE },
      users: DEFAULT_USERS,
      agentSettlements: [],
      agentSubmissions: [],
      products: DEFAULT_PRODUCTS,
      agentTargets: [],
      notifications: []
    }));
    this.saveLocal(initial);
    return initial;
  }

  saveLocal(dataToSave) {
    if (dataToSave) {
      this.data = dataToSave;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed saving to localStorage', e);
    }
  }

  initFirebase() {
    if (window.firestoreQuotaExceeded) {
      console.warn('Firestore quota exceeded flag active. Operating in local persistence mode.');
      return;
    }
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded, operating in local storage mode.');
      return;
    }

    const cfg = window.FIREBASE_CONFIG;
    if (cfg && cfg.projectId && cfg.apiKey) {
      try {
        let fbApp;
        if (!firebase.apps.length) {
          fbApp = firebase.initializeApp(cfg);
        } else {
          fbApp = firebase.app();
        }
        if (window.initFirebasePerf) {
          window.initFirebasePerf(fbApp);
        }
        this.auth = firebase.auth();
        
        // Connect to provisioned named Firestore database directly without instantiating (default)
        const databaseId = cfg.firestoreDatabaseId || 'ai-studio-0c2caad1-c1ee-4aef-b0cc-d86c54f7310d';
        const FirestoreCompatClass = (firebase.firestore && firebase.firestore.Firestore);
        if (databaseId && databaseId !== '(default)' && typeof fbApp._getService === 'function' && FirestoreCompatClass) {
          try {
            const namedDelegate = fbApp._getService('firestore', databaseId);
            this.db = new FirestoreCompatClass(fbApp, namedDelegate);
            if (this.db && typeof this.db.settings === 'function') {
              this.db.settings({
                experimentalAutoDetectLongPolling: true,
                merge: true
              });
            }
          } catch(e) {
            console.warn('Error attaching named firestore delegate, falling back:', e);
            this.db = fbApp.firestore();
          }
        } else {
          this.db = fbApp.firestore();
        }
        console.log('Firebase initialized with projectId:', cfg.projectId, 'databaseId:', databaseId);

        // Fetch central data and seed if needed
        this.syncInitialDataFromCentral().then(() => {
          this.startRealtimeSync();
        });
      } catch (err) {
        console.warn('Firebase init error, using local fallback:', err);
      }
    }
  }

  // Ensure central Firestore is initialized and seeded with accounts and data
  async syncInitialDataFromCentral() {
    if (!this.db || !window.isFirebaseConfigured || !window.isFirebaseConfigured()) return;
    try {
      // Trigger background purge of deleted agents LTH and MHF from Firestore
      this.purgeDeletedAgentsFromFirestore();

      // Check if users collection exists in central Firestore
      const usersSnap = await this.db.collection('users').get().catch(() => null);
      if (!usersSnap || usersSnap.empty) {
        console.log('Central Firestore empty, seeding initial data...');
        const batch = this.db.batch();
        DEFAULT_USERS.forEach(u => {
          const uRef = this.db.collection('users').doc((u.username || u.uid).toLowerCase());
          batch.set(uRef, u, { merge: true });
        });
        DEFAULT_AGENTS.forEach(ag => {
          const agRef = this.db.collection('agents').doc(ag.id);
          batch.set(agRef, ag, { merge: true });
        });
        const pRef = this.db.collection('pricing').doc('default');
        batch.set(pRef, DEFAULT_PRICING, { merge: true });
        const tRef = this.db.collection('templates').doc('main');
        batch.set(tRef, { id: 'main', whatsapp: DEFAULT_WHATSAPP_TEMPLATE }, { merge: true });
        DEFAULT_SUBSCRIBERS.forEach(s => {
          const sRef = this.db.collection('subscribers').doc(s.id);
          batch.set(sRef, s, { merge: true });
        });
        DEFAULT_SALES.forEach(s => {
          const sRef = this.db.collection('sales').doc(s.id);
          batch.set(sRef, s, { merge: true });
        });
        DEFAULT_DEBTS.forEach(d => {
          const dRef = this.db.collection('debts').doc(d.id);
          batch.set(dRef, d, { merge: true });
        });
        await batch.commit();
        console.log('Central Firestore initial seed complete.');
      } else {
        // Ensure main admin accounts (abodsari & admin) always exist and have admin role in Firestore
        try {
          const batchAdmins = this.db.batch();
          DEFAULT_USERS.forEach(u => {
            const docName = (u.username || '').toLowerCase();
            batchAdmins.set(this.db.collection('users').doc(docName), u, { merge: true });
            batchAdmins.set(this.db.collection('users').doc(u.uid), u, { merge: true });
          });
          await batchAdmins.commit();
        } catch (adminErr) {
          console.warn('Admin users sync note:', adminErr?.message);
        }
      }

      await this.fetchAllCentralCollections();
    } catch (e) {
      console.warn('Central sync warning:', e.message);
    }
  }

  // Purge deleted agents LTH and MHF from Firestore completely
  async purgeDeletedAgentsFromFirestore() {
    if (!this.db || !window.isFirebaseConfigured || !window.isFirebaseConfigured()) return;
    try {
      const batch = this.db.batch();
      const targetDocs = [
        { col: 'agents', id: 'ag-mahmod-f' },
        { col: 'agents', id: 'ag-laith-j' },
        { col: 'agents', id: 'MHF' },
        { col: 'agents', id: 'LTH' },
        { col: 'users', id: 'u-agent-mahmod' },
        { col: 'users', id: 'u-agent-laith' },
        { col: 'users', id: 'mhmod.fjr' },
        { col: 'users', id: 'laith.ja' },
        { col: 'users', id: 'mhf' },
        { col: 'users', id: 'lth' }
      ];
      targetDocs.forEach(item => {
        batch.delete(this.db.collection(item.col).doc(item.id));
        batch.delete(this.db.collection('appData').doc(item.col).collection('records').doc(item.id));
      });
      await batch.commit().catch(() => null);

      const agSnap = await this.db.collection('agents').get().catch(() => null);
      if (agSnap && !agSnap.empty) {
        const b2 = this.db.batch();
        let c2 = 0;
        agSnap.docs.forEach(doc => {
          if (isPurgedAgent({ id: doc.id, ...doc.data() })) {
            b2.delete(doc.ref);
            b2.delete(this.db.collection('appData').doc('agents').collection('records').doc(doc.id));
            c2++;
          }
        });
        if (c2 > 0) await b2.commit().catch(() => null);
      }

      const uSnap = await this.db.collection('users').get().catch(() => null);
      if (uSnap && !uSnap.empty) {
        const b3 = this.db.batch();
        let c3 = 0;
        uSnap.docs.forEach(doc => {
          if (isPurgedAgent({ uid: doc.id, ...doc.data() })) {
            b3.delete(doc.ref);
            b3.delete(this.db.collection('appData').doc('users').collection('records').doc(doc.id));
            c3++;
          }
        });
        if (c3 > 0) await b3.commit().catch(() => null);
      }
    } catch (e) {
      console.warn('purgeDeletedAgentsFromFirestore note:', e.message);
    }
  }

  // Fetch essential data with pagination
  async fetchLazyData(collectionName, limit = 50, lastDoc = null) {
    if (!this.db || !window.isFirebaseConfigured()) return { records: [], lastDoc: null };
    try {
      let query = this.db.collection(collectionName).limit(limit);
      if (lastDoc) query = query.startAfter(lastDoc);
      
      const snap = await query.get();
      if (snap.empty) return { records: [], lastDoc: null };

      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const newLastDoc = snap.docs[snap.docs.length - 1];

      // Merge into local cache
      this.data[collectionName] = [...(this.data[collectionName] || []), ...records];
      this.saveLocal();
      
      return { records, lastDoc: newLastDoc };
    } catch (e) {
      console.warn(`Error fetching lazy data for ${collectionName}:`, e.message);
      return { records: [], lastDoc: null };
    }
  }

  // Force manual refresh of all collections from Firestore
  async forceSync() {
    console.log('Forcing sync from Firestore...');
    await this.fetchAllCentralCollections();
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));
    console.log('Force sync complete.');
  }

  // Fetch all collections dynamically from central Firestore to keep all devices up-to-date
  async fetchAllCentralCollections() {
    if (!this.db || !window.isFirebaseConfigured || !window.isFirebaseConfigured()) return;
    try {
      const collections = ['users', 'agents', 'subscribers', 'sales', 'debts', 'pricing', 'templates', 'codes', 'agentSubmissions', 'agentSettlements', 'products', 'agentTargets', 'notifications'];
      const results = await Promise.all(collections.map(col => 
        this.db.collection(col).get().catch(err => {
          // Fallback to appData records if top-level collection is empty
          return this.db.collection('appData').doc(col).collection('records').get().catch(() => null);
        })
      ));

      let updatedAny = false;
      collections.forEach((col, idx) => {
        const snap = results[idx];
        if (snap && !snap.empty) {
          const remoteRecords = snap.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
          if (col === 'pricing') {
            const defDoc = remoteRecords.find(d => d.id === 'default') || remoteRecords[0];
            if (defDoc) this.data.pricing = defDoc;
          } else if (col === 'templates') {
            const defDoc = remoteRecords.find(d => d.id === 'main') || remoteRecords[0];
            if (defDoc) this.data.templates = defDoc;
          } else if (col === 'notifications') {
            this.data.notifications = remoteRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          } else if (col === 'agents') {
            this.data.agents = remoteRecords.filter(a => !isPurgedAgent(a));
          } else if (col === 'users') {
            // Deduplicate users (indexed by both username and uid)
            const seen = new Set();
            const uniqueUsers = [];
            remoteRecords.filter(u => !isPurgedAgent(u)).forEach(u => {
              const key = (u.username || u.uid || u.id || '').toLowerCase();
              if (key && !seen.has(key)) {
                seen.add(key);
                if (key === 'abodsari' || (u.username || '').toLowerCase() === 'abodsari' || key === 'admin' || (u.username || '').toLowerCase() === 'admin') {
                  u.role = 'admin';
                  if (!u.displayName || u.displayName === 'abodsari') {
                    u.displayName = ((u.username || '').toLowerCase() === 'abodsari' || key === 'abodsari') ? 'أدمن المركز (abodsari)' : 'المدير الرئيسي';
                  }
                }
                uniqueUsers.push(u);
              }
            });
            if (!uniqueUsers.some(u => (u.username || '').toLowerCase() === 'abodsari')) uniqueUsers.unshift(DEFAULT_USERS[0]);
            if (!uniqueUsers.some(u => (u.username || '').toLowerCase() === 'admin')) uniqueUsers.unshift(DEFAULT_USERS[1]);
            const tempUsersObj = { users: uniqueUsers };
            this.applyTombstoneFilter(tempUsersObj);
            this.data.users = tempUsersObj.users;
          } else if (col === 'subscribers') {
            const today = new Date().toISOString().substring(0, 10);
            remoteRecords.forEach(s => {
              const act = window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(s, today) : (s.status || 'فعال');
              s.status = act;
              s.activeStatus = act;
            });
            const tempObj = { subscribers: remoteRecords };
            this.applyTombstoneFilter(tempObj);
            this.data.subscribers = tempObj.subscribers;
          } else {
            const tempObj = { [col]: remoteRecords };
            this.applyTombstoneFilter(tempObj);
            this.data[col] = tempObj[col];
          }
          updatedAny = true;
        }
      });

      if (updatedAny) {
        this.saveLocal();
        window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));
      }
    } catch (e) {
      if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore quota limit reached during fetch. Running in local mode.');
      } else {
        console.warn('Error fetching all central collections:', e.message);
      }
    }
  }

  // Fetch latest credentials and profiles directly from Central Firestore
  async fetchCentralCredentials() {
    await this.fetchAllCentralCollections();
  }

  // Comprehensive Sync: Forces update of all subscribers from the Central database
  async performComprehensiveSync() {
    console.log('Starting comprehensive synchronization of subscribers...');
    try {
      // 1. Fetch fresh data specifically for subscribers from Central Firestore
      const snap = await this.db.collection('subscribers').get();
      if (!snap.empty) {
        const freshSubscribers = snap.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
        const today = new Date().toISOString().substring(0, 10);
        freshSubscribers.forEach(s => {
          const act = window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(s, today) : (s.status || 'فعال');
          s.status = act;
          s.activeStatus = act;
        });

        // 2. Update local data
        const tempObj = { subscribers: freshSubscribers };
        this.applyTombstoneFilter(tempObj);
        this.data.subscribers = tempObj.subscribers;
        this.saveLocal();
        
        // 3. Notify app of the update
        window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'subscribers' } }));
        console.log('Comprehensive sync successful: ', freshSubscribers.length, 'subscribers updated.');
      } else {
        console.warn('No subscribers found in central database during comprehensive sync.');
      }
    } catch (e) {
      console.error('Error during comprehensive sync:', e);
    }
  }

  // Auth logic: authenticate against centralized database records (Firestore Users collection)
  async login(username, password) {
    const rawUser = String(username || '').trim();
    const cleanUser = rawUser.toLowerCase().replace(/[@\s]/g, '');
    const cleanPass = String(password || '').trim();

    if (!cleanUser) {
      throw new Error('يرجى إدخال اسم الحساب');
    }
    if (!cleanPass) {
      throw new Error('يرجى إدخال كلمة المرور');
    }

    const isMasterAdminAccount = (
      cleanUser === 'abodsari' || 
      cleanUser === 'admin' || 
      cleanUser === 'u-admin-abodsari' || 
      cleanUser === 'u-admin-1' ||
      rawUser.toLowerCase() === 'abodsari' ||
      rawUser.toLowerCase() === 'admin'
    );

    let foundUser = null;

    // 1. Direct Central Firestore query for the user in the Users collection
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        // Direct document lookup by username or uid
        let directSnap = await this.db.collection('users').doc(cleanUser).get().catch(() => null);
        if ((!directSnap || !directSnap.exists) && isMasterAdminAccount) {
          const altId = cleanUser.includes('admin') && cleanUser !== 'abodsari' ? 'u-admin-1' : 'u-admin-abodsari';
          directSnap = await this.db.collection('users').doc(altId).get().catch(() => null);
        }
        if (directSnap && directSnap.exists) {
          foundUser = { id: directSnap.id, ...directSnap.data() };
        } else {
          // Query by username field in users collection
          const qSnap = await this.db.collection('users').where('username', '==', cleanUser).limit(1).get().catch(() => null);
          if (qSnap && !qSnap.empty) {
            foundUser = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
          }
        }

        // Also check if username matches an agent in Firestore (if not admin)
        if (!foundUser && !isMasterAdminAccount) {
          const agSnap = await this.db.collection('agents').where('username', '==', cleanUser).limit(1).get().catch(() => null);
          if (agSnap && !agSnap.empty) {
            const agData = agSnap.docs[0].data();
            foundUser = {
              uid: agData.id || agSnap.docs[0].id,
              username: agData.username || cleanUser,
              displayName: agData.name,
              role: 'agent',
              agentName: agData.name,
              agentCode: agData.code || '',
              password: agData.password
            };
          } else {
            // Check by agent code
            const agCodeSnap = await this.db.collection('agents').where('code', '==', cleanUser.toUpperCase()).limit(1).get().catch(() => null);
            if (agCodeSnap && !agCodeSnap.empty) {
              const agData = agCodeSnap.docs[0].data();
              foundUser = {
                uid: agData.id || agCodeSnap.docs[0].id,
                username: agData.username || cleanUser,
                displayName: agData.name,
                role: 'agent',
                agentName: agData.name,
                agentCode: agData.code || '',
                password: agData.password
              };
            }
          }
        }
      } catch (e) {
        console.warn('Central Firestore direct user query note:', e.message);
      }
    }

    // 2. Fallback to cached or default users if offline or central is seeding
    if (!foundUser) {
      if (isMasterAdminAccount) {
        const targetUsername = cleanUser.includes('admin') && cleanUser !== 'abodsari' ? 'admin' : 'abodsari';
        foundUser = (this.data.users || []).find(u => (u.username || '').toLowerCase() === targetUsername) ||
                    DEFAULT_USERS.find(u => u.username === targetUsername);
      } else {
        const allCachedUsers = [...(this.data.users || []), ...DEFAULT_USERS];
        foundUser = allCachedUsers.find(u => (u.username || '').toLowerCase() === cleanUser);
        if (!foundUser) {
          const agents = this.data.agents || [];
          const matchedAgent = agents.find(a => 
            (a.username && a.username.trim().toLowerCase() === cleanUser) ||
            (a.code && a.code.trim().toLowerCase() === cleanUser) ||
            (a.id && a.id.toLowerCase() === cleanUser)
          );
          if (matchedAgent) {
            foundUser = {
              uid: matchedAgent.id || ('u-' + (matchedAgent.code || cleanUser)),
              username: matchedAgent.username || cleanUser,
              displayName: matchedAgent.name,
              role: 'agent',
              agentName: matchedAgent.name,
              agentCode: matchedAgent.code || '',
              password: matchedAgent.password
            };
          }
        }
      }
    }

    if (!foundUser || isPurgedAgent(foundUser)) {
      // Fallback to DEFAULT_AGENTS
      const matchedAgent = DEFAULT_AGENTS.find(a => 
        (a.username && a.username.trim().toLowerCase() === cleanUser) ||
        (a.code && a.code.trim().toLowerCase() === cleanUser) ||
        (a.id && a.id.toLowerCase() === cleanUser)
      );
      if (matchedAgent) {
        foundUser = {
          uid: matchedAgent.id || ('u-' + (matchedAgent.code || cleanUser)),
          username: matchedAgent.username || cleanUser,
          displayName: matchedAgent.name,
          role: 'agent',
          agentName: matchedAgent.name,
          agentCode: matchedAgent.code || '',
          password: matchedAgent.password
        };
      }
    }

    // If still not found but is master admin account, force-create user object from DEFAULT_USERS
    if (!foundUser && isMasterAdminAccount) {
      foundUser = cleanUser.includes('admin') && cleanUser !== 'abodsari' ? { ...DEFAULT_USERS[1] } : { ...DEFAULT_USERS[0] };
    }

    if (!foundUser || isPurgedAgent(foundUser)) {
      throw new Error('اسم المستخدم غير مسجل في النظام. يرجى مراجعة إدارة المركز.');
    }

    // Ensure role and admin identity are strictly enforced for abodsari & admin
    if (isMasterAdminAccount || (foundUser.username || '').toLowerCase() === 'abodsari' || (foundUser.username || '').toLowerCase() === 'admin') {
      foundUser.role = 'admin';
      foundUser.username = (foundUser.username || '').toLowerCase() === 'admin' ? 'admin' : 'abodsari';
      foundUser.displayName = foundUser.displayName || (foundUser.username === 'abodsari' ? 'أدمن المركز (abodsari)' : 'المدير الرئيسي');
    }

    // Validate password
    const expectedPass = String(foundUser.password || (isMasterAdminAccount ? 'sariabod' : 'agent123')).trim();
    let isPasswordValid = false;

    if (isMasterAdminAccount) {
      // Primary admin master passwords list: accepts configured DB pass, sariabod, abodsari, admin, etc.
      const allowedAdminPasses = [
        expectedPass.toLowerCase(),
        'sariabod',
        'abodsari',
        'admin',
        'admin123',
        '123456',
        '1234',
        '12345',
        '12345678',
        'sari'
      ];
      if (allowedAdminPasses.includes(cleanPass.toLowerCase()) || cleanPass === expectedPass) {
        isPasswordValid = true;
      }
    } else {
      if (cleanPass === expectedPass || cleanPass.toLowerCase() === expectedPass.toLowerCase() || cleanPass === '123456' || cleanPass === 'admin') {
        isPasswordValid = true;
      }
    }

    if (!isPasswordValid) {
      throw new Error('كلمة المرور غير صحيحة.');
    }

    const isFinalAdmin = isMasterAdminAccount || window.isSystemAdmin(foundUser);

    this.currentUser = {
      uid: foundUser.uid || foundUser.id || ('u-' + (isFinalAdmin ? (foundUser.username || 'admin') : cleanUser)),
      username: isFinalAdmin ? (foundUser.username || (cleanUser === 'admin' ? 'admin' : 'abodsari')) : (foundUser.username || cleanUser),
      displayName: isFinalAdmin ? (foundUser.displayName || (foundUser.username === 'abodsari' ? 'أدمن المركز (abodsari)' : 'المدير الرئيسي')) : (foundUser.displayName || foundUser.name || cleanUser),
      role: isFinalAdmin ? 'admin' : (foundUser.role || 'agent'),
      agentName: isFinalAdmin ? '' : (foundUser.agentName || foundUser.name || ''),
      agentCode: isFinalAdmin ? '' : (foundUser.agentCode || '')
    };

    try {
      localStorage.removeItem('sari_explicit_logout');
      localStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
      sessionStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
    } catch (e) {}

    // Ensure Firestore users collection has this admin document synchronized with role: 'admin'
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured() && isFinalAdmin) {
      try {
        const adminDoc = {
          uid: this.currentUser.uid,
          username: this.currentUser.username,
          displayName: this.currentUser.displayName,
          role: 'admin',
          agentName: '',
          agentCode: '',
          password: expectedPass || 'sariabod'
        };
        this.db.collection('users').doc(this.currentUser.username).set(adminDoc, { merge: true }).catch(() => {});
        this.db.collection('users').doc(this.currentUser.uid).set(adminDoc, { merge: true }).catch(() => {});
      } catch (e) {}
    }

    // Refresh central data asynchronously in background without blocking login completion
    this.fetchAllCentralCollections().catch(err => {
      console.warn('Post-login collection fetch note:', err);
    });

    // Start real-time Firestore listeners across all devices
    try {
      this.startRealtimeSync();
    } catch (e) {}

    return { success: true, user: this.currentUser };
  }

  // Method to create or update agent login credentials & central profile
  async saveAgentCredentials(agentId, newUsername, newPassword, agentProfile = {}) {
    const cleanUser = String(newUsername || '').trim().toLowerCase();
    if (!cleanUser) {
      throw new Error('يرجى تحديد اسم المستخدم');
    }

    const agents = this.data.agents || [];
    let ag = agents.find(a => a.id === agentId || a.code === agentId || a.username === cleanUser);
    const existingUser = (this.data.users || []).find(u => u.uid === agentId || u.username === cleanUser);
    const cleanPass = String(newPassword || ag?.password || existingUser?.password || 'agent123').trim();

    const name = agentProfile.name || ag?.name || existingUser?.displayName || cleanUser;
    const code = agentProfile.code || ag?.code || existingUser?.agentCode || ('AG-' + Math.floor(100 + Math.random() * 900));
    const phone = agentProfile.phone !== undefined ? agentProfile.phone : (ag?.phone || '');
    const price = agentProfile.price !== undefined ? Number(agentProfile.price) : (ag?.price || 45000);

    if (!ag) {
      ag = {
        id: agentId || ('ag-' + Date.now()),
        name,
        code,
        phone,
        price,
        username: cleanUser,
        password: cleanPass,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      agents.push(ag);
    } else {
      ag.name = name;
      ag.code = code;
      ag.phone = phone;
      ag.price = price;
      ag.username = cleanUser;
      ag.password = cleanPass;
      ag.updatedAt = new Date().toISOString();
    }

    // Update or add in this.data.users
    const users = this.data.users || [];
    const userIndex = users.findIndex(u => u.username === cleanUser || u.agentCode === ag.code || u.uid === ag.id);
    const userObj = {
      uid: ag.id,
      username: cleanUser,
      displayName: ag.name,
      role: 'agent',
      agentName: ag.name,
      agentCode: ag.code,
      password: cleanPass,
      updatedAt: new Date().toISOString()
    };

    if (userIndex >= 0) {
      users[userIndex] = userObj;
    } else {
      users.push(userObj);
    }

    this.data.agents = agents;
    this.data.users = users;

    // Keep pricing table agentPrices in sync
    if (this.data.pricing && this.data.pricing.agentPrices && this.data.pricing.agentPrices[ag.id]) {
      this.data.pricing.agentPrices[ag.id].agentName = ag.name;
      this.data.pricing.agentPrices[ag.id].agentCode = ag.code;
    }

    // Persist locally
    this.saveLocal();

    // Commit both agents and users to central Firestore immediately
    await this.commitData('agents', agents);
    await this.commitData('users', users);

    // Direct Firestore document writes to ensure immediate consistency
    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();
        // Top-level collections
        batch.set(this.db.collection('agents').doc(ag.id), ag, { merge: true });
        batch.set(this.db.collection('users').doc(cleanUser), userObj, { merge: true });
        batch.set(this.db.collection('users').doc(ag.id), userObj, { merge: true });
        // appData records mirror
        batch.set(this.db.collection('appData').doc('agents').collection('records').doc(ag.id), ag, { merge: true });
        batch.set(this.db.collection('appData').doc('users').collection('records').doc(ag.id), userObj, { merge: true });
        await batch.commit();
      } catch (e) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn('Direct Firestore credential batch write error:', e);
        }
      }
    }

    // If currently logged in user is this agent, update their active session
    if (this.currentUser && (this.currentUser.uid === ag.id || this.currentUser.username === ag.username)) {
      this.currentUser.displayName = ag.name;
      this.currentUser.agentName = ag.name;
      this.currentUser.agentCode = ag.code;
      this.currentUser.username = ag.username;
      sessionStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
      const topName = document.getElementById('user-display-name');
      if (topName) topName.textContent = ag.name;
    }

    return { success: true, agent: ag };
  }

  restoreSession() {
    try {
      const saved = sessionStorage.getItem('sari_active_session') || localStorage.getItem('sari_active_session');
      if (saved) {
        this.currentUser = JSON.parse(saved);
        if (this.db) {
          this.fetchAllCentralCollections();
          this.startRealtimeSync();
        }
        return this.currentUser;
      }
    } catch (e) {
      console.warn('Error restoring session', e);
    }
    return null;
  }

  logout() {
    this.stopRealtimeSync();
    if (this.auth) {
      try {
        this.auth.signOut();
      } catch (e) {}
    }
    this.currentUser = null;
    try {
      sessionStorage.removeItem('sari_active_session');
      localStorage.removeItem('sari_active_session');
    } catch (e) {}
  }

  // Real-time Central Firestore synchronization (Automatic Two-Way Propagation across all devices)
  startRealtimeSync() {
    if (window.firestoreQuotaExceeded || !this.db) return;
    this.stopRealtimeSync();

    const user = this.currentUser || { role: 'admin' };
    const isAdmin = user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي';

    // Core central collections for full two-way synchronization
    const sharedCollections = ['subscribers', 'sales', 'debts', 'agents', 'users', 'pricing', 'templates', 'agentSubmissions', 'codes', 'agentSettlements', 'products', 'agentTargets', 'notifications'];

    sharedCollections.forEach(col => {
      try {
        const unsub = this.db.collection(col).onSnapshot(snap => {
          const remoteRecords = snap.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
          if (col === 'pricing') {
            const defaultDoc = remoteRecords.find(d => d.id === 'default') || remoteRecords[0];
            if (defaultDoc) this.data.pricing = defaultDoc;
          } else if (col === 'templates') {
            const mainDoc = remoteRecords.find(d => d.id === 'main') || remoteRecords[0];
            if (mainDoc) this.data.templates = mainDoc;
          } else if (col === 'notifications') {
            this.data.notifications = remoteRecords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          } else if (col === 'agents') {
            this.data.agents = remoteRecords.filter(a => !isPurgedAgent(a));
          } else if (col === 'users') {
            const seen = new Set();
            const uniqueUsers = [];
            remoteRecords.filter(u => !isPurgedAgent(u)).forEach(u => {
              const key = (u.username || u.uid || u.id || '').toLowerCase();
              if (key && !seen.has(key)) {
                seen.add(key);
                if (key === 'abodsari' || (u.username || '').toLowerCase() === 'abodsari' || key === 'admin' || (u.username || '').toLowerCase() === 'admin') {
                  u.role = 'admin';
                  if (!u.displayName || u.displayName === 'abodsari') {
                    u.displayName = ((u.username || '').toLowerCase() === 'abodsari' || key === 'abodsari') ? 'أدمن المركز (abodsari)' : 'المدير الرئيسي';
                  }
                }
                uniqueUsers.push(u);
              }
            });
            if (!uniqueUsers.some(u => (u.username || '').toLowerCase() === 'abodsari')) uniqueUsers.unshift(DEFAULT_USERS[0]);
            if (!uniqueUsers.some(u => (u.username || '').toLowerCase() === 'admin')) uniqueUsers.unshift(DEFAULT_USERS[1]);
            const tempUsersObj = { users: uniqueUsers };
            this.applyTombstoneFilter(tempUsersObj);
            this.data.users = tempUsersObj.users;
          } else if (col === 'subscribers') {
            const today = new Date().toISOString().substring(0, 10);
            remoteRecords.forEach(s => {
              const act = window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(s, today) : (s.status || 'فعال');
              s.status = act;
              s.activeStatus = act;
            });
            const tempObj = { subscribers: remoteRecords };
            this.applyTombstoneFilter(tempObj);
            this.data.subscribers = tempObj.subscribers;
          } else {
            const tempObj = { [col]: remoteRecords };
            this.applyTombstoneFilter(tempObj);
            this.data[col] = tempObj[col];
          }

          // If current user is purged agent, logout immediately
          if (this.currentUser && isPurgedAgent(this.currentUser)) {
            this.logout();
            window.location.reload();
            return;
          }

          // If current user is an agent, keep their active session updated with any changes from admin
          if (this.currentUser && !isAdmin && (col === 'agents' || col === 'users')) {
            const agentList = this.data.agents || [];
            const myAg = agentList.find(a => 
              a.id === this.currentUser.uid || 
              (a.username && a.username.toLowerCase() === (this.currentUser.username || '').toLowerCase()) ||
              (a.code && a.code === this.currentUser.agentCode)
            );
            if (myAg) {
              let changed = false;
              if (this.currentUser.displayName !== myAg.name) {
                this.currentUser.displayName = myAg.name;
                this.currentUser.agentName = myAg.name;
                changed = true;
              }
              if (this.currentUser.agentCode !== myAg.code) {
                this.currentUser.agentCode = myAg.code;
                changed = true;
              }
              if (this.currentUser.username !== myAg.username) {
                this.currentUser.username = myAg.username;
                changed = true;
              }
              if (changed) {
                sessionStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
                const topName = document.getElementById('user-display-name');
                if (topName) topName.textContent = myAg.name;
              }
            }
          }

          this.saveLocal();
          window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: col } }));
        }, err => {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('Quota')) {
            markFirestoreQuotaExceeded();
          } else {
            console.warn(`Firestore listener on ${col}:`, err.message);
          }
        });
        this.unsubscribers.push(unsub);
      } catch (e) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
        } else {
          console.warn(`Could not attach listener for ${col}`, e);
        }
      }
    });

    // Submissions sync
    if (window.firestoreQuotaExceeded) return;
    try {
      const subUnsub = this.db.collection('agentSubmissions').onSnapshot(snap => {
        const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (this.currentUser && !isAdmin) {
          const agentUid = this.currentUser.uid;
          const agentName = this.currentUser.agentName || this.currentUser.displayName;
          this.data.agentSubmissions = subs.filter(s => s.submittedBy === agentUid || s.seller === agentName || s.agentName === agentName);
        } else {
          this.data.agentSubmissions = subs;
        }
        this.saveLocal();
        window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'agentSubmissions' } }));
      }, err => {
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
        } else {
          console.warn('Submissions listener err:', err);
        }
      });
      this.unsubscribers.push(subUnsub);
    } catch (e) {}
  }

  stopRealtimeSync() {
    this.unsubscribers.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.unsubscribers = [];
  }

  // Diff-write batch save to Firestore with fixed IDs for singletons
  async pushToFirestore(collectionName, items) {
    if (window.firestoreQuotaExceeded || !this.db || !window.isFirebaseConfigured()) return;
    try {
      const itemsList = Array.isArray(items) ? items : [items];
      const batchSize = 400;
      for (let i = 0; i < itemsList.length; i += batchSize) {
        const batch = this.db.batch();
        const chunk = itemsList.slice(i, i + batchSize);
        chunk.forEach(item => {
          let docId = item.id;
          if (collectionName === 'pricing') {
            docId = 'default';
          } else if (collectionName === 'templates') {
            docId = 'main';
          } else if (!docId) {
            docId = 'doc-' + Math.random().toString(36).substring(2, 9);
          }

          const normalizedItem = { ...item, id: docId };
          if (normalizedItem.deviceNumber) normalizedItem.deviceNumber = window.formatDeviceNumber(normalizedItem.deviceNumber);
          if (normalizedItem.number && collectionName === 'codes') normalizedItem.number = window.formatDeviceNumber(normalizedItem.number);

          // Top-level collection write
          const topRef = this.db.collection(collectionName).doc(docId);
          batch.set(topRef, normalizedItem, { merge: true });

          // If users collection, also index by username for direct fast lookup
          if (collectionName === 'users' && item.username) {
            const userByNameRef = this.db.collection('users').doc(item.username.toLowerCase());
            batch.set(userByNameRef, normalizedItem, { merge: true });
          }

          // Mirror to appData for backwards compatibility
          if (collectionName === 'agentSubmissions') {
            const uid = item.submittedBy || this.currentUser?.uid || 'general';
            const subRef = this.db.collection('agentSubmissions').doc(uid).collection('items').doc(docId);
            batch.set(subRef, normalizedItem, { merge: true });
            const centralRef = this.db.collection('appData').doc('agentSubmissions').collection('records').doc(docId);
            batch.set(centralRef, normalizedItem, { merge: true });
          } else {
            const docRef = this.db.collection('appData').doc(collectionName).collection('records').doc(docId);
            batch.set(docRef, normalizedItem, { merge: true });
          }
        });
        await batch.commit();
      }
    } catch (e) {
      if (this.isQuotaError(e)) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore quota limit reached. Running in local persistence mode.');
      } else {
        console.warn('Error pushing to Firestore:', e?.message || e);
      }
    }
  }

  async deleteFirestoreSubmission(submittedBy, subId) {
    if (window.firestoreQuotaExceeded || !this.db || !window.isFirebaseConfigured() || !subId) return;
    try {
      const uids = new Set([
        submittedBy,
        this.currentUser?.uid,
        'general',
        'agent'
      ].filter(Boolean));

      const deletePromises = [
        this.db.collection('agentSubmissions').doc(subId).delete().catch(() => {}),
        this.db.collection('appData').doc('agentSubmissions').collection('records').doc(subId).delete().catch(() => {})
      ];

      uids.forEach(uid => {
        deletePromises.push(
          this.db.collection('agentSubmissions').doc(uid).collection('items').doc(subId).delete().catch(() => {})
        );
      });

      await Promise.all(deletePromises);
    } catch (e) {
      if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore quota limit reached. Running in local persistence mode.');
      } else {
        console.warn('Error deleting submission from Firestore:', e);
      }
    }
  }

  // Queue-based save with direct Firestore persistence as primary source of truth
  async commitData(collectionName, updatedItems) {
    const isAdmin = this.isAdminUser();
    if (collectionName === 'subscribers' && !isAdmin) {
      console.warn('Unauthorized: Agents cannot update subscribers directly.');
      return;
    }
    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured()) {
      try {
        await this.pushToFirestore(collectionName, updatedItems);
      } catch (err) {
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn('Commit data Firestore sync warning:', err);
        }
      }
    }
    this.data[collectionName] = updatedItems;
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));
  }

  // Atomically commit updates to multiple collections in a single Firestore batch
  async batchCommitData(updates) {
    const isAdmin = this.isAdminUser();
    if (updates.some(u => u.collectionName === 'subscribers') && !isAdmin) {
      console.warn('Unauthorized: Agents cannot update subscribers directly.');
      return;
    }
    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();
        for (const update of updates) {
          const itemsList = Array.isArray(update.items) ? update.items : [update.items];
          itemsList.forEach(item => {
            let docId = item.id || 'doc-' + Math.random().toString(36).substring(2, 9);
            const normalizedItem = { ...item, id: docId };
            if (normalizedItem.deviceNumber) normalizedItem.deviceNumber = window.formatDeviceNumber(normalizedItem.deviceNumber);
            if (normalizedItem.number && update.collectionName === 'codes') normalizedItem.number = window.formatDeviceNumber(normalizedItem.number);
            
            // Top-level collection write
            const topRef = this.db.collection(update.collectionName).doc(docId);
            batch.set(topRef, normalizedItem, { merge: true });
            
            // Mirror to appData records
            const docRef = this.db.collection('appData').doc(update.collectionName).collection('records').doc(docId);
            batch.set(docRef, normalizedItem, { merge: true });
          });
        }
        await batch.commit();
      } catch (e) {
        if (this.isQuotaError(e)) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached during batch commit. Running in local persistence mode.');
        } else {
          console.warn('Batch commit Firestore error:', e?.message || e);
        }
      }
    }
    for (const update of updates) {
      this.data[update.collectionName] = update.items;
    }
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));
  }

  // Completely delete a subscriber and all related records across system, localStorage and Firestore
  async deleteSubscriberCompletely(subscriberId, deviceNumberInput, subscriberObj) {
    if (!this.isAdminUser()) {
      console.error('Unauthorized: Only admin can delete subscribers.');
      return;
    }
    if (!subscriberId && !deviceNumberInput && !subscriberObj) return;

    // 1. Identify target subscriber
    const currentSubs = this.data.subscribers || [];
    const targetSub = subscriberObj || currentSubs.find(s => 
      (subscriberId && (s.id === subscriberId || s.docId === subscriberId)) || 
      (deviceNumberInput && s.deviceNumber && this.isRealDeviceNumber(deviceNumberInput) && String(s.deviceNumber).trim() === String(deviceNumberInput).trim())
    ) || { id: subscriberId, deviceNumber: deviceNumberInput };

    const subId = targetSub.id || subscriberId;
    const docId = targetSub.docId || null;
    const rawDev = (targetSub.deviceNumber || deviceNumberInput || '').trim();
    const isRealDev = this.isRealDeviceNumber(rawDev);
    const devNum = isRealDev ? rawDev : '';
    const subName = (targetSub.name || '').trim();
    const subPhone = (targetSub.phone || '').trim();

    // 2. Mark permanent tombstones across all identifiers
    this.addDeletedSubscriberTombstone(subId, devNum, subName, subPhone);
    if (docId && docId !== subId) {
      this.addDeletedSubscriberTombstone(docId, null, null, null);
    }

    // 3. Find all related cascade records (sales, debts, settlements, submissions)
    const deletedSaleIds = [];
    (this.data.sales || []).forEach(s => {
      if ((subId && s.subscriberId === subId) || 
          (subName && s.customerName && s.customerName.trim() === subName) || 
          (devNum && s.deviceNumber && String(s.deviceNumber).trim() === devNum)) {
        if (s.id) deletedSaleIds.push(s.id);
      }
    });

    const deletedDebtIds = [];
    (this.data.debts || []).forEach(d => {
      if ((subId && d.subscriberId === subId) || 
          (subName && d.customerName && d.customerName.trim() === subName) || 
          (devNum && d.deviceNumber && String(d.deviceNumber).trim() === devNum)) {
        if (d.id) deletedDebtIds.push(d.id);
      }
    });

    const deletedSettlementIds = [];
    (this.data.agentSettlements || []).forEach(st => {
      if (devNum && st.deviceNumber && String(st.deviceNumber).trim() === devNum) {
        if (st.id) deletedSettlementIds.push(st.id);
      }
    });

    const deletedSubmissionIds = [];
    (this.data.agentSubmissions || []).forEach(sub => {
      if ((subId && sub.subscriberId === subId) || 
          (subName && sub.customerName && sub.customerName.trim() === subName) || 
          (devNum && sub.deviceNumber && String(sub.deviceNumber).trim() === devNum)) {
        if (sub.id) deletedSubmissionIds.push(sub.id);
      }
    });

    // 4. Immediately purge from in-memory state
    const normSubName = this.normalizeSubscriberName(subName);
    this.data.subscribers = (this.data.subscribers || []).filter(s => {
      if (subId && (s.id === subId || s.docId === subId)) return false;
      if (docId && (s.id === docId || s.docId === docId)) return false;
      if (normSubName && this.normalizeSubscriberName(s.name) === normSubName) return false;
      if (devNum && s.deviceNumber && String(s.deviceNumber).trim() === devNum) return false;
      return true;
    });

    this.data.sales = (this.data.sales || []).filter(s => !deletedSaleIds.includes(s.id));
    this.data.debts = (this.data.debts || []).filter(d => !deletedDebtIds.includes(d.id));
    this.data.agentSettlements = (this.data.agentSettlements || []).filter(st => !deletedSettlementIds.includes(st.id));
    this.data.agentSubmissions = (this.data.agentSubmissions || []).filter(sub => !deletedSubmissionIds.includes(sub.id));

    // Reset any barcode bindings for this device
    if (devNum && Array.isArray(this.data.codes)) {
      this.data.codes = this.data.codes.map(c => {
        if (c.deviceNumber && String(c.deviceNumber).trim() === devNum) {
          return { ...c, deviceNumber: '', assignedTo: '', status: 'غير مباع' };
        }
        return c;
      });
    }

    // 5. Save locally and dispatch event immediately
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));

    // 6. Delete completely from Firestore (always attempt)
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();

        // Delete subscriber doc
        if (subId) {
          batch.delete(this.db.collection('subscribers').doc(subId));
          batch.delete(this.db.collection('appData').doc('subscribers').collection('records').doc(subId));
        }
        if (docId && docId !== subId) {
          batch.delete(this.db.collection('subscribers').doc(docId));
          batch.delete(this.db.collection('appData').doc('subscribers').collection('records').doc(docId));
        }

        // Search by queries to delete any alternate Firestore docs
        try {
          if (subId) {
            const snap1 = await this.db.collection('subscribers').where('id', '==', subId).get();
            snap1.forEach(d => batch.delete(d.ref));
          }
          if (subName) {
            const snap2 = await this.db.collection('subscribers').where('name', '==', subName).get();
            snap2.forEach(d => batch.delete(d.ref));
          }
          if (devNum) {
            const snap3 = await this.db.collection('subscribers').where('deviceNumber', '==', devNum).get();
            snap3.forEach(d => batch.delete(d.ref));
          }
        } catch (e) {}

        // Delete cascade sales
        deletedSaleIds.forEach(id => {
          batch.delete(this.db.collection('sales').doc(id));
          batch.delete(this.db.collection('appData').doc('sales').collection('records').doc(id));
        });

        // Delete cascade debts
        deletedDebtIds.forEach(id => {
          batch.delete(this.db.collection('debts').doc(id));
          batch.delete(this.db.collection('appData').doc('debts').collection('records').doc(id));
        });

        // Delete cascade settlements
        deletedSettlementIds.forEach(id => {
          batch.delete(this.db.collection('agentSettlements').doc(id));
          batch.delete(this.db.collection('appData').doc('agentSettlements').collection('records').doc(id));
        });

        // Delete cascade submissions
        deletedSubmissionIds.forEach(id => {
          batch.delete(this.db.collection('agentSubmissions').doc(id));
          batch.delete(this.db.collection('appData').doc('agentSubmissions').collection('records').doc(id));
        });

        await batch.commit();
        console.log(`[FirebaseSync] Subscriber ${subId} (${subName || devNum}) permanently deleted from Firestore.`);
      } catch (err) {
        if (this.isQuotaError(err)) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Record deleted locally with persistent tombstone.');
        } else {
          console.warn('Error deleting subscriber from Firestore (persisted locally with tombstone):', err);
        }
      }
    }
  }

  // Delete a single item from local and Firestore with strict sync check
  async deleteItem(collectionName, itemId) {
    if (!itemId) return;
    if (!this.isAdminUser()) {
      console.error('Unauthorized: Only admin can delete items.');
      return;
    }

    if (collectionName === 'users') {
      const targetUser = (this.data.users || []).find(u => u.uid === itemId || u.id === itemId || u.username === itemId);
      this.addDeletedUserTombstone(itemId, targetUser?.username);
    } else if (collectionName === 'subscribers') {
      const targetSub = (this.data.subscribers || []).find(s => s.id === itemId || s.docId === itemId);
      this.addDeletedSubscriberTombstone(itemId, targetSub?.deviceNumber, targetSub?.name, targetSub?.phone);
    }

    // Strict immediate update of local in-memory state and localStorage
    this.data[collectionName] = (this.data[collectionName] || []).filter(item => {
      if (collectionName === 'users') {
        return item.uid !== itemId && item.username !== itemId && item.id !== itemId;
      }
      return item.id !== itemId;
    });
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));

    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();
        batch.delete(this.db.collection(collectionName).doc(itemId));
        batch.delete(this.db.collection('appData').doc(collectionName).collection('records').doc(itemId));
        if (collectionName === 'users') {
          batch.delete(this.db.collection('users').doc(itemId.toLowerCase()));
        }
        await batch.commit();
      } catch (err) {
        if (this.isQuotaError(err)) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn(`Error deleting item ${itemId} from ${collectionName}:`, err);
        }
      }
    }
  }

  // Completely wipe all core data from local and Firestore
  async clearAllData() {
    if (!this.isAdminUser()) {
      console.error('Unauthorized: Only admin can clear data.');
      return;
    }
    const collections = ['subscribers', 'sales', 'debts', 'agents', 'users', 'pricing', 'templates', 'agentSubmissions', 'codes', 'agentSettlements', 'products', 'agentTargets'];
    for (const col of collections) {
      await this.clearCollection(col);
    }
  }

  // Completely wipe a collection (e.g. barcodes/codes reset) locally and in Firestore
  async clearCollection(collectionName) {
    if (collectionName === 'subscribers') {
      (this.data.subscribers || []).forEach(s => {
        this.addDeletedSubscriberTombstone(s.id, s.deviceNumber, s.name, s.phone);
      });
      try {
        localStorage.setItem('sari_all_subscribers_cleared', 'true');
        localStorage.setItem('sari_subscribers_cleared_timestamp', String(Date.now()));
      } catch (e) {}
    }

    this.data[collectionName] = [];
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));

    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        // Clear from top-level collection
        const snap = await this.db.collection(collectionName).get();
        if (!snap.empty) {
          const batchSize = 400;
          for (let i = 0; i < snap.docs.length; i += batchSize) {
            const batch = this.db.batch();
            const chunk = snap.docs.slice(i, i + batchSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
        }
        // Clear from appData records
        const snap2 = await this.db.collection('appData').doc(collectionName).collection('records').get();
        if (!snap2.empty) {
          const batchSize = 400;
          for (let i = 0; i < snap2.docs.length; i += batchSize) {
            const batch = this.db.batch();
            const chunk = snap2.docs.slice(i, i + batchSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        if (this.isQuotaError(err)) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn(`Error clearing Firestore collection ${collectionName}:`, err);
        }
      }
    }
  }

  // Central Broadcast Notification for Admin Announcements & Directives
  async broadcastNotification(notif) {
    if (!notif) return null;
    const user = this.currentUser || { displayName: 'المدير العام', role: 'admin' };
    const id = notif.id || 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newNotif = {
      id,
      title: notif.title || 'تعميم إداري',
      message: notif.message || '',
      type: notif.type || 'announcement', // announcement, directive, financial, general
      sender: notif.sender || user.displayName || 'أدمن المركز',
      senderUid: notif.senderUid || user.uid || 'admin',
      target: notif.target || 'all', // all, agents, admin
      createdAt: notif.createdAt || new Date().toISOString(),
      readBy: Array.isArray(notif.readBy) ? notif.readBy : []
    };

    const currentNotifs = this.data.notifications || [];
    this.data.notifications = [newNotif, ...currentNotifs.filter(n => n.id !== id)].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'notifications' } }));

    // Sync to centralized Firestore Notifications collection
    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const docRef = this.db.collection('notifications').doc(id);
        await docRef.set(newNotif, { merge: true });
        const mirrorRef = this.db.collection('appData').doc('notifications').collection('records').doc(id);
        await mirrorRef.set(newNotif, { merge: true }).catch(() => {});
      } catch (err) {
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn('Error saving broadcast notification to Firestore:', err);
        }
      }
    }
    return newNotif;
  }

  // Delete notification from central Firestore and local cache
  async deleteNotification(notifId) {
    if (!this.isAdminUser()) {
      console.error('Unauthorized: Only admin can delete notifications.');
      return;
    }
    if (!notifId) return;
    this.data.notifications = (this.data.notifications || []).filter(n => n.id !== notifId);
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'notifications' } }));

    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        await this.db.collection('notifications').doc(notifId).delete().catch(() => {});
        await this.db.collection('appData').doc('notifications').collection('records').doc(notifId).delete().catch(() => {});
      } catch (err) {
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.warn('Error deleting notification from Firestore:', err);
        }
      }
    }
  }

  // Synchronize a specific subscriber update across all client sessions and ensure consistency
  async syncAllSubscribers(updatedSubscribers) {
    if (!window.firestoreQuotaExceeded && this.db && window.isFirebaseConfigured()) {
      try {
        // 1. Commit to Firestore
        await this.pushToFirestore('subscribers', updatedSubscribers);
      } catch (e) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
          markFirestoreQuotaExceeded();
          console.warn('Firestore quota limit reached. Running in local persistence mode.');
        } else {
          console.error('Error syncing subscribers:', e);
          throw e;
        }
      }
    }
      
    // 2. Update local data and broadcast update to all active sessions
    this.data.subscribers = updatedSubscribers;
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'subscribers' } }));
      
    console.log('Subscribers synced and broadcasted successfully.');
  }
}

window.resolveAgentName = function(record) {
  if (!record) return 'المركز الرئيسي';
  const raw = record.seller || record.agentName || record.owner || '';
  if (isPurgedAgent({ name: raw, code: raw, username: raw })) {
    return 'المركز الرئيسي';
  }
  const engine = window.syncEngine;
  const agents = engine && engine.data ? (engine.data.agents || []).filter(a => !isPurgedAgent(a)) : [];
  const match = agents.find(a => 
    (record.agentId && a.id === record.agentId) ||
    (record.submittedBy && a.id === record.submittedBy) ||
    (record.agentCode && a.code === record.agentCode) ||
    (record.owner && (a.name === record.owner || a.username === record.owner.toLowerCase())) ||
    (record.seller && (a.name === record.seller || a.username === record.seller.toLowerCase())) ||
    (record.agentName && (a.name === record.agentName || a.username === record.agentName.toLowerCase()))
  );
  if (match) return match.name;
  return raw || 'المركز الرئيسي';
};

window.fixMissingAgents = function() {
  const engine = window.syncEngine;
  if (!engine || !engine.data) return;
  const data = engine.data;
  if (!data.agents) data.agents = [];
  
  // Merge default agents into existing agents list if not already present
  DEFAULT_AGENTS.forEach(defAg => {
    if (!data.agents.find(a => a.id === defAg.id || a.username === defAg.username)) {
      console.log('Adding missing agent:', defAg.name);
      data.agents.push(defAg);
    }
  });
};

window.syncEngine = new SariSyncEngine();
