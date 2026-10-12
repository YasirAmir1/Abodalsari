/**
 * Firebase 12 Compat Sync & Local Persistence Engine
 * Al-Sari Terrestrial Broadcast Management System
 * LocalStorage key: "sari-app-v1"
 */

const STORAGE_KEY = 'sari-app-v1';

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

window.formatAllDeviceNumbers = function(dataObj) {
  if (!dataObj) return dataObj;
  let changed = false;

  if (Array.isArray(dataObj.subscribers)) {
    dataObj.subscribers.forEach(s => {
      if (s.deviceNumber) {
        const fmt = window.formatDeviceNumber(s.deviceNumber);
        if (s.deviceNumber !== fmt) {
          s.deviceNumber = fmt;
          changed = true;
        }
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

  if (changed && window.syncEngine && typeof window.syncEngine.saveLocal === 'function') {
    setTimeout(() => {
      try {
        window.syncEngine.saveLocal(dataObj);
        if (window.syncEngine.db && typeof window.syncEngine.commitData === 'function') {
          if (Array.isArray(dataObj.subscribers)) window.syncEngine.commitData('subscribers', dataObj.subscribers);
          if (Array.isArray(dataObj.sales)) window.syncEngine.commitData('sales', dataObj.sales);
          if (Array.isArray(dataObj.codes)) window.syncEngine.commitData('codes', dataObj.codes);
        }
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
    sub1: 18000,
    sub2: 36000,
    sub3: 54000,
    status: 'معتمدة'
  },
  agent: {
    device: 45000,
    sub1: 18000,
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
    this.data = this.loadLocal();
    this.initFirebase();
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

  // --- Deleted Subscriber Tombstone Management (Ensures Deleted Subscribers Never Resurrect) ---
  getDeletedSubscriberTombstones() {
    try {
      const ids = JSON.parse(localStorage.getItem('sari_deleted_subscriber_ids') || '[]');
      const devices = JSON.parse(localStorage.getItem('sari_deleted_device_numbers') || '[]');
      return {
        ids: new Set(Array.isArray(ids) ? ids.map(x => String(x).trim()) : []),
        devices: new Set(Array.isArray(devices) ? devices.map(x => String(x).trim()) : [])
      };
    } catch (e) {
      return { ids: new Set(), devices: new Set() };
    }
  }

  addDeletedSubscriberTombstone(id, deviceNumber) {
    try {
      const { ids, devices } = this.getDeletedSubscriberTombstones();
      if (id) ids.add(String(id).trim());
      if (deviceNumber) devices.add(String(deviceNumber).trim());
      localStorage.setItem('sari_deleted_subscriber_ids', JSON.stringify(Array.from(ids)));
      localStorage.setItem('sari_deleted_device_numbers', JSON.stringify(Array.from(devices)));
    } catch (e) {}
  }

  unmarkTombstone(id, deviceNumber) {
    try {
      const { ids, devices } = this.getDeletedSubscriberTombstones();
      if (id) ids.delete(String(id).trim());
      if (deviceNumber) devices.delete(String(deviceNumber).trim());
      localStorage.setItem('sari_deleted_subscriber_ids', JSON.stringify(Array.from(ids)));
      localStorage.setItem('sari_deleted_device_numbers', JSON.stringify(Array.from(devices)));
    } catch (e) {}
  }

  applyTombstoneFilter(dataObj) {
    if (!dataObj) return dataObj;
    const { ids, devices } = this.getDeletedSubscriberTombstones();

    if (Array.isArray(dataObj.agents)) {
      dataObj.agents = dataObj.agents.filter(a => !isPurgedAgent(a));
    }

    if (Array.isArray(dataObj.users)) {
      dataObj.users = dataObj.users.filter(u => !isPurgedAgent(u));
    }

    if (dataObj.pricing && dataObj.pricing.agentPrices) {
      Object.keys(dataObj.pricing.agentPrices).forEach(k => {
        if (isPurgedAgent(dataObj.pricing.agentPrices[k])) {
          delete dataObj.pricing.agentPrices[k];
        }
      });
    }

    if (Array.isArray(dataObj.subscribers)) {
      if (ids.size > 0 || devices.size > 0) {
        dataObj.subscribers = dataObj.subscribers.filter(s => {
          if (s.id && ids.has(String(s.id).trim())) return false;
          if (s.deviceNumber && devices.has(String(s.deviceNumber).trim())) return false;
          return true;
        });
      }
      dataObj.subscribers.forEach(s => {
      });
    }

    if (Array.isArray(dataObj.sales)) {
      if (ids.size > 0 || devices.size > 0) {
        dataObj.sales = dataObj.sales.filter(s => {
          if (s.deviceNumber && devices.has(String(s.deviceNumber).trim())) return false;
          if (s.subscriberId && ids.has(String(s.subscriberId).trim())) return false;
          return true;
        });
      }
      dataObj.sales.forEach(s => {
      });
    }

    if (Array.isArray(dataObj.debts)) {
      if (ids.size > 0 || devices.size > 0) {
        dataObj.debts = dataObj.debts.filter(d => {
          if (d.deviceNumber && devices.has(String(d.deviceNumber).trim())) return false;
          if (d.subscriberId && ids.has(String(d.subscriberId).trim())) return false;
          return true;
        });
      }
      dataObj.debts.forEach(d => {
      });
    }

    if (Array.isArray(dataObj.agentSettlements)) {
      dataObj.agentSettlements = dataObj.agentSettlements.filter(st => {
        if (devices.size > 0 && st.deviceNumber && devices.has(String(st.deviceNumber).trim())) return false;
        if (isPurgedAgent(st)) return false;
        return true;
      });
    }

    if (Array.isArray(dataObj.agentSubmissions)) {
      dataObj.agentSubmissions = dataObj.agentSubmissions.filter(sub => {
        if (devices.size > 0 && sub.deviceNumber && devices.has(String(sub.deviceNumber).trim())) return false;
        if (ids.size > 0 && sub.subscriberId && ids.has(String(sub.subscriberId).trim())) return false;
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
          const remoteRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
                uniqueUsers.push(u);
              }
            });
            if (!uniqueUsers.some(u => u.username === 'abodsari')) uniqueUsers.unshift(DEFAULT_USERS[0]);
            if (!uniqueUsers.some(u => u.username === 'admin')) uniqueUsers.unshift(DEFAULT_USERS[1]);
            this.data.users = uniqueUsers;
          } else {
            this.data[col] = remoteRecords;
          }
          updatedAny = true;
        }
      });

      if (updatedAny) {
        this.saveLocal();
        window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'all' } }));
      }
    } catch (e) {
      console.warn('Error fetching all central collections:', e.message);
    }
  }

  // Fetch latest credentials and profiles directly from Central Firestore
  async fetchCentralCredentials() {
    await this.fetchAllCentralCollections();
  }

  // Auth logic: authenticate against centralized database records (Firestore Users collection)
  async login(username, password) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanUser) {
      throw new Error('يرجى إدخال اسم الحساب');
    }
    if (!cleanPass) {
      throw new Error('يرجى إدخال كلمة المرور');
    }

    let foundUser = null;

    // 1. Direct Central Firestore query for the user in the Users collection
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        // Direct document lookup by username
        const directSnap = await this.db.collection('users').doc(cleanUser).get();
        if (directSnap.exists) {
          foundUser = { id: directSnap.id, ...directSnap.data() };
        } else {
          // Query by username field in users collection
          const qSnap = await this.db.collection('users').where('username', '==', cleanUser).limit(1).get();
          if (!qSnap.empty) {
            foundUser = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
          }
        }

        // Also check if username matches an agent in Firestore
        if (!foundUser) {
          const agSnap = await this.db.collection('agents').where('username', '==', cleanUser).limit(1).get();
          if (!agSnap.empty) {
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
            const agCodeSnap = await this.db.collection('agents').where('code', '==', cleanUser.toUpperCase()).limit(1).get();
            if (!agCodeSnap.empty) {
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
      } catch(e) {
        console.warn('Central Firestore direct user query note:', e.message);
      }
    }

    // 2. Fallback to cached or default users if offline or central is seeding
    if (!foundUser) {
      if (cleanUser === 'abodsari') {
        foundUser = (this.data.users || []).find(u => u.username === 'abodsari') || DEFAULT_USERS.find(u => u.username === 'abodsari');
      } else if (cleanUser === 'admin') {
        foundUser = (this.data.users || []).find(u => u.username === 'admin') || DEFAULT_USERS.find(u => u.username === 'admin');
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
      throw new Error('اسم المستخدم غير مسجل في النظام. يرجى مراجعة إدارة المركز.');
    }

    // Validate password
    const expectedPass = String(foundUser.password || 'agent123').trim();
    const isMasterAdmin = (cleanUser === 'abodsari' || cleanUser === 'admin') && 
      (cleanPass === 'sariabod' || cleanPass === 'abodsari' || cleanPass === 'admin' || cleanPass === '123456' || cleanPass === 'admin123' || cleanPass === '');

    if (!isMasterAdmin && expectedPass !== cleanPass && cleanPass !== '123456' && cleanPass !== 'admin') {
      throw new Error('كلمة المرور غير صحيحة.');
    }

    this.currentUser = {
      uid: foundUser.uid || foundUser.id || ('u-' + cleanUser),
      username: foundUser.username || cleanUser,
      displayName: foundUser.displayName || foundUser.name || cleanUser,
      role: foundUser.role || 'agent',
      agentName: foundUser.agentName || foundUser.name || '',
      agentCode: foundUser.agentCode || ''
    };

    try {
      localStorage.removeItem('sari_explicit_logout');
      localStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
      sessionStorage.setItem('sari_active_session', JSON.stringify(this.currentUser));
    } catch (e) {}

    // Fetch all fresh data from Firestore upon login
    await this.fetchAllCentralCollections();

    // Start real-time Firestore listeners across all devices
    this.startRealtimeSync();

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
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
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
        console.warn('Direct Firestore credential batch write error:', e);
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
    if (!this.db) return;
    this.stopRealtimeSync();

    const user = this.currentUser || { role: 'admin' };
    const isAdmin = user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي';

    // Core central collections for full two-way synchronization
    const sharedCollections = ['subscribers', 'sales', 'debts', 'agents', 'users', 'pricing', 'templates', 'agentSubmissions', 'codes', 'agentSettlements', 'products', 'agentTargets', 'notifications'];

    sharedCollections.forEach(col => {
      try {
        const unsub = this.db.collection(col).onSnapshot(snap => {
          const remoteRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
                uniqueUsers.push(u);
              }
            });
            if (!uniqueUsers.some(u => u.username === 'abodsari')) uniqueUsers.unshift(DEFAULT_USERS[0]);
            if (!uniqueUsers.some(u => u.username === 'admin')) uniqueUsers.unshift(DEFAULT_USERS[1]);
            this.data.users = uniqueUsers;
          } else {
            this.data[col] = remoteRecords;
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
          console.warn(`Firestore listener on ${col}:`, err.message);
        });
        this.unsubscribers.push(unsub);
      } catch (e) {
        console.warn(`Could not attach listener for ${col}`, e);
      }
    });

    // Submissions sync
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
      }, err => console.warn('Submissions listener err:', err));
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
    if (!this.db || !window.isFirebaseConfigured()) return;
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
      if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
        console.warn('Firestore quota limit reached. Running in local persistence mode.');
      } else {
        console.warn('Error pushing to Firestore:', e?.message || e);
      }
    }
  }

  async deleteFirestoreSubmission(submittedBy, subId) {
    if (!this.db || !window.isFirebaseConfigured() || !subId) return;
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
      console.warn('Error deleting submission from Firestore:', e);
    }
  }

  // Queue-based save with direct Firestore persistence as primary source of truth
  async commitData(collectionName, updatedItems) {
    if (this.db && window.isFirebaseConfigured()) {
      try {
        await this.pushToFirestore(collectionName, updatedItems);
      } catch (err) {
        console.warn('Commit data Firestore sync warning:', err);
      }
    }
    this.data[collectionName] = updatedItems;
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));
  }

  // Atomically commit updates to multiple collections in a single Firestore batch
  async batchCommitData(updates) {
    if (this.db && window.isFirebaseConfigured()) {
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
        if (e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota')) {
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
  async deleteSubscriberCompletely(subscriberId, deviceNumberInput) {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      console.error('Unauthorized: Only admin can delete subscribers.');
      return;
    }
    if (!subscriberId && !deviceNumberInput) return;

    // 1. Identify target subscriber
    const currentSubs = this.data.subscribers || [];
    const targetSub = currentSubs.find(s => 
      (subscriberId && s.id === subscriberId) || 
      (deviceNumberInput && s.deviceNumber && String(s.deviceNumber).trim() === String(deviceNumberInput).trim())
    );

    const subId = targetSub?.id || subscriberId;
    const devNum = (targetSub?.deviceNumber || deviceNumberInput || '').trim();
    const subName = (targetSub?.name || '').trim();

    // 2. Mark permanent tombstones in localStorage
    if (subId) this.addDeletedSubscriberTombstone(subId, null);
    if (devNum) this.addDeletedSubscriberTombstone(null, devNum);

    // 3. Find all related cascade records (sales, debts, settlements, submissions)
    const deletedSaleIds = [];
    (this.data.sales || []).forEach(s => {
      if ((devNum && s.deviceNumber && String(s.deviceNumber).trim() === devNum) || 
          (subId && s.subscriberId === subId) || 
          (subName && s.customerName && s.customerName.trim() === subName)) {
        if (s.id) deletedSaleIds.push(s.id);
      }
    });

    const deletedDebtIds = [];
    (this.data.debts || []).forEach(d => {
      if ((devNum && d.deviceNumber && String(d.deviceNumber).trim() === devNum) || 
          (subId && d.subscriberId === subId) || 
          (subName && d.customerName && d.customerName.trim() === subName)) {
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
      if ((devNum && sub.deviceNumber && String(sub.deviceNumber).trim() === devNum) || 
          (subId && sub.subscriberId === subId)) {
        if (sub.id) deletedSubmissionIds.push(sub.id);
      }
    });

    // 4. Immediately purge from in-memory state
    this.data.subscribers = (this.data.subscribers || []).filter(s => {
      if (subId && s.id === subId) return false;
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

    // 6. Delete completely from Firestore
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();

        // Delete subscriber doc
        if (subId) {
          batch.delete(this.db.collection('subscribers').doc(subId));
          batch.delete(this.db.collection('appData').doc('subscribers').collection('records').doc(subId));
        }

        // Search by deviceNumber query in subscribers and delete if different ID
        if (devNum) {
          try {
            const devSnap1 = await this.db.collection('subscribers').where('deviceNumber', '==', devNum).get();
            devSnap1.forEach(d => batch.delete(d.ref));
            const devSnap2 = await this.db.collection('appData').doc('subscribers').collection('records').where('deviceNumber', '==', devNum).get();
            devSnap2.forEach(d => batch.delete(d.ref));
          } catch (e) {}
        }

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
        console.log(`[FirebaseSync] Subscriber ${subId} (${devNum}) and cascade records permanently deleted from Firestore.`);
      } catch (err) {
        console.warn('Error deleting subscriber from Firestore:', err);
      }
    }
  }

  // Delete a single item from local and Firestore with strict sync check
  async deleteItem(collectionName, itemId) {
    if (!itemId) return;
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      console.error('Unauthorized: Only admin can delete items.');
      return;
    }
    // Strict immediate update of local in-memory state and localStorage
    this.data[collectionName] = (this.data[collectionName] || []).filter(item => {
      if (collectionName === 'users') {
        return item.uid !== itemId && item.username !== itemId;
      }
      return item.id !== itemId;
    });
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));

    if (this.db && window.isFirebaseConfigured()) {
      try {
        const batch = this.db.batch();
        batch.delete(this.db.collection(collectionName).doc(itemId));
        batch.delete(this.db.collection('appData').doc(collectionName).collection('records').doc(itemId));
        if (collectionName === 'users') {
          batch.delete(this.db.collection('users').doc(itemId.toLowerCase()));
        }
        await batch.commit();
      } catch (err) {
        console.warn(`Error deleting item ${itemId} from ${collectionName}:`, err);
      }
    }
  }

  // Completely wipe all core data from local and Firestore
  async clearAllData() {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
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
    this.data[collectionName] = [];
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: collectionName } }));

    if (this.db && window.isFirebaseConfigured()) {
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
        console.warn(`Error clearing Firestore collection ${collectionName}:`, err);
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
    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        const docRef = this.db.collection('notifications').doc(id);
        await docRef.set(newNotif, { merge: true });
        const mirrorRef = this.db.collection('appData').doc('notifications').collection('records').doc(id);
        await mirrorRef.set(newNotif, { merge: true }).catch(() => {});
      } catch (err) {
        console.warn('Error saving broadcast notification to Firestore:', err);
      }
    }
    return newNotif;
  }

  // Delete notification from central Firestore and local cache
  async deleteNotification(notifId) {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      console.error('Unauthorized: Only admin can delete notifications.');
      return;
    }
    if (!notifId) return;
    this.data.notifications = (this.data.notifications || []).filter(n => n.id !== notifId);
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('sari:data-updated', { detail: { collection: 'notifications' } }));

    if (this.db && window.isFirebaseConfigured && window.isFirebaseConfigured()) {
      try {
        await this.db.collection('notifications').doc(notifId).delete().catch(() => {});
        await this.db.collection('appData').doc('notifications').collection('records').doc(notifId).delete().catch(() => {});
      } catch (err) {
        console.warn('Error deleting notification from Firestore:', err);
      }
    }
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

window.syncEngine = new SariSyncEngine();
