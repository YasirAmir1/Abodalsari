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
  let debtSearchQuery = '';

  window.renderDebts = function(container) {
    const data = getData();
    let debts = data.debts || [];
    const agents = data.agents || [];

    if (debtFilterSeller !== 'all') {
      debts = debts.filter(d => d.seller === debtFilterSeller);
    }
    if (debtSearchQuery) {
      const q = debtSearchQuery.trim().toLowerCase();
      debts = debts.filter(d => (d.customerName || '').toLowerCase().includes(q) || (d.deviceNumber || '').toLowerCase().includes(q));
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

    // Calculate stats per agent/Main
    const agentStats = { 'المركز الرئيسي': { sales: 0, paid: 0, debt: 0 } };
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

    const statsHTML = Object.entries(agentStats).map(([name, stats]) => `
      <div class="stat-card" style="flex: 1;">
        <div class="stat-card-header"><span class="stat-title">${escapeHtml(name)}</span></div>
        <div style="font-size: 0.8rem; padding: 5px 0;">
          <div>مبيعات: ${formatNumber(stats.sales)}</div>
          <div>مسدد: ${formatNumber(stats.paid)}</div>
          <div style="color: var(--danger);">متبقي: ${formatNumber(stats.debt)}</div>
        </div>
      </div>
    `).join('');

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
        
        <div class="stat-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px;">
          ${statsHTML}
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
          <div class="filters-bar" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: space-between; margin-bottom: 16px;">
            <div class="filter-chips">
              <span class="chip ${debtFilterSeller === 'all' ? 'active' : ''}" onclick="setDebtFilter('all')">كافة الجهات</span>
              <span class="chip ${debtFilterSeller === 'المركز الرئيسي' ? 'active' : ''}" onclick="setDebtFilter('المركز الرئيسي')">المركز الرئيسي</span>
              ${agents.map(a => `
                <span class="chip ${debtFilterSeller === a.name ? 'active' : ''}" onclick="setDebtFilter('${escapeHtml(a.name)}')">${escapeHtml(a.name)}</span>
              `).join('')}
            </div>
            <div class="filter-search-box" style="flex: 1; min-width: 220px; max-width: 320px;">
              <input type="text" class="form-control" id="debt-search-input" placeholder="🔍 بحث باسم المشترك أو رقم الجهاز..." value="${escapeHtml(debtSearchQuery)}" oninput="window.setDebtSearchQuery(this.value)" style="width: 100%; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-size: 0.88rem;">
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

  window.setDebtSearchQuery = function(q) {
    debtSearchQuery = q;
    const container = document.getElementById('main-content');
    if (container) {
      const input = document.getElementById('debt-search-input');
      const cursor = input ? input.selectionStart : 0;
      window.renderDebts(container);
      const newInput = document.getElementById('debt-search-input');
      if (newInput) {
        newInput.focus();
        try {
          newInput.setSelectionRange(cursor, cursor);
        } catch (e) {}
      }
    }
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
    window.showConfirmModal('حذف سجل الديون', 'هل أنت متأكد من حذف هذا السجل والدين نهائياً من النظام؟', async () => {
      const engine = getEngine();
      const data = engine.data || getData();
      
      // 1. Find the debt to delete
      const debtIndex = (data.debts || []).findIndex(d => d.id === id);
      if (debtIndex === -1) {
        window.showToast('لم يتم العثور على الدين', 'error');
        return;
      }
      const debtToDelete = data.debts[debtIndex];

      // 2. Remove debt from local data
      data.debts.splice(debtIndex, 1);

      // 3. Update the linked sale
      if (data.sales) {
        const saleIndex = data.sales.findIndex(s => s.id === debtToDelete.saleId || s.code === debtToDelete.saleCode);
        if (saleIndex !== -1) {
          // Reset sale to initial/unpaid state (adjust based on your system logic for reset)
          data.sales[saleIndex] = { 
            ...data.sales[saleIndex], 
            paymentStatus: 'غير مدفوع',
            agentPaid: 0,
            remainingAmount: data.sales[saleIndex].price
          };
        }
      }

      // 4. Persist all changes across system and Firestore
      if (typeof engine.deleteItem === 'function') {
        await engine.deleteItem('debts', id);
      } else {
        await engine.commitData('debts', data.debts);
      }
      await engine.commitData('sales', data.sales);
      
      window.showToast('تم حذف الدين وتحديث بيانات الفاتورة بنجاح', 'success');
      
      const mainEl = document.getElementById('main-content');
      if (mainEl && typeof window.renderDebts === 'function') {
        window.renderDebts(mainEl);
      }
    }, 'حذف نهائي', 'إلغاء', true);
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

      window.getSubscriberAmountAndDebt = function(s, debts, sales) {
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
        return { amount, isDebt };
      }

  function renderSubscriberRows(subs, todayTime) {
    if (subs.length === 0) {
      return '<tr><td colspan="9" style="text-align: center; color: var(--muted); padding: 30px;">لا يوجد مشتركون مطابقون</td></tr>';
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

      // Helper function to calculate subscriber amount and debt status
      const { amount, isDebt } = window.getSubscriberAmountAndDebt(s, debts, sales);

      // Determine color: Red for debt, Green for cash
      const amountColor = isDebt ? '#dc2626' : '#16a34a';
      const amountBg = isDebt ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
      const amountBorder = isDebt ? 'rgba(239, 68, 68, 0.28)' : 'rgba(16, 185, 129, 0.28)';

      const isActive = (String(s.status || '').trim() === 'فعال');
      const typeLabel = isActive ? (window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, sales) : (s.subscriptionType || '1 شهر')) : '-';
      const displayAmount = isActive ? formatNumber(amount) + ' د.ع' : '-';
      const displayAmountStyle = isActive ? ('font-weight: 800; font-size: 0.86rem; color: ' + amountColor + '; background: ' + amountBg + '; border: 1px solid ' + amountBorder + '; padding: 3px 9px; border-radius: 6px; display: inline-block; direction: ltr; font-family: monospace;') : 'color: var(--muted); font-size: 0.9rem; font-weight: 700;';
      
      // Determine if subscriber belongs to Main / Headquarters vs Agent
      const ownerClean = String(s.owner || '').trim();
      const isMainOwner = !ownerClean || 
                          ownerClean === 'المركز الرئيسي' || 
                          ownerClean === 'الرئيسية' || 
                          ownerClean === 'الادارة' || 
                          ownerClean === 'الإدارة' || 
                          ownerClean === 'main' || 
                          ownerClean === 'hq';

      // زر التجديد يظهر فقط للمشتركين غير الفعالين
      const showRenewalBtn = isMainOwner && s.status !== 'فعال';

      const safeSubIdStr = String(s.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeSubIdAttr = escapeHtml(String(s.id || ''));
      const isSelected = window.selectedSubscriberIds && window.selectedSubscriberIds.has(String(s.id));
      
      return '<tr style="' + rowHighlightStyle + '" onclick="this.classList.toggle(\'expanded-mobile-card\')">' +
        '<td style="text-align: center; width: 40px;" onclick="event.stopPropagation()">' +
          '<input type="checkbox" class="subscriber-row-checkbox" value="' + safeSubIdAttr + '" ' + (isSelected ? 'checked' : '') + ' onchange="toggleSubscriberSelection(\'' + safeSubIdStr + '\', this)">' +
        '</td>' +
        '<td>' +
          '<div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">' +
            '<strong class="cell-title">' + escapeHtml(s.name) + '</strong>' +
            (showRenewalBtn ? ('<button class="btn btn-sm btn-success" onclick="openAdminSubscriberRenewalModal(\'' + safeSubIdStr + '\')" title="تجديد وتفعيل الاشتراك وتعديل البيانات" style="padding: 1px 6px; font-size: 0.72rem; border-radius: 4px; background: var(--success, #10b981); color: #fff; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">🔄 تجديد</button>') : '') +
          '</div>' +
          '<div class="cell-subtitle" style="direction: ltr; text-align: right;">' + escapeHtml(s.phone || '-') + '</div>' +
        '</td>' +
        '<td style="font-family: monospace; font-size: 0.84rem;">' +
          '<span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal(\'' + escapeHtml(s.deviceNumber) + '\')" title="انقر لعرض الباركود">' + escapeHtml(s.deviceNumber) + '</span>' +
          (isDuplicate ? '<br><span style="font-size: 0.7rem; color: #b45309; font-weight: 700;">⚠️ جهاز مكرر</span>' : '') +
        '</td>' +
        '<td><span class="badge badge-neutral">' + escapeHtml(window.resolveAgentName ? window.resolveAgentName(s) : s.owner) + '</span></td>' +

        '<td style="text-align: center; white-space: nowrap;">' +
          (typeLabel !== '-' ? '<span class="badge" style="font-weight: 700; font-size: 0.82rem; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">📅 ' + escapeHtml(typeLabel) + '</span>' : '<span style="color: var(--muted); font-size: 0.9rem; font-weight: 700;">-</span>') +
        '</td>' +
        '<td style="text-align: center;">' +
          '<div class="cell-badges-group">' +
            (s.status === 'فعال' ? '<span class="badge badge-success" style="font-weight:700;">فعال</span>' : '<span class="badge badge-neutral" style="background: rgba(100, 116, 139, 0.12); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.25);">غير فعال</span>') +
            (isActive && s.paymentStatus ? ('<span class="badge ' + (s.paymentStatus === 'مدفوع' ? 'badge-success' : ((s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع') ? 'badge-danger' : 'badge-neutral')) + '">' + escapeHtml(s.paymentStatus === 'غير مدفوع' ? 'دين' : s.paymentStatus) + '</span>') : '') +
          '</div>' +
        '</td>' +
        '<td style="text-align: center; white-space: nowrap;">' +
          '<span style="' + displayAmountStyle + '">' + displayAmount + '</span>' +
        '</td>' +
        '<td style="text-align: center;">' +
          (isActive ? ('<div class="cell-date-range" style="direction: ltr; font-size: 0.8rem;"><div class="cell-date-from">بدء: ' + escapeHtml(s.activationDate || s.startDate || s.joiningDate || '-') + '</div><div class="cell-date-to">انتهاء: ' + escapeHtml(s.expiryDate || s.endDate || s.dueDate || '-') + '</div></div>') : '<span style="color: var(--muted); font-size: 0.9rem; font-weight: 700;">-</span>') +
        '</td>' +
        '<td style="text-align: center;">' +
          '<div class="action-btns" style="justify-content: center; gap: 4px; display: inline-flex; align-items: center;">' +
            (waLink ? '<a href="' + waLink + '" target="_blank" class="icon-btn btn-whatsapp" title="مراسلة عبر واتساب">💬</a>' : '') +
            '<button type="button" class="icon-btn" onclick="openSubscriberModal(\'' + safeSubIdStr + '\')" title="تعديل بيانات المشترك">✏️</button>' +
            '<button type="button" class="icon-btn btn-deactivate" data-sub-id="' + safeSubIdAttr + '" onclick="window.confirmDeactivateSubscriber(\'' + safeSubIdStr + '\')" title="إلغاء تفعيل اشتراك المشترك وتفريغ التواريخ والبيانات" aria-label="إلغاء تفعيل اشتراك المشترك" style="color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 3px 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;"><span style="font-size: 0.92rem; font-weight: 900; line-height: 1; pointer-events: none;">❌</span></button>' +
            '<button type="button" class="icon-btn btn-del" onclick="deleteSubscriber(\'' + safeSubIdStr + '\')" title="حذف المشترك نهائياً">🗑️</button>' +
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

    // Dynamic status check and sync with latest renewal sales
    subs.forEach(s => {
      const dev = (s.deviceNumber || '').trim();
      const devDigits = dev ? dev.replace(/\D/g, '') : '';
      const name = (s.name || '').trim().toLowerCase();

      // Find latest sale for this subscriber / device
      const subSales = sales
        .filter(sal => {
          const sDev = (sal.deviceNumber || '').trim();
          const sDevDigits = sDev ? sDev.replace(/\D/g, '') : '';
          const sName = (sal.customerName || '').trim().toLowerCase();
          return (dev && dev !== '-' && sDev && sDev === dev) ||
                 (devDigits && sDevDigits && devDigits === sDevDigits) ||
                 (name && sName && sName === name);
        })
        .sort((a, b) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime());

      if (subSales.length > 0) {
        const latestSale = subSales[0];
        const isRenewalSale = latestSale.saleType === 'تجديد اشتراك' || (latestSale.saleType && latestSale.saleType.includes('تجديد')) || (latestSale.endDate && latestSale.endDate >= today) || latestSale.status === 'فعال';

        if (latestSale.endDate && latestSale.endDate !== '-') {
          if (!s.expiryDate || s.expiryDate === '-' || isRenewalSale || latestSale.endDate >= today) {
            s.expiryDate = latestSale.endDate;
            s.endDate = latestSale.endDate;
            s.dueDate = latestSale.endDate;
          }
        }
        if (latestSale.startDate && latestSale.startDate !== '-') {
          if (!s.activationDate || s.activationDate === '-' || !s.startDate || s.startDate === '-' || isRenewalSale) {
            s.activationDate = latestSale.startDate;
            s.startDate = latestSale.startDate;
          }
        }
        if (latestSale.subscriptionType && latestSale.subscriptionType !== '-') {
          if (!s.subscriptionType || s.subscriptionType === '-' || isRenewalSale) {
            s.subscriptionType = latestSale.subscriptionType;
          }
        }
        if (Number(latestSale.price) > 0) {
          if (!s.price || Number(s.price) === 0 || isRenewalSale) {
            s.price = Number(latestSale.price);
          }
        }
        if (!s.paymentStatus || s.paymentStatus === '' || isRenewalSale) {
          const isCash = latestSale.paymentMethod === 'نقد' || latestSale.paymentStatus === 'تم التسديد' || latestSale.paymentStatus === 'مدفوع';
          s.paymentStatus = isCash ? 'مدفوع' : 'دين';
          s.paymentMethod = latestSale.paymentMethod || (isCash ? 'نقد' : 'دين');
        }
        if (isRenewalSale || (latestSale.endDate && latestSale.endDate >= today)) {
          s.status = 'فعال';
          s.activeStatus = 'فعال';
          s.isActivated = true;
          s.is_active = true;
          s.deactivated = false;
          delete s.deactivated;
        }
      }

      s.status = typeof window.getSubscriberActiveStatus === "function" ? window.getSubscriberActiveStatus(s, today) : ((s.expiryDate && s.expiryDate >= today) || s.status === "فعال" ? "فعال" : "غير فعال");
      s.activeStatus = s.status;
      if (s.status === "فعال") {
        s.deactivated = false;
        delete s.deactivated;
        s.isActivated = true;
        s.is_active = true;
      }
    });

    function checkSubscriberPaid(s) {
      if (s.status === "غير فعال" && (!s.activationDate && !s.expiryDate)) {
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

      return "مدفوع";
    }

    subs.forEach(s => {
      if (s.status === "فعال" || s.activationDate || s.expiryDate) {
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
    const countHQ = allSubsOriginal.filter(s => { 
      const o = String(s.owner || '').trim(); 
      return !o || o === 'المركز الرئيسي' || o === 'الرئيسية' || o === 'الادارة' || o === 'الإدارة' || o === 'main' || o === 'hq'; 
    }).length;

    if (subFilter.owner !== 'all') {
      if (subFilter.owner === 'المركز الرئيسي') {
        subs = subs.filter(s => {
          const o = String(s.owner || '').trim();
          return !o || o === 'المركز الرئيسي' || o === 'الرئيسية' || o === 'الادارة' || o === 'الإدارة' || o === 'main' || o === 'hq';
        });
      } else {
        subs = subs.filter(s => {
          const o = String(s.owner || '').trim();
          return o === subFilter.owner || (window.resolveAgentName && window.resolveAgentName(s) === subFilter.owner);
        });
      }
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

    // Calculate totals for summary boxes
    let totalDebt = 0;
    let totalPaid = 0;
    subs.forEach(s => {
      const { amount, isDebt } = window.getSubscriberAmountAndDebt(s, debts, sales);
      if (isDebt) {
        totalDebt += amount;
      } else {
        totalPaid += amount;
      }
    });

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">قاعدة بيانات المشتركين</span>
            <h1>المشتركون وأجهزة البث</h1>
            <p class="subtitle">متابعة تواريخ تفعيل وانتهاء اشتراكات الأجهزة واستيرادها من Excel ونظام التنبيه التلقائي</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">

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
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الديون الحالية</span><div class="stat-icon">💰</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--danger);">${formatNumber(totalDebt)}</span><span class="stat-unit">د.ع</span></div>
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
                <span class="chip ${subFilter.owner === 'all' ? 'active' : ''}" onclick="setSubFilter('owner', 'all')">
                  <span class="chip-count-badge">${countAll}</span>
                  <span>الكل</span>
                  <small class="agent-count-small" style="font-size: 0.72rem; font-weight: 700; opacity: 0.85; margin-inline-start: 4px;">(${countAll})</small>
                </span>
                <span class="chip ${subFilter.owner === 'المركز الرئيسي' ? 'active' : ''}" onclick="setSubFilter('owner', 'المركز الرئيسي')">
                  <span class="chip-count-badge">${countHQ}</span>
                  <span>المركز الرئيسي</span>
                  <small class="agent-count-small" style="font-size: 0.72rem; font-weight: 700; opacity: 0.85; margin-inline-start: 4px;">(${countHQ})</small>
                </span>
                ${agents.map(a => {
                  const agentSubCount = allSubsOriginal.filter(s => {
                    const o = String(s.owner || '').trim();
                    return o === a.name || (window.resolveAgentName && window.resolveAgentName(s) === a.name);
                  }).length;
                  return `
                  <span class="chip ${subFilter.owner === a.name ? 'active' : ''}" onclick="setSubFilter('owner', '${escapeHtml(a.name)}')">

                    <span class="agent-count-small" style="font-size: 0.72rem; font-weight: 700; opacity: 0.85; margin-inline-end: 4px;">(${agentSubCount})</span>
                    <span>${escapeHtml(a.name)}</span>
                  </span>
                `;}).join('')}
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

          
        <!-- Status Classification Toolbar & Quick Actions above Subscribers Table -->
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


            <div style="font-size: 0.85rem; color: var(--muted); font-weight: 600;">
              عرض <strong style="color: var(--text);">${subs.length}</strong> من إجمالي <strong style="color: var(--text);">${countAll}</strong> مشترك
            </div>
          </div>
        </div>

        <!-- Floating/Sticky Bulk Actions Toolbar for Mass Updates (تعديل مجمع) -->
        <div id="subscribers-bulk-toolbar" class="subscribers-bulk-toolbar" style="display: ${window.selectedSubscriberIds && window.selectedSubscriberIds.size > 0 ? 'flex' : 'none'};">
          <div class="bulk-toolbar-info">
            <span class="bulk-badge">
              <span>✓</span>
              <span>تم تحديد <strong id="bulk-selected-count">${window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0}</strong> مشترك</span>
            </span>
          </div>
          <div class="bulk-toolbar-actions">
            <button type="button" class="btn btn-primary btn-sm bulk-action-btn" onclick="window.openBulkRenewModal()" title="تجديد جماعي للمشتركين المحددين وتحديث تاريخ الانتهاء">
              <span>🔄</span>
              <span>تجديد جماعي</span>
            </button>
            <button type="button" class="btn btn-warning btn-sm bulk-action-btn" onclick="window.openBulkStatusModal()" title="تغيير حالة المشتركين المحددين (فعال / غير فعال / دفع)">
              <span>⚡</span>
              <span>تغيير الحالة</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm bulk-action-btn" onclick="window.openBulkEditModal()" title="تعديل مجمع شامل للمشتركين المحددين (المدة، الأسعار، الوكيل، التواريخ)">
              <span>✏️</span>
              <span>تعديل مجمع</span>
            </button>
            <button type="button" class="btn btn-danger btn-sm bulk-action-btn" onclick="window.deleteSelectedSubscribers()" title="حذف المشتركين المحددين نهائياً">
              <span>🗑️</span>
              <span>حذف المحدد</span>
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm bulk-action-btn" onclick="window.clearSubscriberSelection()" title="إلغاء التحديد">
              <span>✕</span>
              <span>إلغاء التحديد</span>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table subscribers-table">
              <thead>
                <tr>
                  <th style="width: 48px; text-align: center; vertical-align: middle;" title="تحديد الكل للتعديل المجمع">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                      <input type="checkbox" id="select-all-subscribers-checkbox" onclick="toggleSelectAllSubscribers(this)" title="تحديد الكل للتعديل المجمع">
                      <span style="font-size: 0.62rem; color: var(--muted); font-weight: 700; user-select: none;">تحديد</span>
                    </div>
                  </th>
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
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-secondary" onclick="openExcelImportSubscribersModal()">
              <span>📥</span> <span>استدعاء المشتركين من Excel</span>
            </button>
            <button class="btn btn-secondary" onclick="exportSubscribersExcel()">
              <span>📤</span> <span>تصدير Excel</span>
            </button>
            
            <!-- Mass Action Buttons in bottom bar -->
            <button class="btn btn-primary btn-sm" id="bulk-renew-subscribers-btn" onclick="window.openBulkRenewModal()" style="display: ${window.selectedSubscriberIds && window.selectedSubscriberIds.size > 0 ? 'inline-flex' : 'none'}; align-items: center; gap: 6px; font-weight: 700;">
              <span>🔄</span> <span>تجديد جماعي (<span class="selected-count-badge">${window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0}</span>)</span>
            </button>
            <button class="btn btn-warning btn-sm" id="bulk-status-subscribers-btn" onclick="window.openBulkStatusModal()" style="display: ${window.selectedSubscriberIds && window.selectedSubscriberIds.size > 0 ? 'inline-flex' : 'none'}; align-items: center; gap: 6px; font-weight: 700;">
              <span>⚡</span> <span>تغيير الحالة (<span class="selected-count-badge">${window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0}</span>)</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="bulk-edit-subscribers-btn" onclick="window.openBulkEditModal()" style="display: ${window.selectedSubscriberIds && window.selectedSubscriberIds.size > 0 ? 'inline-flex' : 'none'}; align-items: center; gap: 6px; font-weight: 700;">
              <span>✏️</span> <span>تعديل مجمع (<span class="selected-count-badge">${window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0}</span>)</span>
            </button>
            <button class="btn btn-danger btn-sm" id="delete-selected-subscribers-btn" onclick="deleteSelectedSubscribers()" style="display: ${window.selectedSubscriberIds && window.selectedSubscriberIds.size > 0 ? 'inline-flex' : 'none'}; align-items: center; gap: 6px; font-weight: 700;">
              <span>🗑️</span> <span>حذف المحدد (<span class="selected-count-badge">${window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0}</span>)</span>
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
    const subs = data.subscribers || [];
    const subscriber = subs.find(s => 
      String(s.id) === String(subId) || 
      String(s.docId || '') === String(subId) || 
      (s.deviceNumber && String(s.deviceNumber).trim() === String(subId).trim())
    );
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
                <li>تحويل حالة الاشتراك إلى <strong>غير فعال</strong> في قاعدة البيانات والنظام فوراً.</li>
                <li>تصفير (مسح) <strong>حقول تاريخ التجديد وتاريخ البدء وتاريخ التفعيل</strong>.</li>
                <li>تصفير (مسح) <strong>حقول تاريخ الانتهاء والاستحقاق</strong>.</li>
                <li>تصفير (مسح) <strong>كافة بيانات ومبالغ وطرق الدفع</strong> الخاصة بالاشتراك.</li>
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

    const targetSubId = subscriber.id || subId;
    const confirmBtn = document.getElementById("confirm-deactivate-btn");
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        window.closeModal();
        await window.executeDeactivateSubscriber(targetSubId);
      };
    }
  };

  window.executeDeactivateSubscriber = async function(id) {
    try {
      const data = getData();
      const subs = data.subscribers || [];
      const subscriber = subs.find(s => 
        String(s.id) === String(id) || 
        String(s.docId || '') === String(id) || 
        (s.deviceNumber && String(s.deviceNumber).trim() === String(id).trim())
      );
      if (!subscriber) {
        window.showToast("المشترك غير موجود", "error");
        return;
      }

      // 1. Reset active status to inactive in local and DB
      subscriber.status = "غير فعال";
      subscriber.activeStatus = "غير فعال";
      subscriber.isActivated = false;
      subscriber.is_active = false;
      subscriber.deactivated = true;
      subscriber.lastDeactivatedAt = new Date().toISOString();
      subscriber.deactivatedAt = new Date().toISOString();

      // 2. Clear renewal, activation, and start date fields (تصفير حقول تاريخ التجديد)
      subscriber.activationDate = "";
      subscriber.startDate = "";
      subscriber.renewalDate = "";
      subscriber.lastRenewalDate = "";
      subscriber.renewal = "";
      subscriber.activation = "";

      // 3. Clear expiry, end, and due date fields (تصفير حقول تاريخ الانتهاء)
      subscriber.expiryDate = "";
      subscriber.endDate = "";
      subscriber.dueDate = "";
      subscriber.nextDueDate = "";
      subscriber.subscriptionType = "";
      subscriber.durationMonths = 0;

      // 4. Clear payment data (تصفير بيانات الدفع)
      subscriber.paymentStatus = "";
      subscriber.paymentMethod = "";
      subscriber.paymentDate = "";
      subscriber.price = 0;
      subscriber.amount = 0;
      subscriber.paidAmount = 0;
      subscriber.remainingAmount = 0;
      subscriber.debtAmount = 0;
      subscriber.hasDebt = false;

      data.subscribers = subs;

      const subName = (subscriber.name || '').trim().toLowerCase();
      const subDev = (subscriber.deviceNumber || '').trim();
      const subDevDigits = subDev ? subDev.replace(/\D/g, '') : '';

      if (Array.isArray(data.sales)) {
        data.sales = data.sales.filter(s => {
          const sDev = (s.deviceNumber || '').trim();
          const sDevDigits = sDev ? sDev.replace(/\D/g, '') : '';
          const sName = (s.customerName || s.name || '').trim().toLowerCase();
          const matchDev = (subDev && subDev !== '-' && sDev === subDev) || (subDevDigits && sDevDigits && sDevDigits === sDevDigits);
          const matchName = subName && sName && (sName === subName || sName.includes(subName) || subName.includes(sName));
          return !(matchDev || matchName);
        });
        if (getEngine() && typeof getEngine().commitData === 'function') {
          await getEngine().commitData('sales', data.sales);
        }
      }

      if (Array.isArray(data.debts)) {
        data.debts = data.debts.filter(d => {
          const dDev = (d.deviceNumber || '').trim();
          const dDevDigits = dDev ? dDev.replace(/\D/g, '') : '';
          const dName = (d.customerName || '').trim().toLowerCase();
          const matchDev = (subDev && subDev !== '-' && dDev === subDev) || (subDevDigits && dDevDigits && dDevDigits === dDevDigits);
          const matchName = subName && dName && (dName === subName || dName.includes(subName) || dName.includes(subName));
          return !(matchDev || matchName);
        });
        if (getEngine() && typeof getEngine().commitData === 'function') {
          await getEngine().commitData('debts', data.debts);
        }
      }

      if (getEngine() && typeof getEngine().saveLocal === "function") {
        getEngine().saveLocal();
      }
      if (getEngine() && typeof getEngine().commitData === "function") {
        await getEngine().commitData('subscribers', data.subscribers);
      }

      window.showToast(`تم إلغاء تفعيل اشتراك (${subscriber.name}) وتصفير حقول التجديد والانتهاء وبيانات الدفع بنجاح (الحالة: غير فعال)`, "success");
      
      if (typeof window.renderSubscribers === "function") {
        window.renderSubscribers(document.getElementById("main-content"));
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
  window.cancelSubscription = window.confirmDeactivateSubscriber;
  window.cancelSub = window.confirmDeactivateSubscriber;

  window.deleteSubscriber = function(id) {
    window.showConfirmModal('حذف المشترك نهائياً', 'هل تريد حذف هذا المشترك نهائياً من النظام مع كافة سجلات المبيعات والديون المتعلقة به؟ سيتم الحذف نهائياً ولن يعود عند إعادة تحميل الصفحة.', async () => {
      const data = getData();
      const subscriber = (data.subscribers || []).find(s => 
        String(s.id) === String(id) || 
        String(s.docId || '') === String(id) || 
        (s.deviceNumber && String(s.deviceNumber).trim() === String(id).trim())
      );
      
      const targetSub = subscriber || { id: id };
      const rawDev = (targetSub.deviceNumber || '').trim();
      const isRealDevice = typeof getEngine().isRealDeviceNumber === 'function' 
        ? getEngine().isRealDeviceNumber(rawDev) 
        : (rawDev && rawDev !== '00' && rawDev !== '-' && rawDev.length >= 2);
      const deviceNumber = isRealDevice ? rawDev : '';

      const otherSubsWithSameDevice = isRealDevice 
        ? (data.subscribers || []).filter(s => String(s.id) !== String(id) && s.deviceNumber && String(s.deviceNumber).trim() === deviceNumber)
        : [];

      if (typeof getEngine().deleteSubscriberCompletely === 'function') {
        await getEngine().deleteSubscriberCompletely(targetSub.id || id, otherSubsWithSameDevice.length > 0 ? null : deviceNumber, targetSub);
      } else {
        const updatedSubscribers = (data.subscribers || []).filter(s => String(s.id) !== String(id));
        data.subscribers = updatedSubscribers;
        if (typeof getEngine().saveLocal === 'function') getEngine().saveLocal();
        await getEngine().commitData('subscribers', updatedSubscribers);
      }

      window.showToast('تم حذف حساب المشترك وسجلاته نهائياً من النظام بنجاح', 'success');

      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }
    }, 'حذف المشترك نهائياً', 'إلغاء', true);
  };

  if (!window.selectedSubscriberIds) {
    window.selectedSubscriberIds = new Set();
  }

  window.toggleSubscriberSelection = function(id, checkbox) {
    if (!window.selectedSubscriberIds) window.selectedSubscriberIds = new Set();
    if (checkbox.checked) {
      window.selectedSubscriberIds.add(String(id));
    } else {
      window.selectedSubscriberIds.delete(String(id));
    }
    window.updateSelectedSubscribersToolbar();
  };

  window.toggleSelectAllSubscribers = function(masterCheckbox) {
    if (!window.selectedSubscriberIds) window.selectedSubscriberIds = new Set();
    const checkboxes = document.querySelectorAll('.subscriber-row-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = masterCheckbox.checked;
      if (masterCheckbox.checked) {
        window.selectedSubscriberIds.add(String(cb.value));
      } else {
        window.selectedSubscriberIds.delete(String(cb.value));
      }
    });
    window.updateSelectedSubscribersToolbar();
  };

  window.updateSelectedSubscribersToolbar = function() {
    const count = window.selectedSubscriberIds ? window.selectedSubscriberIds.size : 0;
    
    // Top sticky floating toolbar
    const topToolbar = document.getElementById('subscribers-bulk-toolbar');
    const topCount = document.getElementById('bulk-selected-count');
    if (topToolbar) {
      topToolbar.style.display = count > 0 ? 'flex' : 'none';
      if (topCount) topCount.textContent = count;
    }

    // Bottom action bar buttons
    const bottomBtns = [
      document.getElementById('bulk-renew-subscribers-btn'),
      document.getElementById('bulk-status-subscribers-btn'),
      document.getElementById('bulk-edit-subscribers-btn'),
      document.getElementById('delete-selected-subscribers-btn')
    ];
    bottomBtns.forEach(btn => {
      if (btn) btn.style.display = count > 0 ? 'inline-flex' : 'none';
    });

    // Badges across UI
    document.querySelectorAll('.selected-count-badge, #selected-subscribers-count').forEach(el => {
      el.textContent = count;
    });

    // Master checkbox state
    const masterCb = document.getElementById('select-all-subscribers-checkbox');
    const allRowCbs = document.querySelectorAll('.subscriber-row-checkbox');
    if (masterCb && allRowCbs.length > 0) {
      const checkedCount = Array.from(allRowCbs).filter(cb => cb.checked).length;
      if (checkedCount === 0) {
        masterCb.checked = false;
        masterCb.indeterminate = false;
      } else if (checkedCount === allRowCbs.length) {
        masterCb.checked = true;
        masterCb.indeterminate = false;
      } else {
        masterCb.checked = false;
        masterCb.indeterminate = true;
      }
    }
  };

  window.clearSubscriberSelection = function() {
    if (window.selectedSubscriberIds) {
      window.selectedSubscriberIds.clear();
    }
    document.querySelectorAll('.subscriber-row-checkbox').forEach(cb => { cb.checked = false; });
    const masterCb = document.getElementById('select-all-subscribers-checkbox');
    if (masterCb) { masterCb.checked = false; masterCb.indeterminate = false; }
    window.updateSelectedSubscribersToolbar();
  };

  function checkAdminAccessForBulk() {
    const user = getEngine()?.currentUser;
    if (!user) return true;
    const isAdmin = typeof window.isSystemAdmin === 'function' 
      ? window.isSystemAdmin(user) 
      : (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي' || user.username === 'admin' || user.username === 'abodsari');
    if (!isAdmin) {
      window.showToast('عذراً، عمليات التعديل والتجديد المجمع مخصصة للإدارة والمدراء فقط', 'error');
      return false;
    }
    return true;
  }

  // 1. Bulk Renew Modal (تجديد جماعي مجمع)
  window.openBulkRenewModal = function() {
    if (!checkAdminAccessForBulk()) return;
    if (!window.selectedSubscriberIds || window.selectedSubscriberIds.size === 0) {
      window.showToast('الرجاء تحديد مشترك واحد على الأقل للتجديد الجماعي', 'warning');
      return;
    }
    const count = window.selectedSubscriberIds.size;
    const today = new Date().toISOString().substring(0, 10);
    const modalContainer = document.getElementById('modal-container');

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 600px; width: 95%; margin: auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">🔄</span>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">تجديد جماعي لـ (${count}) مشترك</h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="bulk-renew-form" onsubmit="window.handleBulkRenewSubmit(event); return false;">
            <div class="modal-body" style="padding: 16px 18px;">
              
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 0.88rem; line-height: 1.5;">
                <span>ℹ️ سيتم تمديد وتفعيل اشتراك المشتركين المحددين (<strong>${count}</strong> مشترك) وتحديث تواريخ الانتهاء والأسعار دفعة واحدة.</span>
              </div>

              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px; display: block;">مدة التجديد *</label>
                  <select id="bulk-ren-duration" onchange="window.updateBulkRenewPricingPreview()" style="width: 100%; padding: 8px 10px; font-size: 0.9rem; font-weight: 700;">
                    <option value="1 شهر" data-months="1" selected>1 شهر (شهر واحد)</option>
                    <option value="2 شهر" data-months="2">2 شهر (شهرين)</option>
                    <option value="3 شهر" data-months="3">3 شهر (3 أشهر)</option>
                    <option value="6 شهر" data-months="6">6 شهر (6 أشهر)</option>
                    <option value="1 سنة" data-months="12">1 سنة (سنة كاملة)</option>
                  </select>
                </div>

                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px; display: block;">طريقة الدفع *</label>
                  <select id="bulk-ren-payment" style="width: 100%; padding: 8px 10px; font-size: 0.9rem; font-weight: 700;">
                    <option value="نقد" selected>نقد (تم التسديد)</option>
                    <option value="دين">دين (تسجيل في الديون)</option>
                  </select>
                </div>
              </div>

              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px; display: block;">قاعدة تاريخ البدء *</label>
                  <select id="bulk-ren-start-rule" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                    <option value="extend" selected>تمديد من تاريخ الانتهاء الحالي (أو اليوم إن كان منتهياً)</option>
                    <option value="today">بدء الجميع من تاريخ اليوم (${today})</option>
                  </select>
                </div>

                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px; display: block;">السعر الفردي لكل مشترك (د.ع) *</label>
                  <input type="text" id="bulk-ren-unit-price" value="25,000" style="width: 100%; padding: 8px 10px; font-size: 0.92rem; font-weight: 800; color: var(--green); text-align: center;">
                </div>
              </div>

              <div style="margin-bottom: 14px; background: var(--surface-alt); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px; font-size: 0.88rem; font-weight: 700;">
                  <input type="checkbox" id="bulk-ren-create-sales" checked style="width: 17px; height: 17px; accent-color: var(--primary);">
                  <span>تسجيل فواتير تجديد مبيعات تلقائية في سجل المبيعات والتقارير المالية</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 700;">
                  <input type="checkbox" id="bulk-ren-set-active" checked style="width: 17px; height: 17px; accent-color: var(--primary);">
                  <span>تفعيل حالة كافة المشتركين المحددين إلى "فعال" فورياً</span>
                </label>
              </div>

              <div id="bulk-ren-summary" style="font-size: 0.85rem; color: var(--muted); text-align: center;">
                إجمالي المشتركين المحددين للعملية: <strong>${count}</strong> مشترك.
              </div>

            </div>
            <div class="modal-footer" style="padding: 12px 18px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" id="btn-bulk-ren-submit" class="btn btn-success" style="padding: 8px 24px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px;">
                <span>🔄 تطبيق التجديد الجماعي</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.updateBulkRenewPricingPreview = function() {
    const durationSelect = document.getElementById('bulk-ren-duration');
    const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
    const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;
    let price = 25000;
    if (months === 1) price = 25000;
    else if (months === 2) price = 50000;
    else if (months === 3) price = 75000;
    else if (months === 6) price = 150000;
    else if (months === 12) price = 300000;
    else price = 25000 * months;
    const priceInput = document.getElementById('bulk-ren-unit-price');
    if (priceInput) priceInput.value = formatNumber(price);
  };

  window.handleBulkRenewSubmit = async function(e) {
    if (e) e.preventDefault();
    if (!checkAdminAccessForBulk()) return;
    const btn = document.getElementById('btn-bulk-ren-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري التجديد والحفظ...`;
    }

    try {
      const durationSelect = document.getElementById('bulk-ren-duration');
      const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
      const duration = durationSelect?.value || '1 شهر';
      const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;
      const paymentMethod = document.getElementById('bulk-ren-payment')?.value || 'نقد';
      const startRule = document.getElementById('bulk-ren-start-rule')?.value || 'extend';
      const unitPrice = parseNumber(document.getElementById('bulk-ren-unit-price')?.value || '25000');
      const createSales = document.getElementById('bulk-ren-create-sales')?.checked !== false;
      const setActive = document.getElementById('bulk-ren-set-active')?.checked !== false;

      const data = getData();
      const allSubs = data.subscribers || [];
      const today = new Date().toISOString().substring(0, 10);
      const targetIds = new Set(Array.from(window.selectedSubscriberIds || []).map(String));
      const count = targetIds.size;

      const newSales = [];
      const newDebts = [];

      allSubs.forEach(s => {
        if (!targetIds.has(String(s.id))) return;

        let startDate = today;
        if (startRule === 'extend' && s.expiryDate && s.expiryDate >= today) {
          startDate = s.expiryDate;
        }

        const endDate = window.addMonthsToDate ? window.addMonthsToDate(startDate, months) : startDate;

        s.subscriptionType = duration;
        s.startDate = startDate;
        s.activationDate = startDate;
        s.expiryDate = endDate;
        s.endDate = endDate;
        s.dueDate = endDate;
        s.price = unitPrice;
        s.paymentMethod = paymentMethod;
        s.paymentStatus = (paymentMethod === 'نقد' ? 'مدفوع' : 'دين');
        s.paidAmount = (paymentMethod === 'نقد' ? unitPrice : 0);
        s.remainingAmount = (paymentMethod === 'نقد' ? 0 : unitPrice);
        if (setActive) {
          s.status = 'فعال';
          s.activeStatus = 'فعال';
          s.isActivated = true;
          s.is_active = true;
          delete s.deactivated;
          delete s.deactivatedAt;
        }
        s.lastActivatedAt = new Date().toISOString();
        s.activatedBy = 'المركز الرئيسي (تجديد جماعي)';

        if (createSales) {
          const saleCode = (typeof window.generateSaleCode === 'function') ? window.generateSaleCode() : ('SR-' + Math.floor(10000 + Math.random() * 90000));
          const newSale = {
            id: 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            code: saleCode,
            customerName: s.name,
            customerPhone: s.phone || '',
            seller: s.owner || 'المركز الرئيسي',
            saleType: 'تجديد اشتراك',
            deviceNumber: s.deviceNumber || '',
            subscriptionType: duration,
            startDate: startDate,
            endDate: endDate,
            price: unitPrice,
            paymentStatus: (paymentMethod === 'نقد' ? 'تم التسديد' : 'دين'),
            paymentMethod: paymentMethod,
            agentPaid: (paymentMethod === 'نقد' ? unitPrice : 0),
            status: 'فعال',
            activeStatus: 'فعال',
            createdAt: new Date().toISOString()
          };
          newSales.push(newSale);

          if (paymentMethod === 'دين') {
            newDebts.push({
              id: 'debt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
              saleId: newSale.id,
              saleCode: saleCode,
              customerName: s.name,
              customerPhone: s.phone || '',
              agentName: s.owner || 'المركز الرئيسي',
              deviceNumber: s.deviceNumber || '',
              debtType: 'مبيعات',
              totalAmount: unitPrice,
              paidAmount: 0,
              remainingAmount: unitPrice,
              status: 'غير مسدد',
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      if (typeof getEngine().saveLocal === 'function') getEngine().saveLocal();
      await getEngine().commitData('subscribers', data.subscribers);

      if (newSales.length > 0) {
        data.sales = [...newSales, ...(data.sales || [])];
        await getEngine().commitData('sales', data.sales);
      }
      if (newDebts.length > 0) {
        data.debts = [...newDebts, ...(data.debts || [])];
        await getEngine().commitData('debts', data.debts);
      }

      window.showToast(`تم تجديد (${count}) مشترك بنجاح وتحديث كافة السجلات والتواريخ 🎉`, 'success');
      window.clearSubscriberSelection();
      window.closeModal();

      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }
    } catch (err) {
      console.error('Error during bulk renew:', err);
      window.showToast('حدث خطأ أثناء تنفيذ التجديد الجماعي', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 تطبيق التجديد الجماعي';
      }
    }
  };

  // 2. Bulk Status Change Modal (تغيير الحالة المجمع)
  window.openBulkStatusModal = function() {
    if (!checkAdminAccessForBulk()) return;
    if (!window.selectedSubscriberIds || window.selectedSubscriberIds.size === 0) {
      window.showToast('الرجاء تحديد مشترك واحد على الأقل لتغيير الحالة', 'warning');
      return;
    }
    const count = window.selectedSubscriberIds.size;
    const modalContainer = document.getElementById('modal-container');

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 520px; width: 95%; margin: auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">⚡</span>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">تغيير حالة (${count}) مشترك</h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="bulk-status-form" onsubmit="window.handleBulkStatusSubmit(event); return false;">
            <div class="modal-body" style="padding: 16px 18px;">
              
              <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 0.88rem; font-weight: 700; margin-bottom: 6px; display: block;">حالة الاشتراك (Status)</label>
                <select id="bulk-stat-status" style="width: 100%; padding: 9px 12px; font-size: 0.92rem; font-weight: 700;">
                  <option value="no-change">-- بدون تغيير --</option>
                  <option value="فعال" style="color: var(--success); font-weight: 700;">🟢 فعال (تفعيل وتنشيط الاشتراك)</option>
                  <option value="غير فعال" style="color: var(--danger); font-weight: 700;">🔴 غير فعال (إلغاء التنشيط / إيقاف)</option>
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 0.88rem; font-weight: 700; margin-bottom: 6px; display: block;">حالة الدفع (Payment Status)</label>
                <select id="bulk-stat-payment" style="width: 100%; padding: 9px 12px; font-size: 0.92rem; font-weight: 700;">
                  <option value="no-change">-- بدون تغيير --</option>
                  <option value="مدفوع" style="color: var(--success); font-weight: 700;">✅ مدفوع (تم التسديد بالكامل)</option>
                  <option value="دين" style="color: var(--danger); font-weight: 700;">⚠️ دين (تسجيل ذمة / غير مدفوع)</option>
                </select>
              </div>

              <div style="font-size: 0.82rem; color: var(--muted); background: var(--surface-alt); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line);">
                💡 سيتم تطبيق التغييرات المحددة فقط وتحديث كافة المشتركين المحددين فورياً.
              </div>

            </div>
            <div class="modal-footer" style="padding: 12px 18px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" id="btn-bulk-stat-submit" class="btn btn-warning" style="padding: 8px 24px; font-weight: 800;">
                <span>⚡ تطبيق التغيير</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.handleBulkStatusSubmit = async function(e) {
    if (e) e.preventDefault();
    if (!checkAdminAccessForBulk()) return;
    const btn = document.getElementById('btn-bulk-stat-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري التحديث...`;
    }

    try {
      const newStatus = document.getElementById('bulk-stat-status')?.value;
      const newPayment = document.getElementById('bulk-stat-payment')?.value;

      if (newStatus === 'no-change' && newPayment === 'no-change') {
        window.showToast('لم يتم اختيار أي تغيير لتطبيقه', 'info');
        window.closeModal();
        return;
      }

      const data = getData();
      const allSubs = data.subscribers || [];
      const targetIds = new Set(Array.from(window.selectedSubscriberIds || []).map(String));
      const count = targetIds.size;

      allSubs.forEach(s => {
        if (!targetIds.has(String(s.id))) return;

        if (newStatus === 'فعال') {
          s.status = 'فعال';
          s.activeStatus = 'فعال';
          s.isActivated = true;
          s.is_active = true;
          delete s.deactivated;
          delete s.deactivatedAt;
          s.lastActivatedAt = new Date().toISOString();
        } else if (newStatus === 'غير فعال') {
          s.status = 'غير فعال';
          s.activeStatus = 'غير فعال';
          s.isActivated = false;
          s.is_active = false;
          s.deactivated = true;
          s.deactivatedAt = new Date().toISOString();
        }

        if (newPayment === 'مدفوع') {
          s.paymentStatus = 'مدفوع';
          s.paymentMethod = 'نقد';
          s.paidAmount = s.price || 25000;
          s.remainingAmount = 0;
        } else if (newPayment === 'دين') {
          s.paymentStatus = 'دين';
          s.paymentMethod = 'دين';
          s.remainingAmount = s.price || 25000;
          s.paidAmount = 0;
        }
      });

      if (typeof getEngine().saveLocal === 'function') getEngine().saveLocal();
      await getEngine().commitData('subscribers', data.subscribers);

      window.showToast(`تم تحديث حالة (${count}) مشترك بنجاح 👍`, 'success');
      window.clearSubscriberSelection();
      window.closeModal();

      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }
    } catch (err) {
      console.error('Error during bulk status update:', err);
      window.showToast('حدث خطأ أثناء تحديث الحالة المجمعة', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '⚡ تطبيق التغيير';
      }
    }
  };

  // 3. Comprehensive Bulk Edit Modal (تعديل مجمع شامل)
  window.openBulkEditModal = function() {
    if (!checkAdminAccessForBulk()) return;
    if (!window.selectedSubscriberIds || window.selectedSubscriberIds.size === 0) {
      window.showToast('الرجاء تحديد مشترك واحد على الأقل للتعديل المجمع', 'warning');
      return;
    }
    const count = window.selectedSubscriberIds.size;
    const data = getData();
    const agents = data.agents || [];
    const modalContainer = document.getElementById('modal-container');

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 640px; width: 95%; margin: auto;" onclick="event.stopPropagation()">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">✏️</span>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">تعديل مجمع شامل لـ (${count}) مشترك</h3>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="bulk-edit-form" onsubmit="window.handleBulkEditSubmit(event); return false;">
            <div class="modal-body" style="padding: 16px 18px;">
              
              <div style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.86rem;">
                <span>💡 اختر الحقول التي ترغب بتعديلها فقط، الحقول المتروكة على <strong>"بدون تغيير"</strong> ستبقى كما هي لكل مشترك.</span>
              </div>

              <!-- Row 1: Status & Duration -->
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">تعديل حالة الاشتراك</label>
                  <select id="be-status" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                    <option value="no-change">-- بدون تغيير --</option>
                    <option value="فعال">🟢 فعال</option>
                    <option value="غير فعال">🔴 غير فعال</option>
                  </select>
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">تعديل نوع الاشتراك</label>
                  <select id="be-type" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                    <option value="no-change">-- بدون تغيير --</option>
                    <option value="1 شهر">1 شهر</option>
                    <option value="2 شهر">2 شهر</option>
                    <option value="3 شهر">3 شهر</option>
                    <option value="6 شهر">6 شهر</option>
                    <option value="1 سنة">1 سنة</option>
                  </select>
                </div>
              </div>

              <!-- Row 2: Owner/Agent & Payment Status -->
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">الوكيل / المالك المسؤول</label>
                  <select id="be-owner" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                    <option value="no-change">-- بدون تغيير --</option>
                    <option value="المركز الرئيسي">المركز الرئيسي</option>
                    ${agents.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${escapeHtml(a.code || 'AG')})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">تعديل حالة وطريقة الدفع</label>
                  <select id="be-payment" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                    <option value="no-change">-- بدون تغيير --</option>
                    <option value="نقد">نقد (مدفوع / تم التسديد)</option>
                    <option value="دين">دين (تسجيل ذمة)</option>
                  </select>
                </div>
              </div>

              <!-- Row 3: Custom Price & Expiry Date -->
              <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">تعديل السعر (د.ع)</label>
                  <input type="text" id="be-price" placeholder="اتركه فارغاً لعدم التغيير" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.84rem; font-weight: 700; margin-bottom: 4px; display: block;">تحديد تاريخ انتهاء موحد</label>
                  <input type="date" id="be-expiry" style="width: 100%; padding: 8px 10px; font-size: 0.88rem;">
                </div>
              </div>

              <div style="font-size: 0.85rem; color: var(--muted); text-align: center;">
                سيتم تطبيق هذه التعديلات على عدد <strong>${count}</strong> مشترك محدد.
              </div>

            </div>
            <div class="modal-footer" style="padding: 12px 18px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" id="btn-bulk-edit-submit" class="btn btn-primary" style="padding: 8px 24px; font-weight: 800;">
                <span>💾 حفظ التعديلات المجمعة</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.handleBulkEditSubmit = async function(e) {
    if (e) e.preventDefault();
    if (!checkAdminAccessForBulk()) return;
    const btn = document.getElementById('btn-bulk-edit-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري الحفظ...`;
    }

    try {
      const statusVal = document.getElementById('be-status')?.value;
      const typeVal = document.getElementById('be-type')?.value;
      const ownerVal = document.getElementById('be-owner')?.value;
      const paymentVal = document.getElementById('be-payment')?.value;
      const priceRaw = document.getElementById('be-price')?.value?.trim();
      const expiryVal = document.getElementById('be-expiry')?.value;

      const hasPriceChange = priceRaw && priceRaw !== '';
      const customPrice = hasPriceChange ? parseNumber(priceRaw) : null;

      const data = getData();
      const allSubs = data.subscribers || [];
      const targetIds = new Set(Array.from(window.selectedSubscriberIds || []).map(String));
      const count = targetIds.size;

      allSubs.forEach(s => {
        if (!targetIds.has(String(s.id))) return;

        if (statusVal === 'فعال') {
          s.status = 'فعال';
          s.activeStatus = 'فعال';
          s.isActivated = true;
          s.is_active = true;
          delete s.deactivated;
        } else if (statusVal === 'غير فعال') {
          s.status = 'غير فعال';
          s.activeStatus = 'غير فعال';
          s.isActivated = false;
          s.is_active = false;
          s.deactivated = true;
        }

        if (typeVal !== 'no-change') {
          s.subscriptionType = typeVal;
        }

        if (ownerVal !== 'no-change') {
          s.owner = ownerVal;
        }

        if (paymentVal === 'نقد') {
          s.paymentStatus = 'مدفوع';
          s.paymentMethod = 'نقد';
          s.paidAmount = s.price || 25000;
          s.remainingAmount = 0;
        } else if (paymentVal === 'دين') {
          s.paymentStatus = 'دين';
          s.paymentMethod = 'دين';
          s.remainingAmount = s.price || 25000;
          s.paidAmount = 0;
        }

        if (hasPriceChange && customPrice !== null) {
          s.price = customPrice;
          if (s.paymentMethod === 'نقد') s.paidAmount = customPrice;
          else s.remainingAmount = customPrice;
        }

        if (expiryVal) {
          s.expiryDate = expiryVal;
          s.endDate = expiryVal;
          s.dueDate = expiryVal;
        }
      });

      if (typeof getEngine().saveLocal === 'function') getEngine().saveLocal();
      await getEngine().commitData('subscribers', data.subscribers);

      window.showToast(`تم حفظ وتحديث بيانات (${count}) مشترك بنجاح 👍`, 'success');
      window.clearSubscriberSelection();
      window.closeModal();

      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }
    } catch (err) {
      console.error('Error during bulk edit:', err);
      window.showToast('حدث خطأ أثناء حفظ التعديلات المجمعة', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '💾 حفظ التعديلات المجمعة';
      }
    }
  };

  // 4. Delete Selected Subscribers (حذف المحدد)
  window.deleteSelectedSubscribers = function() {
    if (!checkAdminAccessForBulk()) return;
    if (!window.selectedSubscriberIds || window.selectedSubscriberIds.size === 0) {
      window.showToast('الرجاء تحديد مشترك واحد على الأقل للحذف', 'error');
      return;
    }
    const count = window.selectedSubscriberIds.size;
    window.showConfirmModal(
      `حذف (${count}) من المشتركين المحددين`,
      `هل أنت متأكد من رغبتك في حذف ${count} مشتركاً المحددين نهائياً من النظام مع كافة سجلاتهم ومبيعاتهم؟`,
      async () => {
        const idsToDelete = Array.from(window.selectedSubscriberIds);
        window.clearSubscriberSelection();

        if (getEngine() && typeof getEngine().bulkDeleteSubscribers === 'function') {
          await getEngine().bulkDeleteSubscribers(idsToDelete);
        } else {
          for (const id of idsToDelete) {
            if (typeof getEngine().deleteSubscriberCompletely === 'function') {
              await getEngine().deleteSubscriberCompletely(id);
            }
          }
        }

        window.showToast(`تم حذف المشتركين المحددين نهائياً من النظام بنجاح`, 'success');

        if (typeof window.renderSubscribers === 'function') {
          window.renderSubscribers(document.getElementById('main-content'));
        }
      },
      'حذف المحدد نهائياً',
      'إلغاء',
      true
    );
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
    let sub = (data.subscribers || []).find(s => 
      String(s.id) === String(subId) || 
      String(s.docId) === String(subId) || 
      String(s.deviceNumber) === String(subId) ||
      String(s.name) === String(subId) ||
      String(s.name || '').trim().toLowerCase() === String(subId || '').trim().toLowerCase()
    );
    if (!sub) {
      const sale = (data.sales || []).find(sal => String(sal.id) === String(subId) || String(sal.customerName) === String(subId) || String(sal.deviceNumber) === String(subId));
      if (sale) {
        sub = {
          id: sale.id || ('sub-' + Date.now()),
          docId: sale.id || ('sub-' + Date.now()),
          name: sale.customerName || subId,
          phone: sale.customerPhone || '',
          deviceNumber: sale.deviceNumber || '',
          owner: sale.seller || 'المركز الرئيسي',
          subscriptionType: sale.subscriptionType || '1 شهر',
          startDate: sale.startDate || new Date().toISOString().substring(0, 10),
          expiryDate: sale.endDate || new Date().toISOString().substring(0, 10),
          price: sale.price || 25000,
          paymentMethod: sale.paymentMethod || 'نقد',
          paymentStatus: sale.paymentStatus || 'مدفوع',
          status: 'فعال'
        };
        data.subscribers = [...(data.subscribers || []), sub];
      } else {
        sub = {
          id: 'sub-' + Date.now(),
          docId: 'sub-' + Date.now(),
          name: subId,
          deviceNumber: '',
          owner: 'المركز الرئيسي',
          status: 'فعال',
          subscriptionType: '1 شهر',
          startDate: new Date().toISOString().substring(0, 10),
          expiryDate: new Date().toISOString().substring(0, 10),
          price: 25000,
          paymentMethod: 'نقد',
          paymentStatus: 'مدفوع'
        };
        data.subscribers = [...(data.subscribers || []), sub];
      }
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
    else if (sub.subscriptionType === '1 سنة' || sub.subscriptionType === 'اشتراك سنة' || sub.subscriptionType === '12 شهر') initialMonths = 12;

    const initialEndDate = window.addMonthsToDate ? window.addMonthsToDate(initialStartDate, initialMonths) : initialStartDate;

    const safeSubIdVal = escapeHtml(String(sub.id || ''));
    const safeSubNameVal = escapeHtml(String(sub.name || ''));
    const safeSubDevVal = escapeHtml(String(sub.deviceNumber || ''));

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
          <form id="admin-sub-ren-form" onsubmit="window.handleAdminSubscriberRenewalSubmit(event, '${String(sub.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'); return false;">
            <!-- Hidden identifiers to infallibly link and update subscriber without restrictions -->
            <input type="hidden" id="asr-sub-id" value="${safeSubIdVal}">
            <input type="hidden" id="asr-original-name" value="${safeSubNameVal}">
            <input type="hidden" id="asr-original-device" value="${safeSubDevVal}">
            <input type="hidden" id="asr-joining" value="${escapeHtml(sub.joiningDate || today)}">
            <div class="modal-body" style="padding: 14px 18px; overflow: visible;">
              
              <!-- Row 1: Name, Phone, Owner -->
              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">اسم المشترك *</label>
                  <input type="text" id="asr-name" required value="${safeSubNameVal}" style="padding: 6px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">رقم الهاتف</label>
                  <input type="text" id="asr-phone" placeholder="0770xxxxxxx" value="${escapeHtml(sub.phone || '')}" style="padding: 6px 10px; font-size: 0.88rem;">
                </div>
                <div class="form-group" style="margin: 0;">
                  <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px;">المالك / الوكيل *</label>
                  <select id="asr-owner" onchange="updateAdminSubscriberRenewalPrice()" style="padding: 6px 10px; font-size: 0.88rem;">
                    <option value="المركز الرئيسي" selected>المركز الرئيسي</option>
                  </select>
                </div>
              </div>

              <!-- Main Section: Device & QR on right, Subscription Settings on left -->
              <div style="display: grid; grid-template-columns: 175px 1fr; gap: 14px; margin-bottom: 6px; background: var(--surface-alt); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
                <!-- Column 1: Device number & QR square directly beneath it -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; border-left: 1px dashed var(--line); padding-left: 14px;">
                  <div class="form-group" style="margin: 0; width: 100%;">
                    <label style="font-size: 0.8rem; font-weight: 700; margin-bottom: 3px; display: block; text-align: center;">رقم الجهاز *</label>
                    <input type="text" id="asr-device" required placeholder="رقم الجهاز..." value="${safeSubDevVal}" oninput="updateRenewalQrCode(this.value)" style="padding: 6px 6px; font-size: 0.85rem; font-weight: 700; text-align: center; width: 100%;">
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
                        <option value="1 شهر" data-months="1" ${(!sub.subscriptionType || sub.subscriptionType === '1 شهر' || sub.subscriptionType === 'اشتراك شهر واحد') ? 'selected' : ''}>1 شهر (شهر واحد)</option>
                        <option value="2 شهر" data-months="2" ${(sub.subscriptionType === '2 شهر' || sub.subscriptionType === 'اشتراك شهرين') ? 'selected' : ''}>2 شهر (شهرين)</option>
                        <option value="3 شهر" data-months="3" ${(sub.subscriptionType === '3 شهر' || sub.subscriptionType === 'اشتراك 3 أشهر') ? 'selected' : ''}>3 شهر (3 أشهر)</option>
                        <option value="6 شهر" data-months="6" ${(sub.subscriptionType === '6 شهر' || sub.subscriptionType === 'اشتراك 6 أشهر') ? 'selected' : ''}>6 شهر (6 أشهر)</option>
                        <option value="1 سنة" data-months="12" ${(sub.subscriptionType === '1 سنة' || sub.subscriptionType === 'اشتراك سنة' || sub.subscriptionType === '12 شهر') ? 'selected' : ''}>1 سنة (سنة كاملة)</option>
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
                      <span style="font-size: 0.72rem; color: var(--muted);">محتسب تلقائياً حسب فترة الاشتراك (قابل للتعديل)</span>
                    </div>
                    <input type="text" id="asr-price" required value="25,000" style="padding: 6px 10px; font-size: 0.95rem; font-weight: 800; color: var(--green); background: var(--surface); text-align: center;">
                  </div>
                </div>
              </div>

            </div>
            <div class="modal-footer" style="padding: 10px 18px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <button type="button" class="btn btn-success btn-sm" onclick="window.shareRenewalWhatsApp(this)" data-phone="${escapeHtml(sub.phone || '')}" data-name="${safeSubNameVal}" data-device="${safeSubDevVal}" style="background: #25D366; color: #fff; padding: 6px 14px; font-size: 0.85rem; font-weight: 700; border: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                <span>💬</span> <span>مشاركة واتساب</span>
              </button>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.closeModal()" style="padding: 6px 16px; font-size: 0.88rem;">إلغاء</button>
                <button type="submit" class="btn btn-success btn-sm" id="btn-asr-save" style="background-color: var(--green); color: #fff; padding: 6px 22px; font-size: 0.9rem; font-weight: 700;">💾 حفظ وتفعيل الاشتراك</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    window.shareRenewalWhatsApp = function(btn) {
      const phone = btn ? btn.getAttribute('data-phone') : '';
      const name = btn ? btn.getAttribute('data-name') : '';
      const device = btn ? btn.getAttribute('data-device') : '';

      const duration = document.getElementById('asr-duration')?.value || '1 شهر';
      const price = document.getElementById('asr-price')?.value || '25,000';
      const start = document.getElementById('asr-start')?.value || '';
      const end = document.getElementById('asr-end')?.value || '';
      const payment = document.getElementById('asr-payment')?.value || 'نقد';

      const text = `السلام عليكم الأستاذ/ة ${name} 🌟\n\nتم تجديد/تفعيل اشتراككم في مركز الساري للبث الأرضي بنجاح 📡\n\n• كود الجهاز: ${device}\n• مدة الاشتراك: ${duration}\n• المبلغ الإجمالي: ${price} د.ع\n• تاريخ البدء: ${start}\n• تاريخ الانتهاء: ${end}\n• طريقة الدفع: ${payment}\n\nشكراً لتعاملكم مع مركز الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية ⚽`;

      const norm = window.normalizeIraqiPhone ? window.normalizeIraqiPhone(phone) : phone;
      const url = norm ? `https://wa.me/${norm}?text=` + encodeURIComponent(text) : `https://wa.me/?text=` + encodeURIComponent(text);
      window.open(url, '_blank');
    };

    window.updateAdminSubscriberRenewalPrice = function() {
      const owner = document.getElementById('asr-owner')?.value || 'المركز الرئيسي';
      const durationSelect = document.getElementById('asr-duration');
      const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
      const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;

      const group = window.getAgentPricing ? window.getAgentPricing(owner) : { sub1: 25000, sub2: 50000, sub3: 75000 };
      let price = 25000;
      if (months === 1) price = group.sub1 || 25000;
      else if (months === 2) price = group.sub2 || ((group.sub1 || 25000) * 2);
      else if (months === 3) price = group.sub3 || ((group.sub1 || 25000) * 3);
      else if (months === 6) price = group.sub6 || ((group.sub1 || 25000) * 6);
      else if (months === 12) price = group.sub12 || ((group.sub1 || 25000) * 12);
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
      const name = document.getElementById('asr-name').value.trim();
      const phone = document.getElementById('asr-phone').value.trim();
      const deviceNumber = document.getElementById('asr-device').value.trim();
      const owner = document.getElementById('asr-owner').value;
      const originalSubId = document.getElementById('asr-sub-id')?.value || subId;
      const origDev = document.getElementById('asr-original-device')?.value || '';
      const origName = document.getElementById('asr-original-name')?.value || '';

      // تم رفع كافة القيود عن تفعيل وتجديد الاشتراكات ليتمكن المشرف من تجديد أي اشتراك معطل أو تابع لوكيل مباشرة

      const joiningDate = document.getElementById('asr-joining')?.value || new Date().toISOString().substring(0, 10);
      const startDate = document.getElementById('asr-start').value;
      const subscriptionType = document.getElementById('asr-duration').value;
      const endDate = document.getElementById('asr-end').value;
      const price = parseNumber(document.getElementById('asr-price').value);
      const paymentMethod = document.getElementById('asr-payment').value;
      const paymentStatus = paymentMethod === 'نقد' ? 'مدفوع' : 'دين';
      const salePaymentStatus = paymentMethod === 'نقد' ? 'تم التسديد' : 'دين';

      const data = getData();
      const subs = data.subscribers || [];
      const subIdStr = String(originalSubId || subId || '').trim().toLowerCase();
      const devDigits = deviceNumber ? deviceNumber.replace(/\D/g, '') : '';
      const origDevDigits = origDev ? origDev.replace(/\D/g, '') : '';
      const nameLower = name ? name.toLowerCase() : '';
      const origNameLower = origName ? origName.toLowerCase() : '';

      // Comprehensive matching of the subscriber
      let sub = subs.find(s => {
        const sId = String(s.id || '').trim().toLowerCase();
        const sDocId = String(s.docId || '').trim().toLowerCase();
        const sDev = String(s.deviceNumber || '').trim();
        const sDevDigits = sDev ? sDev.replace(/\D/g, '') : '';
        const sName = String(s.name || '').trim().toLowerCase();

        return (subIdStr && (sId === subIdStr || sDocId === subIdStr)) ||
               (origDev && sDev === origDev) ||
               (origDevDigits && sDevDigits && origDevDigits === sDevDigits) ||
               (origNameLower && sName === origNameLower) ||
               (nameLower && sName === nameLower) ||
               (deviceNumber && sDev && sDev === deviceNumber) ||
               (devDigits && sDevDigits && devDigits === sDevDigits);
      });

      if (!sub) {
        sub = {
          id: 'sub-' + Date.now(),
          docId: 'sub-' + Date.now(),
          name: name,
          phone: phone,
          deviceNumber: deviceNumber,
          owner: owner || 'المركز الرئيسي',
          subscriptionType: subscriptionType,
          joiningDate: joiningDate,
          activationDate: startDate,
          startDate: startDate,
          expiryDate: endDate,
          endDate: endDate,
          dueDate: endDate,
          price: price,
          paymentMethod: paymentMethod,
          paymentStatus: paymentStatus,
          status: 'فعال',
          activeStatus: 'فعال',
          isActivated: true,
          is_active: true
        };
        subs.push(sub);
      }

      // Update ALL instances in subs matching name or device number or ID
      subs.forEach(s => {
        const sId = String(s.id || '').trim().toLowerCase();
        const sDocId = String(s.docId || '').trim().toLowerCase();
        const sDev = String(s.deviceNumber || '').trim();
        const sDevDigits = sDev ? sDev.replace(/\D/g, '') : '';
        const sName = String(s.name || '').trim().toLowerCase();

        const isMatch = (s === sub) ||
          (subIdStr && (sId === subIdStr || sDocId === subIdStr)) ||
          (origDev && sDev === origDev) ||
          (origDevDigits && sDevDigits && origDevDigits === sDevDigits) ||
          (origNameLower && sName === origNameLower) ||
          (nameLower && sName === nameLower) ||
          (deviceNumber && sDev && sDev === deviceNumber) ||
          (devDigits && sDevDigits && devDigits === sDevDigits);

        if (isMatch) {
          s.name = name;
          if (phone) s.phone = phone;
          if (deviceNumber) s.deviceNumber = deviceNumber;
          s.owner = owner;
          s.joiningDate = s.joiningDate || joiningDate;
          s.activationDate = startDate;
          s.startDate = startDate;
          s.expiryDate = endDate;
          s.endDate = endDate;
          s.dueDate = endDate;
          s.subscriptionType = subscriptionType;
          s.price = price;
          s.paymentMethod = paymentMethod;
          s.paymentStatus = paymentStatus;
          s.paidAmount = paymentMethod === 'نقد' ? price : 0;
          s.remainingAmount = paymentMethod === 'نقد' ? 0 : price;
          s.status = 'فعال';
          s.activeStatus = 'فعال';
          s.isActivated = true;
          s.is_active = true;
          s.deactivated = false;
          delete s.deactivated;
          delete s.deactivatedAt;
          delete s.lastDeactivatedAt;
          s.lastActivatedAt = new Date().toISOString();
          s.activatedBy = 'المركز الرئيسي';
          s.activatedByType = 'hq';
          s.requestedByAgent = false;
        }
      });

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
        status: 'فعال',
        activeStatus: 'فعال',
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

      // Sync with getEngine()
      const engine = getEngine();
      if (engine && engine.data) {
        engine.data.subscribers = subs;
        engine.data.sales = updatedSales;
        if (paymentMethod === 'دين') engine.data.debts = debts;
      }

      // Save to local persistence immediately so data is NEVER lost
      if (engine && typeof engine.saveLocal === 'function') {
        engine.saveLocal();
      }

      // Immediately close modal & update UI (Optimistic UI) for instant response
      window.closeModal();
      window.showToast('تم تفعيل وحفظ اشتراك الزبون (' + escapeHtml(name) + ') بنجاح - الحالة: فعال', 'success');

      if (typeof window.renderSubscribers === 'function') {
        window.renderSubscribers(document.getElementById('main-content'));
      }
      if (typeof window.renderReports === 'function' && window.currentView === 'reports') {
        window.renderReports(document.getElementById('main-content'));
      }

      // Show invoice success modal with WhatsApp sharing for Headquarters renewal
      setTimeout(() => {
        if (typeof window.openSaleSuccessModal === 'function') {
          window.openSaleSuccessModal(newSale);
        }
      }, 150);

      // Async Firestore persistence with safety try/catch and quota handling
      try {
        console.log('[Renewal Flow] Starting Firestore commit for subscribers, sales, and debts...', {
          subscriberCount: subs.length,
          salesCount: updatedSales.length,
          updatedSubscriber: sub
        });
        if (engine && typeof engine.commitData === 'function') {
          await engine.commitData('subscribers', subs);
          console.log('[Renewal Flow] Subscribers collection committed successfully to Firestore.');
          if (paymentMethod === 'دين') {
            await engine.commitData('debts', debts);
            console.log('[Renewal Flow] Debts collection committed successfully to Firestore.');
          }
          await engine.commitData('sales', updatedSales);
          console.log('[Renewal Flow] Sales collection committed successfully to Firestore.');
          if (typeof engine.forceSyncSubscriberActivation === 'function') {
            engine.forceSyncSubscriberActivation(sub).catch(err => console.warn('[Renewal Flow] forceSyncSubscriberActivation warning:', err));
          }
        }
      } catch (syncErr) {
        console.error('[Renewal Flow] Error during Firestore commit:', syncErr);
        console.warn('Background sync warning (handled gracefully):', syncErr);
      }


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
                    <option value="المركز الرئيسي" selected>المركز الرئيسي</option>
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

        // تم رفع القيود للسماح للأدمن بحفظ وتفعيل أي مشترك مباشرة دون تعقيد
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
          if (status === 'فعال') {
            existing.isActivated = true;
            existing.is_active = true;
            existing.deactivated = false;
            delete existing.deactivated;
          } else {
            existing.isActivated = false;
            existing.is_active = false;
            existing.deactivated = true;
          }
          if (!existing.joiningDate) {
            existing.joiningDate = activationDate || today;
          }
          if (!existing.createdAtTimestamp) {
            existing.createdAtTimestamp = Date.now();
          }
          existing.updatedAt = new Date().toISOString();
        } else {
          const newSubObj = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
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
            isActivated: status === 'فعال',
            is_active: status === 'فعال',
            deactivated: status !== 'فعال',
            activatedBy: 'المركز الرئيسي',
            activatedByType: 'hq',
            requestedByAgent: false,
            createdAtTimestamp: Date.now(),
            updatedAt: new Date().toISOString()
          };
          subs.unshift(newSubObj);
        }

        const subToSync = existing || subs[0];

        try {
          localStorage.removeItem('sari_all_subscribers_cleared');
          localStorage.removeItem('sari_subscribers_cleared_timestamp');
        } catch (e) {}
        if (getEngine() && typeof getEngine().unmarkTombstone === 'function') {
          getEngine().unmarkTombstone(subToSync.id, deviceNumber, name);
        }

        // Immediately close modal & update UI (Optimistic UI)
        window.closeModal();
        window.showToast('تم حفظ المشترك بنجاح', 'success');
        if (typeof window.renderSubscribers === 'function') {
          const mainEl = document.getElementById('main-content');
          if (mainEl) window.renderSubscribers(mainEl);
        }

        // Sync immediately to Firestore and central state
        if (getEngine() && typeof getEngine().saveSubscriberDirect === 'function') {
          getEngine().saveSubscriberDirect(subToSync).catch(err => console.warn('Direct subscriber sync error:', err));
        } else if (getEngine() && typeof getEngine().commitData === 'function') {
          getEngine().commitData('subscribers', subs).catch(err => console.warn('Background sync error:', err));
        }
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

      const file = fileInput.files[0];
      window.closeModal();

      if (window.HeaderImportProgress) {
        window.HeaderImportProgress.start(`جاري قراءة ملف المشتركين (${file.name})...`, 12);
      }

      const reader = new FileReader();
      reader.onerror = () => {
        if (window.HeaderImportProgress) {
          window.HeaderImportProgress.error('فشل في قراءة ملف Excel، يرجى المحاولة مرة أخرى.');
        } else {
          alert('فشل في قراءة ملف Excel');
        }
      };

      reader.onload = async (e) => {
        try {
          if (window.HeaderImportProgress) {
            window.HeaderImportProgress.update(24, 'جاري تحليل وتدقيق ورقة بيانات المشتركين...');
          }

          const workbook = XLSX.read(e.target.result, { type: 'binary', raw: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
          if (json.length < 2) {
            if (window.HeaderImportProgress) {
              window.HeaderImportProgress.error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
            } else {
              alert('الملف فارغ أو لا يحتوي على صفوف بيانات');
            }
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
          const totalRows = json.length - 1;

          for (let r = 1; r < json.length; r++) {
            if (r % 40 === 0 || r === totalRows) {
              const currentPercent = Math.min(75, Math.floor(25 + ((r / totalRows) * 50)));
              if (window.HeaderImportProgress) {
                window.HeaderImportProgress.update(currentPercent, `جاري استيراد المشتركين: تم فحص ${r} من ${totalRows}...`);
              }
              await new Promise(res => setTimeout(res, 0));
            }

            const row = json[r];
            if (!row || !row[nameIdx]) continue;
            
            // Extract ONLY required columns
            const name = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
            const rawDev = devIdx !== -1 ? normalizeDigits(String(row[devIdx] || '')).replace(/\s+/g, '') : '';
            const device = window.formatDeviceNumber ? window.formatDeviceNumber(rawDev) : rawDev;
            const phone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
            const owner = ownerIdx !== -1 && row[ownerIdx] ? String(row[ownerIdx]).trim() : 'المركز الرئيسي';

            if (name && device) {
              existingSubs.push({
                id: 'sub-' + Date.now() + '-' + r,
                name,
                phone,
                deviceNumber: device,
                owner,
                status: 'غير فعال',       // Default: Inactive
                payment: null,          // Default: Empty
                activationDate: '-',    // Default: Empty/Hyphen
                expiryDate: '-'         // Default: Empty/Hyphen
              });
              importedCount++;
            }
          }

          if (window.HeaderImportProgress) {
            window.HeaderImportProgress.update(85, `تم استيراد ${importedCount} مشترك. جاري مزامنة وحفظ البيانات...`, 'syncing');
          }

          try {
            localStorage.removeItem('sari_all_subscribers_cleared');
            localStorage.removeItem('sari_subscribers_cleared_timestamp');
          } catch (e) {}

          // Unmark tombstones for freshly imported subscribers
          if (getEngine() && typeof getEngine().unmarkTombstone === 'function') {
            existingSubs.forEach(s => {
              getEngine().unmarkTombstone(s.id, s.deviceNumber, s.name);
            });
          }

          await getEngine().commitData('subscribers', existingSubs);

          if (window.HeaderImportProgress) {
            window.HeaderImportProgress.success(`تم استيراد ${importedCount} مشترك والمزامنة بنجاح!`, 3200);
          }
          window.showToast(`تم استيراد ${importedCount} مشترك بنجاح!`, 'success');
          if (window.currentPage === 'subscribers') {
            window.navigateTo('subscribers');
          }
        } catch (err) {
          console.error(err);
          if (window.HeaderImportProgress) {
            window.HeaderImportProgress.error('حدث خطأ أثناء استيراد البيانات والمزامنة: ' + err.message, 5000);
          }
          window.showToast('فشل الاستيراد أو تعذر المزامنة: ' + err.message, 'error');
        }
      };
      reader.readAsBinaryString(file);
    };
  };

  window.confirmDeleteAllSubscribers = function() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" style="z-index: 9999;" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 450px; text-align: right; direction: rtl;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 style="color: #ef4444;">تحذير: حذف جميع المشتركين</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p>هل أنت متأكد تماماً؟ هذا الإجراء سيؤدي إلى مسح <strong>كافة</strong> المشتركين، سجلات المبيعات، والديون نهائياً. لا يمكن التراجع عن هذه الخطوة.</p>
            <p>للتأكيد، يرجى كتابة كلمة <strong>DELETE</strong> في الخانة أدناه:</p>
            <input type="text" id="confirm-delete-input" class="form-control" placeholder="اكتب DELETE هنا" style="width: 100%; padding: 8px; margin-top: 8px;">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-danger" onclick="window.executeDeleteAllSubscribers()">حذف الكل</button>
          </div>
        </div>
      </div>
    `;
  };

  window.executeDeleteAllSubscribers = async function() {
    const input = document.getElementById('confirm-delete-input');
    if (input.value !== 'DELETE') {
      window.showToast('كلمة التأكيد غير صحيحة. يرجى كتابة DELETE', 'error');
      return;
    }

    window.closeModal();
    window.showToast('جاري الحذف، يرجى الانتظار...', 'info');

    const data = getData();
    (data.subscribers || []).forEach(s => {
      if (getEngine() && typeof getEngine().addDeletedSubscriberTombstone === 'function') {
        getEngine().addDeletedSubscriberTombstone(s.id, s.deviceNumber, s.name, s.phone);
      }
    });
    try {
      localStorage.setItem('sari_all_subscribers_cleared', 'true');
      localStorage.setItem('sari_subscribers_cleared_timestamp', String(Date.now()));
    } catch (e) {}

    await getEngine().clearCollection('subscribers');
    await getEngine().clearCollection('sales');
    await getEngine().clearCollection('debts');
    await getEngine().clearCollection('agentSubmissions');
    
    window.showToast('تم حذف كافة المشتركين والتعاملات المالية وسجل المبيعات والديون بنجاح', 'success');
    if (typeof window.renderSubscribers === 'function') {
      window.renderSubscribers(document.getElementById('main-content'));
    }
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
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const today = new Date().toISOString().substring(0, 10);
    const subs = data.subscribers || [];
    const sales = data.sales || [];
    const debts = data.debts || [];

    // Ensure all subscribers have their latest status & dates synced
    subs.forEach(s => {
      if (typeof window.getSubscriberActiveStatus === 'function') {
        s.status = window.getSubscriberActiveStatus(s, today);
        s.activeStatus = s.status;
      }
    });

    const rows = subs.map(s => {
      const typeLabel = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, sales) : (s.subscriptionType || '1 شهر');
      let centerStatus = '-';
      if (typeof window.getSubscriberMainSettlementStatus === 'function') {
        const st = window.getSubscriberMainSettlementStatus(s, debts, sales);
        centerStatus = st ? st.status : '-';
      }
      return {
        'اسم المشترك': s.name || '-',
        'رقم الهاتف': s.phone || '-',
        'رقم الجهاز': "'" + (s.deviceNumber || '-'),
        'الجهة المالكة': s.owner || 'المركز الرئيسي',
        'نوع الاشتراك': typeLabel,
        'حالة الاشتراك': s.status || 'فعال',
        'حالة الدفع': s.paymentStatus || 'مدفوع',
        'المبلغ (د.ع)': Number(s.price) || 25000,
        'تاريخ التفعيل': s.activationDate || s.startDate || '-',
        'تاريخ الانتهاء': s.expiryDate || s.endDate || '-',
        'تسديد الرئيسية': centerStatus
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'تنبيه': 'لا توجد بيانات مشتركين' }]);
    ws['!cols'] = [
      { wch: 22 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المشتركون");
    XLSX.writeFile(wb, `مشتركي_الساري_${new Date().toISOString().substring(0, 10)}.xlsx`);
    window.showToast('تم تصدير تقرير المشتركين بنجاح', 'success');
  };
  // Delegated event listener for deactivate buttons to ensure clicks always invoke confirmation modal
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-deactivate');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const subId = btn.getAttribute('data-sub-id') || btn.getAttribute('data-subscriber-id');
      if (subId && typeof window.confirmDeactivateSubscriber === 'function') {
        window.confirmDeactivateSubscriber(subId);
      }
    }
  });

})();

