/**
 * Main Application Logic
 * Al-Sari Terrestrial Broadcast Management System
 * الساري للبث الأرضي
 */

(function () {
  'use strict';

  // --- Utility Functions ---
  function getEngine() {
    return window.syncEngine;
  }

  function getData() {
    return getEngine() ? getEngine().data : {};
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatIQD(num) {
    if (num === null || num === undefined || num === '') return '0 د.ع';
    const clean = typeof num === 'string' ? num.replace(/[^\d.-]/g, '') : num;
    const val = Number(clean) || 0;
    return val.toLocaleString('en-US') + ' د.ع';
  }

  if (!window.normalizeSearchQuery) {
    window.normalizeSearchQuery = function(str) {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim();
    };
  }

  function formatNumber(num) {
    if (num === null || num === undefined || num === '') return '0';
    const clean = typeof num === 'string' ? num.replace(/[^\d.-]/g, '') : num;
    const val = Number(clean) || 0;
    return val.toLocaleString('en-US');
  }

  function parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    const clean = typeof val === 'string' ? val.replace(/[^\d.-]/g, '') : val;
    return Number(clean) || 0;
  }

  function formatInputWithCommas(input) {
    if (!input) return;
    const cursor = input.selectionStart || 0;
    const oldLength = input.value.length;
    const raw = input.value.replace(/[^\d]/g, '');
    if (!raw) {
      input.value = '';
      return;
    }
    const formatted = Number(raw).toLocaleString('en-US');
    input.value = formatted;
    try {
      const newLength = formatted.length;
      const diff = newLength - oldLength;
      input.setSelectionRange(cursor + diff, cursor + diff);
    } catch (e) {}
  }

  window.formatNumber = formatNumber;
  window.parseNumber = parseNumber;
  window.formatInputWithCommas = formatInputWithCommas;
  window.formatIQD = formatIQD;

  function normalizeDigits(str) {
    if (!str) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(str).replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
                      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d));
  }

  function normalizeIraqiPhone(phone) {
    if (!phone) return '';
    let clean = normalizeDigits(phone).replace(/\D/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('964')) clean = '964' + clean;
    return clean;
  }
  window.normalizeIraqiPhone = normalizeIraqiPhone;

  function getEnUsToday() {
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  }

  function getGreeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'صباح الخير والبركة ☀️' : 'مساء الخير والنشاط 🌙';
  }

  function generateSaleCode() {
    const num = Math.floor(10000 + Math.random() * 90000);
    return `SR-${num}`;
  }
  window.generateSaleCode = generateSaleCode;

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showConfirmDialog(title, message, onConfirm) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="confirm-modal" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 420px; text-align: center;" onclick="event.stopPropagation()">
          <div class="modal-body" style="padding: 28px 24px;">
            <div style="font-size: 2.5rem; margin-bottom: 12px; color: var(--warning);">⚠️</div>
            <h3 style="margin-bottom: 8px;">${escapeHtml(title)}</h3>
            <p style="color: var(--text-sub); font-size: 0.95rem;">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer" style="justify-content: center; gap: 14px;">
            <button class="btn btn-secondary" id="confirm-btn-cancel">إلغاء</button>
            <button class="btn btn-danger" id="confirm-btn-ok">تأكيد ومتابعة</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('confirm-btn-cancel').onclick = () => {
      window.closeModal();
    };

    document.getElementById('confirm-btn-ok').onclick = () => {
      window.closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }

  window.showConfirmDialog = showConfirmDialog;

  // --- Auth & State Handling ---
  window.currentPage = 'dashboard';
  let currentPage = window.currentPage;
  let salesFilter = { seller: 'all', type: 'all', paymentStatus: 'all', search: '' };
  let subscribersFilter = { owner: 'all', status: 'all', search: '' };
  let selectedBarcodes = new Set();

  function initApp() {
    // Set Live en-US Date
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.textContent = getEnUsToday();

    // Check restored session
    let restored = getEngine().restoreSession();
    if (!restored) {
      const explicitlyLoggedOut = localStorage.getItem('sari_explicit_logout') === 'true';
      if (!explicitlyLoggedOut) {
        // Auto-login default admin to open system directly without blocking user
        const users = getEngine().data?.users || [];
        const defaultAdmin = users.find(u => u.username === 'abodsari') || 
                             users.find(u => u.username === 'admin') || 
                             users.find(u => (typeof window.isSystemAdmin === 'function' ? window.isSystemAdmin(u) : u.role === 'admin')) || {
          uid: 'u-admin-abodsari',
          username: 'abodsari',
          displayName: 'أدمن المركز (abodsari)',
          role: 'admin',
          agentName: '',
          agentCode: ''
        };
        getEngine().currentUser = defaultAdmin;
        try {
          localStorage.setItem('sari_active_session', JSON.stringify(defaultAdmin));
          sessionStorage.setItem('sari_active_session', JSON.stringify(defaultAdmin));
          if (getEngine().db) {
            getEngine().forceSync();
            getEngine().startRealtimeSync();
            if (window.fixMissingAgents) window.fixMissingAgents();
          }
        } catch (e) {}
        restored = defaultAdmin;
      }
    }

    if (restored) {
      renderAppView(restored);
    } else {
      renderLoginView();
    }

    attachGlobalEvents();
  }

  function renderLoginView() {
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('app-view').style.display = 'none';
  }

  function renderAppView(user) {
    if (typeof window.resetAgentNotificationBaseline === 'function') {
      window.resetAgentNotificationBaseline();
      window.checkAdminPendingSubmissionsNotification();
      window.checkAgentPendingSubmissionsNotification();
    }
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';

    // Set User info in UI
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');
    const badgeEl = document.getElementById('sidebar-role-label');

    if (nameEl) nameEl.textContent = user.displayName || user.username;
    if (avatarEl) avatarEl.textContent = (user.displayName || user.username).substring(0, 1);

    const isAdmin = typeof window.isSystemAdmin === 'function' ? window.isSystemAdmin(user) : (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي' || user.username === 'abodsari' || user.username === 'admin');

    if (typeof window.initNotificationsSystem === 'function') {
      window.initNotificationsSystem();
    }

    if (isAdmin) {
      if (roleEl) roleEl.textContent = 'أدمن رئيسي';
      if (badgeEl) badgeEl.textContent = 'نظام إدارة المركز - رئيسي';
      document.getElementById('sidebar-nav-admin').style.display = 'flex';
      document.getElementById('sidebar-nav-agent').style.display = 'none';
      navigateTo('dashboard');
    } else {
      if (roleEl) roleEl.textContent = 'وكيل معتمد';
      if (badgeEl) badgeEl.textContent = `وكيل: ${user.agentName || user.displayName}`;
      document.getElementById('sidebar-nav-admin').style.display = 'none';
      document.getElementById('sidebar-nav-agent').style.display = 'flex';
      navigateTo('agent-dash');
    }
  }

  // Navigation router
  function navigateTo(page) {
    window.currentPage = page;
    currentPage = page;
    window.currentView = page;
    const currentUser = (typeof getEngine === 'function' && getEngine().currentUser) || null;
    const isAgent = currentUser && !(typeof window.isSystemAdmin === 'function' ? window.isSystemAdmin(currentUser) : (currentUser.role === 'admin' || currentUser.role === 'أدمن' || currentUser.role === 'مدير رئيسي' || currentUser.username === 'abodsari' || currentUser.username === 'admin'));
    const pageTitleMap = {
      dashboard: 'الداشبورد',
      sales: 'المبيعات',
      'pending-requests': 'الطلبات المعلقة',
      agents: 'الوكلاء',
      debts: 'الديون',
      subscribers: 'المشتركون',
      barcodes: 'الأكواد والباركود',
      reports: 'التقارير والاهداف',
      products: isAgent ? 'المنتجات والهدف' : 'المنتجات',
      pricing: 'الأسعار',
      users: 'حساب الادمن',
      'agent-dash': 'لوحة الوكيل',
      'agent-sales': 'مبيعاتي وديوني'
    };

    const titleEl = document.getElementById('topbar-current-page');
    if (titleEl) titleEl.textContent = pageTitleMap[page] || page;

    // Update active nav-item
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      if (el.getAttribute('data-page') === page) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Close mobile menu if open
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('active');

    updatePendingApprovalsBadge();

    // Reset scroll to top on page switch
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, behavior: 'instant' });
    const scrollBtn = document.getElementById('btn-scroll-to-top');
    if (scrollBtn) scrollBtn.classList.remove('visible');

    const mainEl = document.getElementById('main-content');
    if (!mainEl) return;
    mainEl.scrollTop = 0;

    switch (page) {
      case 'dashboard': renderDashboard(mainEl); break;
      case 'sales': renderSales(mainEl); break;
      case 'pending-requests': renderPendingRequests(mainEl); break;
      case 'agents': renderAgents(mainEl); break;
      case 'debts': renderDebts(mainEl); break;
      case 'subscribers': window.renderSubscribers(mainEl); break;
      case 'barcodes': renderBarcodes(mainEl); break;
      case 'reports': renderReports(mainEl); break;
      case 'products': renderProducts(mainEl); break;
      case 'pricing': renderPricing(mainEl); break;
      case 'users': renderUsers(mainEl); break;
      case 'agent-dash': renderAgentDashboard(mainEl); break;
      case 'agent-sales': renderAgentSales(mainEl); break;
      default: renderDashboard(mainEl); break;
    }
  }

  // Expose to window for inline calls
  window.navigateTo = navigateTo;
  window.showToast = showToast;
  
  window.updatePendingApprovalsBadge = function() {
    const data = getData();
    const pending = (data.agentSubmissions || []).length;
    const badge = document.getElementById('pending-requests-badge');
    if (badge) {
      if (pending > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = pending;
      } else {
        badge.style.display = 'none';
      }
    }

    const menuToggle = document.getElementById('menu-toggle-btn');
    if (menuToggle) {
      if (pending === 0 && !menuToggle.classList.contains('pulsed-clicked')) {
        menuToggle.classList.add('menu-pulsing');
      } else {
        menuToggle.classList.remove('menu-pulsing');
      }
    }
  };

  window.quickFillLogin = function(user, pass) {
    try {
      localStorage.removeItem('sari_explicit_logout');
    } catch (e) {}
    document.getElementById('login-username').value = user;
    document.getElementById('login-password').value = pass;
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  };

  // --- Global Event Listeners ---
  function attachGlobalEvents() {
    window.addEventListener('sari:data-updated', (e) => {
      updatePendingApprovalsBadge();
      if (typeof window.checkAdminPendingSubmissionsNotification === 'function') {
        window.checkAdminPendingSubmissionsNotification();
      }
      if (typeof window.checkAgentPendingSubmissionsNotification === 'function') {
        window.checkAgentPendingSubmissionsNotification();
      }
      // Real-time update for subscribers list
      if (e.detail?.collection === 'subscribers' || e.detail?.collection === 'all') {
        const mainContent = document.getElementById('main-content');
        if (mainContent && window.currentView === 'subscribers' && typeof window.renderSubscribers === 'function') {
          window.renderSubscribers(mainContent);
        }
      }
      // Real-time update for debts list
      if (e.detail?.collection === 'debts' || e.detail?.collection === 'all') {
        const mainContent = document.getElementById('main-content');
        if (mainContent && window.currentView === 'debts' && typeof window.renderDebts === 'function') {
          window.renderDebts(mainContent);
        }
      }
    });

    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';

        try {
          try {
            localStorage.removeItem('sari_explicit_logout');
          } catch (e) {}
          const res = await getEngine().login(username, password);
          if (res && res.user) {
            showToast(`أهلاً بك، ${res.user.displayName || res.user.username}!`, 'success');
            renderAppView(res.user);
          }
        } catch (err) {
          errEl.textContent = err.message || 'اسم الحساب أو كلمة المرور غير صحيحة.';
          errEl.style.display = 'block';
        }
      });
    }

    // Sidebar navigation clicks
    document.querySelectorAll('.sidebar-nav').forEach(nav => {
      nav.addEventListener('click', (e) => {
        const item = e.target.closest('.nav-item');
        if (item && item.getAttribute('data-page')) {
          e.preventDefault();
          navigateTo(item.getAttribute('data-page'));
        }
      });
    });

    // Mobile Hamburger
    const menuToggle = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (menuToggle && sidebar && backdrop) {
      const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuToggle.classList.add('pulsed-clicked');
        menuToggle.classList.remove('menu-pulsing');
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('active');
      };
      menuToggle.addEventListener('click', toggleMenu);
      menuToggle.addEventListener('touchend', toggleMenu, { passive: false });

      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
      });
    }

    // Theme toggle ◐
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      const savedTheme = localStorage.getItem('sari_theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('sari_theme', next);
        showToast(next === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
      });
    }

    // Refresh / Sync ↻
    const syncBtn = document.getElementById('btn-sync-data');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => syncBtn.style.transform = '', 500);
        showToast('جاري تحديث البيانات من السيرفر...', 'info');
        await getEngine().forceSync();
        navigateTo(currentPage);
        showToast('تم تحديث البيانات بنجاح', 'success');
      });
    }

    // Logout
    function handleLogout() {
      showConfirmDialog('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج من النظام؟', () => {
        if (typeof window.resetAgentNotificationBaseline === 'function') {
          window.resetAgentNotificationBaseline();
        }
        try {
          localStorage.setItem('sari_explicit_logout', 'true');
        } catch (e) {}
        getEngine().logout();
        renderLoginView();
        showToast('تم تسجيل الخروج بنجاح');
      });
    }

    document.getElementById('btn-topbar-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-quick-logout')?.addEventListener('click', handleLogout);

    // Listen to data-updated events from syncEngine
    window.addEventListener('sari:data-updated', () => {
      navigateTo(currentPage);
    });

    // Circular Scroll-to-Top Button (دائرة سهم للرجوع إلى الأعلى)
    const scrollToTopBtn = document.getElementById('btn-scroll-to-top');

    function updateScrollToTopVisibility() {
      if (!scrollToTopBtn) return;
      const winScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const mainEl = document.getElementById('main-content');
      const mainScroll = mainEl ? mainEl.scrollTop : 0;
      const currentScroll = Math.max(winScroll, mainScroll);

      if (currentScroll > 40) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', updateScrollToTopVisibility, { passive: true });
    document.addEventListener('scroll', updateScrollToTopVisibility, { passive: true, capture: true });

    if (scrollToTopBtn) {
      const executeScrollToTop = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
        const mainEl = document.getElementById('main-content');
        if (mainEl) {
          mainEl.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const openContainers = document.querySelectorAll('.modal-dialog, .modal-body, .table-responsive');
        openContainers.forEach(el => {
          if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
        });
      };
      scrollToTopBtn.addEventListener('click', executeScrollToTop);
      scrollToTopBtn.addEventListener('touchend', executeScrollToTop, { passive: false });
    }
  }

  // --- Page 1: Dashboard ---
  function renderDashboard(container) {
    const data = getData();
    const sales = data.sales || [];
    const debts = data.debts || [];
    const agents = data.agents || [];
    const subscribers = data.subscribers || [];

    const totalSalesVal = sales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const todayStr = new Date().toISOString().substring(0, 10);
    const todaySalesVal = sales.filter(s => (s.startDate || s.createdAt || '').startsWith(todayStr))
                               .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const totalOutstandingDebt = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);

    // Agent Performance Statistics Calculations
    const agentStats = agents.map(ag => {
      const agSales = sales.filter(s => s.seller === ag.name || s.agentName === ag.name || (ag.username && s.seller === ag.username));
      const totalSalesAmount = agSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const agSubs = subscribers.filter(s => s.owner === ag.name || s.owner === ag.username || s.owner === ag.code);
      const newDeviceSales = agSales.filter(s => s.saleType === 'جهاز جديد' || s.saleType === 'أجهزة جديدة' || s.saleType === 'اشتراك جديد');
      const newSubscribersCount = Math.max(agSubs.length, newDeviceSales.length);
      const renewalsSales = agSales.filter(s => s.saleType === 'تجديد اشتراك' || (s.saleType && s.saleType.includes('تجديد')) || (s.subscriptionType && s.subscriptionType.includes('تجديد')));
      const renewalsCount = renewalsSales.length;

      const totalOperations = newDeviceSales.length + renewalsCount;
      const renewalRate = totalOperations > 0 
        ? Math.min(100, Math.round((renewalsCount / totalOperations) * 100))
        : (agSales.length > 0 ? Math.min(100, Math.round((renewalsCount / agSales.length) * 100)) : 0);

      let performanceStatus = 'نشط';
      let statusBadge = 'badge-success';
      if (renewalRate >= 70 && totalSalesAmount > 0) {
        performanceStatus = 'ممتاز 🌟';
        statusBadge = 'badge-success';
      } else if (renewalRate >= 40) {
        performanceStatus = 'جيد 👍';
        statusBadge = 'badge-info';
      } else if (agSales.length > 0) {
        performanceStatus = 'متوسط ⚡';
        statusBadge = 'badge-warning';
      } else {
        performanceStatus = 'جديد / خامل';
        statusBadge = 'badge-neutral';
      }

      return {
        agent: ag,
        newSubscribersCount,
        totalSalesAmount,
        salesCount: agSales.length,
        renewalsCount,
        renewalRate,
        performanceStatus,
        statusBadge
      };
    });

    const totalAgentNewSubs = agentStats.reduce((sum, a) => sum + a.newSubscribersCount, 0);
    const totalAgentSalesAmount = agentStats.reduce((sum, a) => sum + a.totalSalesAmount, 0);
    const totalAgentRenewals = agentStats.reduce((sum, a) => sum + a.renewalsCount, 0);
    const totalAgentOps = agentStats.reduce((sum, a) => sum + (a.newSubscribersCount + a.renewalsCount), 0);
    const avgRenewalRate = totalAgentOps > 0 ? Math.round((totalAgentRenewals / totalAgentOps) * 100) : 0;

    // 7-day Sales Chart Calculation with ar-IQ day labels
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const chartPoints = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().substring(0, 10);
      const daySales = sales.filter(s => (s.startDate || s.createdAt || '').startsWith(iso))
                            .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      chartPoints.push({
        dayName: days[d.getDay()],
        date: iso,
        amount: daySales
      });
    }

    const maxChartVal = Math.max(...chartPoints.map(p => p.amount), 100000);
    const svgWidth = 600;
    const svgHeight = 160;
    const pts = chartPoints.map((p, idx) => {
      const x = 40 + idx * ((svgWidth - 80) / 6);
      const y = svgHeight - 30 - ((p.amount / maxChartVal) * (svgHeight - 60));
      return { x, y, ...p };
    });

    const polylinePts = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaPts = `40,${svgHeight - 30} ` + polylinePts + ` ${svgWidth - 40},${svgHeight - 30}`;

    // Recent Operations (last 6)
    const recentSales = [...sales].reverse().slice(0, 6);

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">${getGreeting()}</span>
            <h1>الداشبورد العام للمركز</h1>
            <p class="subtitle">نظرة شاملة ومباشرة على المبيعات، الوكلاء، والديون القائمة</p>
          </div>
        </div>

        <!-- 4 Stat Cards -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-title">إجمالي المبيعات</span>
              <div class="stat-icon">💰</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value">${formatNumber(totalSalesVal)}</span>
              <span class="stat-unit">د.ع</span>
            </div>
            <div class="stat-footer"><span>عدد العمليات الإجمالي:</span> <strong>${sales.length} عملية</strong></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-title">مبيعات اليوم</span>
              <div class="stat-icon">📈</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value">${formatNumber(todaySalesVal)}</span>
              <span class="stat-unit">د.ع</span>
            </div>
            <div class="stat-footer"><span>معدل النشاط الحالي:</span> <strong>مباشر</strong></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-title">الوكلاء النشطون</span>
              <div class="stat-icon">👥</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value">${agents.length}</span>
              <span class="stat-unit">وكيل</span>
            </div>
            <div class="stat-footer"><span>تغطية شبكة الساري:</span> <strong>مستقرة</strong></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-title">الديون المستحقة</span>
              <div class="stat-icon">⏳</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value" style="color: var(--danger);">${formatNumber(totalOutstandingDebt)}</span>
              <span class="stat-unit">د.ع</span>
            </div>
            <div class="stat-footer"><span>الديون غير المسددة:</span> <strong>${debts.filter(d => d.remainingAmount > 0).length} سجل</strong></div>
          </div>
        </div>



        <!-- Agent Summary Cards -->
        <div class="stat-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px;">
          ${(() => {
            const agentStats = { 'المركز الرئيسي': { sales: 0, paid: 0, debt: 0 } };
            const agents = data.agents || [];
            agents.forEach(a => agentStats[a.name] = { sales: 0, paid: 0, debt: 0 });

            data.sales.forEach(s => {
              const seller = s.seller || s.agentName || 'المركز الرئيسي';
              const key = agentStats.hasOwnProperty(seller) ? seller : 'المركز الرئيسي';
              agentStats[key].sales += Number(s.price) || 0;
            });

            data.debts.forEach(d => {
              const seller = d.seller || d.agentName || 'المركز الرئيسي';
              const key = agentStats.hasOwnProperty(seller) ? seller : 'المركز الرئيسي';
              agentStats[key].paid += Number(d.paidAmount) || 0;
              agentStats[key].debt += Number(d.remainingAmount) || 0;
            });

            return Object.entries(agentStats).map(([name, stats]) => `
              <div class="stat-card" style="flex: 1;">
                <div class="stat-card-header"><span class="stat-title">${escapeHtml(name)}</span></div>
                <div style="font-size: 0.8rem; padding: 5px 0;">
                  <div>مبيعات: ${formatNumber(stats.sales)}</div>
                  <div>مسدد: ${formatNumber(stats.paid)}</div>
                  <div style="color: var(--danger);">متبقي: ${formatNumber(stats.debt)}</div>
                </div>
              </div>
            `).join('');
          })()}
        </div>

        <!-- Sales Chart Card -->
        <div class="content-card">
          <div class="card-header-bar">
            <h3>مخطط حركة المبيعات لآخر 7 أيام</h3>
            <span class="badge badge-neutral">بالدينار العراقي</span>
          </div>
          <div style="overflow-x: auto;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 180px; overflow: visible;">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#245b89" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#245b89" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              <!-- Grid line -->
              <line x1="40" y1="${svgHeight - 30}" x2="${svgWidth - 40}" y2="${svgHeight - 30}" stroke="var(--line)" stroke-width="1.5" />
              <!-- Area -->
              <polygon points="${areaPts}" fill="url(#chartGrad)" />
              <!-- Polyline -->
              <polyline points="${polylinePts}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <!-- Points & Labels -->
              ${pts.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff" stroke="var(--green)" stroke-width="2.5" />
                <text x="${p.x}" y="${svgHeight - 10}" font-size="11" fill="var(--text-sub)" text-anchor="middle" font-weight="600">${p.dayName}</text>
                ${p.amount > 0 ? `<text x="${p.x}" y="${p.y - 10}" font-size="10" fill="var(--ink)" text-anchor="middle" font-weight="700">${(p.amount / 1000).toFixed(0)}k</text>` : ''}
              `).join('')}
            </svg>
          </div>
        </div>

        <!-- Agent Performance Detailed Card -->
        <div class="content-card">
          <div class="card-header-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="display: flex; align-items: center; gap: 8px; margin: 0;">
                <span>📊</span>
                <span>إحصائيات أداء الوكلاء والموزعين</span>
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-sub); margin: 4px 0 0 0;">متابعة فورية ومباشرة للأداء الميداني: المشتركون الجدد، إجمالي المبيعات، ومعدل التجديد</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="badge badge-neutral" style="font-size: 0.8rem; font-weight: 700;">${agents.length} وكيل معتمد</span>
              <button class="btn btn-secondary btn-sm" onclick="navigateTo('agents')" style="padding: 4px 10px; font-size: 0.8rem;">إدارة الوكلاء ←</button>
            </div>
          </div>

          <!-- Summary KPI Stats -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; padding: 12px; background: var(--surface-alt); border-radius: var(--radius-md); border: 1px solid var(--line);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 1.6rem; background: rgba(36, 91, 137, 0.1); padding: 6px 10px; border-radius: var(--radius-md);">👥</div>
              <div>
                <span style="font-size: 0.76rem; color: var(--text-sub); display: block;">إجمالي المشتركين الجدد</span>
                <strong style="font-size: 1.15rem; color: var(--ink);">${formatNumber(totalAgentNewSubs)} مشترك</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 1.6rem; background: rgba(40, 167, 69, 0.1); padding: 6px 10px; border-radius: var(--radius-md);">💰</div>
              <div>
                <span style="font-size: 0.76rem; color: var(--text-sub); display: block;">إجمالي مبيعات الوكلاء</span>
                <strong style="font-size: 1.15rem; color: var(--success);">${formatIQD(totalAgentSalesAmount)}</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="font-size: 1.6rem; background: rgba(255, 193, 7, 0.15); padding: 6px 10px; border-radius: var(--radius-md);">🔄</div>
              <div>
                <span style="font-size: 0.76rem; color: var(--text-sub); display: block;">متوسط معدل التجديد</span>
                <strong style="font-size: 1.15rem; color: #b78103;">${avgRenewalRate}% (${totalAgentRenewals} تجديد)</strong>
              </div>
            </div>
          </div>

          <!-- Agent Performance Table -->
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>الوكيل / الرمز</th>
                  <th>عدد المشتركين الجدد</th>
                  <th>إجمالي المبيعات</th>
                  <th>عمليات التجديد</th>
                  <th>معدل التجديد</th>
                  <th style="text-align: center;">تقييم الأداء</th>
                  <th style="text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${agentStats.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 24px;">لا يوجد وكلاء مسجلون حالياً</td></tr>` : 
                  agentStats.map(st => `
                    <tr>
                      <td>
                        <strong class="cell-title">${escapeHtml(st.agent.name)}</strong>
                        <div class="cell-subtitle">${escapeHtml(st.agent.code || '')} ${st.agent.phone ? `· ${escapeHtml(st.agent.phone)}` : ''}</div>
                      </td>
                      <td>
                        <span class="badge badge-neutral" style="font-weight: 700; font-size: 0.85rem;">
                          👥 ${formatNumber(st.newSubscribersCount)} مشترك
                        </span>
                      </td>
                      <td>
                        <strong style="color: var(--ink); font-size: 0.9rem;">${formatIQD(st.totalSalesAmount)}</strong>
                        <div class="cell-subtitle">${st.salesCount} عملية بيع</div>
                      </td>
                      <td>
                        <strong style="color: var(--green); font-size: 0.88rem;">🔄 ${st.renewalsCount}</strong>
                        <span class="cell-subtitle">تجديد</span>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="flex: 1; height: 7px; background: rgba(0,0,0,0.08); border-radius: 4px; overflow: hidden; min-width: 50px;">
                            <div style="width: ${st.renewalRate}%; height: 100%; background: ${st.renewalRate >= 70 ? 'var(--success)' : (st.renewalRate >= 40 ? 'var(--warning)' : 'var(--danger)')}; border-radius: 4px;"></div>
                          </div>
                          <strong style="font-size: 0.82rem; min-width: 34px; text-align: left;">${st.renewalRate}%</strong>
                        </div>
                      </td>
                      <td style="text-align: center;">
                        <span class="badge ${st.statusBadge}" style="font-size: 0.76rem;">${st.performanceStatus}</span>
                      </td>
                      <td style="text-align: center;">
                        <button class="btn btn-secondary btn-sm" onclick="setSalesFilter('seller', '${escapeHtml(st.agent.name)}'); navigateTo('sales');" style="padding: 2px 8px; font-size: 0.74rem;">
                          مبيعاته ←
                        </button>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="content-card">
          <div class="card-header-bar">
            <h3>آخر العمليات</h3>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('sales')">عرض الكل ←</button>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>الفاتورة / التاريخ</th>
                  <th>الزبون / البائع</th>
                  <th>نوع العملية</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${recentSales.length === 0 ? `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 30px;">لا توجد عمليات مسجلة بعد</td></tr>` : 
                  recentSales.map(s => `
                    <tr>
                      <td>
                        <strong style="color: var(--green); font-size: 0.85rem;">${escapeHtml(s.code)}</strong>
                        <div class="cell-subtitle" style="direction: ltr; text-align: right;">${escapeHtml((s.startDate || s.createdAt || '').substring(0, 10))}</div>
                      </td>
                      <td>
                        <strong class="cell-title">${escapeHtml(s.customerName)}</strong>
                        <div class="cell-subtitle">${escapeHtml(s.seller)}</div>
                      </td>
                      <td>${escapeHtml(s.saleType || s.subscriptionType)}</td>
                      <td><strong>${formatIQD(s.price)}</strong></td>
                      <td>
                        <span class="badge ${s.paymentStatus === 'تم التسديد' ? 'badge-success' : 'badge-danger'}">
                          ${escapeHtml(s.paymentStatus)}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

  }

  // --- Page 2: Sales ---
  window.formatWhatsAppMessage = function(s, templateOverride) {
    const engine = getEngine();
    const defaultTpl = window.DEFAULT_WHATSAPP_TEMPLATE || `السلام عليكم ورحمة الله

• المشترك: «اسم الزبون»🌟

تمت عملية «تجديد اشتراك» بنجاح.
• المدة: «مدة تجديد اشتراك»
• المبلغ: «المبلغ» د.ع
• المدفوع: «المبلغ المدفوع» د.ع
• المتبقي: «المبلغ المتبقي» د.ع
• تاريخ الانتهاء: «تاريخ انتهاء الاشتراك»

شكراً لثقتكم — الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية 📡`;

    const tpl = templateOverride || engine?.data?.templates?.whatsapp || defaultTpl;

    const customerName = s.customerName || s.name || '';
    const saleType = s.saleType || s.subscriptionType || 'تجديد اشتراك';
    const duration = s.subscriptionType || s.saleType || 'اشتراك شهر واحد';
    const price = formatNumber(Number(s.price) || 0);
    const isPaidFull = s.paymentStatus === 'تم التسديد';
    const paidVal = isPaidFull ? (Number(s.price) || 0) : (Number(s.agentPaid) || 0);
    const paid = formatNumber(paidVal);
    const remainingVal = Math.max(0, (Number(s.price) || 0) - paidVal);
    const remaining = formatNumber(remainingVal);
    const endDate = s.endDate || s.expiryDate || '-';
    const deviceNumber = s.deviceNumber || '-';

    let msg = tpl;
    msg = msg.replace(/«اسم الزبون»|\{customerName\}|\{اسم_الزبون\}|\{المشترك\}/g, customerName);
    msg = msg.replace(/«تجديد اشتراك»|\{saleType\}|\{نوع_العملية\}/g, saleType);
    msg = msg.replace(/«مدة تجديد اشتراك»|\{duration\}|\{المدة\}/g, duration);
    msg = msg.replace(/«المبلغ»|\{price\}|\{المبلغ\}/g, price);
    msg = msg.replace(/«المبلغ المدفوع»|\{paid\}|\{المدفوع\}|\{المبلغ_المدفوع\}/g, paid);
    msg = msg.replace(/«المبلغ المتبقي»|\{remaining\}|\{المتبقي\}|\{المبلغ_المتبقي\}/g, remaining);
    msg = msg.replace(/«تاريخ انتهاء الاشتراك»|\{endDate\}|\{تاريخ_الانتهاء\}/g, endDate);
    msg = msg.replace(/«رقم الجهاز»|\{deviceNumber\}|\{رقم_الجهاز\}/g, deviceNumber);

    return msg;
  };

  window.renderPendingSubmissions = function(container) {
    const data = getData();
    const pendingSubmissions = data.agentSubmissions || [];
    if (pendingSubmissions.length === 0) {
      container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted);">لا توجد طلبات معلقة بانتظار الاعتماد.</p>';
      return;
    }
    container.innerHTML = `
      <div class="content-card" style="border: 2px solid var(--warning); background: var(--warning-bg);">
        <div class="card-header-bar" style="margin-bottom: 12px;">
          <h3 style="color: var(--warning); display: flex; align-items: center; gap: 8px;">
            <span>🔔</span>
            <span>طلبات بيع وتجديد من الوكلاء (${pendingSubmissions.length})</span>
          </h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>الزبون والوكيل</th>
                <th>الجهاز / نوع الطلب</th>
                <th>فترة الاشتراك</th>
                <th>المبلغ</th>
                <th style="text-align: center;">إجراءات الاعتماد</th>
              </tr>
            </thead>
            <tbody>
              ${pendingSubmissions.map(req => `
                <tr>
                  <td>
                    <strong class="cell-title">${escapeHtml(req.customerName)}</strong>
                    <div class="cell-subtitle">
                      <span class="badge badge-neutral" style="font-size: 0.68rem; padding: 1px 5px;">${escapeHtml(window.resolveAgentName ? window.resolveAgentName(req) : (req.agentName || req.seller))}</span>
                      ${req.customerPhone ? `<span style="direction: ltr; margin-right: 4px;">${escapeHtml(req.customerPhone)}</span>` : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-family: monospace; font-size: 0.84rem;">
                      <span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal('${escapeHtml(req.deviceNumber)}')" title="انقر لعرض QR Code">${escapeHtml(req.deviceNumber)}</span>
                    </div>
                    <div class="cell-subtitle">${escapeHtml(req.subscriptionType || req.saleType || 'تجديد')}</div>
                  </td>
                  <td>
                    <div class="cell-date-range" style="direction: ltr;">
                      <span class="cell-date-from">بدء: ${escapeHtml(req.startDate || '-')}</span>
                      <span class="cell-date-to">انتهاء: ${escapeHtml(req.endDate || '-')}</span>
                    </div>
                  </td>
                  <td><strong class="cell-title">${formatIQD(req.price || 0)}</strong></td>
                  <td style="text-align: center;">
                    <div class="action-btns" style="justify-content: center;">
                      <button class="btn btn-success btn-sm" onclick="approveSubmission('${req.id}', 'نقد')" style="padding: 3px 7px; font-size: 0.75rem;">قبول نقد</button>
                      <button class="btn btn-secondary btn-sm" onclick="approveSubmission('${req.id}', 'دين')" style="padding: 3px 7px; font-size: 0.75rem;">قبول دين</button>
                      <button class="btn btn-danger btn-sm" onclick="rejectSubmission('${req.id}')" style="padding: 3px 7px; font-size: 0.75rem;">رفض</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  function renderSales(container) {
    const data = getData();
    let sales = data.sales || [];
    const agents = data.agents || [];
    // ... rest of original renderSales logic ...

    // Filter calculations
    if (salesFilter.seller !== 'all') {
      sales = sales.filter(s => s.seller === salesFilter.seller);
    }
    if (salesFilter.type !== 'all') {
      sales = sales.filter(s => {
        if (salesFilter.type === 'devices') return s.saleType === 'جهاز جديد' || s.subscriptionType === 'أجهزة جديدة';
        if (salesFilter.type === 'subscriptions') return s.saleType === 'تجديد اشتراك';
        return true;
      });
    }
    if (salesFilter.paymentStatus && salesFilter.paymentStatus !== 'all') {
      sales = sales.filter(s => {
        if (salesFilter.paymentStatus === 'نقد' || salesFilter.paymentStatus === 'تم التسديد') {
          return s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد';
        }
        if (salesFilter.paymentStatus === 'دين' || salesFilter.paymentStatus === 'عليه دين') {
          return s.paymentMethod === 'دين' || s.paymentStatus === 'دين' || s.paymentStatus === 'عليه دين' || ((Number(s.price) || 0) - (Number(s.agentPaid) || 0) > 0);
        }
        return s.paymentStatus === salesFilter.paymentStatus || s.paymentMethod === salesFilter.paymentStatus;
      });
    }
    if (salesFilter.search) {
      const qRaw = salesFilter.search.trim();
      const qNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(qRaw) : qRaw.toLowerCase();
      const qDigits = qRaw.replace(/\D/g, '');

      sales = sales.filter(s => {
        const cNameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.customerName || '') : (s.customerName || '').toLowerCase();
        const phoneClean = (s.customerPhone || '').replace(/\D/g, '');
        const devClean = (s.deviceNumber || '').replace(/\D/g, '');
        const devRaw = (s.deviceNumber || '').toLowerCase();
        const codeNorm = (s.code || '').toLowerCase();

        return cNameNorm.includes(qNorm) || 
               (qDigits && (phoneClean.includes(qDigits) || devClean.includes(qDigits))) ||
               devRaw.includes(qRaw.toLowerCase()) ||
               (s.customerPhone || '').includes(qRaw) ||
               codeNorm.includes(qRaw.toLowerCase());
      });
    }

    const totalCount = sales.length;
    const totalSum = sales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const receivedSum = sales.reduce((sum, s) => sum + ((s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد') ? Number(s.price) || 0 : Number(s.agentPaid) || 0), 0);
    const remainingSum = Math.max(0, totalSum - receivedSum);
    const pendingSubmissions = data.agentSubmissions || [];

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">إدارة السجلات والفواتير</span>
            <h1>سجل المبيعات والاشتراكات</h1>
            <p class="subtitle">تسجيل المبيعات، تحديث الدفعات، وربط الواتساب مع المشتركين</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-outline-danger" onclick="if(typeof confirmDeleteAllSubscribers === 'function') confirmDeleteAllSubscribers();" title="حذف كافة المبيعات والمشتركين للبدء من جديد">
              <span>🗑️</span> <span>تفريغ وحذف الكل</span>
            </button>
            <button class="btn btn-primary" onclick="openSaleModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>تسجيل بيع جديد</span>
            </button>
          </div>
        </div>

        <!-- 4 Stats -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">عدد العمليات</span><div class="stat-icon">📄</div></div>
            <div class="stat-value-group"><span class="stat-value">${totalCount}</span><span class="stat-unit">فاتورة</span></div>
            <div class="stat-footer"><span>بحسب الفلتر الحالي</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي قيمة المبيعات</span><div class="stat-icon">💵</div></div>
            <div class="stat-value-group"><span class="stat-value">${formatNumber(totalSum)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>المبلغ الكلي المطلوب</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">المبالغ المستلمة</span><div class="stat-icon">✅</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--success);">${formatNumber(receivedSum)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>نقد ومسدد بالكامل</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">المتبقي للتحصيل</span><div class="stat-icon">⏳</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--danger);">${formatNumber(remainingSum)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>ديون جارية للمتابعة</span></div>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="content-card">
          <div class="filters-bar">
            <div class="filter-chips">
              <span class="chip ${salesFilter.seller === 'all' ? 'active' : ''}" onclick="setSalesFilter('seller', 'all')">الكل</span>
              <span class="chip ${salesFilter.seller === 'المركز الرئيسي' ? 'active' : ''}" onclick="setSalesFilter('seller', 'المركز الرئيسي')">المركز الرئيسي</span>
              ${agents.map(a => `
                <span class="chip ${salesFilter.seller === a.name ? 'active' : ''}" onclick="setSalesFilter('seller', '${escapeHtml(a.name)}')">${escapeHtml(a.name)}</span>
              `).join('')}
            </div>

            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <div class="filter-chips">
                <span class="chip ${salesFilter.type === 'all' ? 'active' : ''}" onclick="setSalesFilter('type', 'all')">كافة العمليات</span>
                <span class="chip ${salesFilter.type === 'devices' ? 'active' : ''}" onclick="setSalesFilter('type', 'devices')">أجهزة</span>
                <span class="chip ${salesFilter.type === 'subscriptions' ? 'active' : ''}" onclick="setSalesFilter('type', 'subscriptions')">اشتراكات</span>
              </div>

              <div class="filter-chips">
                <span class="chip ${salesFilter.paymentStatus === 'all' || !salesFilter.paymentStatus ? 'active' : ''}" onclick="setSalesFilter('paymentStatus', 'all')">كافة حالات الدفع</span>
                <span class="chip ${salesFilter.paymentStatus === 'نقد' || salesFilter.paymentStatus === 'تم التسديد' ? 'active' : ''}" onclick="setSalesFilter('paymentStatus', 'نقد')">نقد (تم التسديد)</span>
                <span class="chip ${salesFilter.paymentStatus === 'دين' || salesFilter.paymentStatus === 'عليه دين' ? 'active' : ''}" onclick="setSalesFilter('paymentStatus', 'دين')">دين</span>
              </div>

              <div class="search-box" style="position: relative; display: flex; align-items: center;">
                <span class="search-icon">🔍</span>
                <input type="text" id="sales-search-input" placeholder="بحث بالاسم، الهاتف، الجهاز، الفاتورة..." value="${escapeHtml(salesFilter.search)}" oninput="handleSalesSearch(this.value)">
                ${salesFilter.search ? `<button type="button" onclick="handleSalesSearch('')" style="position: absolute; left: 10px; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 0.9rem; padding: 2px 6px;" title="إلغاء البحث">✕</button>` : ''}
              </div>
            </div>
          </div>

          <!-- Sales Table -->
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>الفاتورة / البائع</th>
                  <th>الزبون / الهاتف</th>
                  <th>الجهاز / نوع العملية</th>
                  <th>فترة الاشتراك</th>
                  <th>المبلغ والدفع</th>
                  <th style="text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${sales.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 40px;">لا توجد مبيعات مطابقة لمعايير البحث</td></tr>` : 
                  sales.map(s => {
                    const waPhone = normalizeIraqiPhone(s.customerPhone);
                    const waText = encodeURIComponent(window.formatWhatsAppMessage(s));
                    return `
                      <tr>
                        <td>
                          <strong style="color: var(--green); font-size: 0.85rem;">${escapeHtml(s.code)}</strong>
                          <div class="cell-subtitle">
                            <span class="badge badge-neutral" style="font-size: 0.68rem; padding: 1px 5px;">${escapeHtml(window.resolveAgentName ? window.resolveAgentName(s) : s.seller)}</span>
                          </div>
                        </td>
                        <td>
                          <strong class="cell-title">${escapeHtml(s.customerName)}</strong>
                          <div class="cell-subtitle" style="direction: ltr; text-align: right;">${escapeHtml(s.customerPhone || '-')}</div>
                        </td>
                        <td>
                          <div style="font-family: monospace; font-size: 0.84rem;">
                            <span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal('${escapeHtml(s.deviceNumber || '')}')" title="انقر لعرض الباركود">${escapeHtml(s.deviceNumber || '-')}</span>
                          </div>
                          <div class="cell-subtitle">${escapeHtml(s.subscriptionType || s.saleType)}</div>
                        </td>
                        <td>
                          <div class="cell-date-range" style="direction: ltr;">
                            <span class="cell-date-from">بدء: ${escapeHtml(s.startDate || '-')}</span>
                            <span class="cell-date-to">انتهاء: ${escapeHtml(s.endDate || '-')}</span>
                          </div>
                        </td>
                        <td>
                          <strong class="cell-title">${formatIQD(s.price)}</strong>
                          <div style="margin-top: 2px;">
                            <span class="badge ${(s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد') ? 'badge-success' : 'badge-danger'}">
                              ${(s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد') ? 'نقد' : 'دين'}
                            </span>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <div class="action-btns" style="justify-content: center;">
                            ${waPhone ? `
                              <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="icon-btn btn-whatsapp" title="مراسلة عبر واتساب">
                                💬
                              </a>
                            ` : ''}
                            <button class="icon-btn" onclick="openSaleModal('${s.id}')" title="تعديل الفاتورة">✏️</button>
                            <button class="icon-btn btn-del" onclick="deleteSale('${s.id}')" title="حذف الفاتورة">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- الفقرة الأخيرة في أسفل صفحة المبيعات: زر تصدير المبيعات وزر مسح وحذف جميع المبيعات -->
        <div class="page-bottom-actions" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding-top: 14px; margin-top: 6px;">
          <button class="btn btn-secondary" onclick="exportSalesExcel()" title="تصدير المبيعات اكسل" aria-label="تصدير المبيعات اكسل" style="display: inline-flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>تصدير المبيعات اكسل</span>
          </button>
          <button class="btn btn-outline-danger btn-icon" onclick="confirmDeleteAllSales()" title="حذف ومسح جميع المبيعات" aria-label="حذف ومسح جميع المبيعات">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>

      </div>
    `;
  }

  function renderPendingRequests(container) {
    const data = getData();
    const pendingSubmissions = data.agentSubmissions || [];
    const isSoundOn = typeof window.isAdminSoundEnabled === 'function' ? window.isAdminSoundEnabled() : true;
    const isRepeatingOn = typeof window.isAdminRepeatingSoundEnabled === 'function' ? window.isAdminRepeatingSoundEnabled() : true;
    const currentVol = typeof window.getAdminSoundVolume === 'function' ? window.getAdminSoundVolume() : 10.0;
    const newlyArrivedIds = typeof window.getNewlyArrivedSubmissionIds === 'function' ? window.getNewlyArrivedSubmissionIds() : new Set();

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">إدارة طلبات الوكلاء</span>
            <h1>الطلبات المعلقة (طلبات التجديد الواردة من الوكلاء)</h1>
            <p class="subtitle">مراجعة والاعتماد الفوري لطلبات تجديد الاشتراكات الواردة من كافة الوكلاء باستخدام بطاقات المعالجة مع التنبيه الفوري</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <!-- Sound toggle button -->
            <button type="button" class="btn-sound-toggle ${isSoundOn ? 'active' : ''}" onclick="window.toggleAdminSound()" title="${isSoundOn ? 'كتم التنبيه الصوتي' : 'تفعيل التنبيه الصوتي'}">
              <span>${isSoundOn ? '🔔' : '🔕'}</span>
              <span>${isSoundOn ? 'صوت التنبيه: مفعّل' : 'صوت التنبيه: مكتوم'}</span>
            </button>
            <!-- Repeating sound toggle -->
            <button type="button" class="btn btn-secondary btn-sm" style="background: ${isRepeatingOn ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface)'}; color: ${isRepeatingOn ? 'var(--success)' : 'var(--text)'}; border-color: ${isRepeatingOn ? 'var(--success)' : 'var(--line)'};" onclick="window.toggleAdminRepeatingSound()" title="تشغيل/إيقاف التنبيه الصوتي المتكرر للطلبات المعلقة">
              <span>${isRepeatingOn ? '🔁 التنبيه المتكرر: مفعل' : '⏹️ التنبيه المتكرر: متوقف'}</span>
            </button>
            <!-- Volume selector -->
            <div style="display: flex; align-items: center; gap: 4px; background: var(--surface); padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              <span style="font-size: 0.8rem; font-weight: 700;">مستوى الصوت:</span>
              <select class="form-input" style="padding: 2px 6px; font-size: 0.82rem; height: auto;" onchange="window.setAdminSoundVolume(this.value)">
                 <option value="20.0" ${currentVol === 20 ? 'selected' : ''}>20 X</option>
                 <option value="40.0" ${currentVol === 40 ? 'selected' : ''}>40 X</option>
                 <option value="60.0" ${currentVol === 60 ? 'selected' : ''}>60 X</option>
                 <option value="80.0" ${currentVol === 80 ? 'selected' : ''}>80 X</option>
                 <option value="100.0" ${currentVol === 100 ? 'selected' : ''}>100 X</option>
               </select>
            </div>
            <button type="button" class="btn-test-sound" onclick="window.testNotificationChime('admin')" title="تجربة رنة التنبيه">
              <span>▶</span> <span>تجربة الصوت</span>
            </button>
            <span class="badge" style="background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); padding: 8px 16px; font-weight: bold; font-size: 0.95rem;">
              <span class="pulse-badge"></span> الطلبات المعلقة: ${pendingSubmissions.length}
            </span>
          </div>
        </div>

        ${pendingSubmissions.length > 0 ? `
          <!-- Visual & Audio Alert Attention Banner -->
          <div class="pending-alert-banner">
            <div class="pending-alert-banner-text">
              <span class="bell-shaking" style="font-size: 1.5rem;">🔔</span>
              <div>
                <div style="font-size: 1rem; color: var(--warning); font-weight: 800;">
                  تنبيه: يوجد ${pendingSubmissions.length} ${pendingSubmissions.length === 1 ? 'طلب معلق بانتظار اعتمادك الفوري' : 'طلبات معلقة بانتظار اعتمادك الفوري'}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-sub); font-weight: 500; margin-top: 2px;">
                  يتم إطلاق نغمة صوتية وتنبيه فوري تلقائياً عند وصول أي طلب جديد من أي وكيل.
                </div>
              </div>
            </div>
            <div class="pending-alert-banner-actions">
              <span class="badge" style="background: #ef4444; color: #fff; font-weight: 800; padding: 5px 12px; font-size: 0.82rem; border-radius: var(--radius-full); box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);">
                ⚡ بانتظار قرارك الآن
              </span>
            </div>
          </div>
        ` : ''}

        <div class="content-card" style="border: 2px solid var(--warning); background: var(--warning-bg); margin-top: 16px;">
          <div class="card-header-bar" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <h3 style="color: var(--warning); display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.05rem;">
              <span class="pulse-badge"></span>
              <span>قائمة طلبات التجديد الواردة من الوكلاء (${pendingSubmissions.length})</span>
            </h3>
            ${pendingSubmissions.length > 0 ? `<span class="badge" style="background: var(--warning); color: #fff; font-weight: bold; font-size: 0.78rem;">تتطلب اعتماد الأدمن</span>` : ''}
          </div>
          ${pendingSubmissions.length === 0 ? `
            <div style="text-align: center; color: var(--muted); padding: 50px 20px;">
              <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
              <h3 style="color: var(--text-main); margin-bottom: 6px;">لا توجد طلبات معلقة حالياً</h3>
              <p style="font-size: 0.9rem;">جميع طلبات التجديد الواردة من الوكلاء تم اعتمادها أو رفضها بنجاح، وسينبهك النظام فور وصول أي طلب جديد.</p>
            </div>
          ` : `
            <div class="pending-cards-grid">
              ${pendingSubmissions.map(req => {
                const agentNameStr = escapeHtml(window.resolveAgentName ? window.resolveAgentName(req) : (req.agentName || req.seller));
                const isNewlyArrived = newlyArrivedIds.has(req.id);
                return `
                  <div class="pending-sub-card ${isNewlyArrived ? 'is-new-arrived' : ''}">
                    <div class="pending-card-header">
                      <div class="pending-agent-info">
                        <span class="pending-agent-icon">👤</span>
                        <div class="pending-agent-details">
                          <span class="pending-agent-label">الوكيل المعتمد</span>
                          <strong class="pending-agent-name" title="${agentNameStr}">${agentNameStr}</strong>
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        ${isNewlyArrived ? `
                          <span class="badge" style="background: #ef4444; color: #fff; font-size: 0.68rem; font-weight: 800; padding: 2px 6px;">جديد الآن!</span>
                        ` : ''}
                        <span class="pending-status-badge">
                          <span class="pulse-badge"></span> معلق
                        </span>
                      </div>
                    </div>

                    <div class="pending-card-body">
                      <!-- Row 1: Customer Name and Phone -->
                      <div class="pending-info-row">
                        <div class="pending-info-cell" style="flex: 1; min-width: 0;">
                          <span class="pending-info-label">الزبون:</span>
                          <strong class="pending-info-val" title="${escapeHtml(req.customerName)}">${escapeHtml(req.customerName)}</strong>
                        </div>
                        ${req.customerPhone ? `
                          <div class="pending-info-cell" style="direction: ltr; flex-shrink: 0;">
                            <span class="pending-phone-val">${escapeHtml(req.customerPhone)}</span>
                          </div>
                        ` : ''}
                      </div>

                      <!-- Row 2: Device and Type -->
                      <div class="pending-info-row">
                        <div class="pending-info-cell">
                          <span class="pending-info-label">الجهاز:</span>
                          <span class="pending-device-pill" onclick="showDeviceBarcodeModal('${escapeHtml(req.deviceNumber)}')" title="انقر لعرض الباركود وQR Code">
                            📱 ${escapeHtml(req.deviceNumber)}
                          </span>
                        </div>
                        <div class="pending-info-cell">
                          <span class="pending-type-badge">${escapeHtml(req.subscriptionType || 'تجديد')}</span>
                        </div>
                      </div>

                      <!-- Row 3: Period and Price -->
                      <div class="pending-info-row highlight-row">
                        <div class="pending-info-cell">
                          <span class="pending-info-label">الفترة:</span>
                          <span class="pending-date-val">${escapeHtml(req.startDate)} ~ ${escapeHtml(req.endDate)}</span>
                        </div>
                        <div class="pending-info-cell">
                          <strong class="pending-price-val">${formatIQD(req.price)}</strong>
                        </div>
                      </div>
                    </div>

                    <div class="pending-card-actions">
                      <button type="button" class="btn btn-success btn-sm btn-pending-action" onclick="approveSubmission('${req.id}', 'نقد')" title="اعتماد كدفع نقدي">
                        <span>✓</span> <span>قبول نقد</span>
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm btn-pending-action" onclick="approveSubmission('${req.id}', 'دين')" title="اعتماد كدين على الوكيل">
                        <span>📝</span> <span>قبول دين</span>
                      </button>
                      <button type="button" class="btn btn-danger btn-sm btn-pending-action" onclick="rejectSubmission('${req.id}')" title="رفض الطلب">
                        <span>✕</span> <span>رفض</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  window.renderPendingRequests = renderPendingRequests;

  window.setSalesFilter = function(key, val) {
    salesFilter[key] = val;
    renderSales(document.getElementById('main-content'));
  };

  window.handleSalesSearch = function(val) {
    salesFilter.search = val;
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      renderSales(mainEl);
      const searchBox = document.getElementById('sales-search-input');
      if (searchBox) {
        searchBox.focus();
        const len = searchBox.value.length;
        searchBox.setSelectionRange(len, len);
      }
    }
  };

  window.getCurrentlyFilteredSales = function() {
    const data = getData();
    let sales = [...(data.sales || [])];
    if (salesFilter.seller !== 'all') {
      sales = sales.filter(s => {
        const resolved = window.resolveAgentName ? window.resolveAgentName(s) : s.seller;
        return resolved === salesFilter.seller || s.seller === salesFilter.seller;
      });
    }
    if (salesFilter.type !== 'all') {
      sales = sales.filter(s => {
        const t = (s.subscriptionType || s.saleType || '').toLowerCase();
        if (salesFilter.type === 'devices') return t.includes('جهاز') || t.includes('بيع') || t.includes('device');
        if (salesFilter.type === 'subscriptions') return t.includes('اشتراك') || t.includes('تجديد') || t.includes('sub');
        return true;
      });
    }
    if (salesFilter.paymentStatus && salesFilter.paymentStatus !== 'all') {
      sales = sales.filter(s => {
        if (salesFilter.paymentStatus === 'نقد') {
          return s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد';
        }
        if (salesFilter.paymentStatus === 'دين' || salesFilter.paymentStatus === 'عليه دين') {
          return s.paymentMethod === 'دين' || s.paymentStatus === 'دين' || s.paymentStatus === 'عليه دين' || ((Number(s.price) || 0) - (Number(s.agentPaid) || 0) > 0);
        }
        return s.paymentStatus === salesFilter.paymentStatus || s.paymentMethod === salesFilter.paymentStatus;
      });
    }
    if (salesFilter.search) {
      const qRaw = salesFilter.search.trim();
      const qNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(qRaw) : qRaw.toLowerCase();
      const qDigits = qRaw.replace(/\D/g, '');

      sales = sales.filter(s => {
        const cNameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.customerName || '') : (s.customerName || '').toLowerCase();
        const phoneClean = (s.customerPhone || '').replace(/\D/g, '');
        const devClean = (s.deviceNumber || '').replace(/\D/g, '');
        const devRaw = (s.deviceNumber || '').toLowerCase();
        const codeNorm = (s.code || '').toLowerCase();

        return cNameNorm.includes(qNorm) || 
               (qDigits && (phoneClean.includes(qDigits) || devClean.includes(qDigits))) ||
               devRaw.includes(qRaw.toLowerCase()) ||
               (s.customerPhone || '').includes(qRaw) ||
               codeNorm.includes(qRaw.toLowerCase());
      });
    }
    return sales;
  };

  window.openExportSalesModal = function() {
    const data = getData();
    const allSales = data.sales || [];
    let currentFilteredSales = allSales;
    if (typeof window.getCurrentlyFilteredSales === 'function') {
      currentFilteredSales = window.getCurrentlyFilteredSales();
    }
    const isFiltered = currentFilteredSales.length !== allSales.length;

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="export-sales-modal" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 500px; direction: rtl; text-align: right;" onclick="event.stopPropagation()">
          <div class="modal-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">📊</span>
              <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: var(--text);">تصدير المبيعات إلى ملف Excel</h3>
                <span style="font-size: 0.8rem; color: var(--muted);">سجل المبيعات والاشتراكات</span>
              </div>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--muted);">✕</button>
          </div>

          <div class="modal-body" style="padding: 18px 0;">
            <div style="background: var(--bg-hover, #f8fafc); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 600; color: var(--text); font-size: 0.95rem;">إجمالي عمليات المبيعات:</span>
                <span class="badge badge-primary" style="font-size: 0.88rem; padding: 3px 10px;">${allSales.length} عملية</span>
              </div>
              <p style="font-size: 0.83rem; color: var(--text-sub); margin: 0; line-height: 1.5;">
                يتضمن ملف Excel كافة التفاصيل: رمز الفاتورة، اسم الزبون، رقم الهاتف، البائع/الوكيل، رقم الجهاز، نوع العملية، تاريخ البدء والانتهاء، السعر، وحالة الدفع.
              </p>
            </div>

            ${isFiltered ? `
              <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 0.88rem; font-weight: 600; margin-bottom: 8px; display: block;">تحديد نطاق التصدير:</label>
                <div style="display: flex; flex-direction: column; gap: 8px; background: var(--card-bg, #fff); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                    <input type="radio" name="export-sales-scope" value="all" checked>
                    <span>تصدير كافة السجلات (${allSales.length} عملية)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                    <input type="radio" name="export-sales-scope" value="filtered">
                    <span>تصدير السجلات المفلترة حالياً فقط (${currentFilteredSales.length} عملية)</span>
                  </label>
                </div>
              </div>
            ` : `
              <input type="hidden" id="export-sales-scope-hidden" name="export-sales-scope" value="all">
            `}

            <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed var(--green, #10b981); border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.3rem;">📗</span>
              <span style="font-size: 0.84rem; color: var(--text);">
                الملف جاهز للتنزيل المباشر بصيغة <strong>Excel (.xlsx)</strong> متوافق مع Microsoft Excel و Google Sheets.
              </span>
            </div>
          </div>

          <div class="modal-footer" style="border-top: 1px solid var(--line); padding-top: 14px; display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-success" id="btn-download-sales-excel" onclick="window.downloadSalesExcel()" style="display: inline-flex; align-items: center; gap: 8px; background-color: #10b981; color: #fff; font-weight: 600; padding: 8px 18px; border-radius: var(--radius-sm); border: none; cursor: pointer;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>تنزيل الملف إلى Excel</span>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  window.exportSalesExcel = function() {
    window.openExportSalesModal();
  };

  window.downloadSalesExcel = function() {
    const data = getData();
    const scopeEl = document.querySelector('input[name="export-sales-scope"]:checked');
    const scope = scopeEl ? scopeEl.value : 'all';

    let sales = data.sales || [];
    if (scope === 'filtered' && typeof window.getCurrentlyFilteredSales === 'function') {
      sales = window.getCurrentlyFilteredSales();
    }

    if (!sales || sales.length === 0) {
      window.showToast('لا توجد مبيعات لتصديرها', 'warning');
      return;
    }

    const exportRows = sales.map(s => ({
      'رمز الفاتورة': s.code || '',
      'اسم الزبون': s.customerName || '',
      'رقم الهاتف': s.customerPhone || '',
      'البائع': window.resolveAgentName ? window.resolveAgentName(s) : (s.seller || ''),
      'رقم الجهاز': s.deviceNumber || '',
      'نوع العملية': s.subscriptionType || s.saleType || '',
      'تاريخ البدء': s.startDate || '',
      'تاريخ الانتهاء': s.endDate || '',
      'السعر (د.ع)': Number(s.price) || 0,
      'المبلغ المستلم (د.ع)': (s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد') ? (Number(s.price) || 0) : (Number(s.agentPaid) || 0),
      'المتبقي / الديون (د.ع)': (s.paymentMethod === 'دين' || s.paymentStatus === 'دين' || s.paymentStatus === 'عليه دين' || ((Number(s.price) || 0) - (Number(s.agentPaid) || 0) > 0)) ? Math.max(0, (Number(s.price) || 0) - (Number(s.agentPaid) || 0)) : 0,
      'حالة الدفع': (s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد') ? 'نقد' : 'دين'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المبيعات والاشتراكات");
    XLSX.writeFile(wb, `مبيعات_الساري_${new Date().toISOString().substring(0, 10)}.xlsx`);
    
    window.closeModal();
    window.showToast('تم تنزيل ملف المبيعات Excel بنجاح', 'success');
  };

  window.confirmDeleteAllSales = function() {
    showConfirmDialog('حذف جميع المبيعات', 'هل أنت متأكد تماماً من رغبتك في حذف كافة سجلات المبيعات والديون المرتبطة؟ هذا الإجراء لا يمكن التراجع عنه!', async () => {
      await getEngine().clearCollection('sales');
      await getEngine().clearCollection('debts');
      showToast('تم حذف كافة المبيعات والديون بنجاح', 'success');
    });
  };

  window.deleteSale = async function(id) {
    window.showConfirmModal('حذف الفاتورة', 'هل تريد حذف هذه الفاتورة وسجلات الديون المرتبطة بها نهائياً لعدم الحذف بالخطأ؟', async () => {
      const data = getData();
      const saleToDelete = (data.sales || []).find(s => s.id === id);
      const debtsToDelete = (data.debts || []).filter(d => d.saleId === id || (saleToDelete && d.saleCode === saleToDelete.code));

      await getEngine().deleteItem('sales', id);
      for (const d of debtsToDelete) {
        await getEngine().deleteItem('debts', d.id);
      }
      showToast('تم حذف الفاتورة وسجلات الديون المرتبطة بنجاح', 'success');
    }, 'حذف الفاتورة', 'إلغاء', true);
  };

  window.approveSubmission = function(subId, paymentMethod) {
    const isCash = paymentMethod === 'نقد';
    const title = isCash ? 'قبول الطلب كنقد' : 'قبول الطلب كدين';
    const message = `هل أنت متأكد من قبول هذا الطلب وترحيله إلى المبيعات وإضافته لقائمة المشتركين والزبائن للوكيل ${isCash ? 'كنقد' : 'كدين'}؟`;

    showConfirmDialog(title, message, async () => {
      try {
        const data = getData();
        const subs = data.agentSubmissions || [];
        const req = subs.find(s => s.id === subId);
        if (!req) return;

        const agentName = window.resolveAgentName ? window.resolveAgentName(req) : (req.agentName || req.seller || 'وكيل');
        const isNewDevice = req.saleType === 'جهاز جديد' || req.subscriptionType === 'جهاز جديد';
        const startDate = req.startDate || new Date().toISOString().substring(0, 10);
        
        let endDate = req.endDate;
        if (isNewDevice || !endDate || endDate === '-') {
          if (typeof window.addMonthsToDate === 'function') {
            endDate = window.addMonthsToDate(startDate, 1);
          } else {
            const parts = startDate.split('-').map(Number);
            const target = new Date(parts[0], parts[1], parts[2]);
            endDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
          }
        }

        // 1. Create completed sale
        const newSale = {
          id: 'sale-' + Date.now(),
          code: generateSaleCode(),
          customerName: req.customerName,
          customerPhone: req.customerPhone || '',
          seller: agentName,
          agentName: agentName,
          agentCode: req.agentCode || '',
          saleType: req.saleType || (isNewDevice ? 'جهاز جديد' : 'تجديد اشتراك'),
          deviceNumber: req.deviceNumber,
          subscriptionType: req.subscriptionType || (isNewDevice ? 'جهاز جديد' : 'اشتراك شهر واحد'),
          startDate: startDate,
          endDate: endDate,
          price: Number(req.price) || 0,
          paymentStatus: isCash ? 'نقد' : 'دين',
          paymentMethod: isCash ? 'نقد' : 'دين',
          agentPaid: isCash ? (Number(req.price) || 0) : 0,
          approvalStatus: 'معتمدة',
          approvedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        const updatedSales = [newSale, ...(data.sales || [])];
        const updatedSubs = subs.filter(s => s.id !== subId);

        // 2. If credit (دين), register debt
        let updatedDebts = data.debts || [];
        if (!isCash) {
          const debtDueDate = endDate;
          const newDebt = {
            id: 'debt-' + Date.now(),
            saleId: newSale.id,
            saleCode: newSale.code,
            customerName: req.customerName,
            debtor: 'الوكيل والزبون',
            seller: agentName,
            agentName: agentName,
            agentCode: req.agentCode || '',
            customerPhone: req.customerPhone || '',
            deviceNumber: req.deviceNumber,
            totalAmount: Number(req.price) || 0,
            paidAmount: 0,
            remainingAmount: Number(req.price) || 0,
            dueDate: debtDueDate,
            notes: `دين على الوكيل (${agentName}) والزبون (${req.customerName}) - ${req.subscriptionType}`,
            status: 'غير مسدد',
            createdAt: new Date().toISOString().substring(0, 10)
          };
          updatedDebts = [newDebt, ...updatedDebts];
        }

        // 3. Update subscribers table (Add or update subscriber and assign to agent)
        let updatedSubscribers = data.subscribers || [];
        const subIdx = updatedSubscribers.findIndex(s => s.deviceNumber === req.deviceNumber);
        if (subIdx >= 0) {
          updatedSubscribers[subIdx].name = req.customerName;
          if (req.customerPhone) updatedSubscribers[subIdx].phone = req.customerPhone;
          updatedSubscribers[subIdx].activationDate = startDate;
          updatedSubscribers[subIdx].startDate = startDate;
          updatedSubscribers[subIdx].expiryDate = endDate;
          updatedSubscribers[subIdx].endDate = endDate;
          updatedSubscribers[subIdx].dueDate = endDate;
          updatedSubscribers[subIdx].paymentMethod = isCash ? 'نقد' : 'دين';
          updatedSubscribers[subIdx].paymentStatus = isCash ? 'مدفوع' : 'دين';
          updatedSubscribers[subIdx].subscriptionType = req.subscriptionType || 'اشتراك شهر واحد';
          updatedSubscribers[subIdx].price = Number(req.price) || 0;
          updatedSubscribers[subIdx].status = 'فعال';
          updatedSubscribers[subIdx].activeStatus = 'فعال';
          updatedSubscribers[subIdx].owner = agentName;
          updatedSubscribers[subIdx].agentName = agentName;
          updatedSubscribers[subIdx].activatedBy = agentName;
          updatedSubscribers[subIdx].activatedByType = 'agent';
          updatedSubscribers[subIdx].requestedByAgent = true;
          if (!updatedSubscribers[subIdx].joiningDate) {
            updatedSubscribers[subIdx].joiningDate = startDate;
          }
        } else {
          updatedSubscribers.push({
            id: 'sub-' + Date.now(),
            name: req.customerName,
            phone: req.customerPhone || '',
            deviceNumber: req.deviceNumber,
            owner: agentName,
            agentName: agentName,
            joiningDate: startDate,
            activationDate: startDate,
            startDate: startDate,
            expiryDate: endDate,
            endDate: endDate,
            dueDate: endDate,
            subscriptionType: req.subscriptionType || 'اشتراك شهر واحد',
            paymentMethod: isCash ? 'نقد' : 'دين',
            paymentStatus: isCash ? 'مدفوع' : 'دين',
            price: Number(req.price) || 0,
            status: 'فعال',
            activeStatus: 'فعال',
            activatedBy: agentName,
            activatedByType: 'agent',
            requestedByAgent: true
          });
        }

        // Use batch commit for all updates
        await getEngine().batchCommitData([
          { collectionName: 'sales', items: updatedSales },
          { collectionName: 'subscribers', items: updatedSubscribers },
          ...(isCash ? [] : [{ collectionName: 'debts', items: updatedDebts }]),
          { collectionName: 'agentSubmissions', items: updatedSubs }
        ]);
        
        if (typeof getEngine().deleteItem === 'function') {
          await getEngine().deleteItem('agentSubmissions', req.id);
        }

        showToast(`تم قبول الطلب بنجاح وإضافته لقائمة المشتركين والزبائن للوكيل (${agentName})`, 'success');
        navigateTo(currentPage);
      } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء المعالجة', 'error');
      }
    });
  };

  window.rejectSubmission = async function(subId) {
    showConfirmDialog('رفض الطلب', 'هل أنت متأكد من رفض هذا الطلب؟', async () => {
      const data = getData();
      const subs = data.agentSubmissions || [];
      const req = subs.find(s => s.id === subId);
      if (req && req.submittedBy && typeof getEngine().deleteFirestoreSubmission === 'function') {
        await getEngine().deleteFirestoreSubmission(req.submittedBy, req.id);
      }
      const updated = subs.filter(s => s.id !== subId);
      await getEngine().commitData('agentSubmissions', updated);
      showToast('تم رفض الطلب وحذفه', 'info');
      navigateTo(currentPage);
    });
  };

  // --- Sale Modal (Create / Edit) ---
  window.openSaleModal = function(saleId) {
    const data = getData();
    const agents = data.agents || [];
    const pricing = data.pricing || DEFAULT_PRICING;
    const existing = saleId ? (data.sales || []).find(s => s.id === saleId) : null;

    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().substring(0, 10);
    const endDef = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="sale-modal" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 660px; width: 95%; margin: auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="padding: 12px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">🧾</span>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text);">
                ${existing ? 'تعديل الفاتورة' : 'تسجيل بيع جديد وتفعيل اشتراك'}
              </h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="sale-form" onsubmit="window.handleSaleFormSubmit(event, '${existing ? existing.id : ''}'); return false;">
            <div class="modal-body" style="padding: 14px 18px; overflow: visible;">
              
              <!-- Row 1: Customer Name, Phone, Seller -->
              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div class="form-group" style="margin: 0; position: relative;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <label style="font-size: 0.8rem; font-weight: 700; margin: 0;">اسم الزبون *</label>
                    <span id="sf-name-badge" style="font-size: 0.72rem; color: var(--muted);">(بحث ذكي ⚡)</span>
                  </div>
                  <div class="autocomplete-container">
                    <input type="text" id="sf-name" required autocomplete="off" placeholder="اكتب اسم الزبون..." value="${escapeHtml(existing?.customerName || '')}" oninput="onAdminCustomerNameInput(this.value)" onfocus="onAdminCustomerNameFocus()" style="padding: 6px 10px; font-size: 0.88rem;">
                    <div id="sf-name-suggestions" class="autocomplete-suggestions" style="display: none; z-index: 10000;"></div>
                  </div>
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">رقم الهاتف</label>
                  <input type="text" id="sf-phone" placeholder="0770xxxxxxx" value="${escapeHtml(existing?.customerPhone || '')}" style="padding: 6px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">جهة البيع (البائع) *</label>
                  <select id="sf-seller" onchange="recalculateSalePrice()" style="padding: 6px 10px; font-size: 0.88rem;">
                    <option value="المركز الرئيسي" ${!existing || existing.seller === 'المركز الرئيسي' ? 'selected' : ''}>المركز الرئيسي</option>
                    ${agents.map(a => `
                      <option value="${escapeHtml(a.name)}" ${existing?.seller === a.name ? 'selected' : ''}>وكيل: ${escapeHtml(a.name)}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Main Section: Device & QR on right, Details on left -->
              <div style="display: grid; grid-template-columns: 175px 1fr; gap: 14px; margin-bottom: 6px; background: var(--surface-alt); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
                <!-- Column 1: Sale Type, Device Number & QR Code -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px; border-left: 1px dashed var(--line); padding-left: 14px;">
                  <div class="form-group" style="margin: 0; width: 100%;">
                    <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px; display: block;">نوع البيع *</label>
                    <select id="sf-type" onchange="handleSaleTypeChange()" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700; width: 100%;">
                      <option value="تجديد اشتراك" ${existing?.saleType === 'تجديد اشتراك' || !existing ? 'selected' : ''}>تجديد اشتراك</option>
                      <option value="جهاز جديد" ${existing?.saleType === 'جهاز جديد' ? 'selected' : ''}>بيع جهاز جديد</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin: 0; width: 100%;">
                    <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px; display: block;">رقم الجهاز *</label>
                    <div style="display: flex; gap: 4px;">
                      <input type="text" id="sf-device" placeholder="رقم الجهاز..." value="${escapeHtml(existing?.deviceNumber || '')}" oninput="onAdminDeviceInput(this.value); updateSaleQrCode(this.value);" style="padding: 6px 6px; font-size: 0.85rem; font-weight: 700; text-align: center; width: 100%;">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="openScannerModal((code) => { document.getElementById('sf-device').value = code; onAdminDeviceInput(code); updateSaleQrCode(code); })" style="padding: 4px 8px; font-size: 0.8rem;" title="مسح باركود">📷</button>
                    </div>
                  </div>
                  <!-- QR Code display directly below device number -->
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding: 6px; border-radius: 8px; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,0.06); width: fit-content; margin: 2px auto 0;">
                    <div id="sf-qr-box" style="width: 135px; height: 135px; display: flex; align-items: center; justify-content: center;"></div>
                    <span style="font-size: 0.7rem; color: var(--muted); margin-top: 3px; font-weight: 600;">QR كود الجهاز 📱</span>
                  </div>
                </div>

                <!-- Column 2: Subscription Controls, Price & Payment -->
                <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                  <!-- Subscription fields (hidden if new device) -->
                  <div id="sf-subscription-section" style="${existing?.saleType === 'جهاز جديد' ? 'display: none;' : 'display: flex; flex-direction: column; gap: 8px;'}">
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">نوع الاشتراك *</label>
                      <select id="sf-sub" onchange="recalculateSalePrice()" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700;">
                        <option value="1 شهر" ${(!existing?.subscriptionType || existing?.subscriptionType === '1 شهر' || existing?.subscriptionType === 'اشتراك شهر واحد') ? 'selected' : ''}>1 شهر</option>
                        <option value="2 شهر" ${(existing?.subscriptionType === '2 شهر' || existing?.subscriptionType === 'اشتراك شهرين') ? 'selected' : ''}>2 شهر</option>
                        <option value="3 شهر" ${(existing?.subscriptionType === '3 شهر' || existing?.subscriptionType === 'اشتراك 3 أشهر') ? 'selected' : ''}>3 شهر</option>
                      </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                      <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">تاريخ البدء (التفعيل) *</label>
                        <input type="date" id="sf-start" value="${existing?.startDate || today}" onchange="recalcEndDate()" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700;">
                      </div>
                      <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">تاريخ الانتهاء (تلقائي) *</label>
                        <input type="date" id="sf-end" value="${existing?.endDate || endDef}" readonly style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700; background: var(--surface); color: var(--text); cursor: not-allowed;" title="تاريخ الانتهاء محدد تلقائياً حسب فترة الاشتراك وتاريخ البدء">
                      </div>
                    </div>
                  </div>

                  <!-- Price & Payment Method (Always present) -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">السعر الإجمالي (د.ع) *</label>
                      <input type="text" id="sf-price" required value="${formatNumber(existing?.price || 50000)}" readonly style="padding: 6px 8px; font-size: 0.95rem; font-weight: 800; color: var(--green); background: var(--surface); text-align: center; cursor: not-allowed;" title="السعر محدد تلقائياً">
                    </div>
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">طريقة الدفع *</label>
                      <select id="sf-payment" onchange="updatePaymentSelectColor(this)" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700; ${!existing || existing.paymentMethod === 'دين' ? 'color: var(--danger); border-color: var(--danger);' : 'color: var(--success); border-color: var(--success);'}">
                        <option value="دين" ${!existing || existing.paymentMethod === 'دين' ? 'selected' : ''} style="color: var(--danger); font-weight: 700;">دين (تسجيل دين)</option>
                        <option value="نقد" ${existing?.paymentMethod === 'نقد' ? 'selected' : ''} style="color: var(--success); font-weight: 700;">نقد (تم التسديد)</option>
                      </select>
                    </div>
                  </div>

                  <span class="form-help" style="font-size: 0.72rem; color: var(--muted); margin: 0;">يتم احتساب السعر والتواريخ تلقائياً وبشكل مقفل حسب نوع وفترة الاشتراك</span>
                </div>
              </div>

            </div>
            <div class="modal-footer" style="padding: 10px 18px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()" style="padding: 6px 16px; font-size: 0.88rem;">إلغاء</button>
              <button type="submit" class="btn btn-primary btn-sm" id="btn-submit-sale-form" style="padding: 6px 22px; font-size: 0.9rem; font-weight: 700;">${existing ? '💾 حفظ التعديلات' : '💾 تسجيل الفاتورة'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.onAdminCustomerNameInput = function(val) {
      const container = document.getElementById('sf-name-suggestions');
      const badgeEl = document.getElementById('sf-name-badge');
      if (!container) return;

      const cleanVal = (val || '').trim();
      if (!cleanVal) {
        container.style.display = 'none';
        container.innerHTML = '';
        if (badgeEl) badgeEl.innerHTML = '(بحث ذكي وتكملة تلقائية ⚡)';
        return;
      }

      const curData = getData();
      const subscribers = curData.subscribers || [];
      const normQuery = window.normalizeSearchQuery ? window.normalizeSearchQuery(cleanVal) : cleanVal.toLowerCase();
      const digitsQuery = cleanVal.replace(/\D/g, '');

      const matched = subscribers.filter(s => {
        const sNameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.name || '') : (s.name || '').toLowerCase();
        const sPhoneClean = (s.phone || '').replace(/\D/g, '');
        const sDevClean = (s.deviceNumber || '').replace(/\D/g, '');
        return sNameNorm.includes(normQuery) || 
               (digitsQuery && (sPhoneClean.includes(digitsQuery) || sDevClean.includes(digitsQuery)));
      }).slice(0, 8);

      if (matched.length === 0) {
        container.innerHTML = `
          <div class="autocomplete-hint">
            <span>✨ لا يوجد مشترك مسجل بهذا الاسم — سيتم تسجيله كزبون جديد</span>
          </div>
        `;
        container.style.display = 'block';
        return;
      }

      container.innerHTML = matched.map(sub => `
        <div class="autocomplete-item" onclick="selectSubscriberForSale('${escapeHtml(sub.id)}')">
          <div class="autocomplete-item-main">
            <div class="autocomplete-item-name">👤 ${escapeHtml(sub.name)}</div>
            <div class="autocomplete-item-details">
              <span>📞 ${escapeHtml(sub.phone || 'بدون هاتف')}</span>
              <span>📱 ${escapeHtml(sub.deviceNumber)}</span>
            </div>
          </div>
          <div class="autocomplete-item-meta">
            <span class="badge ${sub.status === 'فعال' ? 'badge-success' : 'badge-danger'}" style="font-size: 0.72rem; padding: 2px 6px;">
              ${escapeHtml(sub.status || 'غير فعال')}
            </span>
            <span style="font-size: 0.74rem; color: var(--muted);">${escapeHtml(window.resolveAgentName ? window.resolveAgentName(sub) : sub.owner)}</span>
          </div>
        </div>
      `).join('');
      container.style.display = 'block';
    };

    window.onAdminCustomerNameFocus = function() {
      const input = document.getElementById('sf-name');
      if (input && input.value.trim().length >= 1) {
        window.onAdminCustomerNameInput(input.value);
      }
    };

    window.selectSubscriberForSale = function(subId) {
      const curData = getData();
      const sub = (curData.subscribers || []).find(s => s.id === subId);
      if (!sub) return;

      const nameInput = document.getElementById('sf-name');
      const phoneInput = document.getElementById('sf-phone');
      const deviceInput = document.getElementById('sf-device');
      const sellerSelect = document.getElementById('sf-seller');
      const badgeEl = document.getElementById('sf-name-badge');

      if (nameInput) nameInput.value = sub.name;
      if (phoneInput) phoneInput.value = sub.phone || '';
      if (deviceInput) {
        deviceInput.value = sub.deviceNumber || '';
        if (typeof window.onAdminDeviceInput === 'function') {
          window.onAdminDeviceInput(sub.deviceNumber);
        }
        if (typeof window.updateSaleQrCode === 'function') {
          window.updateSaleQrCode(sub.deviceNumber);
        }
      }
      if (sellerSelect && sub.owner) {
        for (let i = 0; i < sellerSelect.options.length; i++) {
          if (sellerSelect.options[i].value === sub.owner) {
            sellerSelect.selectedIndex = i;
            break;
          }
        }
      }

      if (badgeEl) {
        badgeEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✅ تم جلب البيانات تلقائياً (${escapeHtml(sub.deviceNumber)})</span>`;
      }

      const container = document.getElementById('sf-name-suggestions');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    };

    // Close suggestions dropdown when clicking outside
    document.addEventListener('click', function(evt) {
      const container = document.getElementById('sf-name-suggestions');
      const input = document.getElementById('sf-name');
      if (container && input && !container.contains(evt.target) && evt.target !== input) {
        container.style.display = 'none';
      }
    });

    window.onAdminDeviceInput = function(val) {
      const cleanVal = (val || '').trim();
      if (!cleanVal || cleanVal.length < 5) return;
      const curData = getData();
      const sub = (curData.subscribers || []).find(s => s.deviceNumber === cleanVal);
      const sale = (curData.sales || []).find(s => s.deviceNumber === cleanVal);
      const nameInput = document.getElementById('sf-name');
      const phoneInput = document.getElementById('sf-phone');
      const badgeEl = document.getElementById('sf-name-badge');

      if (sub) {
        if (nameInput && !nameInput.value) {
          nameInput.value = sub.name || '';
        }
        if (phoneInput && !phoneInput.value) {
          phoneInput.value = sub.phone || '';
        }
        if (badgeEl) {
          badgeEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✅ مطابق للمشترك: ${escapeHtml(sub.name)}</span>`;
        }
      } else if (sale) {
        if (nameInput && !nameInput.value) {
          nameInput.value = sale.customerName || '';
        }
        if (phoneInput && !phoneInput.value) {
          phoneInput.value = sale.customerPhone || '';
        }
        if (badgeEl) {
          badgeEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✅ مطابق لفاتورة سابقة: ${escapeHtml(sale.customerName)}</span>`;
        }
      }
    };

    window.handleSaleTypeChange = function() {
      const type = document.getElementById('sf-type')?.value;
      const subSec = document.getElementById('sf-subscription-section');
      if (subSec) {
        if (type === 'جهاز جديد') {
          subSec.style.display = 'none';
        } else {
          subSec.style.display = 'flex';
          subSec.style.flexDirection = 'column';
          subSec.style.gap = '8px';
        }
      }
      recalculateSalePrice();
    };

    handleSaleTypeChange();
    setTimeout(() => {
      window.updateSaleQrCode(existing?.deviceNumber || document.getElementById('sf-device')?.value || '');
    }, 50);

    window.handleSaleFormSubmit = async function(e, sId) {
      if (e) e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-sale-form');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.origHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري الحفظ والتفعيل...`;
      }

      try {
        const customerName = document.getElementById('sf-name').value.trim();
        const customerPhone = document.getElementById('sf-phone').value.trim();
        const seller = document.getElementById('sf-seller').value;
        const saleType = document.getElementById('sf-type').value;
        const isNewDevice = saleType === 'جهاز جديد';
        const rawDev = document.getElementById('sf-device').value.trim();
        const deviceNumber = window.formatDeviceNumber ? window.formatDeviceNumber(rawDev) : rawDev;
        const subscriptionType = isNewDevice ? 'جهاز جديد' : (document.getElementById('sf-sub')?.value || 'اشتراك شهر واحد');
        const startDate = isNewDevice ? today : (document.getElementById('sf-start')?.value || today);
        const endDate = isNewDevice ? '-' : (document.getElementById('sf-end')?.value || endDef);
        const price = parseNumber(document.getElementById('sf-price').value);
        const paymentMethod = document.getElementById('sf-payment').value;
        const paymentStatus = paymentMethod === 'نقد' ? 'تم التسديد' : 'دين';

        // تم رفع القيود للسماح للأدمن بتسجيل الفواتير وتفعيل المشتركين مباشرة
        const data = getData();
        const allSales = data.sales || [];
        const existing = sId ? allSales.find(s => s.id === sId) : null;

        if (existing) {
          existing.customerName = customerName;
          existing.customerPhone = customerPhone;
          existing.seller = seller;
          existing.saleType = saleType;
          existing.deviceNumber = deviceNumber;
          existing.subscriptionType = subscriptionType;
          existing.startDate = startDate;
          existing.endDate = endDate;
          existing.price = price;
          existing.paymentStatus = paymentStatus;
          existing.paymentMethod = paymentMethod;

          let debts = data.debts || [];
          const debtIdx = debts.findIndex(d => d.saleId === existing.id || d.saleCode === existing.code);
          if (paymentMethod === 'دين') {
            const isAgent = seller && seller !== 'المركز الرئيسي';
            if (debtIdx >= 0) {
              debts[debtIdx].totalAmount = price;
              debts[debtIdx].remainingAmount = Math.max(0, price - (debts[debtIdx].paidAmount || 0));
              debts[debtIdx].customerName = customerName;
              debts[debtIdx].seller = seller;
              debts[debtIdx].debtor = isAgent ? 'الوكيل والزبون' : 'الرئيسية';
              debts[debtIdx].agentName = isAgent ? seller : '';
            } else {
              let debtDueDate = endDate;
              if (isNewDevice || !debtDueDate || debtDueDate === '-') {
                const parts = (startDate || today).split('-');
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                const eom = new Date(y, m, 0);
                debtDueDate = `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`;
              }
              const newDebt = {
                id: 'debt-' + Date.now(),
                saleId: existing.id,
                saleCode: existing.code,
                customerName,
                seller,
                debtor: isAgent ? 'الوكيل والزبون' : 'الرئيسية',
                agentName: isAgent ? seller : '',
                totalAmount: price,
                paidAmount: 0,
                remainingAmount: price,
                dueDate: debtDueDate,
                notes: `فاتورة بيع معدلة بالدين`,
                createdAt: startDate
              };
              debts = [newDebt, ...debts];
            }
          } else {
            if (debtIdx >= 0) {
              debts.splice(debtIdx, 1);
            }
            existing.agentPaid = price;
          }

          getEngine().commitData('sales', allSales).catch(err => console.warn('Sales sync warning:', err));
          getEngine().commitData('debts', debts).catch(err => console.warn('Debts sync warning:', err));
          showToast('تم تحديث الفاتورة بنجاح', 'success');
          window.closeModal();
          window.openSaleSuccessModal(existing);
          return;
        } else {
          const saleCode = generateSaleCode();
          const newSale = {
            id: 'sale-' + Date.now(),
            code: saleCode,
            customerName,
            customerPhone,
            seller,
            saleType,
            deviceNumber,
            subscriptionType,
            startDate,
            endDate,
            price,
            paymentStatus,
            paymentMethod,
            agentPaid: paymentMethod === 'نقد' ? price : 0,
            createdAt: new Date().toISOString()
          };

          const updatedSales = [newSale, ...allSales];

          // Automatic debt creation for credit sale
          let debts = data.debts || [];
          if (paymentMethod === 'دين') {
            let debtDueDate = endDate;
            if (isNewDevice || !debtDueDate || debtDueDate === '-') {
              const parts = (startDate || today).split('-');
              const y = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const eom = new Date(y, m, 0);
              debtDueDate = `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`;
            }
            const isAgent = seller && seller !== 'المركز الرئيسي';
            const newDebt = {
              id: 'debt-' + Date.now(),
              saleId: newSale.id,
              saleCode: saleCode,
              customerName,
              seller,
              debtor: isAgent ? 'الوكيل والزبون' : 'الرئيسية',
              agentName: isAgent ? seller : '',
              totalAmount: price,
              paidAmount: 0,
              remainingAmount: price,
              dueDate: debtDueDate,
              notes: `فاتورة بيع بالدين (${isNewDevice ? 'جهاز جديد' : subscriptionType})`,
              createdAt: startDate
            };
            debts = [newDebt, ...debts];
            getEngine().commitData('debts', debts).catch(err => console.warn('Debts sync warning:', err));
          }

          // Auto update / register subscriber
          if (deviceNumber || customerName) {
            const subs = data.subscribers || [];
            const devDigits = deviceNumber ? deviceNumber.replace(/\D/g, '') : '';
            const nameLower = customerName ? customerName.trim().toLowerCase() : '';
            const subExpiry = isNewDevice ? '-' : endDate;

            let matchFound = false;
            subs.forEach(s => {
              const sDev = (s.deviceNumber || '').trim();
              const sDevDigits = sDev ? sDev.replace(/\D/g, '') : '';
              const sName = (s.name || '').trim().toLowerCase();

              const isMatch = (deviceNumber && sDev && sDev !== '-' && sDev === deviceNumber) ||
                             (devDigits && sDevDigits && devDigits === sDevDigits) ||
                             (nameLower && sName && sName === nameLower);

              if (isMatch) {
                matchFound = true;
                s.name = customerName;
                if (customerPhone) s.phone = customerPhone;
                if (deviceNumber && deviceNumber !== '-') s.deviceNumber = deviceNumber;
                if (seller) s.owner = seller;
                if (!isNewDevice) {
                  s.expiryDate = subExpiry;
                  s.endDate = subExpiry;
                  s.dueDate = subExpiry !== '-' ? subExpiry : '';
                }
                s.activationDate = startDate;
                s.startDate = startDate;
                s.paymentMethod = paymentMethod;
                s.paymentStatus = paymentMethod === 'نقد' ? 'مدفوع' : 'دين';
                s.subscriptionType = subscriptionType;
                s.price = price;
                s.status = 'فعال';
                s.activeStatus = 'فعال';
                s.isActivated = true;
                s.is_active = true;
                s.deactivated = false;
                delete s.deactivated;
                delete s.deactivatedAt;
                delete s.lastDeactivatedAt;
                if (!s.joiningDate) s.joiningDate = startDate || today;
              }
            });

            if (!matchFound) {
              subs.push({
                id: 'sub-' + Date.now(),
                name: customerName,
                phone: customerPhone || '',
                deviceNumber: deviceNumber || '-',
                owner: seller || 'المركز الرئيسي',
                joiningDate: startDate || today,
                activationDate: startDate,
                startDate: startDate,
                expiryDate: subExpiry,
                endDate: subExpiry,
                dueDate: subExpiry !== '-' ? subExpiry : '',
                subscriptionType: subscriptionType,
                paymentMethod: paymentMethod,
                paymentStatus: paymentMethod === 'نقد' ? 'مدفوع' : 'دين',
                price: price,
                status: 'فعال',
                activeStatus: 'فعال',
                isActivated: true,
                is_active: true
              });
            }
            data.subscribers = subs;
            if (getEngine() && typeof getEngine().saveLocal === 'function') {
              getEngine().saveLocal();
            }
            getEngine().commitData('subscribers', subs).catch(err => console.warn('Subscribers sync warning:', err));
            const subToSync = subs.find(s => (deviceNumber && s.deviceNumber === deviceNumber) || (customerName && s.name === customerName)) || subs[subs.length - 1];
            getEngine().forceSyncSubscriberActivation(subToSync).catch(err => console.warn('Immediate activation sync error:', err));
          }

          data.sales = updatedSales;
          if (getEngine() && typeof getEngine().saveLocal === 'function') {
            getEngine().saveLocal();
          }
          getEngine().commitData('sales', updatedSales).catch(err => console.warn('Sales sync warning:', err));
          showToast('تم تسجيل وتفعيل الفاتورة وتحديث المشترك بنجاح', 'success');
          window.closeModal();

          if (typeof window.renderSubscribers === 'function' && document.getElementById('subscribers-table-body')) {
            window.renderSubscribers(document.getElementById('main-content'));
          } else if (window.currentPage === 'sales' && typeof renderSales === 'function') {
            renderSales(document.getElementById('main-content'));
          }

          window.openSaleSuccessModal(newSale);
          return;
        }
      } catch (err) {
        console.error('Error saving sale/activation:', err);
        showToast('حدث خطأ أثناء معالجة الطلب في Firestore: ' + (err.message || ''), 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.dataset.origHTML || 'تسجيل الفاتورة';
        }
      }
    };
  };

  // --- Sale Success Modal with QR Code for Device Number ---
  window.openSaleSuccessModal = function(sale) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="sale-success-modal" onclick="if (event.target === this) { window.closeModal(); navigateTo(currentPage); }">
        <div class="modal-dialog" style="max-width: 520px;" onclick="event.stopPropagation()">
          <div class="modal-header" style="background: var(--success-bg, #ecfdf5); border-bottom: 1px solid var(--success-border, #a7f3d0);">
            <h3 style="color: var(--success, #059669); display: flex; align-items: center; gap: 8px;">
              <span>🎉</span> <span>تم تسجيل الفاتورة بنجاح</span>
            </h3>
            <button type="button" class="modal-close" onclick="window.closeModal(); navigateTo(currentPage);">✕</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <div style="background: var(--surface-alt); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; border: 1px solid var(--line);">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.92rem;">
                <div><strong>اسم المشترك:</strong> <span style="color: var(--text-main);">${escapeHtml(sale.customerName)}</span></div>
                <div><strong>نوع البيع:</strong> <span style="color: var(--primary); font-weight: 700;">${escapeHtml(sale.saleType)}</span></div>
                <div><strong>كود الجهاز:</strong> <span style="font-family: monospace; font-weight: 800; color: var(--accent);">${escapeHtml(sale.deviceNumber || 'غير متوفر')}</span></div>
                <div><strong>قيمة الفاتورة:</strong> <span style="font-weight: 700; color: var(--green);">${formatNumber(sale.price)} د.ع</span></div>
                <div><strong>تاريخ البدء:</strong> <span>${escapeHtml(sale.startDate || '-')}</span></div>
                <div><strong>تاريخ الانتهاء:</strong> <span>${escapeHtml(sale.endDate || '-')}</span></div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 10px;">
              <label style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-main);">
                📱 QR Code لرقم الجهاز (${escapeHtml(sale.deviceNumber || 'رقم الجهاز')}):
              </label>
              <div style="display: inline-flex; padding: 16px; background: #ffffff; border-radius: var(--radius-md); border: 2px solid var(--line); box-shadow: 0 4px 12px rgba(0,0,0,0.06); justify-content: center; align-items: center;">
                <div id="sale-success-qr" style="width: 200px; height: 200px; display: flex; align-items: center; justify-content: center;"></div>
              </div>
              <div style="font-size: 0.78rem; color: var(--muted); margin-top: 6px;">يمكن مسح هذا الرمز ضوئياً للوصول الفوري لرقم الجهاز وتفاصيل المشترك</div>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary" onclick="window.downloadSaleInvoiceImage('${sale.id}')">📥 تحميل</button>
              <button type="button" class="btn btn-success" onclick="window.shareSaleWhatsAppCard('${sale.id}')" style="background: #25D366; color: white; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                <span>💬</span> <span>واتساب</span>
              </button>
            </div>
            <button type="button" class="btn btn-primary" onclick="window.closeModal(); navigateTo(currentPage);">تم</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const qrEl = document.getElementById('sale-success-qr');
      if (qrEl && !qrEl.hasChildNodes() && typeof QRCode !== 'undefined' && sale.deviceNumber) {
        new QRCode(qrEl, {
          text: sale.deviceNumber,
          width: 190,
          height: 190,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }, 100);
  };

  window.printSaleInvoice = function(saleId) {
    const data = getData();
    const sale = (data.sales || []).find(s => s.id === saleId);
    if (!sale) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      showToast('يرجى السماح بفتح النوافذ المنبثقة للطباعة', 'error');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة بيع واشتراك - ${escapeHtml(sale.code || sale.id)}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #111; direction: rtl; }
          .invoice-box { max-width: 600px; margin: auto; padding: 30px; border: 2px solid #333; border-radius: 8px; }
          h2 { text-align: center; margin-bottom: 20px; color: #0284c7; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px; }
          .qr-section { text-align: center; margin-top: 30px; }
          .footer { text-align: center; margin-top: 30px; font-size: 0.85rem; color: #666; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <h2>فاتورة بيع واشتراك مركز الساري</h2>
          <div class="info-row"><strong>رقم الفاتورة:</strong> <span>${escapeHtml(sale.code || sale.id)}</span></div>
          <div class="info-row"><strong>اسم المشترك:</strong> <span>${escapeHtml(sale.customerName)}</span></div>
          <div class="info-row"><strong>رقم الهاتف:</strong> <span>${escapeHtml(sale.customerPhone || '-')}</span></div>
          <div class="info-row"><strong>نوع البيع:</strong> <span>${escapeHtml(sale.saleType)}</span></div>
          <div class="info-row"><strong>كود الجهاز:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHtml(sale.deviceNumber)}</span></div>
          <div class="info-row"><strong>فترة الاشتراك:</strong> <span>${escapeHtml(sale.subscriptionType || '-')}</span></div>
          <div class="info-row"><strong>تاريخ البدء:</strong> <span>${escapeHtml(sale.startDate || '-')}</span></div>
          <div class="info-row"><strong>تاريخ الانتهاء:</strong> <span>${escapeHtml(sale.endDate || '-')}</span></div>
          <div class="info-row"><strong>المبلغ الإجمالي:</strong> <span style="font-weight: bold; color: #059669;">${formatNumber(sale.price)} د.ع</span></div>
          <div class="info-row"><strong>طريقة الدفع:</strong> <span>${escapeHtml(sale.paymentMethod || 'نقد')}</span></div>
          
          <div class="qr-section">
            <div id="print-qr" style="display: inline-block; padding: 10px; background: #fff; border: 1px solid #ccc;"></div>
            <div style="margin-top: 8px; font-size: 0.85rem; font-weight: bold;">كود الجهاز: ${escapeHtml(sale.deviceNumber)}</div>
          </div>

          <div class="footer">
            <p>شكراً لتعاملكم مع مركز الساري للبث الارضي</p>
          </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <script>
          window.onload = function() {
            new QRCode(document.getElementById('print-qr'), {
              text: "${sale.deviceNumber || ''}",
              width: 160,
              height: 160,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.M
            });
            setTimeout(() => { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  window.downloadSaleInvoiceImage = async function(saleId) {
    const data = getData();
    const sale = (data.sales || []).find(s => s.id === saleId);
    if (!sale) return;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '600px';
    container.style.background = '#ffffff';
    container.style.padding = '30px';
    container.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif";
    container.style.direction = 'rtl';
    container.style.color = '#111111';
    container.style.borderRadius = '8px';
    container.style.border = '2px solid #333333';

    container.innerHTML = `
      <h2 style="text-align: center; margin-bottom: 20px; color: #0284c7; font-size: 1.5rem;">فاتورة بيع واشتراك مركز الساري</h2>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>رقم الفاتورة:</strong> <span>${escapeHtml(sale.code || sale.id)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>اسم المشترك:</strong> <span>${escapeHtml(sale.customerName)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>رقم الهاتف:</strong> <span>${escapeHtml(sale.customerPhone || '-')}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>نوع البيع:</strong> <span>${escapeHtml(sale.saleType)}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>كود الجهاز:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHtml(sale.deviceNumber || '-')}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>فترة الاشتراك:</strong> <span>${escapeHtml(sale.subscriptionType || '-')}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>تاريخ البدء:</strong> <span>${escapeHtml(sale.startDate || '-')}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>تاريخ الانتهاء:</strong> <span>${escapeHtml(sale.endDate || '-')}</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>المبلغ الإجمالي:</strong> <span style="font-weight: bold; color: #059669;">${formatNumber(sale.price)} د.ع</span></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #ddd; padding-bottom: 8px;"><strong>طريقة الدفع:</strong> <span>${escapeHtml(sale.paymentMethod || 'نقد')}</span></div>
      
      <div style="text-align: center; margin-top: 30px;">
        <div id="download-qr-box" style="display: inline-block; padding: 10px; background: #fff; border: 1px solid #ccc;"></div>
        <div style="margin-top: 8px; font-size: 0.85rem; font-weight: bold;">كود الجهاز: ${escapeHtml(sale.deviceNumber || '')}</div>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 0.85rem; color: #666;">
        <p>شكراً لتعاملكم مع مركز الساري للبث الارضي</p>
      </div>
    `;

    document.body.appendChild(container);

    if (typeof QRCode !== 'undefined' && sale.deviceNumber) {
      const qrTarget = container.querySelector('#download-qr-box');
      new QRCode(qrTarget, {
        text: sale.deviceNumber,
        width: 160,
        height: 160,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    setTimeout(async () => {
      try {
        if (typeof html2canvas === 'undefined') {
          showToast('مكتبة html2canvas غير متوفرة', 'error');
          document.body.removeChild(container);
          return;
        }
        const canvas = await html2canvas(container, { scale: 2, useCORS: true });
        const imageUri = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUri;
        downloadLink.download = `فاتورة-${sale.code || sale.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        showToast('تم تحميل صورة الفاتورة بنجاح', 'success');
      } catch (err) {
        console.error('Error generating invoice image:', err);
        showToast('حدث خطأ أثناء تحميل صورة الفاتورة', 'error');
      } finally {
        document.body.removeChild(container);
      }
    }, 400);
  };

    window.shareSaleWhatsAppCard = async function(saleId) {
    const data = getData();
    const sale = (data.sales || []).find(s => s.id === saleId) || (data.subscribers || []).find(s => s.id === saleId);
    if (!sale) {
      showToast("لم يتم العثور على بيانات الفاتورة", "error");
      return;
    }

    const customerName = sale.customerName || sale.name || "المشترك";
    const customerPhone = sale.customerPhone || sale.phone || "";
    const deviceNumber = sale.deviceNumber || "00";
    const saleType = sale.saleType || "تجديد اشتراك";
    const subscriptionType = sale.subscriptionType || "1 شهر";
    const startDate = sale.startDate || sale.activationDate || new Date().toISOString().substring(0, 10);
    const endDate = sale.endDate || sale.expiryDate || "-";
    const price = formatNumber(sale.price || 25000);
    const paymentStatus = sale.paymentStatus || "تم التسديد";

    showToast("جاري تجهيز وتوليد بطاقة المشترك للمشاركة...", "info");

    const cardEl = document.createElement("div");
    cardEl.style.position = "fixed";
    cardEl.style.left = "-9999px";
    cardEl.style.top = "0";
    cardEl.style.width = "460px";
    cardEl.style.background = "#ffffff";
    cardEl.style.padding = "22px";
    cardEl.style.fontFamily = "'Cairo', 'Tajawal', system-ui, sans-serif";
    cardEl.style.direction = "rtl";
    cardEl.style.color = "#0f172a";
    cardEl.style.borderRadius = "14px";
    cardEl.style.border = "2px solid #0284c7";
    cardEl.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";

    cardEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px;">
        <div>
          <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 6px;">
            <span>🛰️</span> <span>مركز الساري للبث الأرضي</span>
          </h2>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px; font-weight: 600;">بطاقة اشتراك وتفعيل جهاز معتمد</div>
        </div>
        <div style="text-align: left;">
          <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; border: 1px solid #bae6fd;">
            ${escapeHtml(saleType)}
          </span>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 12px; text-align: center; margin-bottom: 14px;">
        <div style="font-size: 0.76rem; color: #64748b; font-weight: 700; margin-bottom: 4px;">رقم كود الجهاز المعتمد (16 رقماً):</div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 1.22rem; font-weight: 900; letter-spacing: 2px; color: #0f172a; margin-bottom: 10px; direction: ltr;">
          ${escapeHtml(deviceNumber)}
        </div>
        <div style="display: flex; justify-content: center; align-items: center;">
          <div id="wa-share-card-qr" style="padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-flex;"></div>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 0.88rem; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding-bottom: 4px;">
          <span style="color: #64748b; font-weight: 600;">👤 اسم المشترك:</span>
          <strong style="color: #0f172a;">${escapeHtml(customerName)}</strong>
        </div>
        ${customerPhone ? `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding: 4px 0;">
          <span style="color: #64748b; font-weight: 600;">📞 رقم الهاتف:</span>
          <span style="font-family: monospace; font-weight: 700; direction: ltr;">${escapeHtml(customerPhone)}</span>
        </div>` : ""}
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding: 4px 0;">
          <span style="color: #64748b; font-weight: 600;">📅 مدة الاشتراك:</span>
          <strong style="color: #0284c7;">${escapeHtml(subscriptionType)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding: 4px 0;">
          <span style="color: #64748b; font-weight: 600;">🗓️ تاريخ البدء:</span>
          <span style="font-family: monospace; font-weight: 600;">${escapeHtml(startDate)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding: 4px 0;">
          <span style="color: #64748b; font-weight: 600;">⌛ تاريخ الانتهاء:</span>
          <span style="font-family: monospace; font-weight: 700; color: #dc2626;">${escapeHtml(endDate)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 4px;">
          <span style="color: #64748b; font-weight: 600;">💰 المبلغ الإجمالي:</span>
          <strong style="color: #16a34a; font-size: 0.95rem;">${price} د.ع (${escapeHtml(paymentStatus)})</strong>
        </div>
      </div>

      <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 0.74rem; color: #64748b; line-height: 1.4;">
        <div>🌟 شكراً لاختياركم مركز الساري للبث الأرضي - نتمنى لكم مشاهدة ممتعة 🌟</div>
        <div style="font-weight: 700; color: #0284c7; margin-top: 2px;">خدمة المشتركين والدعم الفني المباشر</div>
      </div>
    `;

    document.body.appendChild(cardEl);

    if (typeof QRCode !== "undefined" && deviceNumber) {
      const qrBox = cardEl.querySelector("#wa-share-card-qr");
      if (qrBox) {
        new QRCode(qrBox, {
          text: deviceNumber,
          width: 130,
          height: 130,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }

    setTimeout(async () => {
      try {
        let imageBlob = null;
        if (typeof html2canvas !== "undefined") {
          const canvas = await html2canvas(cardEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
          imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
          
          const downloadUrl = URL.createObjectURL(imageBlob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `بطاقة-مشترك-${deviceNumber || customerName}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 4000);
        }

        const waText = 
`السلام عليكم ورحمة الله وبركاته 🌹
🌟 *مركز الساري للبث الأرضي* 🌟
📋 *بطاقة اشتراك وتفعيل جهاز*

👤 *المشترك:* ${customerName}
📱 *رقم الجهاز:* ${deviceNumber}
${customerPhone ? `📞 *الهاتف:* ${customerPhone}\n` : ""}📅 *فترة الاشتراك:* ${subscriptionType}
🗓️ *تاريخ البدء:* ${startDate}
⌛ *تاريخ الانتهاء:* ${endDate}
💰 *المبلغ:* ${price} د.ع
💳 *حالة الدفع:* ${paymentStatus}

🎉 تمت عملية التفعيل وتجديد الاشتراك بنجاح!
(تم تنزيل وحفظ صورة البطاقة المعتمدة لإرسالها)
شكراً لاختياركم مركز الساري للبث الأرضي.`;

        let waUrl = "https://wa.me/?text=" + encodeURIComponent(waText);
        if (customerPhone && typeof window.normalizeIraqiPhone === "function") {
          const norm = window.normalizeIraqiPhone(customerPhone);
          if (norm) {
            waUrl = "https://wa.me/" + norm + "?text=" + encodeURIComponent(waText);
          }
        }

        if (imageBlob && navigator.canShare && navigator.canShare({ files: [new File([imageBlob], "card.png", { type: "image/png" })] })) {
          try {
            const file = new File([imageBlob], `بطاقة-${deviceNumber}.png`, { type: "image/png" });
            await navigator.share({
              title: `بطاقة اشتراك - ${customerName}`,
              text: waText,
              files: [file]
            });
            showToast("تمت مشاركة بطاقة المشترك بنجاح!", "success");
            return;
          } catch (shareErr) {
            console.log("Web share cancelled or fallback needed:", shareErr);
          }
        }

        window.open(waUrl, "_blank");
        showToast("تم تنزيل صورة البطاقة وفتح واتساب لمشاركتها مع المشترك!", "success");
      } catch (err) {
        console.error("Error sharing WhatsApp card:", err);
        showToast("حدث خطأ أثناء إعداد البطاقة للمشاركة: " + (err.message || ""), "error");
      } finally {
        if (cardEl && cardEl.parentNode) {
          cardEl.parentNode.removeChild(cardEl);
        }
      }
    }, 450);
  };

  window.addMonthsToDate = function(dateStr, months) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0])) return '';
    const [year, month, day] = parts;
    const target = new Date(year, month - 1 + months, day);
    if (target.getDate() !== day) {
      target.setDate(0);
    }
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  window.recalcEndDate = function() {
    const startInput = document.getElementById('sf-start');
    const subType = document.getElementById('sf-sub')?.value;
    const today = new Date().toISOString().substring(0, 10);
    if (startInput && !startInput.value) {
      startInput.value = today;
    }
    const startVal = startInput?.value || today;

    let months = 1;
    if (subType === '1 شهر' || subType === 'اشتراك شهر واحد') months = 1;
    else if (subType === '2 شهر' || subType === 'اشتراك شهرين') months = 2;
    else if (subType === '3 شهر' || subType === 'اشتراك 3 أشهر') months = 3;
    else if (subType === '6 شهر' || subType === 'اشتراك 6 أشهر') months = 6;
    else if (subType === '1 سنة' || subType === 'اشتراك سنة' || subType === '12 شهر') months = 12;

    const endVal = window.addMonthsToDate(startVal, months);
    const endInput = document.getElementById('sf-end');
    if (endInput) {
      endInput.value = endVal;
    }
  };

  window.recalculateSalePrice = function() {
    const seller = document.getElementById('sf-seller')?.value;
    const saleType = document.getElementById('sf-type')?.value;
    const subType = document.getElementById('sf-sub')?.value;
    const priceInput = document.getElementById('sf-price');
    if (!priceInput) return;

    const group = window.getAgentPricing ? window.getAgentPricing(seller) : (DEFAULT_PRICING.headquarters);

    let calculated = 50000;
    if (saleType === 'جهاز جديد') {
      calculated = group.device || 50000;
    } else {
      if (subType === '1 شهر' || subType === 'اشتراك شهر واحد') calculated = group.sub1 || 25000;
      else if (subType === '2 شهر' || subType === 'اشتراك شهرين') calculated = group.sub2 || 50000;
      else if (subType === '3 شهر' || subType === 'اشتراك 3 أشهر') calculated = group.sub3 || 75000;
      else if (subType === '6 شهر' || subType === 'اشتراك 6 أشهر') calculated = group.sub6 || (group.sub1 ? group.sub1 * 6 : 150000);
      else if (subType === '1 سنة' || subType === 'اشتراك سنة' || subType === '12 شهر') calculated = group.sub12 || (group.sub1 ? group.sub1 * 12 : 300000);
      else calculated = group.sub1 || 25000;
    }

    priceInput.value = formatNumber(calculated);
    window.recalcEndDate();
  };

  window.showConfirmModal = function(title, message, onConfirm, confirmText = 'تأكيد', cancelText = 'إلغاء', isDanger = true) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" style="z-index: 9999;" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 440px; text-align: right; direction: rtl;" onclick="event.stopPropagation()">
          <div class="modal-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.5rem;">${isDanger ? '⚠️' : 'ℹ️'}</span>
              <h3 style="margin: 0; font-size: 1.15rem; color: var(--text);">${escapeHtml(title)}</h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--muted);">✕</button>
          </div>
          <div class="modal-body" style="padding: 20px 0; color: var(--text-sub); font-size: 0.95rem; line-height: 1.6; white-space: pre-line;">
            ${escapeHtml(message)}
          </div>
          <div class="modal-footer" style="border-top: 1px solid var(--line); padding-top: 14px; display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()" style="min-width: 90px;">${escapeHtml(cancelText)}</button>
            <button type="button" id="custom-confirm-btn" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" style="min-width: 100px;">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('custom-confirm-btn').onclick = async () => {
      window.closeModal();
      if (typeof onConfirm === 'function') {
        await onConfirm();
      }
    };
  };

  window.updatePaymentSelectColor = function(el) {
    if (!el) return;
    if (el.value === 'دين') {
      el.style.color = 'var(--danger)';
      el.style.borderColor = 'var(--danger)';
    } else {
      el.style.color = 'var(--success)';
      el.style.borderColor = 'var(--success)';
    }
  };

  let qrDebounceTimer = null;
  window.updateSaleQrCode = function(val) {
    if (qrDebounceTimer) clearTimeout(qrDebounceTimer);
    qrDebounceTimer = setTimeout(() => {
      const box = document.getElementById('sf-qr-box');
      if (!box) return;
      box.innerHTML = '';
      const text = (val || '').trim();
      if (text && typeof QRCode !== 'undefined') {
        try {
          new QRCode(box, {
            text: text,
            width: 135,
            height: 135,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch (e) {
          console.warn('QR gen error:', e);
        }
      } else {
        box.innerHTML = '<span style="font-size: 0.7rem; color: var(--muted); display: flex; align-items: center; justify-content: center; height: 100%;">أدخل رقم الجهاز لعرض QR</span>';
      }
    }, 150);
  };

  window.closeModal = function() {
    const container = document.getElementById('modal-container');
    if (container) {
      container.innerHTML = '';
    }
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(el => el.remove());
    document.body.classList.remove('modal-open');
  };

  // Global Escape key listener to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeModal();
    }
  });

  // Run initialization on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Sidebar click-outside listener
  document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.menu-toggle-btn');
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
      sidebar.classList.remove('open');
      document.querySelector('.sidebar-backdrop')?.classList.remove('active');
    }
  });

})();
