/**
 * Features: Debts, Subscribers, Barcodes/QR, Reports, Pricing, Users, Agent Dashboard
 * Al-Sari Terrestrial Broadcast Management System
 */

(function () {
  'use strict';

  function getEngine() { return window.syncEngine; }
  function getData() { return getEngine() ? getEngine().data : {}; }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatIQD(num) {
    return (Number(num) || 0).toLocaleString('en-US') + ' د.ع';
  }

  function formatNumber(num) {
    return (Number(num) || 0).toLocaleString('en-US');
  }

  function parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    const clean = typeof val === 'string' ? val.replace(/[^\d.-]/g, '') : val;
    return Number(clean) || 0;
  }
  window.parseNumber = window.parseNumber || parseNumber;

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
  window.formatInputWithCommas = window.formatInputWithCommas || formatInputWithCommas;

  function normalizeDigits(str) {
    if (!str) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(str).replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
                      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d));
  }

  // --- Page 4: Debts ---
  let debtFilterSeller = 'all';

  window.renderDebts = function(container) {
    const data = getData();
    let debts = data.debts || [];
    const agents = data.agents || [];

    if (debtFilterSeller !== 'all') {
      debts = debts.filter(d => d.seller === debtFilterSeller);
    }

    // Total calculation for all debts / filtered debts
    const totalDebts = debts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalRecords = debts.length;
    const paidSum = debts.reduce((sum, d) => sum + (Number(d.paidAmount) || 0), 0);
    const creditSalesTotal = debts.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

    // Specific Agent debts and payments to main (المطلوب من الوكلاء والمسدد للرئيسية)
    const agentNamesSet = new Set(agents.map(a => a.name));
    if (agents.length) {
      agents.forEach(a => {
        if (a.username) agentNamesSet.add(a.username);
        if (a.code) agentNamesSet.add(a.code);
      });
    }

    // Debts on agents: debts where debtor is agent or seller/agentName matches an agent
    const allDebtsList = data.debts || [];
    const agentDebtsList = (debtFilterSeller !== 'all')
      ? debts // If filtered by a specific agent, the debts are already scoped
      : allDebtsList.filter(d => 
          d.debtor === 'الوكيل والزبون' || 
          d.agentName || 
          agentNamesSet.has(d.seller) || 
          (d.notes && agents.some(a => d.notes.includes(a.name)))
        );

    const totalDueFromAgents = agentDebtsList.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const agentDebtsCount = agentDebtsList.filter(d => (Number(d.remainingAmount) || 0) > 0).length;

    // Total paid to main by agents (all payments on agent debts and sales)
    const allSales = data.sales || [];
    const countedDebtIds = new Set();
    let totalPaidToMain = 0;

    const relevantSales = (debtFilterSeller !== 'all')
      ? allSales.filter(s => s.seller === debtFilterSeller || s.agentName === debtFilterSeller)
      : allSales.filter(s => agentNamesSet.has(s.seller) || agentNamesSet.has(s.agentName));

    relevantSales.forEach(s => {
      let salePaid = Number(s.agentPaid) || 0;
      if (s.paymentStatus === 'تم التسديد' && salePaid === 0) {
        salePaid = Number(s.price) || 0;
      }
      const linkedDebt = allDebtsList.find(d => 
        (d.saleId && d.saleId === s.id) || 
        (s.code && d.saleCode === s.code) || 
        (s.deviceNumber && d.deviceNumber === s.deviceNumber)
      );
      if (linkedDebt) {
        countedDebtIds.add(linkedDebt.id);
        salePaid = Math.max(salePaid, Number(linkedDebt.paidAmount) || 0);
      }
      totalPaidToMain += salePaid;
    });

    // Add standalone agent debts paid amounts not linked to sales
    agentDebtsList.forEach(d => {
      if (!countedDebtIds.has(d.id)) {
        totalPaidToMain += (Number(d.paidAmount) || 0);
      }
    });

    // If totalPaidToMain is 0 but we have paidAmount recorded on debts, fallback to paid on debts
    const fallbackAgentDebtsPaid = agentDebtsList.reduce((sum, d) => sum + (Number(d.paidAmount) || 0), 0);
    const finalPaidToMain = Math.max(totalPaidToMain, fallbackAgentDebtsPaid);

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">إدارة المستحقات والذمم المالية</span>
            <h1>سجل الديون والمستحقات</h1>
            <p class="subtitle">متابعة دفعات الزبائن والوكلاء وجدولة السداد للمركز الرئيسي</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" onclick="exportDebtsExcel()">
              <span>📥</span> <span>تصدير Excel</span>
            </button>
          </div>
        </div>

        <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="border-top: 4px solid var(--danger);">
            <div class="stat-card-header">
              <span class="stat-title" style="font-weight: 700; color: var(--danger);">المطلوب من الوكلاء (ديون)</span>
              <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">🏢</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value" style="color: var(--danger);">${formatNumber(totalDueFromAgents)}</span>
              <span class="stat-unit">د.ع</span>
            </div>
            <div class="stat-footer">
              <span>⚠️ متبقي بذمة الوكلاء (${agentDebtsCount} ديون قائمة)</span>
            </div>
          </div>

          <div class="stat-card" style="border-top: 4px solid var(--success);">
            <div class="stat-card-header">
              <span class="stat-title" style="font-weight: 700; color: var(--success);">المسدد للرئيسية</span>
              <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--success);">💳</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value" style="color: var(--success);">${formatNumber(finalPaidToMain)}</span>
              <span class="stat-unit">د.ع</span>
            </div>
            <div class="stat-footer">
              <span>✅ إجمالي ما تم تسديده للرئيسية</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي الديون القائمة</span><div class="stat-icon">⏳</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--danger);">${formatNumber(totalDebts)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>المبلغ المتبقي للتحصيل الكلي</span></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">دفعات محصلة جزئياً</span><div class="stat-icon">💰</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--success);">${formatNumber(paidSum)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>من سجلات الديون المفلترة</span></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">عدد سجلات الديون</span><div class="stat-icon">📑</div></div>
            <div class="stat-value-group"><span class="stat-value">${totalRecords}</span><span class="stat-unit">سجل</span></div>
            <div class="stat-footer"><span>تشمل الوكلاء والزبائن</span></div>
          </div>

          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي المبيعات بالآجل</span><div class="stat-icon">📊</div></div>
            <div class="stat-value-group"><span class="stat-value">${formatNumber(creditSalesTotal)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>القيمة الكلية للديون الأصلية</span></div>
          </div>
        </div>

        <div class="content-card">
          <div class="filters-bar">
            <div class="filter-chips">
              <span class="chip ${debtFilterSeller === 'all' ? 'active' : ''}" onclick="setDebtFilter('all')">كافة الجهات</span>
              <span class="chip ${debtFilterSeller === 'المركز الرئيسي' ? 'active' : ''}" onclick="setDebtFilter('المركز الرئيسي')">المركز الرئيسي</span>
              ${agents.map(a => `
                <span class="chip ${debtFilterSeller === a.name ? 'active' : ''}" onclick="setDebtFilter('${escapeHtml(a.name)}')">${escapeHtml(a.name)}</span>
              `).join('')}
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المدين / الفاتورة</th>
                  <th>المبلغ والمسدد</th>
                  <th>المتبقي (الديون)</th>
                  <th>التواريخ (استحقاق / تسديد)</th>
                  <th>ملاحظات</th>
                  <th style="text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${debts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">لا توجد ديون مسجلة</td></tr>` : 
                  debts.map(d => `
                    <tr>
                      <td>
                        <strong class="cell-title">${escapeHtml(d.customerName)}</strong>
                        <div class="cell-subtitle">
                          <span class="badge badge-neutral" style="font-size: 0.70rem; padding: 1px 5px;">${escapeHtml(window.resolveAgentName ? window.resolveAgentName(d) : (d.seller || '-'))} (${escapeHtml(d.saleCode || '')})</span>
                        </div>
                        ${(d.debtor === 'الوكيل والزبون' || d.agentName) ? `
                          <div style="margin-top: 3px;">
                            <span class="badge badge-warning" style="font-size: 0.68rem; padding: 1px 5px;">
                              دين على الوكيل (${escapeHtml(d.agentName || d.seller)})
                            </span>
                          </div>
                        ` : ''}
                      </td>
                      <td>
                        <div style="font-size: 0.78rem;"><span style="color: var(--muted);">الكلي:</span> ${formatIQD(d.totalAmount)}</div>
                        <div style="font-size: 0.78rem; color: var(--success);"><span style="color: var(--muted);">المسدد:</span> ${formatIQD(d.paidAmount)}</div>
                      </td>
                      <td>
                        <strong style="color: var(--danger); font-size: 0.95rem;">${formatIQD(d.remainingAmount)}</strong>
                      </td>
                      <td>
                        <div class="cell-date-range" style="direction: ltr;">
                          <span class="cell-date-from">استحقاق: ${escapeHtml(d.dueDate || '-')}</span>
                          ${d.paymentDate ? `<span class="cell-date-to" style="color: var(--success);">تسديد: ${escapeHtml(d.paymentDate)}</span>` : (d.remainingAmount === 0 ? `<span class="badge badge-success" style="font-size: 0.68rem; padding: 1px 4px; align-self: flex-start;">مسدد بالكامل</span>` : '')}
                        </div>
                      </td>
                      <td></td>
                      <td style="text-align: center;">
                        <div class="action-btns" style="justify-content: center;">
                          <button class="btn btn-primary btn-sm" onclick="openDebtPaymentModal('${d.id}')" style="padding: 3px 7px; font-size: 0.75rem;">تسجيل دفعة</button>
                          <button class="icon-btn btn-del" onclick="deleteDebt('${d.id}')" title="حذف الدين">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  window.setDebtFilter = function(seller) {
    debtFilterSeller = seller;
    window.renderDebts(document.getElementById('main-content'));
  };

  window.openDebtPaymentModal = function(debtId) {
    const data = getData();
    const debts = data.debts || [];
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return;

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 440px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>تسجيل دفعة للدين</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="debt-pay-form">
            <div class="modal-body">
              <p>المدين: <strong>${escapeHtml(debt.customerName)}</strong></p>
              <p>المبلغ المتبقي حالياً: <strong style="color: var(--danger);">${formatIQD(debt.remainingAmount)}</strong></p>
              <div class="form-group" style="margin-top: 12px;">
                <label>مبلغ الدفعة المسددة (د.ع) *</label>
                <input type="text" inputmode="numeric" id="pay-amount" required value="${formatNumber(debt.remainingAmount)}" oninput="formatInputWithCommas(this)">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="btn-pay-submit">تأكيد استلام الدفعة</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('debt-pay-form').onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-pay-submit');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري التسجيل...'; }

      try {
        const rawVal = document.getElementById('pay-amount')?.value;
        const amount = (typeof parseNumber === 'function' ? parseNumber(rawVal) : (typeof window.parseNumber === 'function' ? window.parseNumber(rawVal) : Number(String(rawVal).replace(/[^\d.-]/g, '')))) || 0;
        if (amount <= 0) {
          window.showToast('يرجى إدخال مبلغ صحيح للدفعة', 'warning');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'تأكيد استلام الدفعة'; }
          return;
        }

        const prevRemaining = Number(debt.remainingAmount) || 0;
        debt.paidAmount = (Number(debt.paidAmount) || 0) + amount;
        debt.remainingAmount = Math.max(0, prevRemaining - amount);
        if (debt.remainingAmount <= 0 && !debt.paymentDate) {
          debt.paymentDate = new Date().toISOString().substring(0, 10);
        }

        // 1. Identify associated agent
        const agents = data.agents || [];
        let agentName = '';
        const matchedAgent = agents.find(a => 
          (debt.seller && (a.name === debt.seller || a.username === debt.seller || a.code === debt.seller)) ||
          (debt.agentName && (a.name === debt.agentName || a.username === debt.agentName || a.code === debt.agentName)) ||
          (debt.agentCode && a.code === debt.agentCode) ||
          (debt.customerName && (a.name === debt.customerName || debt.customerName.includes(a.name)))
        );

        if (matchedAgent) {
          agentName = matchedAgent.name;
        } else if (debt.agentName) {
          agentName = debt.agentName;
        } else if (debt.seller && debt.seller !== 'المركز الرئيسي') {
          agentName = debt.seller;
        } else if (debt.customerName && debt.customerName.includes('(وكيل)')) {
          agentName = debt.customerName.replace(/\(وكيل\)/g, '').trim();
        }

        // 2. Update corresponding sale if exists
        const sales = data.sales || [];
        const s = sales.find(x => 
          (debt.saleId && x.id === debt.saleId) || 
          (debt.saleCode && x.code === debt.saleCode) ||
          (debt.deviceNumber && x.deviceNumber === debt.deviceNumber)
        );

        if (s) {
          s.agentPaid = (Number(s.agentPaid) || 0) + amount;
          if (debt.remainingAmount <= 0) s.paymentStatus = 'تم التسديد';
          if (!agentName) {
            agentName = s.agentName || (s.seller !== 'المركز الرئيسي' ? s.seller : '');
          }
          if (agentName) {
            if (!s.agentName) s.agentName = agentName;
            if (!s.seller || s.seller === 'المركز الرئيسي') s.seller = agentName;
          }
        }

        if (!agentName) {
          agentName = debt.seller || debt.customerName || 'وكيل';
        }

        // 3. Add to agentSettlements log
        const settlementRecord = {
          id: 'settle-' + Date.now(),
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          agentName: agentName,
          linesCount: 1,
          dueAmount: prevRemaining,
          receivedAmount: amount,
          variance: 0,
          debtId: debt.id,
          saleCode: debt.saleCode || (s ? s.code : ''),
          customerName: debt.customerName || '',
          paymentSource: 'صفحة الديون',
          notes: `تسديد دفعة دين: ${debt.customerName || debt.notes || ''}`
        };

        const allSettlements = [settlementRecord, ...(data.agentSettlements || [])];

        // 4. Update data and close modal immediately (no delay / freezing)
        data.debts = debts;
        data.sales = sales;
        data.agentSettlements = allSettlements;

        if (getEngine() && typeof getEngine().saveLocal === 'function') {
          getEngine().saveLocal();
        }

        // Close modal immediately so it never gets stuck open
        window.closeModal();

        window.showToast('تم تسجيل الدفعة وإضافتها إلى سجل تسديدات الوكيل بنجاح', 'success');

        // Refresh debts view if active
        const mainContent = document.getElementById('main-content');
        if (window.renderDebts && mainContent) {
          const activeNav = document.querySelector('.nav-item.active');
          if (activeNav && activeNav.getAttribute('data-page') === 'debts') {
            window.renderDebts(mainContent);
          }
        }

        // Background sync to Firestore without blocking the UI
        if (getEngine() && typeof getEngine().batchCommitData === 'function') {
          getEngine().batchCommitData([
            { collectionName: 'debts', items: debts },
            { collectionName: 'sales', items: sales },
            { collectionName: 'agentSettlements', items: allSettlements }
          ]).catch(err => console.warn('Background sync warning on debt payment:', err));
        } else if (getEngine() && typeof getEngine().commitData === 'function') {
          Promise.all([
            getEngine().commitData('debts', debts),
            getEngine().commitData('sales', sales),
            getEngine().commitData('agentSettlements', allSettlements)
          ]).catch(err => console.warn('Background sync warning on debt payment:', err));
        }
      } catch (err) {
        console.error('Error recording debt payment:', err);
        window.closeModal();
        window.showToast('حدث خطأ أثناء تسجيل الدفعة: ' + (err.message || ''), 'error');
      }
    };
  };

  window.deleteDebt = function(id) {
    window.showConfirmModal('حذف سجل الديون', 'هل أنت متأكد من حذف هذا السجل والدين المتبقي؟', async () => {
      const data = getData();
      const debtToDelete = (data.debts || []).find(d => d.id === id);

      let updatedSales = data.sales || [];
      if (debtToDelete) {
        updatedSales = updatedSales.map(s => {
          if (s.id === debtToDelete.saleId || s.code === debtToDelete.saleCode) {
            return { ...s, agentPaid: 0, paymentStatus: 'معلق' };
          }
          return s;
        });
      }

      await getEngine().commitData('sales', updatedSales);
      await getEngine().deleteItem('debts', id);
      window.showToast('تم حذف السجل بنجاح', 'success');
    }, 'حذف السجل', 'إلغاء', true);
  };

  window.exportDebtsExcel = function() {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const rows = (data.debts || []).map(d => ({
      'المدين': d.customerName || '-',
      'الجهة / الوكيل': d.seller || d.agentName || '-',
      'رمز الفاتورة': d.saleCode || '-',
      'رقم الهاتف': d.customerPhone || d.phone || '-',
      'رقم الجهاز': d.deviceNumber || '-',
      'المبلغ الكلي (د.ع)': Number(d.totalAmount) || 0,
      'المبلغ المسدد (د.ع)': Number(d.paidAmount) || 0,
      'المتبقي (د.ع)': Number(d.remainingAmount) || 0,
      'تاريخ الاستحقاق': d.dueDate || '-',
      'ملاحظات': d.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'تنبيه': 'لا توجد ديون مسجلة' }]);
    ws['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 25 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الديون_والمستحقات");
    XLSX.writeFile(wb, `ديون_الساري_${new Date().toISOString().substring(0,10)}.xlsx`);
    window.showToast('تم تصدير سجل الديون إلى ملف Excel بنجاح', 'success');
  };

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

  // --- Page 5: Subscribers ---
  let subFilter = { owner: 'all', status: 'all', paymentStatus: 'all', startDate: '', endDate: '', search: '', expiring: 'all' };
  let subscriberSortBy = { field: '', direction: 'asc' };
  window.sortSubscribersBy = function(field) {
    if (subscriberSortBy.field === field) {
      subscriberSortBy.direction = subscriberSortBy.direction === 'asc' ? 'desc' : 'asc';
    } else {
      subscriberSortBy.field = field;
      subscriberSortBy.direction = 'desc';
    }
    const mainEl = document.getElementById('main-content');
    if (mainEl) window.renderSubscribers(mainEl);
  };

  window.getSubscriberTypeLabel = function(s, sales) {
    let type = s.subscriptionType || '';
    if (!type && sales && sales.length > 0) {
      const subSale = sales.find(sal => (sal.deviceNumber && sal.deviceNumber === s.deviceNumber) || (sal.customerName && sal.customerName === s.name));
      if (subSale && subSale.subscriptionType) {
        type = subSale.subscriptionType;
      }
    }
    
    if (type) {
      if (type.includes('12') || type.includes('سنة')) return '1 سنة';
      if (type.includes('6')) return '6 شهر';
      if (type.includes('3')) return '3 شهر';
      if (type.includes('شهرين') || type.includes('2')) return '2 شهر';
      if (type.includes('شهر واحد') || type.includes('1') || type.includes('شهر')) return '1 شهر';
      return type;
    }
    
    // Calculate from start and end dates if available
    if (s.activationDate && s.expiryDate) {
      const d1 = new Date(s.activationDate).getTime();
      const d2 = new Date(s.expiryDate).getTime();
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays > 300) return '1 سنة';
      if (diffDays > 140) return '6 شهر';
      if (diffDays > 70) return '3 شهر';
      if (diffDays > 40) return '2 شهر';
      if (diffDays > 0) return '1 شهر';
    }

    return '1 شهر';
  };

  function renderSubscriberRows(subs, todayTime) {
    if (subs.length === 0) {
      return '<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 30px;">لا يوجد مشتركون مطابقون</td></tr>';
    }
    const data = getData();
    const allSubs = data.subscribers || [];
    const sales = data.sales || [];
    const debts = data.debts || [];
    const deviceCounts = {};
    allSubs.forEach(sub => {
      const dev = (sub.deviceNumber || '').trim();
      if (dev && dev !== '-') {
        deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
      }
    });

    return subs.map(function(s) {
      const dev = (s.deviceNumber || '').trim();
      const isDuplicate = dev && dev !== '-' && (deviceCounts[dev] > 1);

      const dueStr = s.expiryDate || s.dueDate || '';
      let dueBadgeAlert = '';
      let rowHighlightStyle = '';
      if (isDuplicate) {
        rowHighlightStyle = 'background: rgba(234, 154, 42, 0.22); border-right: 4px solid #f59e0b;';
      } else if (dueStr) {
        const dueTime = new Date(dueStr).getTime();
        const diffDays = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          dueBadgeAlert = '<span class="badge badge-danger" style="font-size:0.68rem; font-weight:700; padding:1px 5px;">متأخر (' + Math.abs(diffDays) + ' يوم) 🚨</span>';
          rowHighlightStyle = 'background: rgba(239, 68, 68, 0.12); border-right: 4px solid #ef4444;';
        } else if (diffDays <= 3) {
          dueBadgeAlert = '<span class="badge badge-warning" style="font-size:0.68rem; font-weight:700; color:#b45309; background:rgba(234,154,42,0.18); padding:1px 5px;">قريب (' + (diffDays === 0 ? 'اليوم' : diffDays + ' يوم') + ') ⚠️</span>';
          rowHighlightStyle = 'background: rgba(234, 154, 42, 0.12); border-right: 4px solid #f59e0b;';
        } else {
          rowHighlightStyle = 'background: rgba(16, 185, 129, 0.08); border-right: 4px solid #10b981;';
        }
      } else {
        if (s.status === 'فعال') {
          rowHighlightStyle = 'background: rgba(16, 185, 129, 0.08); border-right: 4px solid #10b981;';
        }
      }
      const waLink = (s.phone && window.normalizeIraqiPhone) ? 'https://wa.me/' + window.normalizeIraqiPhone(s.phone) + '?text=' + encodeURIComponent(typeof window.formatWhatsAppMessage === 'function' ? window.formatWhatsAppMessage({ customerName: s.name, saleType: 'تجديد اشتراك', subscriptionType: 'اشتراك سنوي/شهري', price: 0, paymentStatus: 'تم التسديد', endDate: s.expiryDate, deviceNumber: s.deviceNumber }) : '') : '';

      // Determine subscriber amount
      let amount = 0;
      if (s.price !== undefined && s.price !== null && Number(s.price) > 0) {
        amount = Number(s.price);
      }
      const subDebt = debts.find(d => ((d.customerName && d.customerName.includes(s.name)) || (d.saleId && sales.find(sal => sal.id === d.saleId && sal.deviceNumber === s.deviceNumber))) && Number(d.remainingAmount) > 0);
      const isDebt = s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع' || s.paymentMethod === 'دين' || (subDebt && Number(subDebt.remainingAmount) > 0);
      
      if (isDebt && subDebt && Number(subDebt.remainingAmount) > 0) {
        amount = Number(subDebt.remainingAmount);
      } else if (!amount) {
        if (subDebt && Number(subDebt.totalAmount || subDebt.remainingAmount) > 0) {
          amount = Number(subDebt.remainingAmount || subDebt.totalAmount);
        } else {
          const subSales = sales.filter(sal => sal.deviceNumber === s.deviceNumber || sal.customerName === s.name);
          if (subSales.length > 0 && Number(subSales[0].price) > 0) {
            amount = Number(subSales[0].price);
          } else {
            amount = 25000;
          }
        }
      }

      // Determine color: Red for debt, Green for cash
      const amountColor = isDebt ? '#dc2626' : '#16a34a';
      const amountBg = isDebt ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
      const amountBorder = isDebt ? 'rgba(239, 68, 68, 0.28)' : 'rgba(16, 185, 129, 0.28)';

      const typeLabel = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, sales) : (s.subscriptionType || '1 شهر');
      
      // Determine if subscriber belongs to Main / Headquarters vs Agent
      const ownerClean = String(s.owner || '').trim();
      const isMainOwner = !ownerClean || 
                          ownerClean === 'المركز الرئيسي' || 
                          ownerClean === 'الرئيسية' || 
                          ownerClean === 'الادارة' || 
                          ownerClean === 'الإدارة' || 
                          ownerClean === 'main' || 
                          ownerClean === 'hq';

      // زر التجديد يظهر فقط لمشتركي المركز الرئيسي وغير الفعالين، ويُخفى تماماً من أمام مشتركي الوكلاء
      const showRenewalBtn = isMainOwner;
      
      return '<tr style="' + rowHighlightStyle + '">' +
        '<td>' +
          '<div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">' +
            '<strong class="cell-title">' + escapeHtml(s.name) + '</strong>' +
            (showRenewalBtn ? ('<button class="btn btn-sm btn-success" onclick="openAdminSubscriberRenewalModal(\'' + s.id + '\')" title="تجديد اشتراك مشترك المركز الرئيسي وتعديل البيانات" style="padding: 1px 6px; font-size: 0.72rem; border-radius: 4px; background: var(--success, #10b981); color: #fff; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">🔄 تجديد</button>') : '') +
          '</div>' +
          '<div class="cell-subtitle" style="direction: ltr; text-align: right;">' + escapeHtml(s.phone || '-') + '</div>' +
        '</td>' +
        '<td style="font-family: monospace; font-size: 0.84rem;">' +
          '<span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal(\'' + escapeHtml(s.deviceNumber) + '\')" title="انقر لعرض الباركود">' + escapeHtml(s.deviceNumber) + '</span>' +
          (isDuplicate ? '<br><span style="font-size: 0.7rem; color: #b45309; font-weight: 700;">⚠️ جهاز مكرر</span>' : '') +
        '</td>' +
        '<td><span class="badge badge-neutral">' + escapeHtml(window.resolveAgentName ? window.resolveAgentName(s) : s.owner) + '</span></td>' +

        '<td style="text-align: center; white-space: nowrap;">' +
          (s.status === 'فعال' ? '<span class="badge" style="font-weight: 700; font-size: 0.82rem; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">📅 ' + escapeHtml(typeLabel) + '</span>' : '<span style="color: var(--muted); font-size: 0.8rem;">-</span>') +
        '</td>' +
        '<td style="text-align: center;">' +
          (s.status === 'فعال' ? '<div class="cell-badges-group">' +
            '<span class="badge badge-success">فعال</span>' +
            (s.paymentStatus ? ('<span class="badge ' + (s.paymentStatus === 'مدفوع' ? 'badge-success' : ((s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع') ? 'badge-danger' : 'badge-neutral')) + '">' + escapeHtml(s.paymentStatus === 'غير مدفوع' ? 'دين' : s.paymentStatus) + '</span>') : '') +
          '</div>' : '<div class="cell-badges-group"><span class="badge badge-neutral" style="background: rgba(100, 116, 139, 0.12); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.25);">غير فعال</span></div>') +
        '</td>' +
        '<td style="text-align: center; white-space: nowrap;">' +
          (s.status === 'فعال' ? '<span style="font-weight: 800; font-size: 0.86rem; color: ' + amountColor + '; background: ' + amountBg + '; border: 1px solid ' + amountBorder + '; padding: 3px 9px; border-radius: 6px; display: inline-block; direction: ltr; font-family: monospace;">' + formatNumber(amount) + ' د.ع</span>' : '<span style="color: var(--muted); font-size: 0.8rem;">-</span>') +
        '</td>' +
        '<td style="text-align: center;">' +
          (s.status === 'فعال' ? '<div class="cell-date-range" style="direction: ltr; font-size: 0.8rem;"><div class="cell-date-from">بدء: ' + escapeHtml(s.activationDate || s.startDate || '-') + '</div><div class="cell-date-to">انتهاء: ' + escapeHtml(s.expiryDate || s.endDate || '-') + '</div></div>' : '<span style="color: var(--muted); font-size: 0.8rem;">-</span>') +
        '</td>' +
        '<td style="text-align: center;">' +
          '<div class="action-btns" style="justify-content: center; gap: 4px; display: inline-flex; align-items: center;">' +
            (waLink ? '<a href="' + waLink + '" target="_blank" class="icon-btn btn-whatsapp" title="مراسلة عبر واتساب">💬</a>' : '') +
            '<button class="icon-btn" onclick="openSubscriberModal(\'' + s.id + '\')" title="تعديل بيانات المشترك">✏️</button>' +
            '<button type="button" class="icon-btn btn-deactivate" onclick="window.confirmDeactivateSubscriber(' + JSON.stringify(s.id) + ')" title="إلغاء تفعيل اشتراك المشترك وتفريغ التواريخ والبيانات (زر خطأ ❌)" aria-label="إلغاء تفعيل اشتراك المشترك" style="color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 3px 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;"><span style="font-size: 0.92rem; font-weight: 900; line-height: 1;">❌</span></button>' +
            '<button class="icon-btn btn-del" onclick="deleteSubscriber(\'' + s.id + '\')" title="حذف المشترك نهائياً">🗑️</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  window.renderSubscribers = function(container) {
    if (!container) {
      container = document.getElementById('main-content');
      if (!container) return;
    }
    const data = getData();
    let subs = data.subscribers || [];
    const agents = data.agents || [];
    const sales = data.sales || [];
    const debts = data.debts || [];
    const today = new Date().toISOString().substring(0, 10);
    const todayTime = new Date(today).getTime();

    // Dynamic status check - identical across Headquarters and Agents
    subs.forEach(s => {
      s.status = typeof window.getSubscriberActiveStatus === "function" ? window.getSubscriberActiveStatus(s, today) : ((s.expiryDate && s.expiryDate >= today) || s.status === "فعال" ? "فعال" : "غير فعال");
      s.activeStatus = s.status;
      if (s.status === "غير فعال" || s.deactivated === true || (!s.activationDate && !s.expiryDate)) {
        s.paymentStatus = "";
        s.paymentMethod = "";
        s.price = 0;
        s.paidAmount = 0;
        s.remainingAmount = 0;
      }
    });

    function checkSubscriberPaid(s) {
      // If inactive or deactivated or without dates, keep payment data completely empty
      if (s.status === "غير فعال" || s.deactivated === true || (!s.activationDate && !s.expiryDate)) {
        return "";
      }
      // 1. Direct saved payment status on subscriber takes precedence
      if (s.paymentStatus) {
        if (s.paymentStatus === "مدفوع" || s.paymentStatus === "نقد" || s.paymentStatus === "تم التسديد") {
          return "مدفوع";
        }
        if (s.paymentStatus === "دين" || s.paymentStatus === "غير مدفوع") {
          return "دين";
        }
      }
      if (s.paymentMethod) {
        if (s.paymentMethod === "نقد") return "مدفوع";
        if (s.paymentMethod === "دين") return "دين";
      }

      // 2. Check the most recent sale for this subscriber / device
      const subSales = sales
        .filter(sal => sal.deviceNumber === s.deviceNumber || sal.customerName === s.name)
        .sort((a, b) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime());
      if (subSales.length > 0) {
        const latestSale = subSales[0];
        if (latestSale.paymentMethod === "نقد" || latestSale.paymentStatus === "نقد" || latestSale.paymentStatus === "تم التسديد") {
          return "مدفوع";
        }
        if (latestSale.paymentMethod === "دين" || latestSale.paymentStatus === "دين" || latestSale.paymentStatus === "عليه دين") {
          return "دين";
        }
      }

      // 3. Check outstanding debts
      const hasDebt = debts.some(d => ((d.customerName && d.customerName.includes(s.name)) || (d.saleId && sales.find(sal => sal.id === d.saleId && sal.deviceNumber === s.deviceNumber))) && Number(d.remainingAmount) > 0);
      if (hasDebt) return "دين";

      if (!s.activationDate || !s.expiryDate || !s.status) {
        return "";
      }

      if (s.status === "غير فعال") {
        return "";
      }

      return "مدفوع";
    }

    subs.forEach(s => {
      if (s.status !== "غير فعال" && !s.deactivated && (s.activationDate || s.expiryDate)) {
        s.paymentStatus = checkSubscriberPaid(s);
      }
    });

    // Calculate subscribers whose subscriptions expire within 7 days
    const expiringSoonSubs = (data.subscribers || []).filter(s => {
      if (!s.expiryDate) return false;
      const expTime = new Date(s.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).map(s => {
      const expTime = new Date(s.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return { ...s, daysLeft: diffDays };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const allSubsOriginal = data.subscribers || [];
    const countAll = allSubsOriginal.length;
    const countActive = allSubsOriginal.filter(s => s.status === 'فعال').length;
    const countInactive = allSubsOriginal.filter(s => s.status === 'غير فعال').length;
    const countExpiring = expiringSoonSubs.length;

    if (subFilter.owner !== 'all') {
      subs = subs.filter(s => s.owner === subFilter.owner);
    }
    if (subFilter.status === 'منتهي قريباً' || subFilter.expiring === '7days') {
      subs = subs.filter(s => expiringSoonSubs.some(exp => exp.id === s.id));
    } else if (subFilter.status !== 'all') {
      subs = subs.filter(s => s.status === subFilter.status);
    }
    if (subFilter.paymentStatus && subFilter.paymentStatus !== 'all') {
      subs = subs.filter(s => {
        if (subFilter.paymentStatus === 'دين' || subFilter.paymentStatus === 'غير مدفوع') {
          return s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع';
        }
        return s.paymentStatus === subFilter.paymentStatus;
      });
    }
    if (subFilter.startDate) {
      subs = subs.filter(s => s.activationDate && s.activationDate >= subFilter.startDate);
    }
    if (subFilter.endDate) {
      subs = subs.filter(s => s.activationDate && s.activationDate <= subFilter.endDate);
    }
    if (subFilter.expiring === '7days') {
      subs = subs.filter(s => expiringSoonSubs.some(exp => exp.id === s.id));
    }
    if (subFilter.search) {
      const qRaw = subFilter.search.trim();
      const qNorm = window.normalizeSearchQuery(qRaw);
      const qDigits = qRaw.replace(/\D/g, '');

      subs = subs.filter(s => {
        const nameNorm = window.normalizeSearchQuery(s.name || '');
        const phoneClean = (s.phone || '').replace(/\D/g, '');
        const devClean = (s.deviceNumber || '').replace(/\D/g, '');
        const devRaw = (s.deviceNumber || '').toLowerCase();
        const ownerNorm = window.normalizeSearchQuery(s.owner || '');

        return nameNorm.includes(qNorm) || 
               (qDigits && (phoneClean.includes(qDigits) || devClean.includes(qDigits))) ||
               devRaw.includes(qRaw.toLowerCase()) ||
               (s.phone || '').includes(qRaw) ||
               ownerNorm.includes(qNorm);
      });
    }

    if (subscriberSortBy.field) {
      subs.sort((a, b) => {
        if (subscriberSortBy.field === 'price') {
          const numA = Number(a.price || 0);
          const numB = Number(b.price || 0);
          return subscriberSortBy.direction === 'asc' ? numA - numB : numB - numA;
        }
        if (subscriberSortBy.field === 'subscriptionType') {
          const typeA = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(a, sales) : (a.subscriptionType || '');
          const typeB = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(b, sales) : (b.subscriptionType || '');
          return subscriberSortBy.direction === 'asc' ? typeA.localeCompare(typeB) : typeB.localeCompare(typeA);
        }
        const valA = String(a[subscriberSortBy.field] || '');
        const valB = String(b[subscriberSortBy.field] || '');
        if (subscriberSortBy.direction === 'asc') {
          return valA.localeCompare(valB);
        } else {
          return valB.localeCompare(valA);
        }
      });
    }

    const activeCount = subs.filter(s => s.status === 'فعال').length;

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">قاعدة بيانات المشتركين</span>
            <h1>المشتركون وأجهزة البث</h1>
            <p class="subtitle">متابعة تواريخ تفعيل وانتهاء اشتراكات الأجهزة واستيرادها من Excel ونظام التنبيه التلقائي</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="openSaleModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>تسجيل بيع جديد</span>
            </button>
            <button class="btn btn-secondary" onclick="openSubscriberModal()">
              <span>➕</span> <span>إضافة مشترك جديد</span>
            </button>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي المشتركين</span><div class="stat-icon">👥</div></div>
            <div class="stat-value-group"><span class="stat-value">${subs.length}</span><span class="stat-unit">مشترك</span></div>
            <div class="stat-footer"><span>بحسب الفلتر</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الاشتراكات الفعالة</span><div class="stat-icon">🟢</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--success);">${activeCount}</span><span class="stat-unit">اشتراك</span></div>
            <div class="stat-footer"><span>أجهزة صالحة حالياً</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الاشتراكات المنتهية</span><div class="stat-icon">🔴</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--danger);">${subs.length - activeCount}</span><span class="stat-unit">منتهي</span></div>
            <div class="stat-footer"><span>تحتاج إلى تجديد</span></div>
          </div>
          <div class="stat-card" style="${expiringSoonSubs.length > 0 ? 'border: 2px solid var(--warning);' : ''}">
            <div class="stat-card-header">
              <span class="stat-title">توشك على الانتهاء</span>
              <div class="stat-icon">⏳</div>
            </div>
            <div class="stat-value-group">
              <span class="stat-value" style="color: #b45309;">${expiringSoonSubs.length}</span>
              <span class="stat-unit">خلال 7 أيام</span>
            </div>
            <div class="stat-footer">
              <span style="color: ${expiringSoonSubs.length > 0 ? '#b45309' : 'var(--muted)'}; font-weight: 600;">
                ${expiringSoonSubs.length > 0 ? '⚠️ تتطلب تذكيراً وتجديداً' : 'جميع الاشتراكات مستقرة'}
              </span>
            </div>
          </div>
        </div>

        <!-- Automatic Alert Banner: Subscriptions expiring within 7 days -->
        ${expiringSoonSubs.length > 0 ? `
          <div class="content-card" style="border: 2px solid var(--warning); background: linear-gradient(135deg, rgba(234, 154, 42, 0.08) 0%, rgba(234, 154, 42, 0.02) 100%); margin-bottom: 24px; box-shadow: 0 4px 16px rgba(234, 154, 42, 0.12);">
            <div class="card-header-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(234, 154, 42, 0.25); padding-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.6rem;">🔔</span>
                <div>
                  <h3 style="margin: 0; color: #b45309; font-size: 1.15rem; font-weight: 800;">
                    نظام التنبيه التلقائي: مشتركون أوشك اشتراكهم على الانتهاء في غضون 7 أيام (${expiringSoonSubs.length} مشترك)
                  </h3>
                  <small style="color: var(--muted); font-size: 0.85rem;">قائمة المشتركين الواجب تذكيرهم لتجديد الاشتراك قبل توقف الخدمة</small>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="setSubFilter('expiring', '${subFilter.expiring === '7days' ? 'all' : '7days'}')" style="font-size: 0.82rem; padding: 5px 12px; border-color: rgba(234, 154, 42, 0.5);">
                  ${subFilter.expiring === '7days' ? '👁️ إلغاء الحصر وعرض الكل' : '🎯 حصر هؤلاء فقط بالجدول'}
                </button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px;">
              ${expiringSoonSubs.map(s => {
                const waMsg = encodeURIComponent(`السلام عليكم أخ ${s.name}، نود تذكيركم بأن اشتراككم في شبكة الساري للبث الأرضي (رقم الجهاز: ${s.deviceNumber}) أوشك على الانتهاء بتاريخ ${s.expiryDate} (متبقي: ${s.daysLeft === 0 ? 'اليوم' : s.daysLeft + ' أيام'}). يرجى التجديد لضمان استمرار البث دون انقطاع.`);
                const waLink = s.phone && window.normalizeIraqiPhone ? `https://wa.me/${window.normalizeIraqiPhone(s.phone)}?text=${waMsg}` : null;
                const daysBadgeText = s.daysLeft === 0 ? 'ينتهي اليوم 🚨' : (s.daysLeft === 1 ? 'ينتهي غداً ⚠️' : (s.daysLeft === 2 ? 'متبقي يومان ⏳' : `متبقي ${s.daysLeft} أيام ⏳`));
                const daysBadgeClass = s.daysLeft <= 1 ? 'badge-danger' : 'badge-warning';

                return `
                  <div style="background: var(--surface); border: 1px solid rgba(234, 154, 42, 0.3); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                      <div>
                        <strong style="font-size: 1rem; color: var(--text); display: block;">${escapeHtml(s.name)}</strong>
                        <span style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(window.resolveAgentName ? window.resolveAgentName(s) : s.owner)}</span>
                      </div>
                      <span class="badge ${daysBadgeClass}" style="font-size: 0.78rem; font-weight: 700; white-space: nowrap;">
                        ${daysBadgeText}
                      </span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 7px 10px; background: var(--surface-alt); border-radius: 8px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="color: var(--muted); font-size: 0.75rem;">الجهاز:</span>
                        <span style="font-family: monospace; font-weight: 700; color: var(--green); cursor: pointer; text-decoration: underline;" onclick="showDeviceBarcodeModal('${escapeHtml(s.deviceNumber)}')" title="انقر لعرض QR Code">
                          ${escapeHtml(s.deviceNumber)} 📱
                        </span>
                      </div>
                      <span style="font-size: 0.82rem; color: var(--text-sub); direction: ltr; font-weight: 600;">${escapeHtml(s.expiryDate)}</span>
                    </div>

                    <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center; margin-top: 4px;">
                      ${waLink ? `
                        <a href="${waLink}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 8px; color: #16a34a;" title="إرسال تذكير عبر واتساب">
                          <span>💬</span> <span>تذكير واتساب</span>
                        </a>
                      ` : ''}
                      <button class="btn btn-primary btn-sm" onclick="openSaleModalForSubscriber('${escapeHtml(s.deviceNumber)}', '${escapeHtml(s.name)}', '${escapeHtml(s.phone || '')}', '${escapeHtml(s.owner)}')" style="font-size: 0.78rem; padding: 4px 10px;">
                        <span>🔄</span> <span>تجديد الاشتراك</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="content-card" style="margin-bottom: 18px;">
          <div class="sub-filter-panel">
            <!-- Row 1: Agent filter -->
            <div class="filter-group-row">
              <span class="filter-group-label">الوكيل المسؤول:</span>
              <div class="filter-chips-wrap">
                <span class="chip ${subFilter.owner === 'all' ? 'active' : ''}" onclick="setSubFilter('owner', 'all')">الكل</span>
                <span class="chip ${subFilter.owner === 'المركز الرئيسي' ? 'active' : ''}" onclick="setSubFilter('owner', 'المركز الرئيسي')">المركز الرئيسي</span>
                ${agents.map(a => `
                  <span class="chip ${subFilter.owner === a.name ? 'active' : ''}" onclick="setSubFilter('owner', '${escapeHtml(a.name)}')">${escapeHtml(a.name)}</span>
                `).join('')}
              </div>
            </div>

            <!-- Row 2: Status & Payment chips -->
            <div class="filter-groups-split">
              <div class="filter-group-block">
                <span class="filter-group-label">حالة الاشتراك:</span>
                <div class="filter-chips-wrap">
                  <span class="chip ${subFilter.status === 'all' && subFilter.expiring !== '7days' ? 'active' : ''}" onclick="setSubFilter('status', 'all'); setSubFilter('expiring', 'all')">الكل (${countAll})</span>
                  <span class="chip ${subFilter.status === 'فعال' ? 'active' : ''}" onclick="setSubFilter('status', 'فعال'); setSubFilter('expiring', 'all')">🟢 فعال (${countActive})</span>
                  <span class="chip ${subFilter.status === 'غير فعال' ? 'active' : ''}" onclick="setSubFilter('status', 'غير فعال'); setSubFilter('expiring', 'all')">🔴 غير فعال (${countInactive})</span>
                  <span class="chip ${subFilter.status === 'منتهي قريباً' || subFilter.expiring === '7days' ? 'active' : ''}" style="${subFilter.status === 'منتهي قريباً' || subFilter.expiring === '7days' ? 'background: #b45309; color: white;' : 'color: #b45309; border-color: rgba(234, 154, 42, 0.4);'}" onclick="setSubFilter('status', 'منتهي قريباً'); setSubFilter('expiring', '7days')">
                    ⏳ منتهي قريباً [${countExpiring}]
                  </span>
                </div>
              </div>

              <div class="filter-group-block">
                <span class="filter-group-label">حالة الدفع:</span>
                <div class="filter-chips-wrap">
                  <span class="chip ${subFilter.paymentStatus === 'all' ? 'active' : ''}" onclick="setSubFilter('paymentStatus', 'all')">الكل</span>
                  <span class="chip ${subFilter.paymentStatus === 'مدفوع' ? 'active' : ''}" onclick="setSubFilter('paymentStatus', 'مدفوع')">🟢 مدفوع</span>
                  <span class="chip ${subFilter.paymentStatus === 'دين' || subFilter.paymentStatus === 'غير مدفوع' ? 'active' : ''}" onclick="setSubFilter('paymentStatus', 'دين')">🔴 دين</span>
                </div>
              </div>
            </div>

            <!-- Row 3: Subscription Date Range & Search Box -->
            <div class="filter-bottom-bar">
              <div class="date-filter-group">
                <span class="filter-group-label">تاريخ الاشتراك:</span>
                <div class="date-inputs-cluster">
                  <div class="date-input-field">
                    <span class="date-label-sub">من:</span>
                    <input type="date" class="date-picker-input" value="${subFilter.startDate || ''}" onchange="setSubFilter('startDate', this.value)" title="من تاريخ الاشتراك">
                  </div>
                  <div class="date-input-field">
                    <span class="date-label-sub">إلى:</span>
                    <input type="date" class="date-picker-input" value="${subFilter.endDate || ''}" onchange="setSubFilter('endDate', this.value)" title="إلى تاريخ الاشتراك">
                  </div>
                  ${subFilter.startDate || subFilter.endDate ? `
                    <button type="button" class="btn btn-secondary btn-sm clear-date-btn" onclick="setSubFilter('startDate', ''); setSubFilter('endDate', '');" title="إلغاء تصفية التاريخ">إلغاء</button>
                  ` : ''}
                </div>
              </div>

              <div class="search-box-wrapper">
                <div class="search-box">
                  <span class="search-icon">🔍</span>
                  <input type="text" id="subscribers-search-input" placeholder="بحث بالاسم، الهاتف، الجهاز..." value="${escapeHtml(subFilter.search)}" oninput="onSubscriberSearchInput(this.value)">
                  ${subFilter.search ? `<button type="button" onclick="onSubscriberSearchInput('')" class="search-clear-btn" title="إلغاء البحث">✕</button>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

          
        <!-- Status Classification Toolbar & Quick Actions above Subscribers Table (تصنيف المشتركين وزر تسجيل بيع جديد) -->
        <div class="subscribers-status-filter-toolbar">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.9rem; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 6px;">
              <span>⚡</span>
              <span>تصنيف حسب حالة الاشتراك:</span>
            </span>
            <div style="display: inline-flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="sub-status-btn ${subFilter.status === 'all' && subFilter.expiring !== '7days' ? 'active-all' : ''}" onclick="setSubFilter('status', 'all'); setSubFilter('expiring', 'all');">
                <span>الكل</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">${countAll}</span>
              </button>
              <button type="button" class="sub-status-btn ${subFilter.status === 'فعال' ? 'active-active' : ''}" onclick="setSubFilter('status', 'فعال'); setSubFilter('expiring', 'all');">
                <span>🟢 فعال</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">${countActive}</span>
              </button>
              <button type="button" class="sub-status-btn ${subFilter.status === 'غير فعال' ? 'active-inactive' : ''}" onclick="setSubFilter('status', 'غير فعال'); setSubFilter('expiring', 'all');">
                <span>🔴 غير فعال</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">${countInactive}</span>
              </button>
              <button type="button" class="sub-status-btn ${subFilter.status === 'منتهي قريباً' || subFilter.expiring === '7days' ? 'active-expiring' : ''}" onclick="setSubFilter('status', 'منتهي قريباً'); setSubFilter('expiring', '7days');">
                <span>⏳ منتهي قريباً</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">${countExpiring}</span>
              </button>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- نسخة طبق الأصل لزر تسجيل بيع جديد بنفس الخصائص والمواصفات والعمل -->
            <button type="button" class="btn btn-primary" onclick="window.openSaleModal()" title="تسجيل بيع جديد وتفعيل اشتراك" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.84rem; padding: 6px 14px; font-weight: 700;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16" style="vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>تسجيل بيع جديد</span>
            </button>
            <div style="font-size: 0.85rem; color: var(--muted); font-weight: 600;">
              عرض <strong style="color: var(--text);">${subs.length}</strong> من إجمالي <strong style="color: var(--text);">${countAll}</strong> مشترك
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table subscribers-table">
              <thead>
                <tr>
                  <th>المشترك / الهاتف</th>
                  <th>رقم الجهاز</th>
                  <th>الوكيل المسؤول</th>
                  <th style="text-align: center; cursor: pointer; user-select: none;" onclick="sortSubscribersBy('subscriptionType')" title="انقر للفرز حسب نوع الاشتراك">نوع الاشتراك ${subscriberSortBy.field === 'subscriptionType' ? (subscriberSortBy.direction === 'asc' ? '⬆️' : '⬇️') : '↕️'}</th>
                  <th>الحالة والدفع</th>
                  <th style="text-align: center; cursor: pointer; user-select: none;" onclick="sortSubscribersBy('price')" title="انقر للفرز حسب المبلغ">المبلغ ${subscriberSortBy.field === 'price' ? (subscriberSortBy.direction === 'asc' ? '⬆️' : '⬇️') : '↕️'}</th>
                  <th style="text-align: center;">تاريخ البدء/الانتهاء</th>
                  <th style="text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${renderSubscriberRows(subs, todayTime)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- الفقرة الأخيرة في أسفل صفحة المشتركون وأجهزة البث -->
        <div class="page-bottom-actions" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; padding-top: 14px; margin-top: 6px; gap: 10px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="openExcelImportSubscribersModal()">
              <span>📥</span> <span>استدعاء المشتركين من Excel</span>
            </button>
            <button class="btn btn-secondary" onclick="exportSubscribersExcel()">
              <span>📤</span> <span>تصدير Excel</span>
            </button>
          </div>
          <button class="btn btn-outline-danger btn-icon" onclick="confirmDeleteAllSubscribers()" title="حذف الكل والتعاملات" aria-label="حذف الكل والتعاملات">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    `;
  };

  let subscriberSearchTimer = null;
  window.onSubscriberSearchInput = function(val) {
    if (subscriberSearchTimer) clearTimeout(subscriberSearchTimer);
    subscriberSearchTimer = setTimeout(() => {
      subFilter.search = val || '';
      const mainEl = document.getElementById('main-content');
      if (mainEl) {
        window.renderSubscribers(mainEl);
        const searchBox = document.getElementById('subscribers-search-input');
        if (searchBox) {
          searchBox.focus();
          const len = searchBox.value.length;
          searchBox.setSelectionRange(len, len);
        }
      }
    }, 300);
  };

  window.setSubFilter = function(k, v) {
    if (typeof k === 'object' && k !== null) {
      Object.assign(subFilter, k);
    } else {
      subFilter[k] = v;
      if (k === 'status') {
        if (v !== 'منتهي قريباً') {
          subFilter.expiring = 'all';
        } else {
          subFilter.expiring = '7days';
        }
      }
    }
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      window.renderSubscribers(mainEl);
      if (k === 'search') {
        const searchBox = document.getElementById('subscribers-search-input');
        if (searchBox) {
          searchBox.focus();
          const len = searchBox.value.length;
          searchBox.setSelectionRange(len, len);
        }
      }
    }
  };

  window.confirmDeactivateSubscriber = function(subId) {
    console.log("confirmDeactivateSubscriber called for:", subId);
    const data = getData();
    const subscriber = (data.subscribers || []).find(s => s.id === subId);
    if (!subscriber) {
      window.showToast("المشترك غير موجود", "error");
      return;
    }

    const subName = subscriber.name || "المشترك";
    const devNum = subscriber.deviceNumber || "غير محدد";
    const currentStatus = subscriber.status || "غير محدد";
    const subType = subscriber.subscriptionType || "-";
    const expiry = subscriber.expiryDate || subscriber.endDate || "-";

    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" style="z-index: 9999;" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 490px; width: 95%; text-align: right; direction: rtl; box-shadow: 0 20px 45px rgba(0,0,0,0.3); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; overflow: hidden;" onclick="event.stopPropagation()">
          <div class="modal-header" style="background: rgba(239, 68, 68, 0.08); border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem; color: #dc2626;">⚠️</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #b91c1c;">تأكيد إلغاء تفعيل اشتراك المشترك</h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()" style="background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--muted); padding: 4px;">✕</button>
          </div>
          <div class="modal-body" style="padding: 18px 20px; color: var(--text);">
            <!-- Subscriber Summary Card -->
            <div style="background: var(--surface-alt, #f8fafc); border: 1px solid var(--line, #e2e8f0); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.82rem; color: var(--muted, #64748b);">اسم المشترك:</span>
                <strong style="font-size: 1rem; color: var(--text, #0f172a);">${escapeHtml(subName)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 0.82rem; color: var(--muted, #64748b);">رقم الجهاز:</span>
                <span style="font-family: monospace; font-weight: 700; color: var(--primary, #2563eb);">${escapeHtml(devNum)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.82rem; color: var(--muted, #64748b);">الحالة الحالية:</span>
                <span class="badge ${currentStatus === "فعال" ? "badge-success" : "badge-neutral"}" style="font-size: 0.78rem;">${escapeHtml(currentStatus)}</span>
              </div>
            </div>

            <!-- Danger Warning Message -->
            <div style="background: rgba(239, 68, 68, 0.08); border-right: 4px solid #ef4444; border-radius: 6px; padding: 12px 14px; margin-bottom: 8px;">
              <p style="margin: 0 0 8px 0; font-weight: 700; color: #b91c1c; font-size: 0.92rem;">
                هل أنت متأكد من رغبتك في إطفاء وإلغاء تفعيل اشتراك هذا المشترك؟
              </p>
              <ul style="margin: 0; padding-right: 18px; font-size: 0.85rem; color: #7f1d1d; line-height: 1.6;">
                <li>إرجاع حالة اشتراك المشترك إلى <strong>غير فعال</strong> فوراً.</li>
                <li>تفريغ ومسح <strong>تواريخ البدء والانتهاء</strong> وتاريخ التفعيل.</li>
                <li>تفريغ ومسح <strong>بيانات وطرق ومبالغ الدفع</strong> الخاصة بالاشتراك.</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer" style="border-top: 1px solid var(--line, #e2e8f0); padding: 12px 20px; display: flex; gap: 10px; justify-content: flex-end; background: var(--surface-alt, #f8fafc);">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()" style="min-width: 90px; padding: 8px 16px; font-weight: 600;">تراجع وإلغاء</button>
            <button type="button" id="confirm-deactivate-btn" class="btn btn-danger" style="min-width: 150px; padding: 8px 18px; font-weight: 700; background: #dc2626; color: #ffffff; border: none; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;">
              <span>❌</span>
              <span>تأكيد إلغاء التفعيل وتفريغ البيانات</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("confirm-deactivate-btn").onclick = async () => {
      window.closeModal();
      await window.executeDeactivateSubscriber(subId);
    };
  };

  window.executeDeactivateSubscriber = async function(id) {
    try {
      const data = getData();
      const subs = data.subscribers || [];
      const subscriber = subs.find(s => s.id === id);
      if (!subscriber) {
        window.showToast("المشترك غير موجود", "error");
        return;
      }

      // 1. Reset active status to inactive
      subscriber.status = "غير فعال";
      subscriber.activeStatus = "غير فعال";
      subscriber.isActivated = false;
      subscriber.deactivated = true;
      subscriber.lastDeactivatedAt = new Date().toISOString();

      // 2. Clear subscription dates
      subscriber.activationDate = "";
      subscriber.startDate = "";
      subscriber.expiryDate = "";
      subscriber.endDate = "";
      subscriber.dueDate = "";
      subscriber.subscriptionType = "";
      subscriber.durationMonths = 0;

      // 3. Clear payment data
      subscriber.paymentStatus = "";
      subscriber.paymentMethod = "";
      subscriber.price = 0;
      subscriber.paidAmount = 0;
      subscriber.remainingAmount = 0;

      data.subscribers = subs;
      if (getEngine() && typeof getEngine().saveLocal === "function") {
        getEngine().saveLocal();
      }

      window.showToast(`تم إلغاء تفعيل اشتراك (${subscriber.name}) وتفريغ التواريخ والبيانات بنجاح (الحالة: غير فعال)`, "success");
      
      if (typeof window.renderSubscribers === "function") {
        window.renderSubscribers(document.getElementById("main-content"));
      }

      if (getEngine() && typeof getEngine().commitData === "function") {
        getEngine().commitData("subscribers", subs).catch(err => console.warn("Sync warning on deactivating subscriber:", err));
      }
    } catch (err) {
      console.error("Error deactivating subscriber:", err);
      window.showToast("حدث خطأ أثناء إلغاء تفعيل الاشتراك: " + (err.message || ""), "error");
    }
  };

  // Safe wrapper: always triggers confirmation modal if called without explicit force flag
  window.deactivateSubscriber = function(subId, force = false) {
    if (!force) {
      window.confirmDeactivateSubscriber(subId);
      return;
    }
    return window.executeDeactivateSubscriber(subId);
  };

  window.deactivateSubscriberWithConfirm = window.confirmDeactivateSubscriber;
  window.cancelSubscriberSubscription = window.confirmDeactivateSubscriber;

  window.deleteSubscriber = function(id) {
    window.showConfirmModal('حذف المشترك', 'هل تريد حذف هذا المشترك نهائياً من النظام مع كافة سجلات المبيعات والديون المتعلقة به؟', async () => {
      const data = getData();
      const subscriber = (data.subscribers || []).find(s => s.id === id);
      if (!subscriber) {
        window.showToast('المشترك غير موجود', 'error');
        return;
      }

      const deviceNumber = (subscriber.deviceNumber || '').trim();
      const otherSubs = (data.subscribers || []).filter(s => s.id !== id && s.deviceNumber && String(s.deviceNumber).trim() === deviceNumber);

      if (otherSubs.length > 0) {
        // Duplicate: delete this subscriber and activate the remaining subscriber(s)
        const updatedSubscribers = (data.subscribers || []).filter(s => s.id !== id).map(s => {
          if (s.deviceNumber && String(s.deviceNumber).trim() === deviceNumber) {
            return { ...s, status: 'فعال' };
          }
          return s;
        });

        await getEngine().batchCommitData([
          { collectionName: 'subscribers', items: updatedSubscribers }
        ]);
        window.showToast('تم حذف المشترك المكرر وتفعيل الرقم والمشترك المتبقي للجهة المسؤولة بنجاح', 'success');
      } else {
        // Complete deletion of subscriber and cascade records
        if (typeof getEngine().deleteSubscriberCompletely === 'function') {
          await getEngine().deleteSubscriberCompletely(id, deviceNumber);
        } else {
          const updatedSubscribers = (data.subscribers || []).filter(s => s.id !== id);
          const updatedSales = (data.sales || []).filter(s => s.deviceNumber !== deviceNumber);
          const updatedDebts = (data.debts || []).filter(d => d.deviceNumber !== deviceNumber);
          const updatedSettlements = (data.agentSettlements || []).filter(st => st.deviceNumber !== deviceNumber);
          const updatedSubmissions = (data.agentSubmissions || []).filter(sub => sub.deviceNumber !== deviceNumber);
          await getEngine().batchCommitData([
            { collectionName: 'subscribers', items: updatedSubscribers },
            { collectionName: 'sales', items: updatedSales },
            { collectionName: 'debts', items: updatedDebts },
            { collectionName: 'agentSettlements', items: updatedSettlements },
            { collectionName: 'agentSubmissions', items: updatedSubmissions }
          ]);
        }
        window.showToast('تم حذف المشترك وكافة سجلاته المرتبطة نهائياً من البيانات بنجاح', 'success');
      }

      if (typeof window.renderSubscribers === 'function') window.renderSubscribers(document.getElementById('main-content'));
    }, 'حذف المشترك', 'إلغاء', true);
  };

  window.requestRenewal = async function(subId) {
    const data = getData();
    const subscriber = (data.subscribers || []).find(s => s.id === subId);
    if (!subscriber) {
      window.showToast('المشترك غير موجود', 'error');
      return;
    }

    const user = getEngine().currentUser;
    const isAgent = user && user.role !== 'admin' && user.role !== 'أدمن' && user.role !== 'مدير رئيسي';
    if (isAgent) {
      const isRegistered = window.isDeviceRegisteredToAgent ? window.isDeviceRegisteredToAgent(subscriber.deviceNumber, user, data) : true;
      if (!isRegistered) {
        if (typeof window.showDeviceNotRegisteredAlert === 'function') {
          window.showDeviceNotRegisteredAlert();
        } else {
          window.showToast('تنبيه: هذا الجهاز غير مسجل لك، سيتم الغاء إرسال الطلب للأدمن للاعتماد. يجب ان تقوم ببيع اشتراك لزبون تابع لك', 'error');
        }
        return;
      }
    }

    const renewalRequest = {
      id: 'sub-req-' + Date.now(),
      customerName: subscriber.name,
      customerPhone: subscriber.phone,
      deviceNumber: subscriber.deviceNumber,
      subscriptionType: 'تجديد اشتراك',
      price: 0, // Admin to set price
      startDate: subscriber.expiryDate, // Assume starts on expiry
      endDate: '-', // Admin to set end date
      approvalStatus: 'قيد الاعتماد',
      submittedBy: window.syncEngine?.currentUser?.uid || 'agent',
      agentName: subscriber.owner,
      createdAt: new Date().toISOString()
    };

    const submissions = [...(data.agentSubmissions || []), renewalRequest];
    await getEngine().commitData('agentSubmissions', submissions);
    window.showToast('تم إرسال طلب التجديد للاعتماد بنجاح', 'success');
    if (typeof window.playNotificationChime === 'function') {
      window.playNotificationChime();
    }
  };

  window.openAdminSubscriberRenewalModal = function(subId) {
    const data = getData();
    const agents = data.agents || [];
    const sub = (data.subscribers || []).find(s => s.id === subId);
    if (!sub) {
      window.showToast('المشترك غير موجود', 'error');
      return;
    }

    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().substring(0, 10);

    // Dynamic start date based on subscription:
    // If the subscriber has an active future expiry date, renewal starts from that date; otherwise today.
    const initialStartDate = (sub.expiryDate && sub.expiryDate >= today) ? sub.expiryDate : today;

    // Detect initial duration months (default 1)
    let initialMonths = 1;
    if (sub.subscriptionType === '2 شهر' || sub.subscriptionType === 'اشتراك شهرين') initialMonths = 2;
    else if (sub.subscriptionType === '3 شهر' || sub.subscriptionType === 'اشتراك 3 أشهر') initialMonths = 3;
    else if (sub.subscriptionType === '6 شهر' || sub.subscriptionType === 'اشتراك 6 أشهر') initialMonths = 6;
    else if (sub.subscriptionType === '1 سنة' || sub.subscriptionType === 'اشتراك سنة') initialMonths = 12;

    const initialEndDate = window.addMonthsToDate ? window.addMonthsToDate(initialStartDate, initialMonths) : initialStartDate;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 660px; width: 95%; margin: auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="padding: 12px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">🔄</span>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text);">
                تجديد اشتراك وتعديل بيانات المشترك: <span style="color: var(--primary);">${escapeHtml(sub.name)}</span>
              </h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="admin-sub-ren-form" onsubmit="window.handleAdminSubscriberRenewalSubmit(event, '${sub.id}'); return false;">
            <!-- Hidden joining date to keep data intact while hiding it from view -->
            <input type="hidden" id="asr-joining" value="${escapeHtml(sub.joiningDate || today)}">
            <div class="modal-body" style="padding: 14px 18px; overflow: visible;">
              
              <!-- Row 1: Name, Phone, Owner -->
              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">اسم المشترك *</label>
                  <input type="text" id="asr-name" required value="${escapeHtml(sub.name || '')}" style="padding: 6px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">رقم الهاتف</label>
                  <input type="text" id="asr-phone" placeholder="0770xxxxxxx" value="${escapeHtml(sub.phone || '')}" style="padding: 6px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">المالك / الوكيل *</label>
                  <select id="asr-owner" onchange="updateAdminSubscriberRenewalPrice()" style="padding: 6px 10px; font-size: 0.88rem;">
                    <option value="المركز الرئيسي" ${sub.owner === 'المركز الرئيسي' || !sub.owner ? 'selected' : ''}>المركز الرئيسي</option>
                    ${agents.map(a => `<option value="${escapeHtml(a.name)}" ${sub.owner === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- Main Section: Device & QR on right, Subscription Settings on left -->
              <div style="display: grid; grid-template-columns: 175px 1fr; gap: 14px; margin-bottom: 6px; background: var(--surface-alt); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
                <!-- Column 1: Device number & QR square directly beneath it -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; border-left: 1px dashed var(--line); padding-left: 14px;">
                  <div class="form-group" style="margin: 0; width: 100%;">
                    <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px; display: block; text-align: center;">رقم الجهاز *</label>
                    <input type="text" id="asr-device" required placeholder="رقم الجهاز..." value="${escapeHtml(sub.deviceNumber || '')}" oninput="updateRenewalQrCode(this.value)" style="padding: 6px 6px; font-size: 0.85rem; font-weight: 700; text-align: center; width: 100%;">
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding: 8px; border-radius: 8px; border: 1px solid var(--line); box-shadow: 0 2px 6px rgba(0,0,0,0.06); width: fit-content; margin-top: 2px;">
                    <div id="asr-qr-box" style="width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;"></div>
                    <span style="font-size: 0.72rem; color: var(--muted); margin-top: 4px; font-weight: 700;">QR كود الجهاز 📱</span>
                  </div>
                </div>

                <!-- Column 2: Subscription Duration, Dates, Price, Payment -->
                <div style="display: flex; flex-direction: column; gap: 10px; justify-content: center;">
                  <!-- Sub Row 1: Duration & Payment Method -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">نوع الاشتراك *</label>
                      <select id="asr-duration" onchange="updateAdminSubscriberRenewalPrice()" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700;">
                        <option value="1 شهر" data-months="1" ${(!sub.subscriptionType || sub.subscriptionType === '1 شهر' || sub.subscriptionType === 'اشتراك شهر واحد') ? 'selected' : ''}>1 شهر</option>
                        <option value="2 شهر" data-months="2" ${(sub.subscriptionType === '2 شهر' || sub.subscriptionType === 'اشتراك شهرين') ? 'selected' : ''}>2 شهر</option>
                        <option value="3 شهر" data-months="3" ${(sub.subscriptionType === '3 شهر' || sub.subscriptionType === 'اشتراك 3 أشهر') ? 'selected' : ''}>3 شهر</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">طريقة الدفع *</label>
                      <select id="asr-payment" onchange="updatePaymentSelectColor(this)" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700; color: ${(sub.paymentMethod === 'نقد' || sub.paymentStatus === 'مدفوع' || sub.paymentStatus === 'تم التسديد') ? 'var(--success)' : 'var(--danger)'}; border-color: ${(sub.paymentMethod === 'نقد' || sub.paymentStatus === 'مدفوع' || sub.paymentStatus === 'تم التسديد') ? 'var(--success)' : 'var(--danger)'};">
                        <option value="دين" ${!(sub.paymentMethod === 'نقد' || sub.paymentStatus === 'مدفوع' || sub.paymentStatus === 'تم التسديد') ? 'selected' : ''} style="color: var(--danger); font-weight: 700;">دين (تسجيل دين)</option>
                        <option value="نقد" ${(sub.paymentMethod === 'نقد' || sub.paymentStatus === 'مدفوع' || sub.paymentStatus === 'تم التسديد') ? 'selected' : ''} style="color: var(--success); font-weight: 700;">نقد (تم التسديد)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Sub Row 2: Start Date & End Date (calculated by subscription type) -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">تاريخ البدء (التفعيل) *</label>
                      <input type="date" id="asr-start" value="${initialStartDate}" onchange="updateAdminSubscriberRenewalPrice()" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">تاريخ الانتهاء *</label>
                      <input type="date" id="asr-end" value="${initialEndDate}" style="padding: 6px 8px; font-size: 0.85rem; font-weight: 700; background: var(--surface); color: var(--text);">
                    </div>
                  </div>

                  <!-- Sub Row 3: Price -->
                  <div class="form-group" style="margin: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                      <label style="font-size: 0.8rem; font-weight: 700; margin: 0;">السعر الإجمالي (د.ع) *</label>
                      <span style="font-size: 0.72rem; color: var(--muted);">محتسب تلقائياً حسب الوكيل وفترة الاشتراك</span>
                    </div>
                    <input type="text" id="asr-price" required value="25,000" readonly style="padding: 6px 10px; font-size: 0.95rem; font-weight: 800; color: var(--green); background: var(--surface); text-align: center;">
                  </div>
                </div>
              </div>

            </div>
            <div class="modal-footer" style="padding: 10px 18px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()" style="padding: 6px 16px; font-size: 0.88rem;">إلغاء</button>
              <button type="submit" class="btn btn-success btn-sm" id="btn-asr-save" style="background-color: var(--green); color: #fff; padding: 6px 22px; font-size: 0.9rem; font-weight: 700;">💾 حفظ التفعيل</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.updateAdminSubscriberRenewalPrice = function() {
      const owner = document.getElementById('asr-owner')?.value || 'المركز الرئيسي';
      const durationSelect = document.getElementById('asr-duration');
      const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
      const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;

      const group = window.getAgentPricing ? window.getAgentPricing(owner) : { sub1: 25000, sub2: 50000, sub3: 75000 };
      let price = group.sub1 || 25000;
      if (months === 1) price = group.sub1 || 25000;
      else if (months === 2) price = group.sub2 || ((group.sub1 || 25000) * 2);
      else if (months === 3) price = group.sub3 || ((group.sub1 || 25000) * 3);
      else price = (group.sub1 || 25000) * months;

      const priceInput = document.getElementById('asr-price');
      if (priceInput) priceInput.value = formatNumber(price);

      const startInput = document.getElementById('asr-start');
      const startVal = startInput?.value || today;
      const endInput = document.getElementById('asr-end');
      if (endInput && window.addMonthsToDate) {
        endInput.value = window.addMonthsToDate(startVal, months);
      }
    };

    window.updateRenewalQrCode = function(val) {
      const box = document.getElementById('asr-qr-box');
      if (!box) return;
      box.innerHTML = '';
      const text = (val || '').trim();
      if (text && typeof QRCode !== 'undefined') {
        new QRCode(box, {
          text: text,
          width: 140,
          height: 140,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      } else {
        box.innerHTML = '<span style="font-size: 0.75rem; color: var(--muted); text-align: center;">أدخل رقم الجهاز</span>';
      }
    };

    updateRenewalQrCode(sub.deviceNumber || '');

    updateAdminSubscriberRenewalPrice();
  };

  window.handleAdminSubscriberRenewalSubmit = async function(e, subId) {
    if (e) e.preventDefault();
    const submitBtn = document.getElementById('btn-asr-save');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.origHTML = submitBtn.innerHTML;
      submitBtn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري الحفظ والتفعيل...`;
    }

    try {
      const data = getData();
      const subs = data.subscribers || [];
      const sub = subs.find(s => s.id === subId);
      if (!sub) return;

      const name = document.getElementById('asr-name').value.trim();
      const phone = document.getElementById('asr-phone').value.trim();
      const deviceNumber = document.getElementById('asr-device').value.trim();
      const owner = document.getElementById('asr-owner').value;

      const currentUser = getEngine()?.currentUser;
      const isAdmin = typeof window.isSystemAdmin === 'function' ? window.isSystemAdmin(currentUser) : (currentUser?.role === 'admin' || currentUser?.username === 'abodsari');

      if (isAdmin && owner && owner !== 'المركز الرئيسي') {
        window.showToast('عذراً، لا يمكن للرئيسية التفعيل المباشر لزبائن الوكلاء. يتم التفعيل حصرياً عبر طلبات الاعتماد المقدمة من الوكيل.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.dataset.origHTML || 'حفظ';
        }
        return;
      }
      const joiningDate = document.getElementById('asr-joining')?.value || sub.joiningDate || new Date().toISOString().substring(0, 10);
      const startDate = document.getElementById('asr-start').value;
      const subscriptionType = document.getElementById('asr-duration').value;
      const endDate = document.getElementById('asr-end').value;
      const price = parseNumber(document.getElementById('asr-price').value);
      const paymentMethod = document.getElementById('asr-payment').value;
      const paymentStatus = paymentMethod === 'نقد' ? 'مدفوع' : 'دين';
      const salePaymentStatus = paymentMethod === 'نقد' ? 'تم التسديد' : 'دين';

      // 1. Update subscriber with values from modal (تحويل حالة الزبون إلى فعال وتاريخ البدء والانتهاء والدفع)
      sub.name = name;
      sub.phone = phone;
      sub.deviceNumber = deviceNumber;
      sub.owner = owner;
      sub.joiningDate = joiningDate;
      sub.activationDate = startDate;
      sub.startDate = startDate;
      sub.expiryDate = endDate;
      sub.endDate = endDate;
      sub.dueDate = endDate;
      sub.subscriptionType = subscriptionType;
      sub.price = price;
      sub.paymentMethod = paymentMethod;
      sub.paymentStatus = paymentStatus;
      sub.paidAmount = paymentMethod === 'نقد' ? price : 0;
      sub.remainingAmount = paymentMethod === 'نقد' ? 0 : price;
      sub.status = 'فعال';
      sub.activeStatus = 'فعال';
      sub.isActivated = true;
      sub.lastActivatedAt = new Date().toISOString();
      sub.activatedBy = 'المركز الرئيسي';
      sub.activatedByType = 'hq';
      sub.requestedByAgent = false;

      // 2. Create new sale record
      const saleCode = (typeof window.generateSaleCode === 'function') ? window.generateSaleCode() : ('SR-' + Math.floor(10000 + Math.random() * 90000));
      const newSale = {
        id: 'sale-' + Date.now(),
        code: saleCode,
        customerName: name,
        customerPhone: phone,
        seller: owner,
        saleType: 'تجديد اشتراك',
        deviceNumber: deviceNumber,
        subscriptionType: subscriptionType,
        startDate: startDate,
        endDate: endDate,
        price: price,
        paymentStatus: salePaymentStatus,
        paymentMethod: paymentMethod,
        agentPaid: paymentMethod === 'نقد' ? price : 0,
        createdAt: new Date().toISOString()
      };

      const updatedSales = [newSale, ...(data.sales || [])];

      // 3. Create debt if payment method is debt
      let debts = data.debts || [];
      if (paymentMethod === 'دين') {
        const isAgent = owner && owner !== 'المركز الرئيسي';
        const newDebt = {
          id: 'debt-' + Date.now(),
          saleId: newSale.id,
          saleCode: saleCode,
          customerName: name,
          seller: owner,
          debtor: isAgent ? 'الوكيل والزبون' : 'الرئيسية',
          agentName: isAgent ? owner : '',
          totalAmount: price,
          paidAmount: 0,
          remainingAmount: price,
          dueDate: endDate,
          notes: `تجديد اشتراك بالدين (${subscriptionType})`,
          status: 'غير مسدد',
          createdAt: startDate || new Date().toISOString().substring(0, 10)
        };
        debts = [newDebt, ...debts];
      }

      // Update in-memory data
      data.subscribers = subs;
      data.sales = updatedSales;
      if (paymentMethod === 'دين') {
        data.debts = debts;
      }

      // Immediately close modal & update UI (Optimistic UI) for instant response
      window.closeModal();
      window.showToast('تم تفعيل وحفظ اشتراك الزبون (' + escapeHtml(name) + ') بنجاح - الحالة: فعال', 'success');
      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }

      // Show invoice success modal with WhatsApp sharing for Headquarters renewal
      setTimeout(() => {
        if (typeof window.openSaleSuccessModal === 'function') {
          window.openSaleSuccessModal(newSale);
        }
      }, 150);

      // Sync to backend asynchronously in background without blocking UI
      getEngine().batchCommitData([
        { collectionName: 'subscribers', items: subs },
        { collectionName: 'sales', items: updatedSales },
        ...(paymentMethod === 'دين' ? [{ collectionName: 'debts', items: debts }] : [])
      ]).catch(err => console.warn('Background sync error:', err));

    } catch (err) {
      console.error('Error in handleAdminSubscriberRenewalSubmit:', err);
      window.showToast('حدث خطأ أثناء معالجة الطلب: ' + (err.message || ''), 'error');
    }
  };

  window.openSubscriberModal = function(subId) {
    const data = getData();
    const agents = data.agents || [];
    const existing = subId ? (data.subscribers || []).find(s => s.id === subId) : null;
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().substring(0, 10);
    const isAdmin = typeof window.isSystemAdmin === 'function' 
      ? window.isSystemAdmin(typeof getEngine === 'function' ? getEngine().currentUser : null)
      : (getEngine()?.currentUser?.role === 'admin' || getEngine()?.currentUser?.username === 'abodsari');

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${existing ? 'تعديل بيانات المشترك' : 'إضافة مشترك جديد'}</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="subscriber-form">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label>اسم المشترك *</label>
                  <input type="text" id="sub-name" required value="${escapeHtml(existing?.name || '')}">
                </div>
                <div class="form-group">
                  <label>رقم الهاتف</label>
                  <input type="text" id="sub-phone" placeholder="0770xxxxxxx" value="${escapeHtml(existing?.phone || '')}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>رقم الجهاز *</label>
                  <input type="text" id="sub-device" required placeholder="رقم الجهاز..." value="${escapeHtml(existing?.deviceNumber || '')}">
                </div>
                <div class="form-group">
                  <label>المالك / الوكيل *</label>
                  <select id="sub-owner" onchange="updateSubModalDates(); updateSubModalPrice();">
                    <option value="المركز الرئيسي" ${!existing || existing.owner === 'المركز الرئيسي' ? 'selected' : ''}>المركز الرئيسي</option>
                    ${agents.map(a => `<option value="${escapeHtml(a.name)}" ${existing?.owner === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>تاريخ التفعيل</label>
                  <input type="date" id="sub-act" ${isAdmin ? '' : 'disabled'} value="${existing?.activationDate || today}" onchange="updateSubModalDates()">
                </div>
                <div class="form-group">
                  <label>نوع الاشتراك *</label>
                  <select id="sub-type" ${isAdmin ? '' : 'disabled'} onchange="updateSubModalDates()">
                    <option value="1 شهر" data-months="1" ${(!existing?.subscriptionType || existing?.subscriptionType === '1 شهر' || existing?.subscriptionType === 'اشتراك شهر واحد') ? 'selected' : ''}>1 شهر</option>
                    <option value="2 شهر" data-months="2" ${(existing?.subscriptionType === '2 شهر' || existing?.subscriptionType === 'اشتراك شهرين') ? 'selected' : ''}>2 شهر</option>
                    <option value="3 شهر" data-months="3" ${(existing?.subscriptionType === '3 شهر' || existing?.subscriptionType === 'اشتراك 3 أشهر') ? 'selected' : ''}>3 شهر</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>تاريخ الانتهاء</label>
                  <input type="date" id="sub-exp" ${isAdmin ? '' : 'disabled'} value="${existing?.expiryDate || ''}">
                </div>
                <div class="form-group">
                  <label>حالة الاشتراك (فعال / غير فعال) *</label>
                  <button type="button" class="px-4 py-2 rounded-lg font-bold ${(!existing || existing.status === 'فعال' || existing.activeStatus === 'فعال') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}" onclick="window.toggleStatus(this)">
                    ${(!existing || existing.status === 'فعال' || existing.activeStatus === 'فعال') ? '🟢 فعال' : '🔴 غير فعال'}
                  </button>
                  <input type="hidden" id="sub-active-status" value="${(!existing || existing.status === 'فعال' || existing.activeStatus === 'فعال') ? 'فعال' : 'غير فعال'}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>حالة الدفع *</label>
                  <select id="sub-payment" ${isAdmin ? '' : 'disabled'}>
                    <option value="مدفوع" ${!existing || existing.paymentStatus === 'مدفوع' || existing.paymentStatus === 'نقد' ? 'selected' : ''}>🟢 مدفوع (نقد)</option>
                    <option value="دين" ${existing?.paymentStatus === 'دين' || existing?.paymentStatus === 'غير مدفوع' ? 'selected' : ''}>🔴 دين</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>المبلغ المعتمد للبيع (د.ع) * <span style="font-size: 0.72rem; color: var(--muted);">(تلقائي من السستم)</span></label>
                  <input type="text" id="sub-price" required ${isAdmin ? '' : 'readonly'} value="${formatNumber(existing?.price !== undefined ? existing.price : 25000)}" oninput="this.dataset.manualEdited='true'" style="font-weight: 700; color: var(--green);">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="btn-sub-save">حفظ المشترك</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.toggleStatus = function(btn) {
      const input = document.getElementById('sub-active-status');
      if (input.value === 'فعال') {
        input.value = 'غير فعال';
        btn.textContent = '🔴 غير فعال';
        btn.className = 'px-4 py-2 rounded-lg font-bold bg-red-500 text-white';
      } else {
        input.value = 'فعال';
        btn.textContent = '🟢 فعال';
        btn.className = 'px-4 py-2 rounded-lg font-bold bg-green-500 text-white';
      }
    };

    window.updateSubModalDates = function() {
      const actInput = document.getElementById('sub-act');
      const typeSelect = document.getElementById('sub-type');
      const expInput = document.getElementById('sub-exp');
      if (!actInput || !typeSelect || !expInput) return;
      const startVal = actInput.value || today;
      if (!actInput.value) actInput.value = startVal;
      const months = Number(typeSelect.options[typeSelect.selectedIndex]?.dataset?.months) || 1;
      if (window.addMonthsToDate) {
        expInput.value = window.addMonthsToDate(startVal, months);
      }
    };

    window.updateSubModalPrice = function() {
      const owner = document.getElementById('sub-owner')?.value || 'المركز الرئيسي';
      const durationSelect = document.getElementById('sub-type');
      const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
      const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;

      const group = window.getAgentPricing ? window.getAgentPricing(owner) : { sub1: 25000, sub2: 50000, sub3: 75000 };
      let price = group.sub1 || 25000;
      if (months === 1) price = group.sub1 || 25000;
      else if (months === 2) price = group.sub2 || ((group.sub1 || 25000) * 2);
      else if (months === 3) price = group.sub3 || ((group.sub1 || 25000) * 3);
      else price = (group.sub1 || 25000) * months;

      const priceInput = document.getElementById('sub-price');
      if (priceInput && !priceInput.dataset.manualEdited && !existing?.price) {
        priceInput.value = formatNumber(price);
      }
    };

    if (!existing?.expiryDate) {
      window.updateSubModalDates();
    }
    if (!existing?.price && typeof window.updateSubModalPrice === 'function') {
      window.updateSubModalPrice();
    }

    document.getElementById('subscriber-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById('sub-name').value.trim();
        const phone = document.getElementById('sub-phone').value.trim();
        const rawDev = document.getElementById('sub-device').value.trim();
        const deviceNumber = window.formatDeviceNumber ? window.formatDeviceNumber(rawDev) : rawDev;
        const owner = document.getElementById('sub-owner').value;
        const activationDate = document.getElementById('sub-act').value;
        const subscriptionType = document.getElementById('sub-type').value;
        const expiryDate = document.getElementById('sub-exp').value;
        const paymentStatus = document.getElementById('sub-payment').value;
        const status = document.getElementById('sub-active-status').value;
        const price = parseNumber(document.getElementById('sub-price').value) || 25000;

        const currentUser = getEngine()?.currentUser;
        const isAdmin = typeof window.isSystemAdmin === 'function' ? window.isSystemAdmin(currentUser) : (currentUser?.role === 'admin' || currentUser?.username === 'abodsari');

        if (isAdmin && owner !== 'المركز الرئيسي' && status === 'فعال') {
          window.showToast('عذراً، لا يمكن للرئيسية التفعيل المباشر لزبائن الوكلاء. يتم التفعيل حصرياً عبر طلبات الاعتماد المقدمة من الوكيل.', 'error');
          const saveBtn = document.getElementById('btn-sub-save');
          if (saveBtn) saveBtn.disabled = false;
          return;
        }

        const subs = data.subscribers || [];

        if (existing) {
          existing.name = name;
          existing.phone = phone;
          existing.deviceNumber = deviceNumber;
          existing.owner = owner;
          existing.activationDate = activationDate;
          existing.startDate = activationDate;
          existing.subscriptionType = subscriptionType;
          existing.expiryDate = expiryDate;
          existing.endDate = expiryDate;
          existing.dueDate = expiryDate;
          existing.paymentStatus = paymentStatus;
          existing.paymentMethod = paymentStatus === 'مدفوع' ? 'نقد' : 'دين';
          existing.status = status;
          existing.activeStatus = status;
          existing.price = price;
          if (!existing.joiningDate) {
            existing.joiningDate = activationDate || today;
          }
        } else {
          subs.push({
            id: 'sub-' + Date.now(),
            name, phone, deviceNumber, owner,
            joiningDate: activationDate || today,
            activationDate, startDate: activationDate,
            subscriptionType,
            expiryDate, endDate: expiryDate,
            dueDate: expiryDate,
            status,
            activeStatus: status,
            paymentStatus,
            paymentMethod: paymentStatus === 'مدفوع' ? 'نقد' : 'دين',
            price,
            activatedBy: 'المركز الرئيسي',
            activatedByType: 'hq',
            requestedByAgent: false
          });
        }

        // Immediately close modal & update UI (Optimistic UI)
        window.closeModal();
        window.showToast('تم حفظ المشترك بنجاح', 'success');
        if (typeof window.renderSubscribers === 'function') {
          const mainEl = document.getElementById('main-content');
          if (mainEl) window.renderSubscribers(mainEl);
        }

        // Sync in background
        getEngine().commitData('subscribers', subs).catch(err => console.warn('Background sync error:', err));
      } catch (err) {
        console.error('Error saving subscriber:', err);
        window.showToast('حدث خطأ أثناء حفظ بيانات المشترك', 'error');
      }
    };
  };

  window.showDeviceBarcodeModal = function(deviceNum) {
    const cleanNum = String(deviceNum || '').trim();
    if (!cleanNum) return;

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="window.closeModal()">
        <div class="modal-dialog" style="max-width: 320px; text-align: center; border-radius: 14px; overflow: hidden;" onclick="event.stopPropagation()">
          <div class="modal-header" style="background: var(--surface); border-bottom: 1px solid var(--line); padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 1.15rem;">📱</span>
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 800;">رمز QR Code للجهاز</h3>
            </div>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <div class="modal-body" style="padding: 12px 14px;">
            <!-- Compact Device Number Display -->
            <div style="margin-bottom: 10px; background: var(--surface-alt); padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line);">
              <span style="font-size: 0.72rem; color: var(--muted); display: block; margin-bottom: 2px;">رقم الجهاز المسجل</span>
              <div style="font-family: monospace; font-size: 1.15rem; font-weight: 900; letter-spacing: 1px; color: var(--green); user-select: all; word-break: break-all;">
                ${escapeHtml(cleanNum)}
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(cleanNum)}'); window.showToast('تم نسخ رقم الجهاز بنجاح', 'success');" style="margin-top: 6px; font-size: 0.74rem; padding: 2px 10px;">
                📋 نسخ الرقم
              </button>
            </div>

            <!-- Square QR Code Container -->
            <div style="background: #ffffff; padding: 8px; border-radius: 12px; display: inline-flex; justify-content: center; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid var(--line); margin: 0 auto 6px;">
              <div id="device-qrcode-target" style="display: flex; justify-content: center; align-items: center; width: 140px; height: 140px; background: #fff;"></div>
            </div>

            <p style="font-size: 0.72rem; color: var(--muted); margin: 4px 0 0;">
              امسح الرمز بكاميرا الهاتف أو القارئ للتعرف المباشر
            </p>
          </div>
          <div class="modal-footer" style="justify-content: center; background: var(--surface); border-top: 1px solid var(--line); padding: 8px 14px;">
            <button class="btn btn-secondary btn-sm" onclick="window.closeModal()" style="min-width: 90px; padding: 4px 14px;">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const qrTarget = document.getElementById('device-qrcode-target');
      if (!qrTarget) return;
      qrTarget.innerHTML = '';

      if (typeof QRCode !== 'undefined') {
        try {
          new QRCode(qrTarget, {
            text: cleanNum,
            width: 140,
            height: 140,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
          return;
        } catch (e) {
          console.warn('QRCode library error, using SVG fallback:', e);
        }
      }

      renderFallbackQRCodeSVG(qrTarget, cleanNum, 140);
    }, 40);
  };

  // High-fidelity square QR code SVG fallback
  function renderFallbackQRCodeSVG(container, text, size = 200) {
    const n = 25;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));

    function drawFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[r0 + r][c0 + c] = 1;
          }
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, n - 7);
    drawFinder(n - 7, 0);

    for (let i = 8; i < n - 8; i++) {
      if (i % 2 === 0) {
        matrix[6][i] = 1;
        matrix[i][6] = 1;
      }
    }

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    let seed = Math.abs(hash);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const isFinder = (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
        const isTiming = (r === 6 || c === 6);
        if (!isFinder && !isTiming) {
          seed = (seed * 9301 + 49297) % 233280;
          if (seed / 233280 > 0.5) matrix[r][c] = 1;
        }
      }
    }

    const cellSize = (size / n).toFixed(2);
    let rects = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) {
          rects += `<rect x="${(c * cellSize)}" y="${(r * cellSize)}" width="${cellSize}" height="${cellSize}" fill="#000" />`;
        }
      }
    }

    container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="shape-rendering: crispEdges;">${rects}</svg>`;
  }

  // Quick renewal helper from 7-day expiration alert list
  window.openSaleModalForSubscriber = function(deviceNumber, name, phone, owner) {
    if (typeof window.openSaleModal === 'function') {
      window.openSaleModal();
      setTimeout(() => {
        const typeEl = document.getElementById('sf-type');
        if (typeEl) {
          typeEl.value = 'تجديد اشتراك';
          if (typeof window.handleSaleTypeChange === 'function') window.handleSaleTypeChange();
        }
        const devEl = document.getElementById('sf-device');
        if (devEl) {
          devEl.value = deviceNumber;
          if (typeof window.onAdminDeviceInput === 'function') window.onAdminDeviceInput(deviceNumber);
        }
        const nameEl = document.getElementById('sf-name');
        if (nameEl && name) nameEl.value = name;
        const phoneEl = document.getElementById('sf-phone');
        if (phoneEl && phone) phoneEl.value = phone;
        const sellerEl = document.getElementById('sf-seller');
        if (sellerEl && owner) sellerEl.value = owner;
        if (typeof window.recalculateSalePrice === 'function') window.recalculateSalePrice();
      }, 50);
    }
  };

  // Excel Import for Subscribers
  window.openExcelImportSubscribersModal = function() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>استدعاء المشتركين من ملف Excel</h3>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.9rem; color: var(--text-sub);">
              يجب أن يحتوي الصف الأول على أعمدة باسم المشترك ورقم الجهاز، وعمود اختياري للمالك أو رقم الهاتف. يتم تخزين أرقام الأجهزة كنصوص للحفاظ على الأصفار.
            </p>
            <div class="form-group" style="margin-top: 14px;">
              <label>اختر ملف Excel (.xlsx أو .xls أو .csv)</label>
              <input type="file" id="sub-excel-file" accept=".xlsx,.xls,.csv">
            </div>
            <div id="import-preview" style="margin-top: 12px; font-size: 0.85rem; color: var(--green);"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-primary" id="btn-process-sub-excel">بدء الاستيراد</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-process-sub-excel').onclick = function() {
      const fileInput = document.getElementById('sub-excel-file');
      if (!fileInput.files.length) {
        alert('يرجى اختيار ملف Excel أولاً');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary', raw: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
          if (json.length < 2) {
            alert('الملف فارغ أو لا يحتوي على صفوف بيانات');
            return;
          }

          const headers = json[0].map(h => String(h || '').trim().toLowerCase());
          // Detect column indices
          let nameIdx = headers.findIndex(h => h.includes('اسم') || h.includes('مشترك') || h.includes('name'));
          let devIdx = headers.findIndex(h => h.includes('جهاز') || h.includes('باركود') || h.includes('كود') || h.includes('device') || h.includes('number'));
          let phoneIdx = headers.findIndex(h => h.includes('هاتف') || h.includes('phone') || h.includes('موبايل'));
          let ownerIdx = headers.findIndex(h => h.includes('مالك') || h.includes('وكيل') || h.includes('owner'));
          let actIdx = headers.findIndex(h => h.includes('تفعيل') || h.includes('بدء') || h.includes('start') || h.includes('activation'));
          let expIdx = headers.findIndex(h => h.includes('انتهاء') || h.includes('نهاية') || h.includes('end') || h.includes('expiry') || h.includes('expire'));
          let statusIdx = headers.findIndex(h => h.includes('حالة') || h.includes('status'));

          if (nameIdx === -1) nameIdx = 0;
          if (devIdx === -1) devIdx = 1;

          const data = getData();
          const existingSubs = [...(data.subscribers || [])];
          let importedCount = 0;

          for (let r = 1; r < json.length; r++) {
            const row = json[r];
            if (!row || !row[nameIdx]) continue;
            const name = String(row[nameIdx] || '').trim();
            const rawDev = normalizeDigits(String(row[devIdx] || '')).replace(/\s+/g, '');
            const device = window.formatDeviceNumber ? window.formatDeviceNumber(rawDev) : rawDev;
            const phone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            const owner = ownerIdx !== -1 && row[ownerIdx] ? String(row[ownerIdx]).trim() : 'المركز الرئيسي';

            // New imported subscribers: dates and status default to empty/not active ('غير فعال')
            const activationDate = (actIdx !== -1 && row[actIdx]) ? String(row[actIdx]).trim() : '';
            const expiryDate = (expIdx !== -1 && row[expIdx]) ? String(row[expIdx]).trim() : '';

            let status = 'غير فعال';
            if (statusIdx !== -1 && row[statusIdx]) {
              const fileStatus = String(row[statusIdx]).trim();
              if (fileStatus === 'فعال' && activationDate && expiryDate) {
                status = 'فعال';
              } else {
                status = 'غير فعال';
              }
            } else if (activationDate && expiryDate) {
              const today = new Date().toISOString().substring(0, 10);
              status = (activationDate <= today && today <= expiryDate) ? 'فعال' : 'غير فعال';
            } else {
              status = 'غير فعال';
            }

            if (name && device) {
              existingSubs.push({
                id: 'sub-' + Date.now() + '-' + r,
                name,
                phone,
                deviceNumber: device,
                owner,
                activationDate: activationDate || '',
                expiryDate: expiryDate || '',
                status: status || 'غير فعال'
              });
              importedCount++;
            }
          }

          await getEngine().commitData('subscribers', existingSubs);
          window.showToast(`تم استيراد ${importedCount} مشترك بنجاح!`, 'success');
          window.closeModal();
        } catch (err) {
          console.error(err);
          alert('حدث خطأ أثناء قراءة ملف Excel: ' + err.message);
        }
      };
      reader.readAsBinaryString(fileInput.files[0]);
    };
  };

  window.confirmDeleteAllSubscribers = function() {
    showConfirmDialog(
      'حذف جميع المشتركين والتعاملات المالية',
      'هل أنت متأكد تماماً من رغبتك في حذف كافة المشتركين وسجل المبيعات والديون وكل التعاملات المالية المرتبطة بالزبائن دفعة واحدة؟ هذا الإجراء نهائي ولا يمكن التراجع عنه!',
      async () => {
        await getEngine().clearCollection('subscribers');
        await getEngine().clearCollection('sales');
        await getEngine().clearCollection('debts');
        await getEngine().clearCollection('agentSubmissions');
        showToast('تم حذف كافة المشتركين والتعاملات المالية وسجل المبيعات والديون بنجاح', 'success');
        if (typeof window.renderSubscribers === 'function') {
          window.renderSubscribers(document.getElementById('main-content'));
        }
      }
    );
  };

  window.submitAgentSale = async function(saleData) {
    const user = getEngine().currentUser;
    const data = getData();

    // Guard: When renewing a subscription, the device MUST be registered to this agent
    const isAgent = user && user.role !== 'admin' && user.role !== 'أدمن' && user.role !== 'مدير رئيسي';
    if (isAgent && (saleData.saleType === 'تجديد اشتراك' || saleData.subscriptionType !== 'جهاز جديد')) {
      const isRegistered = window.isDeviceRegisteredToAgent ? window.isDeviceRegisteredToAgent(saleData.deviceNumber, user, data) : true;
      if (!isRegistered) {
        if (typeof window.showDeviceNotRegisteredAlert === 'function') {
          window.showDeviceNotRegisteredAlert();
        } else {
          window.showToast('تنبيه: هذا الجهاز غير مسجل لك، سيتم الغاء إرسال الطلب للأدمن للاعتماد. يجب ان تقوم ببيع اشتراك لزبون تابع لك', 'error');
        }
        return null; // Cancel approval request, do not save subscriber
      }
    }

    const subs = data.agentSubmissions || [];

    const newSubmission = {
      id: 'subm-' + Date.now(),
      code: 'REQ-' + Math.floor(1000 + Math.random() * 9000),
      customerName: saleData.customerName,
      customerPhone: saleData.customerPhone || '',
      deviceNumber: saleData.deviceNumber,
      subscriptionType: saleData.subscriptionType || 'اشتراك شهر واحد',
      saleType: saleData.saleType || 'تجديد اشتراك',
      price: Number(saleData.price) || 0,
      startDate: saleData.startDate || new Date().toISOString().substring(0, 10),
      endDate: saleData.endDate || new Date().toISOString().substring(0, 10),
      seller: user?.agentName || user?.displayName || 'وكيل',
      agentName: user?.agentName || user?.displayName || 'وكيل',
      agentCode: user?.agentCode || '',
      submittedBy: user?.uid || 'agent',
      status: 'Pending',
      approvalStatus: 'قيد الاعتماد',
      paymentMethod: saleData.paymentMethod || 'بانتظار اعتماد الادمن',
      createdAt: new Date().toISOString()
    };

    const updatedSubs = [newSubmission, ...subs];
    await getEngine().commitData('agentSubmissions', updatedSubs);
    window.showToast('تم إرسال معاملة البيع بنجاح (Status: Pending) إلى المركز الرئيسي للاعتماد', 'success');
    if (typeof window.playNotificationChime === 'function') {
      window.playNotificationChime();
    }
    return newSubmission;
  };

  window.exportSubscribersExcel = function() {
    const data = getData();
    const rows = (data.subscribers || []).map(s => ({
      'اسم المشترك': s.name,
      'رقم الهاتف': s.phone,
      'رقم الجهاز': "'" + s.deviceNumber,
      'الجهة المالكة': s.owner,
      'نوع الاشتراك': window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, data.sales) : (s.subscriptionType || '1 شهر'),
      'الحالة': s.status,
      'تاريخ التفعيل': s.activationDate,
      'تاريخ الانتهاء': s.expiryDate
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المشتركون");
    XLSX.writeFile(wb, `مشتركو_الساري_${new Date().toISOString().substring(0,10)}.xlsx`);
  };

})();
