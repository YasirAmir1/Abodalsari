/**
 * app-import-progress.js
 * شريط تقدم (Progress Bar) مخصص بأسفل الهيدر يظهر فقط أثناء استيراد البيانات
 * ويتغير لونه بناءً على حالة المزامنة:
 * - أخضر للنجاح (Success)
 * - أحمر للخطأ (Error)
 * - أزرق متدرج ونبضي أثناء المعالجة والمزامنة (In-Progress / Syncing)
 */

(function() {
  'use strict';

  let hideTimeout = null;
  let activeState = 'idle'; // idle | importing | syncing | success | error

  const ICONS = {
    importing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.9s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>`,
    syncing: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.9s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  function getElements() {
    return {
      container: document.getElementById('header-import-progress-container'),
      fill: document.getElementById('header-import-progress-fill'),
      icon: document.getElementById('header-import-progress-icon'),
      text: document.getElementById('header-import-progress-text'),
      percent: document.getElementById('header-import-progress-percent'),
      closeBtn: document.getElementById('header-import-progress-close')
    };
  }

  const HeaderImportProgress = {
    /**
     * Start the progress bar at the bottom of the header
     * @param {string} text - Message to display
     * @param {number} initialPercent - Starting percent (default 10)
     */
    start(text = 'جاري استيراد البيانات...', initialPercent = 10) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      const els = getElements();
      if (!els.container || !els.fill) return;

      activeState = 'importing';

      // Reset classes
      els.container.classList.remove('state-importing', 'state-syncing', 'state-success', 'state-error');
      els.container.classList.add('state-importing');

      // Make visible directly below header
      els.container.style.display = 'block';
      els.container.style.opacity = '1';

      if (els.closeBtn) els.closeBtn.style.display = 'none';

      this.update(initialPercent, text, 'importing');
    },

    /**
     * Update progress percent, text, and state
     * @param {number} percent - Percentage 0-100
     * @param {string} text - Message to display
     * @param {string} state - 'importing' | 'syncing' | 'success' | 'error'
     */
    update(percent = 0, text = '', state = null) {
      const els = getElements();
      if (!els.container || !els.fill) return;

      const clamped = Math.max(0, Math.min(100, Math.round(percent)));

      if (state && state !== activeState) {
        activeState = state;
        els.container.classList.remove('state-importing', 'state-syncing', 'state-success', 'state-error');
        els.container.classList.add(`state-${state}`);
      }

      // Update progress bar width
      els.fill.style.width = `${clamped}%`;
      els.container.setAttribute('aria-valuenow', clamped);

      // Update text
      if (text && els.text) {
        els.text.textContent = text;
        els.text.title = text;
      }

      // Update badge percent
      if (els.percent) {
        els.percent.textContent = `${clamped}%`;
      }

      // Update icon
      if (els.icon && ICONS[activeState]) {
        els.icon.innerHTML = ICONS[activeState];
      }
    },

    /**
     * Finish with Success state (أخضر للنجاح)
     * @param {string} message - Success message
     * @param {number} autoHideMs - Milliseconds before hiding (default 3200ms)
     */
    success(message = 'تم الاستيراد والمزامنة بنجاح!', autoHideMs = 3200) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      const els = getElements();
      if (!els.container || !els.fill) return;

      activeState = 'success';
      els.container.classList.remove('state-importing', 'state-syncing', 'state-error');
      els.container.classList.add('state-success');

      els.fill.style.width = '100%';
      els.container.setAttribute('aria-valuenow', '100');

      if (els.text) {
        els.text.textContent = message;
        els.text.title = message;
      }

      if (els.percent) {
        els.percent.textContent = '100%';
      }

      if (els.icon) {
        els.icon.innerHTML = ICONS.success;
      }

      if (els.closeBtn) {
        els.closeBtn.style.display = 'none';
      }

      hideTimeout = setTimeout(() => {
        this.hide();
      }, autoHideMs);
    },

    /**
     * Finish with Error state (أحمر للخطأ)
     * @param {string} message - Error message
     * @param {number} autoHideMs - Milliseconds before hiding (default 5000ms)
     */
    error(message = 'حدث خطأ أثناء استيراد البيانات والمزامنة', autoHideMs = 5000) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      const els = getElements();
      if (!els.container || !els.fill) return;

      activeState = 'error';
      els.container.classList.remove('state-importing', 'state-syncing', 'state-success');
      els.container.classList.add('state-error');

      // Keep fill at current position or set to 100% to show clear red alert
      els.fill.style.width = '100%';

      if (els.text) {
        els.text.textContent = message;
        els.text.title = message;
      }

      if (els.percent) {
        els.percent.textContent = 'خطأ';
      }

      if (els.icon) {
        els.icon.innerHTML = ICONS.error;
      }

      // Show close button so user can dismiss anytime
      if (els.closeBtn) {
        els.closeBtn.style.display = 'inline-block';
        els.closeBtn.onclick = () => this.hide();
      }

      hideTimeout = setTimeout(() => {
        this.hide();
      }, autoHideMs);
    },

    /**
     * Hide and reset the progress bar
     */
    hide() {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      const els = getElements();
      if (!els.container || !els.fill) return;

      els.container.style.opacity = '0';
      setTimeout(() => {
        if (els.container) {
          els.container.style.display = 'none';
          els.fill.style.width = '0%';
          els.container.classList.remove('state-importing', 'state-syncing', 'state-success', 'state-error');
          activeState = 'idle';
        }
      }, 300);
    }
  };

  // Bind to window for global access
  window.HeaderImportProgress = HeaderImportProgress;
  window.showImportProgress = (t, p) => HeaderImportProgress.start(t, p);
  window.updateImportProgress = (p, t, s) => HeaderImportProgress.update(p, t, s);
  window.finishImportSuccess = (m, ms) => HeaderImportProgress.success(m, ms);
  window.finishImportError = (m, ms) => HeaderImportProgress.error(m, ms);
  window.hideImportProgress = () => HeaderImportProgress.hide();

  // Test helper for quick verification in console or tests
  window.testImportProgressBar = function(state = 'success') {
    HeaderImportProgress.start('جاري استيراد البيانات التجريبية...', 15);
    setTimeout(() => HeaderImportProgress.update(45, 'جاري معالجة 500 سطر بيانات...'), 700);
    setTimeout(() => HeaderImportProgress.update(75, 'جاري مزامنة البيانات مع السيرفر...', 'syncing'), 1400);
    setTimeout(() => {
      if (state === 'error') {
        HeaderImportProgress.error('فشل الاستيراد أو تعذر المزامنة مع السيرفر!');
      } else {
        HeaderImportProgress.success('تم استيراد البيانات ومزامنتها بنجاح!');
      }
    }, 2200);
  };

  // Wire close button once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('header-import-progress-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => HeaderImportProgress.hide());
    }
  });

})();
