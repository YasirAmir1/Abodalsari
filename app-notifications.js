/**
 * Al-Sari Real-time Notification & Admin Broadcast System
 * Real-time synchronization with Firebase Firestore 'notifications' collection
 */

(function() {
  'use strict';

  // Helper to get active user ID or username for read status storage
  function getCurrentUserKey() {
    const user = window.syncEngine?.currentUser;
    if (!user) return 'anonymous';
    return (user.uid || user.username || user.id || 'user').toLowerCase();
  }

  function getReadNotificationIds() {
    try {
      const key = 'sari_read_notifs_' + getCurrentUserKey();
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveReadNotificationIds(ids) {
    try {
      const key = 'sari_read_notifs_' + getCurrentUserKey();
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {}
  }

  window.getNotifications = function() {
    const data = window.syncEngine?.data;
    const notifs = data?.notifications || [];
    const user = window.syncEngine?.currentUser;
    const isAgent = user && user.role === 'agent';

    // If agent, show 'all' and 'agents' targets
    if (isAgent) {
      return notifs.filter(n => !n.target || n.target === 'all' || n.target === 'agents');
    }
    return notifs;
  };

  window.getUnreadNotificationsCount = function() {
    const notifs = window.getNotifications();
    const readIds = new Set(getReadNotificationIds());
    return notifs.filter(n => !readIds.has(n.id)).length;
  };

  window.markNotificationAsRead = function(id) {
    if (!id) return;
    const readIds = new Set(getReadNotificationIds());
    readIds.add(id);
    saveReadNotificationIds(Array.from(readIds));
    window.updateNotificationBadge();
    window.renderNotificationsDropdown();
  };

  window.markAllNotificationsAsRead = function() {
    const notifs = window.getNotifications();
    const readIds = new Set(getReadNotificationIds());
    notifs.forEach(n => readIds.add(n.id));
    saveReadNotificationIds(Array.from(readIds));
    window.updateNotificationBadge();
    window.renderNotificationsDropdown();
    if (typeof window.showToast === 'function') {
      window.showToast('تم تحديد جميع الإشعارات كمقروءة', 'success');
    }
  };

  window.updateNotificationBadge = function() {
    const badge = document.getElementById('topbar-notif-badge');
    const bellBtn = document.getElementById('btn-topbar-notifications');
    const unreadCount = window.getUnreadNotificationsCount();

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (bellBtn) {
      if (unreadCount > 0) {
        bellBtn.classList.add('has-unread');
      } else {
        bellBtn.classList.remove('has-unread');
      }
    }

    const dropdownCount = document.getElementById('notif-dropdown-count');
    if (dropdownCount) {
      dropdownCount.textContent = unreadCount > 0 ? `${unreadCount} جديد` : 'مكتمل';
    }
  };

  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays === 1) return 'أمس';
      if (diffDays < 7) return `منذ ${diffDays} أيام`;

      return date.toLocaleDateString('ar-IQ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  }

  function getTypeMeta(type) {
    switch (type) {
      case 'directive':
        return { label: 'توجيه عاجل', icon: '⚡', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
      case 'financial':
        return { label: 'تسديد ومالية', icon: '💰', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
      case 'general':
        return { label: 'تنبيه عام', icon: 'ℹ️', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
      case 'announcement':
      default:
        return { label: 'تعميم إداري', icon: '📢', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
    }
  }

  window.renderNotificationsDropdown = function() {
    const listEl = document.getElementById('notif-dropdown-list');
    const footerEl = document.getElementById('notif-dropdown-footer');
    if (!listEl) return;

    const notifs = window.getNotifications();
    const readIds = new Set(getReadNotificationIds());
    const user = window.syncEngine?.currentUser;
    const isAdmin = user && (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي');

    if (notifs.length === 0) {
      listEl.innerHTML = `
        <div class="notif-empty-state">
          <div class="notif-empty-icon">🔔</div>
          <h4>لا توجد تعميمات حالياً</h4>
          <p>جميع التوجيهات والتعميمات الصادرة من إدارة المركز ستظهر هنا فور نشرها ومزامنتها.</p>
        </div>
      `;
    } else {
      listEl.innerHTML = notifs.map(n => {
        const isRead = readIds.has(n.id);
        const meta = getTypeMeta(n.type);
        const timeStr = formatRelativeTime(n.createdAt);

        return `
          <div class="notif-item ${isRead ? 'is-read' : 'is-unread'}" data-id="${n.id}" onclick="window.markNotificationAsRead('${n.id}')">
            <div class="notif-item-top">
              <span class="notif-type-tag" style="background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.border};">
                <span>${meta.icon}</span> ${meta.label}
              </span>
              <div class="notif-item-actions">
                <span class="notif-time">${timeStr}</span>
                ${isAdmin ? `
                  <button type="button" class="notif-item-del-btn" title="حذف التعميم" onclick="event.stopPropagation(); window.deleteBroadcastNotification('${n.id}');">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="notif-item-title-row">
              <strong class="notif-item-title">${escapeHtml(n.title || 'تعميم إداري')}</strong>
              ${!isRead ? '<span class="notif-unread-dot" title="غير مقروء"></span>' : ''}
            </div>

            <p class="notif-item-message">${escapeHtml(n.message || '')}</p>

            <div class="notif-item-bottom">
              <span class="notif-sender">👤 ${escapeHtml(n.sender || 'المدير العام')}</span>
              ${n.target === 'agents' ? '<span class="badge badge-info" style="font-size: 0.65rem; padding: 2px 6px;">موجه للوكلاء</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    if (footerEl) {
      if (isAdmin) {
        footerEl.innerHTML = `
          <button type="button" class="btn btn-primary btn-sm notif-broadcast-action-btn" onclick="window.openBroadcastModal(); window.closeNotificationDropdown();">
            <span>📢</span>
            <span>بث تعليمات إدارية جديدة</span>
          </button>
        `;
      } else {
        footerEl.innerHTML = `
          <div style="font-size: 0.72rem; color: var(--muted); text-align: center; width: 100%;">
            تنبيهات وتوجيهات الإدارة العامة — الساري للبث الأرضي
          </div>
        `;
      }
    }
  };

  window.toggleNotificationDropdown = function(force) {
    const dropdown = document.getElementById('notif-dropdown');
    const backdrop = document.getElementById('notif-backdrop');
    if (!dropdown) return;

    const isOpen = dropdown.style.display === 'block';
    const shouldOpen = force !== undefined ? force : !isOpen;

    if (shouldOpen) {
      window.renderNotificationsDropdown();
      dropdown.style.display = 'block';
      dropdown.setAttribute('aria-expanded', 'true');

      // Responsiveness: screen-safe placement logic
      if (window.innerWidth <= 768) {
        dropdown.style.position = 'fixed';
        dropdown.style.top = window.innerWidth <= 480 ? '56px' : '60px';
        dropdown.style.left = '12px';
        dropdown.style.right = '12px';
        dropdown.style.width = 'calc(100vw - 24px)';
        dropdown.style.maxWidth = 'calc(100vw - 24px)';
        dropdown.style.boxSizing = 'border-box';
        dropdown.style.margin = '0';
        dropdown.style.zIndex = '9999';
        if (backdrop) backdrop.style.display = 'block';
      } else {
        dropdown.style.position = 'absolute';
        dropdown.style.top = 'calc(100% + 10px)';
        dropdown.style.left = '0';
        dropdown.style.right = 'auto';
        dropdown.style.width = '380px';
        dropdown.style.maxWidth = 'min(380px, calc(100vw - 32px))';
        dropdown.style.zIndex = '1050';
        if (backdrop) backdrop.style.display = 'none';
      }
    } else {
      dropdown.style.display = 'none';
      dropdown.setAttribute('aria-expanded', 'false');
      if (backdrop) backdrop.style.display = 'none';
    }
  };

  window.closeNotificationDropdown = function() {
    window.toggleNotificationDropdown(false);
  };

  // Broadcast Modal controls
  window.openBroadcastModal = function() {
    const modal = document.getElementById('broadcast-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const titleInput = document.getElementById('broadcast-modal-title');
    if (titleInput) {
      titleInput.value = '';
      titleInput.focus();
    }
    const msgInput = document.getElementById('broadcast-modal-message');
    if (msgInput) msgInput.value = '';
  };

  window.closeBroadcastModal = function() {
    const modal = document.getElementById('broadcast-modal');
    if (modal) modal.style.display = 'none';
  };

  // Preset suggestions helper
  window.fillBroadcastPreset = function(presetType, isModal = false) {
    const prefix = isModal ? 'broadcast-modal-' : 'broadcast-panel-';
    const titleInput = document.getElementById(prefix + 'title');
    const msgInput = document.getElementById(prefix + 'message');
    const typeSelect = document.getElementById(prefix + 'type');

    if (!titleInput || !msgInput) return;

    switch (presetType) {
      case 'settlement':
        titleInput.value = 'تذكير عاجل بتسديد المستحقات والديون للرئيسية';
        msgInput.value = 'الأخوة الوكلاء الكرام، يرجى تصفية وتسديد المبالغ المستحقة بذمتكم للرئيسية قبل نهاية الأسبوع لاعتماد كشوفات الحسابات.';
        if (typeSelect) typeSelect.value = 'financial';
        break;
      case 'pricing':
        titleInput.value = 'تحديث رسمي بخصوص أسعار الأجهزة وتجديد الاشتراكات';
        msgInput.value = 'نود إعلام جميع الوكلاء المعتمدين بتحديث قائمة الأسعار المعتمدة من المركز الرئيسي. يرجى مراجعة صفحة الأسعار والالتزام بالتعرفة المحددة.';
        if (typeSelect) typeSelect.value = 'announcement';
        break;
      case 'subscribers':
        titleInput.value = 'توجيه هام: تدقيق أرقام الأجهزة وبيانات المشتركين';
        msgInput.value = 'يرجى من جميع الوكلاء التأكد من إدخال أرقام الأجهزة (الكارت) بصورة دقيقة ومطابقة، وربط كل اشتراك برقم هاتف المشترك الفعلي.';
        if (typeSelect) typeSelect.value = 'directive';
        break;
      case 'bonus':
        titleInput.value = 'انطلاق حملة المبيعات والحوافز الشهرية للوكلاء';
        msgInput.value = 'يسر إدارة الساري الإعلان عن بدء احتساب المكافآت والحوافز للوكلاء المتميزين الذين يحققون أهداف المبيعات المحددة لهذا الشهر.';
        if (typeSelect) typeSelect.value = 'general';
        break;
    }
  };

  // Submit Broadcast Notification to Firestore
  window.handleBroadcastSubmit = async function(e, isModal = false) {
    if (e && e.preventDefault) e.preventDefault();
    const prefix = isModal ? 'broadcast-modal-' : 'broadcast-panel-';

    const titleEl = document.getElementById(prefix + 'title');
    const msgEl = document.getElementById(prefix + 'message');
    const typeEl = document.getElementById(prefix + 'type');
    const targetEl = document.getElementById(prefix + 'target');
    const submitBtn = document.getElementById(prefix + 'submit-btn');

    const title = (titleEl?.value || '').trim();
    const message = (msgEl?.value || '').trim();
    const type = typeEl?.value || 'announcement';
    const target = targetEl?.value || 'all';

    if (!title) {
      if (typeof window.showToast === 'function') window.showToast('يرجى كتابة عنوان للتعميم الإداري', 'error');
      titleEl?.focus();
      return;
    }

    if (!message) {
      if (typeof window.showToast === 'function') window.showToast('يرجى كتابة نص التوجيه أو التعميم', 'error');
      msgEl?.focus();
      return;
    }

    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ جاري بث التعميم والنشر...';
    }

    try {
      const user = window.syncEngine?.currentUser || { displayName: 'المدير العام', role: 'admin' };
      const notifData = {
        title,
        message,
        type,
        target,
        sender: user.displayName || 'أدمن المركز (المدير العام)',
        senderUid: user.uid || 'admin'
      };

      if (window.syncEngine && typeof window.syncEngine.broadcastNotification === 'function') {
        await window.syncEngine.broadcastNotification(notifData);
      }

      if (typeof window.showToast === 'function') {
        window.showToast('تم بث وحفظ التعميم بنجاح 🚀', 'success');
      }

      // Reset fields
      if (titleEl) titleEl.value = '';
      if (msgEl) msgEl.value = '';

      if (isModal) {
        window.closeBroadcastModal();
      }

      // Re-render broadcast panel on dashboard if visible
      const panelContainer = document.getElementById('admin-broadcast-panel-container');
      if (panelContainer) {
        window.renderAdminBroadcastPanel(panelContainer);
      }

      window.updateNotificationBadge();
    } catch (err) {
      console.error('Error broadcasting notification:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('تعذر نشر التعميم: ' + (err.message || 'خطأ غير معروف'), 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  };

  // Delete notification
  window.deleteBroadcastNotification = async function(id) {
    if (!id) return;
    const confirmDelete = confirm('هل أنت متأكد من حذف هذا التعميم؟ سيتم إزالته من جميع الأجهزة.');
    if (!confirmDelete) return;

    try {
      if (window.syncEngine && typeof window.syncEngine.deleteNotification === 'function') {
        await window.syncEngine.deleteNotification(id);
      }
      if (typeof window.showToast === 'function') {
        window.showToast('تم حذف التعميم بنجاح', 'success');
      }

      const panelContainer = document.getElementById('admin-broadcast-panel-container');
      if (panelContainer) {
        window.renderAdminBroadcastPanel(panelContainer);
      }
      window.updateNotificationBadge();
      window.renderNotificationsDropdown();
    } catch (err) {
      console.error('Error deleting notification:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('حدث خطأ أثناء حذف التعميم', 'error');
      }
    }
  };

  // Render Admin Broadcast Panel for the Dashboard
  window.renderAdminBroadcastPanel = function(container) {
    if (!container) return;
    const notifs = window.syncEngine?.data?.notifications || [];

    container.innerHTML = `
      <div class="content-card broadcast-panel-card">
        <div class="card-header-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="display: flex; align-items: center; gap: 8px; margin: 0;">
              <span style="font-size: 1.35rem;">📢</span>
              <span>لوحة بث التعميمات والتوجيهات الإدارية</span>
            </h3>
            <p style="font-size: 0.83rem; color: var(--text-sub); margin: 4px 0 0 0;">
              بث مباشر للتوجيهات والقرارات الإدارية — تتم المزامنة فورياً مع شريط إشعارات جميع الوكلاء والمستخدمين
            </p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700;">
              <span class="pulse-green-dot"></span>
              بث مباشر
            </span>
            <span class="badge badge-neutral" style="font-weight: 700;">
              ${notifs.length} تعميم مسجل
            </span>
          </div>
        </div>

        <!-- Form for creating new broadcast -->
        <form onsubmit="window.handleBroadcastSubmit(event, false); return false;" style="margin-top: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="broadcast-panel-title" style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 6px;">
                عنوان التعميم أو التوجيه <span style="color: var(--danger);">*</span>
              </label>
              <input type="text" id="broadcast-panel-title" class="form-control" placeholder="مثال: تنبيه بخصوص تسديد المبالغ المستحقة" required style="width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: inherit;">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label for="broadcast-panel-type" style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 6px;">
                تصنيف التوجيه
              </label>
              <select id="broadcast-panel-type" class="form-control" style="width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: inherit;">
                <option value="announcement">📢 تعميم إداري عام</option>
                <option value="directive">⚡ توجيه إداري عاجل</option>
                <option value="financial">💰 تعليمات مالية وتسديد</option>
                <option value="general">ℹ️ تنبيه وإشعار عام</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label for="broadcast-panel-target" style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 6px;">
                الجهة المستهدفة
              </label>
              <select id="broadcast-panel-target" class="form-control" style="width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: inherit;">
                <option value="all">🌐 جميع الوكلاء والإدارة</option>
                <option value="agents">👥 الوكلاء فقط</option>
              </select>
            </div>
          </div>

          <!-- Quick presets chips -->
          <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.78rem; color: var(--muted); font-weight: 600;">نماذج جاهزة سريعة:</span>
            <button type="button" class="preset-chip-btn" onclick="window.fillBroadcastPreset('settlement', false)">
              💰 تذكير بالتسديد
            </button>
            <button type="button" class="preset-chip-btn" onclick="window.fillBroadcastPreset('pricing', false)">
              🏷️ تحديث الأسعار
            </button>
            <button type="button" class="preset-chip-btn" onclick="window.fillBroadcastPreset('subscribers', false)">
              🔍 تدقيق بيانات الأجهزة
            </button>
            <button type="button" class="preset-chip-btn" onclick="window.fillBroadcastPreset('bonus', false)">
              🎯 حوافز ومكافآت
            </button>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label for="broadcast-panel-message" style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 6px;">
              نص التوجيه أو التعميم الإداري <span style="color: var(--danger);">*</span>
            </label>
            <textarea id="broadcast-panel-message" class="form-control" rows="3" placeholder="اكتب هنا نص التوجيه أو القرار الإداري المطلوب تعميمه على لوحات الوكلاء فورياً..." required style="width: 100%; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: inherit; font-size: 0.92rem;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
            <button type="submit" id="broadcast-panel-submit-btn" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; font-weight: 700;">
              <span>🚀</span>
              <span>نشر وبث التعميم فورياً</span>
            </button>
          </div>
        </form>

        <!-- Current Published Broadcasts List -->
        ${notifs.length > 0 ? `
          <div style="margin-top: 24px; border-top: 1px solid var(--line); padding-top: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--ink);">
                سجل التعميمات المنشورة
              </h4>
              <span style="font-size: 0.78rem; color: var(--muted);">تتزامن تلقائياً عبر الأجهزة</span>
            </div>

            <div class="broadcast-history-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-left: 4px;">
              ${notifs.slice(0, 10).map(n => {
                const meta = getTypeMeta(n.type);
                const timeStr = formatRelativeTime(n.createdAt);
                return `
                  <div class="broadcast-history-item" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 12px; background: var(--surface-alt); border-radius: var(--radius-sm); border: 1px solid var(--line);">
                    <div style="flex: 1;">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                        <span class="notif-type-tag" style="background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.border}; padding: 2px 8px; font-size: 0.7rem; border-radius: var(--radius-full); font-weight: 700;">
                          ${meta.icon} ${meta.label}
                        </span>
                        <strong style="font-size: 0.9rem; color: var(--ink);">${escapeHtml(n.title)}</strong>
                        <span style="font-size: 0.72rem; color: var(--muted); margin-right: auto;">${timeStr}</span>
                      </div>
                      <p style="margin: 0; font-size: 0.83rem; color: var(--text-sub); line-height: 1.5;">${escapeHtml(n.message)}</p>
                      <div style="margin-top: 6px; font-size: 0.7rem; color: var(--muted); display: flex; gap: 12px;">
                        <span>بواسطة: ${escapeHtml(n.sender || 'المدير العام')}</span>
                        <span>الهدف: ${n.target === 'agents' ? 'الوكلاء فقط' : 'الجميع'}</span>
                      </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger); border-color: var(--danger-border); background: var(--danger-bg);" title="حذف التعميم" onclick="window.deleteBroadcastNotification('${n.id}')">
                      🗑️ حذف
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper escape
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Ensure the notification bell and dropdown exist in the DOM (even if cached index.html was served)
  function ensureNotificationMarkupInDOM() {
    let container = document.getElementById('topbar-notif-container');
    if (!container) {
      const themeBtn = document.getElementById('btn-toggle-theme');
      if (themeBtn && themeBtn.parentNode) {
        container = document.createElement('div');
        container.className = 'topbar-notif-container';
        container.id = 'topbar-notif-container';
        container.innerHTML = `
          <button class="top-action-btn notif-bell-btn" id="btn-topbar-notifications" title="الإشعارات والتعميمات الإدارية" aria-label="الإشعارات والتعميمات">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="notif-badge" id="topbar-notif-badge" style="display: none;">0</span>
          </button>
          <div class="notif-dropdown" id="notif-dropdown">
            <div class="notif-dropdown-header">
              <div class="notif-header-title">
                <span style="font-size: 1.15rem;">📢</span>
                <strong>الإشعارات والتعميمات</strong>
                <span class="notif-count-pill" id="notif-dropdown-count">0</span>
              </div>
              <div class="notif-header-actions">
                <button type="button" class="notif-action-btn" id="btn-mark-all-notifs-read" title="تحديد جميع الإشعارات كمقروءة">
                  ✓ تحديد الكل كمقروء
                </button>
              </div>
            </div>
            <div class="notif-dropdown-body" id="notif-dropdown-list"></div>
            <div class="notif-dropdown-footer" id="notif-dropdown-footer"></div>
          </div>
        `;
        themeBtn.parentNode.insertBefore(container, themeBtn);
      }
    }

    if (!document.getElementById('broadcast-modal-overlay')) {
      const modalDiv = document.createElement('div');
      modalDiv.id = 'broadcast-modal-overlay';
      modalDiv.className = 'broadcast-modal-overlay';
      modalDiv.style.display = 'none';
      modalDiv.innerHTML = `
        <div class="broadcast-modal-card">
          <div class="broadcast-modal-header">
            <h3><span>📢</span> <span>بث تعميم إداري جديد</span></h3>
            <button type="button" class="btn-close" onclick="window.closeBroadcastModal()">&times;</button>
          </div>
          <form id="modal-broadcast-form" onsubmit="window.handleBroadcastSubmit(event)">
            <div class="broadcast-modal-body">
              <div class="form-group" style="margin-bottom: 14px;">
                <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.85rem;">نوع التعميم:</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <label class="radio-chip"><input type="radio" name="notifType" value="info" checked> <span>ℹ️ تنبيه عام</span></label>
                  <label class="radio-chip"><input type="radio" name="notifType" value="warning"> <span>⚠️ تحذير إداري</span></label>
                  <label class="radio-chip"><input type="radio" name="notifType" value="directive"> <span>📋 توجيه عاجل</span></label>
                  <label class="radio-chip"><input type="radio" name="notifType" value="pricing"> <span>💰 تسعيرة وعروض</span></label>
                </div>
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.85rem;">عنوان التعميم / التوجيه:</label>
                <input type="text" id="modal-notif-title" class="form-control" placeholder="مثال: تعليمات تجديد الاشتراكات لشهر جديد" required style="width: 100%; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.85rem;">نص الرسالة / التوجيه:</label>
                <textarea id="modal-notif-message" class="form-control" rows="4" placeholder="اكتب التعليمات الإدارية الموجهة للوكلاء هنا..." required style="width: 100%; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); resize: vertical;"></textarea>
              </div>
              <div class="form-group" style="margin-bottom: 14px;">
                <label style="display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.85rem;">الجمهور المستهدف:</label>
                <select id="modal-notif-target" class="form-control" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line);">
                  <option value="all">جميع الوكلاء والمستخدمين (عام)</option>
                  <option value="agents">الوكلاء فقط</option>
                  <option value="admin">الإدارة فقط</option>
                </select>
              </div>
            </div>
            <div class="broadcast-modal-footer" style="padding: 12px 18px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line);">
              <button type="button" class="btn btn-secondary" onclick="window.closeBroadcastModal()">إلغاء</button>
              <button type="submit" id="broadcast-modal-submit-btn" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
                <span>🚀</span> <span>بث وحفظ التعميم</span>
              </button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modalDiv);
    }
  }

  window.requestBrowserNotificationPermission = function() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  };

  window.showBrowserNotification = function(title, options) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            icon: '/logo.png',
            ...options
          });
        } catch (e) {}
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, {
                icon: '/logo.png',
                ...options
              });
            } catch (e) {}
          }
        }).catch(() => {});
      }
    }
  };

  // Initialize notification events and interactions
  window.initNotificationsSystem = function() {
    // 0. Ensure markup exists in DOM even if cached HTML was rendered
    ensureNotificationMarkupInDOM();

    // 1. Initial badge update
    window.updateNotificationBadge();

    // 2. Bell button toggle click
    const bellBtn = document.getElementById('btn-topbar-notifications');
    if (bellBtn) {
      bellBtn.onclick = function(e) {
        e.stopPropagation();
        window.requestBrowserNotificationPermission();
        window.toggleNotificationDropdown();
      };
    }

    // 3. Mark all as read button
    const markAllBtn = document.getElementById('btn-mark-all-notifs-read');
    if (markAllBtn) {
      markAllBtn.onclick = function(e) {
        e.stopPropagation();
        window.markAllNotificationsAsRead();
      };
    }

    // 4. Click outside to close dropdown
    document.addEventListener('click', function(e) {
      const container = document.getElementById('topbar-notif-container');
      const dropdown = document.getElementById('notif-dropdown');
      if (!dropdown || dropdown.style.display !== 'block') return;

      if (container && !container.contains(e.target)) {
        window.closeNotificationDropdown();
      }
    });

    // 5. Escape key to close dropdown and modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        window.closeNotificationDropdown();
        window.closeBroadcastModal();
      }
    });

    // 6. Real-time Firestore sync event listener & new notification audio chime + browser notification
    let lastSeenNotifIds = null;
    let lastSeenSubmissionIds = null;
    let lastSeenExpiringIds = null;

    // Automatically request browser notification permission on load
    window.requestBrowserNotificationPermission();

    window.addEventListener('sari:data-updated', function(e) {
      const data = window.syncEngine?.data || (window.getData ? window.getData() : {});

      // Check new agent submissions (orders)
      const submissions = data.agentSubmissions || [];
      const subIds = new Set(submissions.map(s => s.id));
      if (lastSeenSubmissionIds !== null) {
        let newSub = null;
        for (const sub of submissions) {
          if (!lastSeenSubmissionIds.has(sub.id)) {
            newSub = sub;
            break;
          }
        }
        if (newSub) {
          const user = window.syncEngine?.currentUser;
          const role = (user && (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي')) ? 'admin' : 'agent';
          if (typeof window.playNotificationChime === 'function') {
            window.playNotificationChime(true, role);
          }
          window.showBrowserNotification('طلب جديد قيد الانتظار - شبكة الساري', {
            body: `طلب ${newSub.saleType || 'تجديد/اشتراك'} للمشترك ${newSub.customerName || 'غير محدد'} (جهاز: ${newSub.deviceNumber || '00'}) بواسطة الوكيل ${newSub.seller || 'وكيل'}`,
            tag: 'new-order-' + newSub.id
          });
        }
      }
      lastSeenSubmissionIds = subIds;

      // Check expiring / expired subscriptions
      const subscribers = data.subscribers || [];
      const today = new Date().toISOString().substring(0, 10);
      const expiringSubs = subscribers.filter(s => {
        const exp = s.expiryDate || s.endDate || s.dueDate;
        if (!exp || exp === '-') return false;
        return exp <= today;
      });
      const expiringIds = new Set(expiringSubs.map(s => s.id || s.deviceNumber));
      if (lastSeenExpiringIds !== null) {
        let newlyExpired = null;
        for (const sub of expiringSubs) {
          const idKey = sub.id || sub.deviceNumber;
          if (!lastSeenExpiringIds.has(idKey)) {
            newlyExpired = sub;
            break;
          }
        }
        if (newlyExpired) {
          window.showBrowserNotification('تنبيه: انتهاء اشتراك مشترك', {
            body: `انتهى اشتراك المشترك ${newlyExpired.name || 'بدون اسم'} (جهاز: ${newlyExpired.deviceNumber || '00'})`,
            tag: 'expired-' + (newlyExpired.id || newlyExpired.deviceNumber)
          });
        }
      }
      lastSeenExpiringIds = expiringIds;

      if (!e.detail || e.detail.collection === 'notifications' || e.detail.collection === 'all') {
        const notifs = window.getNotifications();
        const currentIds = new Set(notifs.map(n => n.id));
        if (lastSeenNotifIds !== null) {
          let hasNew = false;
          let latestNotif = null;
          for (const n of notifs) {
            if (!lastSeenNotifIds.has(n.id)) {
              hasNew = true;
              latestNotif = n;
              break;
            }
          }
          if (hasNew) {
            const user = window.syncEngine?.currentUser;
            const role = (user && (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي')) ? 'admin' : 'agent';
            if (typeof window.playNotificationChime === 'function') {
              window.playNotificationChime(false, role);
            }
            if (latestNotif) {
              window.showBrowserNotification(latestNotif.title || 'إشعار جديد - شبكة الساري', {
                body: latestNotif.message || latestNotif.body || 'لديك إشعار إداري جديد',
                tag: latestNotif.id || 'broadcast'
              });
            }
          }
        }
        lastSeenNotifIds = currentIds;

        window.updateNotificationBadge();
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
          window.renderNotificationsDropdown();
        }
        const panelContainer = document.getElementById('admin-broadcast-panel-container');
        if (panelContainer) {
          window.renderAdminBroadcastPanel(panelContainer);
        }
      }
    });
  };

  // Auto-init on script evaluation & DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initNotificationsSystem();
    });
  } else {
    window.initNotificationsSystem();
  }

})();
