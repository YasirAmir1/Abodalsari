/**
 * Reports, Pricing, Users, Agent Dashboard, and Firebase Config Tools
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

  // --- Agent Target & Prize Handlers ---
  window.onTargetAgentSelected = function(agentId) {
    window._lastSelectedTargetAgentId = agentId;
    const data = getData();
    const agents = data.agents || [];
    const targets = data.agentTargets || [];
    const agent = agents.find(a => a.id === agentId);
    const targetObj = targets.find(t => t.agentId === agentId || t.id === agentId);

    const goalInput = document.getElementById('target-agent-goal');
    const prizeInput = document.getElementById('target-agent-prize');
    const notesInput = document.getElementById('target-agent-notes');

    if (goalInput) goalInput.value = (agent && agent.target) || (targetObj && targetObj.target) || '';
    if (prizeInput) prizeInput.value = (agent && agent.prize) || (targetObj && targetObj.prize) || '';
    if (notesInput) notesInput.value = (agent && (agent.notes || agent.targetNotes)) || (targetObj && targetObj.notes) || '';
  };

  window.editAgentTargetQuick = function(agentId) {
    const select = document.getElementById('target-agent-select');
    if (select) {
      select.value = agentId;
      window.onTargetAgentSelected(agentId);
      select.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const goalInput = document.getElementById('target-agent-goal');
      if (goalInput) {
        goalInput.focus();
        goalInput.select();
      }
    }
  };

  window.saveAgentTargetAndPrize = async function() {
    const select = document.getElementById('target-agent-select');
    if (!select || !select.value) {
      showToast('يرجى تحديد الوكيل أولاً', 'warning');
      return;
    }
    const agentId = select.value;
    const goal = (document.getElementById('target-agent-goal')?.value || '').trim();
    const prize = (document.getElementById('target-agent-prize')?.value || '').trim();
    const notes = (document.getElementById('target-agent-notes')?.value || '').trim();

    const engine = getEngine();
    const data = getData();
    const agents = data.agents || [];
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      showToast('الوكيل المحدد غير موجود في النظام', 'error');
      return;
    }

    const now = new Date().toISOString();
    agent.target = goal;
    agent.prize = prize;
    agent.notes = notes;
    agent.targetNotes = notes;
    agent.targetUpdatedAt = now;

    let targets = data.agentTargets || [];
    const targetIndex = targets.findIndex(t => t.agentId === agentId || t.id === agentId);
    const targetRecord = {
      id: agentId,
      agentId: agentId,
      agentName: agent.name,
      agentCode: agent.code || '',
      target: goal,
      prize: prize,
      notes: notes,
      updatedAt: now
    };

    if (targetIndex >= 0) {
      targets[targetIndex] = targetRecord;
    } else {
      targets.push(targetRecord);
    }

    window._lastSelectedTargetAgentId = agentId;

    try {
      await engine.commitData('agents', agents);
      await engine.commitData('agentTargets', targets);
      showToast(`تم حفظ وتثبيت هدف ومكافأة الوكيل (${agent.name}) بنجاح`, 'success');
      
      const mainEl = document.getElementById('main-content');
      if (mainEl && window.renderReports) {
        window.renderReports(mainEl);
      }
    } catch (err) {
      console.error('Error saving agent target:', err);
      showToast('تعذر حفظ بيانات الهدف في قاعدة البيانات', 'error');
    }
  };

  // --- Page 7: Reports ---
  window.renderReports = function(container) {
    const today = new Date().toISOString().substring(0, 10);
    const firstDayMonth = today.substring(0, 8) + '01';
    const engine = getEngine();
    const data = getData();
    const agents = data.agents || [];
    const targets = data.agentTargets || [];

    let selectedAgent = agents.find(a => a.id === window._lastSelectedTargetAgentId) || agents[0] || null;
    let selectedTargetObj = selectedAgent ? (targets.find(t => t.agentId === selectedAgent.id || t.id === selectedAgent.id) || null) : null;
    let currentGoal = (selectedAgent && selectedAgent.target) || (selectedTargetObj && selectedTargetObj.target) || '';
    let currentPrize = (selectedAgent && selectedAgent.prize) || (selectedTargetObj && selectedTargetObj.prize) || '';
    let currentNotes = (selectedAgent && (selectedAgent.notes || selectedAgent.targetNotes)) || (selectedTargetObj && selectedTargetObj.notes) || '';

    const currentWhatsAppTemplate = engine?.data?.templates?.whatsapp || window.DEFAULT_WHATSAPP_TEMPLATE || `السلام عليكم ورحمة الله

• المشترك: «اسم الزبون»🌟

تمت عملية «تجديد اشتراك» بنجاح.
• المدة: «مدة تجديد اشتراك»
• المبلغ: «المبلغ» د.ع
• المدفوع: «المبلغ المدفوع» د.ع
• المتبقي: «المبلغ المتبقي» د.ع
• تاريخ الانتهاء: «تاريخ انتهاء الاشتراك»

شكراً لثقتكم — الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية 📡`;

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">تقارير النشاط والبيانات المالية</span>
            <h1>التقارير والاهداف</h1>
            <p class="subtitle">توليد تقارير الأداء المالي، سجل المبيعات، وموقف ديون الوكلاء مع تصفية النطاق الزمني والتصدير</p>
          </div>
        </div>

        <!-- 1. Top Section on Reports & Targets Page: Agent Target & Prize Management Box -->
        <div class="content-card" style="margin-bottom: 24px; padding: 22px 24px; border: 1px solid var(--line); border-top: 4px solid var(--primary); background: var(--card-bg); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.5rem;">🎯</span>
                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text);">إدارة أهداف وجوائز الوكلاء</h2>
              </div>
              <p style="margin: 4px 0 0 0; color: var(--text-sub); font-size: 0.88rem;">
                تحديد الهدف المخصص لكل وكيل مع المكافأة المستحقة وحالة الإنجاز، مع حفظها تلقائياً في قاعدة البيانات لتظهر حصرياً لكل وكيل في صفحته.
              </p>
            </div>
            <span class="badge badge-primary" style="font-size: 0.82rem; padding: 6px 12px; font-weight: 700;">
              👥 إجمالي الوكلاء: ${agents.length}
            </span>
          </div>

          <div style="background: var(--surface); padding: 18px 20px; border-radius: var(--radius-md); border: 1px solid var(--line); margin-bottom: 18px;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
              <!-- Agent Selection -->
              <div class="form-group" style="margin: 0;">
                <label style="display: block; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; color: var(--text);">
                  👤 اختر الوكيل:
                </label>
                <select id="target-agent-select" class="form-input" style="width: 100%; font-size: 0.95rem; font-weight: 600;" onchange="window.onTargetAgentSelected(this.value)">
                  ${agents.map((ag, idx) => `
                    <option value="${escapeHtml(ag.id)}" ${(selectedAgent && selectedAgent.id === ag.id) || (!selectedAgent && idx === 0) ? 'selected' : ''}>
                      ${escapeHtml(ag.name)} (${escapeHtml(ag.code || 'بدون كود')}) ${ag.phone ? ` - ${escapeHtml(ag.phone)}` : ''}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Agent Target: A designated target for each specific agent -->
              <div class="form-group" style="margin: 0;">
                <label style="display: block; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; color: var(--text);">
                  🎯 الهدف المحدد للوكيل (Agent Target):
                </label>
                <input type="text" id="target-agent-goal" class="form-input" placeholder="اكتب الهدف المطلوب تحقيقه (مثال: تحقيق 50 اشتراك جديد أو بيع 30 جهاز)..." value="${escapeHtml(currentGoal)}" style="font-size: 0.92rem;">
              </div>

              <!-- Prize/Reward: A text field beneath the target where the Admin writes the prize the agent will receive upon achieving that target -->
              <div class="form-group" style="margin: 0;">
                <label style="display: block; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; color: var(--green);">
                  🎁 المكافأة / الجائزة المستحقة (Prize/Reward):
                </label>
                <input type="text" id="target-agent-prize" class="form-input" placeholder="اكتب الجائزة أو المكافأة التي سينالها الوكيل عند تحقيق الهدف (مثال: مكافأة مالية 150,000 د.ع + درع تميز)..." value="${escapeHtml(currentPrize)}" style="font-size: 0.92rem;">
              </div>

              <!-- Achievement Status / Notes: A field below the prize written by the Admin -->
              <div class="form-group" style="margin: 0;">
                <label style="display: block; font-weight: 700; font-size: 0.88rem; margin-bottom: 6px; color: var(--text-sub);">
                  📝 حالة الإنجاز / ملاحظات المشرف (Achievement Status / Notes):
                </label>
                <textarea id="target-agent-notes" class="form-input" rows="2" placeholder="اكتب حالة الإنجاز أو ملاحظات الإدارة الخاصة بهذا الوكيل (مثال: قيد التنفيذ - تم تحقيق 35 اشتراك حتى الآن)..." style="font-size: 0.9rem; resize: vertical;">${escapeHtml(currentNotes)}</textarea>
              </div>

              <!-- Save Button to persist targets, prizes, and details into database -->
              <div style="display: flex; justify-content: flex-start; gap: 10px; margin-top: 4px;">
                <button type="button" class="btn btn-primary" onclick="window.saveAgentTargetAndPrize()" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; font-weight: 700; font-size: 0.95rem;">
                  <span>💾</span> <span>حفظ الهدف والمكافأة في قاعدة البيانات</span>
                </button>
              </div>
            </div>
          </div>

          <!-- All Agents Targets Table for Admin -->
          <div style="margin-top: 10px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 6px;">
              <span>📋</span> <span>سجل أهداف وجوائز جميع الوكلاء المعتمدين:</span>
            </h4>
            <div class="table-responsive" style="border: 1px solid var(--line); border-radius: var(--radius-md);">
              <table class="table" style="margin: 0; font-size: 0.88rem;">
                <thead>
                  <tr style="background: var(--surface);">
                    <th style="padding: 10px 14px;">الوكيل</th>
                    <th style="padding: 10px 14px;">🎯 الهدف المحدد</th>
                    <th style="padding: 10px 14px;">🎁 الجائزة / المكافأة</th>
                    <th style="padding: 10px 14px;">📝 حالة الإنجاز / ملاحظات</th>
                    <th style="padding: 10px 14px; text-align: center;">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  ${agents.length === 0 ? `
                    <tr><td colspan="5" style="text-align: center; padding: 18px; color: var(--muted);">لا يوجد وكلاء مسجلون حالياً</td></tr>
                  ` : agents.map(ag => {
                    const agTarget = ag.target || (targets.find(t => t.agentId === ag.id)?.target || '');
                    const agPrize = ag.prize || (targets.find(t => t.agentId === ag.id)?.prize || '');
                    const agNotes = (ag.notes || ag.targetNotes) || (targets.find(t => t.agentId === ag.id)?.notes || '');
                    return `
                      <tr>
                        <td style="padding: 10px 14px;">
                          <strong>${escapeHtml(ag.name)}</strong>
                          <div style="font-size: 0.78rem; color: var(--muted);">${escapeHtml(ag.code || 'وكيل')} ${ag.phone ? `· ${escapeHtml(ag.phone)}` : ''}</div>
                        </td>
                        <td style="padding: 10px 14px;">
                          ${agTarget ? `<span style="font-weight: 700; color: var(--primary);">${escapeHtml(agTarget)}</span>` : '<span style="color: var(--muted);">غير محدد</span>'}
                        </td>
                        <td style="padding: 10px 14px;">
                          ${agPrize ? `<span class="badge badge-success" style="font-size: 0.8rem; font-weight: 700;">🎁 ${escapeHtml(agPrize)}</span>` : '<span style="color: var(--muted);">غير محددة</span>'}
                        </td>
                        <td style="padding: 10px 14px; max-width: 250px;">
                          ${agNotes ? `<span style="color: var(--text);">${escapeHtml(agNotes)}</span>` : '<span style="color: var(--muted);">-</span>'}
                        </td>
                        <td style="padding: 10px 14px; text-align: center;">
                          <button class="btn btn-secondary btn-sm" onclick="window.editAgentTargetQuick('${escapeHtml(ag.id)}')" style="padding: 4px 10px; font-size: 0.8rem;">
                            ✏️ تعديل
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Date Range Filter Bar -->
        <div class="content-card" style="margin-bottom: 24px; padding: 18px 24px; background: var(--card-bg);">
          <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span style="font-weight: 700; color: var(--green); display: flex; align-items: center; gap: 6px;">
                <span>📅</span> <span>تصفية حسب النطاق الزمني:</span>
              </span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 0.85rem; color: var(--muted);">من تاريخ:</label>
                <input type="date" id="rep-start-date" value="${firstDayMonth}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface-alt); font-size: 0.9rem;">
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 0.85rem; color: var(--muted);">إلى تاريخ:</label>
                <input type="date" id="rep-end-date" value="${today}" style="padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface-alt); font-size: 0.9rem;">
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('rep-start-date').value=''; document.getElementById('rep-end-date').value=''; showToast('تم إزالة تصفية التاريخ', 'info');">إلغاء التصفية</button>
              <button class="btn btn-success btn-sm" onclick="exportFinancialBackupExcel({ filtered: true })" style="background: #107c41; color: #ffffff; border: 1px solid #0e6b38; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 4px rgba(16,124,65,0.3);">
                <span>📊</span> <span>تصدير نسخة احتياطية مالية (Excel)</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="exportFullBackupJSON()">📦 نسخة كاملة (JSON)</button>
            </div>
          </div>
        </div>

        <!-- Dedicated SheetJS Financial Backup Card -->
        <div class="content-card" style="margin-bottom: 24px; padding: 22px 24px; border: 2px solid #107c41; background: linear-gradient(135deg, rgba(16, 124, 65, 0.08) 0%, rgba(16, 124, 65, 0.02) 100%); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="display: flex; align-items: flex-start; gap: 14px;">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: #107c41; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(16, 124, 65, 0.35);">
                📊
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #107c41;">نسخة احتياطية للبيانات المالية - Excel (SheetJS)</h2>
                  <span class="badge" style="background: #107c41; color: white; font-weight: 700; font-size: 0.78rem; padding: 4px 10px; border-radius: 12px;">مُصنّف متعدد الأوراق Multi-Sheet</span>
                </div>
                <p style="margin: 6px 0 0 0; color: var(--text-sub); font-size: 0.9rem; line-height: 1.6; max-width: 850px;">
                  توليد ملف Excel احترافي متكامل باستخدام مكتبة SheetJS لحفظ نسخة احتياطية مالية دقيقة تتضمن: 
                  <strong>الملخص المالي التنفيذي، سجل المبيعات والاشتراكات، تفاصيل ديون الزبائن والوكلاء، أرصدة وحسابات الوكلاء، حركات تسديدات الصندوق، وقاعدة المشتركين</strong>، لتسهيل الاحتفاظ بنسخ احتياطية دورية آمنة ومراجعتها في Microsoft Excel.
                </p>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
              <button type="button" class="btn btn-success" onclick="exportFinancialBackupExcel({ filtered: true })" style="background: #107c41; color: white; border: none; font-weight: 700; padding: 10px 18px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(16, 124, 65, 0.35); font-size: 0.92rem; cursor: pointer;">
                <span>📅</span> <span>تصدير نسخة مالية للفترة المحددة</span>
              </button>
              <button type="button" class="btn btn-secondary" onclick="exportFinancialBackupExcel({ filtered: false })" style="font-weight: 700; padding: 10px 18px; border-radius: var(--radius-md); display: inline-flex; align-items: center; gap: 8px; font-size: 0.92rem; cursor: pointer;">
                <span>🗄️</span> <span>تصدير كافة السجلات التاريخية (Excel)</span>
              </button>
            </div>
          </div>

          <!-- Quick financial overview for backup -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(16, 124, 65, 0.25);">
            <div style="background: var(--card-bg); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
              <div style="font-size: 0.78rem; color: var(--muted); font-weight: 600;">💰 إجمالي المبيعات المسجلة</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: #107c41; margin-top: 2px;">${formatIQD((data.sales || []).reduce((sum, s) => sum + (Number(s.price) || 0), 0))}</div>
            </div>
            <div style="background: var(--card-bg); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
              <div style="font-size: 0.78rem; color: var(--muted); font-weight: 600;">⏳ إجمالي الديون القائمة</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--danger); margin-top: 2px;">${formatIQD((data.debts || []).reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0))}</div>
            </div>
            <div style="background: var(--card-bg); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
              <div style="font-size: 0.78rem; color: var(--muted); font-weight: 600;">👥 عدد الوكلاء المعتمدين</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--primary); margin-top: 2px;">${(data.agents || []).length} وكيل</div>
            </div>
            <div style="background: var(--card-bg); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--line);">
              <div style="font-size: 0.78rem; color: var(--muted); font-weight: 600;">📡 إجمالي المشتركين</div>
              <div style="font-size: 1.05rem; font-weight: 800; color: var(--text); margin-top: 2px;">${(data.subscribers || []).length} مشترك</div>
            </div>
          </div>
        </div>

        <div class="report-grid">
          <!-- Report 1: Subscribers -->
          <div class="report-card">
            <div style="font-size: 2.2rem; margin-bottom: 4px;">👥</div>
            <h3>تقرير وتصدير المشتركين</h3>
            <p style="color: var(--text-sub); font-size: 0.9rem;">
              تصدير بيانات المشتركين وتواريخ اشتراكهم وتفعيلهم حسب النطاق الزمني المحدد بصيغتي JSON أو Excel.
            </p>
            <div style="margin-top: auto; display: flex; gap: 8px; width: 100%; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="exportSubscribersExcel()" style="flex: 1;">تنزيل Excel</button>
              <button class="btn btn-primary btn-sm" onclick="exportSubscribersJSON()" style="flex: 1;">تنزيل JSON</button>
            </div>
          </div>

          <!-- Report 2: Sales -->
          <div class="report-card">
            <div style="font-size: 2.2rem; margin-bottom: 4px;">📈</div>
            <h3>تقرير المبيعات والاشتراكات</h3>
            <p style="color: var(--text-sub); font-size: 0.9rem;">
              تصدير سجل المبيعات والاشتراكات وحركات الأجهزة للوكلاء والمركز الرئيسي ضمن النطاق الزمني المحدد.
            </p>
            <div style="margin-top: auto; display: flex; gap: 8px; width: 100%; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="exportReportsSalesExcel()" style="flex: 1;">تنزيل Excel</button>
              <button class="btn btn-primary btn-sm" onclick="exportSalesJSON()" style="flex: 1;">تنزيل JSON</button>
            </div>
          </div>

          <!-- Report 3: Debts -->
          <div class="report-card">
            <div style="font-size: 2.2rem; margin-bottom: 4px;">⏳</div>
            <h3>تقرير الديون والمستحقات</h3>
            <p style="color: var(--text-sub); font-size: 0.9rem;">
              تقرير شامل بجميع المبالغ المتبقية في ذمة الزبائن والوكلاء وتواريخ الاستحقاق.
            </p>
            <div style="margin-top: auto; display: flex; gap: 8px; width: 100%;">
              <button class="btn btn-secondary btn-sm" onclick="exportDebtsExcel()" style="flex: 1;">تنزيل Excel</button>
              <button class="btn btn-primary btn-sm" onclick="window.print()" style="flex: 1;">طباعة / PDF</button>
            </div>
          </div>

          <!-- Report 4: Agents -->
          <div class="report-card">
            <div style="font-size: 2.2rem; margin-bottom: 4px;">🏆</div>
            <h3>تقرير حركة الوكلاء والتسديدات</h3>
            <p style="color: var(--text-sub); font-size: 0.9rem;">
              تقرير إحصائي لحجم مبيعات كل وكيل، رصيد الديون، وسجل التسديدات الدورية.
            </p>
            <div style="margin-top: auto; display: flex; gap: 8px; width: 100%;">
              <button class="btn btn-secondary btn-sm" onclick="exportAgentsExcel()" style="flex: 1;">تنزيل Excel</button>
              <button class="btn btn-primary btn-sm" onclick="window.print()" style="flex: 1;">طباعة / PDF</button>
            </div>
          </div>
        </div>

        <!-- WhatsApp Message Customization Template Section -->
        <div class="content-card" style="margin-top: 28px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--card-bg); box-shadow: var(--shadow-sm);">
          <div class="card-header-bar" style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 1.8rem; background: rgba(37, 211, 102, 0.15); color: #25D366; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">💬</span>
              <div>
                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text);">نموذج تخصيص رسالة الواتساب للمشتركين</h3>
                <p style="margin: 3px 0 0 0; font-size: 0.88rem; color: var(--muted);">
                  تخصيص نص الرسالة التي تُرسل تلقائياً للزبائن والوكلاء عند تسجيل المبيعات أو تجديد الاشتراك
                </p>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="resetWhatsAppTemplate()">
                <span>🔄</span> <span>استعادة النص الافتراضي</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="saveWhatsAppTemplate()">
                <span>💾</span> <span>حفظ النموذج</span>
              </button>
            </div>
          </div>

          <div style="background: var(--surface-alt); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 16px; font-size: 0.9rem; line-height: 1.6; border: 1px dashed var(--line);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <strong style="color: var(--green); display: flex; align-items: center; gap: 6px;">
                <span>✨</span> <span>المتغيرات التلقائية المتاحة (انقر على أي متغير لإدراجه في نص الرسالة):</span>
              </strong>
              <small style="color: var(--muted);">يتم استبدال كل رمز تلقائياً ببيانات المشترك الحقيقية</small>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="template-tags-container">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«اسم الزبون»')">«اسم الزبون»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«تجديد اشتراك»')">«تجديد اشتراك»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«مدة تجديد اشتراك»')">«مدة تجديد اشتراك»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«المبلغ»')">«المبلغ»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«المبلغ المدفوع»')">«المبلغ المدفوع»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«المبلغ المتبقي»')">«المبلغ المتبقي»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«تاريخ انتهاء الاشتراك»')">«تاريخ انتهاء الاشتراك»</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.82rem; padding: 4px 10px;" onclick="insertTagIntoTemplate('«رقم الجهاز»')">«رقم الجهاز»</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-weight: 700; margin-bottom: 8px; display: block; color: var(--text);">نص رسالة الواتساب:</label>
            <textarea id="wa-template-input" rows="12" style="width: 100%; padding: 14px 16px; font-size: 0.95rem; line-height: 1.8; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg); color: var(--text); resize: vertical; direction: rtl; font-family: inherit; box-sizing: border-box;">${currentWhatsAppTemplate}</textarea>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 14px;">
            <button class="btn btn-secondary" onclick="previewWhatsAppTemplate()">
              <span>👁️</span> <span>معاينة الرسالة ببيانات افتراضية</span>
            </button>
            <button class="btn btn-primary" onclick="saveWhatsAppTemplate()">
              <span>💾</span> <span>حفظ نموذج الرسالة وتطبيقه في النظام</span>
            </button>
          </div>

          <!-- Preview Box -->
          <div id="wa-preview-box" style="display: none; margin-top: 18px; padding: 16px 20px; border-radius: var(--radius-md); background: #e7fedc; color: #111b21; border: 1px solid #b7ebb1; white-space: pre-wrap; font-size: 0.95rem; line-height: 1.8; direction: rtl; box-shadow: var(--shadow-sm);"></div>
        </div>
      </div>
    `;
  };

  window.insertTagIntoTemplate = function(tag) {
    const textarea = document.getElementById('wa-template-input');
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + tag + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  };

  window.saveWhatsAppTemplate = async function() {
    const textarea = document.getElementById('wa-template-input');
    if (!textarea) return;
    const val = textarea.value.trim();
    if (!val) {
      window.showToast('يرجى كتابة نص النموذج قبل الحفظ', 'error');
      return;
    }
    const engine = getEngine();
    if (!engine) return;
    const currentTemplates = engine.data.templates || {};
    const updated = {
      ...currentTemplates,
      id: 'main-templates',
      whatsapp: val,
      updatedAt: new Date().toISOString()
    };
    await engine.commitData('templates', updated);
    window.showToast('تم حفظ نموذج رسالة الواتساب بنجاح وتحديثه في النظام', 'success');
  };

  window.resetWhatsAppTemplate = function() {
    const textarea = document.getElementById('wa-template-input');
    if (textarea) {
      textarea.value = window.DEFAULT_WHATSAPP_TEMPLATE;
      window.showToast('تم استعادة النموذج الافتراضي، اضغط "حفظ النموذج" لتأكيد التغيير', 'info');
      const previewBox = document.getElementById('wa-preview-box');
      if (previewBox && previewBox.style.display !== 'none') {
        window.previewWhatsAppTemplate();
      }
    }
  };

  window.previewWhatsAppTemplate = function() {
    const textarea = document.getElementById('wa-template-input');
    const previewBox = document.getElementById('wa-preview-box');
    if (!textarea || !previewBox) return;
    const tpl = textarea.value;
    const sampleSale = {
      customerName: 'حيدر الكرخي',
      saleType: 'تجديد اشتراك',
      subscriptionType: 'اشتراك شهر واحد',
      price: 18000,
      paymentStatus: 'تم التسديد',
      agentPaid: 18000,
      endDate: '2026-11-04',
      deviceNumber: '1029384756102938'
    };
    const rendered = typeof window.formatWhatsAppMessage === 'function' ? 
      window.formatWhatsAppMessage(sampleSale, tpl) : tpl;
    previewBox.style.display = 'block';
    previewBox.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.15); padding-bottom: 6px;">
        <strong style="color: #0b6b2b; display: flex; align-items: center; gap: 6px;">
          <span>📱</span> <span>معاينة واقعية لشكل الرسالة في تطبيق WhatsApp:</span>
        </strong>
        <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 2px 8px;" onclick="document.getElementById('wa-preview-box').style.display='none'">إغلاق المعاينة ✕</button>
      </div>
      <div>${rendered.replace(/\n/g, '<br>')}</div>
    `;
  };

  function filterByDate(items, dateField, start, end) {
    if (!start && !end) return items;
    return items.filter(item => {
      const d = item[dateField];
      if (!d) return true;
      const dateStr = d.substring(0, 10);
      if (start && dateStr < start) return false;
      if (end && dateStr > end) return false;
      return true;
    });
  }

  window.compareAgentsAndUsers = function() {
    const data = getData();
    const agents = data.agents || [];
    const users = (data.users || []).filter(u => u.role !== 'admin' && u.username !== 'admin' && u.username !== 'abodsari');
    
    const missingUsers = agents.filter(a => !users.some(u => 
        u.username === a.username || 
        u.uid === a.id || 
        u.agentCode === a.code ||
        u.name === a.name
    ));
    
    const missingAgents = users.filter(u => !agents.some(a => 
        a.username === u.username || 
        a.id === u.uid || 
        a.code === u.agentCode ||
        a.name === u.name
    ));
    
    console.log("Agents without matching User:", missingUsers);
    console.log("Users without matching Agent:", missingAgents);
    
    let message = `نتائج المقارنة:\n\nوكلاء بدون مستخدم مطابق: ${missingUsers.length}\nمستخدمون بدون وكيل مطابق: ${missingAgents.length}\n\nيرجى مراجعة الـ Console للتفاصيل.`;
    alert(message);
  };

  window.togglePasswordVisibility = function(id, password) {
    const el = document.getElementById(`pass-${id}`);
    if (el) {
      if (el.textContent === '••••••••') {
        el.textContent = password;
      } else {
        el.textContent = '••••••••';
      }
    }
  };

  window.clearAllDataUI = async function() {
    if (!confirm('تنبيه: هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      window.showToast('جاري مسح البيانات، يرجى الانتظار...', 'info');
      await window.syncEngine.clearAllData();
      window.showToast('تم مسح جميع البيانات بنجاح', 'success');
      window.location.reload();
    } catch (e) {
      window.showToast('حدث خطأ أثناء مسح البيانات', 'error');
      console.error(e);
    }
  };

  window.exportSubscribersJSON = function() {
    const data = getData();
    const start = document.getElementById('rep-start-date')?.value || '';
    const end = document.getElementById('rep-end-date')?.value || '';
    const filtered = filterByDate(data.subscribers || [], 'activationDate', start, end);
    
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `المشتركين_الساري_${start || 'all'}_إلى_${end || 'all'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('تم تصدير نسخة JSON للمشتركين بنجاح', 'success');
  };

  window.exportSubscribersExcel = function() {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const start = document.getElementById('rep-start-date')?.value || '';
    const end = document.getElementById('rep-end-date')?.value || '';
    const filtered = filterByDate(data.subscribers || [], 'activationDate', start, end);

    const allDebts = data.debts || [];
    const allSales = data.sales || [];

    const rows = filtered.map(s => {
      let centerStatus = '-';
      if (typeof window.getSubscriberMainSettlementStatus === 'function') {
        const st = window.getSubscriberMainSettlementStatus(s, allDebts, allSales);
        centerStatus = st ? st.status : '-';
      }
      return {
        'اسم المشترك': s.name || '-',
        'رقم الهاتف': s.phone || '-',
        'رقم الجهاز / الكارت': s.deviceNumber || '-',
        'جهة البيع / الوكيل': s.owner || '-',
        'تاريخ التفعيل': s.activationDate || '-',
        'تاريخ الانتهاء': s.expiryDate || '-',
        'الحالة': s.status || 'نشط',
        'تم التسديد للرئيسية': centerStatus,
        'المبلغ المدفوع (د.ع)': Number(s.price) || 0
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'تنبيه': 'لا توجد بيانات مشتركين' }]);
    ws['!cols'] = [
      { wch: 22 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المشتركين");
    XLSX.writeFile(wb, `مشتركي_الساري_${start || 'all'}_إلى_${end || 'all'}.xlsx`);
    window.showToast('تم تصدير تقرير المشتركين Excel بنجاح', 'success');
  };

  window.exportReportsSalesExcel = function() {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const start = document.getElementById('rep-start-date')?.value || '';
    const end = document.getElementById('rep-end-date')?.value || '';
    const filtered = filterByDate(data.sales || [], 'startDate', start, end);

    if (!filtered || filtered.length === 0) {
      window.showToast('لا توجد مبيعات في النطاق الزمني المحدد لتصديرها', 'warning');
      return;
    }

    const rows = filtered.map(s => {
      const price = Number(s.price) || 0;
      const isCash = s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد';
      const paid = isCash ? price : (Number(s.agentPaid) || 0);
      const remaining = isCash ? 0 : Math.max(0, price - paid);
      const sellerName = window.resolveAgentName ? window.resolveAgentName(s) : (s.seller || s.agentName || 'المركز');
      const mainSettled = s.centerPaymentStatus || s.paidToMain || (isCash ? 'تم التسديد للرئيسية' : 'مطلوب للرئيسية');

      return {
        'رمز الفاتورة': s.code || '-',
        'التاريخ': s.startDate || s.date || '-',
        'اسم الزبون / المشترك': s.customerName || '-',
        'رقم الهاتف': s.customerPhone || '-',
        'البائع / الوكيل': sellerName,
        'نوع العملية / الباقة': s.subscriptionType || s.saleType || 'اشتراك',
        'رقم الجهاز / الكارت': s.deviceNumber || '-',
        'السعر الإجمالي (د.ع)': price,
        'المبلغ المدفوع (د.ع)': paid,
        'المتبقي / الديون (د.ع)': remaining,
        'حالة الدفع': isCash ? 'نقد' : 'دين',
        'تسديد الرئيسية': mainSettled,
        'تاريخ الانتهاء': s.endDate || '-',
        'ملاحظات': s.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 18 },
      { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 25 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المبيعات والاشتراكات");
    XLSX.writeFile(wb, `مبيعات_الساري_${start || 'all'}_إلى_${end || 'all'}.xlsx`);
    window.showToast('تم تصدير تقرير المبيعات Excel بنجاح', 'success');
  };

  window.exportSalesJSON = function() {
    const data = getData();
    const start = document.getElementById('rep-start-date')?.value || '';
    const end = document.getElementById('rep-end-date')?.value || '';
    const filtered = filterByDate(data.sales || [], 'startDate', start, end);

    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `المبيعات_الساري_${start || 'all'}_إلى_${end || 'all'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('تم تصدير نسخة JSON للمبيعات بنجاح', 'success');
  };

  window.exportFullBackupJSON = function() {
    const data = getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_كاملة_الساري_${new Date().toISOString().substring(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('تم تصدير النسخة الاحتياطية الشاملة بنجاح', 'success');
  };

  window.exportDebtsExcel = function() {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const start = document.getElementById('rep-start-date')?.value || '';
    const end = document.getElementById('rep-end-date')?.value || '';
    const filtered = filterByDate(data.debts || [], 'date', start, end);
    const debtsList = (filtered.length > 0 ? filtered : (data.debts || []));

    const rows = debtsList.map(d => {
      const total = Number(d.totalAmount) || 0;
      const paid = Number(d.paidAmount) || 0;
      const remaining = Number(d.remainingAmount) || (total - paid);
      return {
        'المدين': d.customerName || '-',
        'الجهة / الوكيل': d.seller || d.agentName || '-',
        'رمز الفاتورة': d.saleCode || '-',
        'رقم الهاتف': d.customerPhone || d.phone || '-',
        'رقم الجهاز': d.deviceNumber || '-',
        'المبلغ الكلي (د.ع)': total,
        'المبلغ المسدد (د.ع)': paid,
        'المتبقي / الديون (د.ع)': remaining,
        'تاريخ الاستحقاق': d.dueDate || '-',
        'حالة الدين': remaining <= 0 ? 'مسدد' : 'دين',
        'ملاحظات': d.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'تنبيه': 'لا توجد ديون مسجلة' }]);
    ws['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 25 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الديون_والمستحقات");
    XLSX.writeFile(wb, `ديون_الساري_${new Date().toISOString().substring(0,10)}.xlsx`);
    window.showToast('تم تصدير تقرير الديون Excel بنجاح', 'success');
  };

  window.exportAgentsExcel = function() {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }
    const data = getData();
    const targets = data.agentTargets || [];
    const rows = (data.agents || []).map(a => {
      const sales = (data.sales || []).filter(s => s.seller === a.name || s.agentName === a.name);
      const debts = (data.debts || []).filter(d => (d.seller === a.name || d.agentName === a.name) && (Number(d.remainingAmount) || 0) > 0);
      const agTarget = a.target || (targets.find(t => t.agentId === a.id)?.target || '-');
      const agPrize = a.prize || (targets.find(t => t.agentId === a.id)?.prize || '-');
      return {
        'رمز الوكيل': a.code || '-',
        'اسم الوكيل': a.name || '-',
        'رقم الهاتف': a.phone || '-',
        'سعر الجهاز المخصص (د.ع)': Number(a.price) || 0,
        'عدد العمليات': sales.length,
        'إجمالي المبيعات (د.ع)': sales.reduce((s, x) => s + (Number(x.price) || 0), 0),
        'الديون القائمة (د.ع)': debts.reduce((s, x) => s + (Number(x.remainingAmount) || 0), 0),
        'الهدف المحدد': agTarget,
        'المكافأة المستحقة': agPrize
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'تنبيه': 'لا يوجد وكلاء مسجلون' }]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
      { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 20 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير_الوكلاء");
    XLSX.writeFile(wb, `وكلاء_الساري_${new Date().toISOString().substring(0,10)}.xlsx`);
    window.showToast('تم تصدير تقرير الوكلاء Excel بنجاح', 'success');
  };

  // --- Comprehensive Financial Backup to Excel using SheetJS ---
  window.exportFinancialBackupExcel = function(options = {}) {
    if (typeof XLSX === 'undefined') {
      window.showToast('مكتبة SheetJS قيد التحميل، يرجى المحاولة بعد لحظات', 'error');
      return;
    }

    try {
      const data = getData();
      const applyDateFilter = options.filtered !== false;
      const start = applyDateFilter ? (document.getElementById('rep-start-date')?.value || '') : '';
      const end = applyDateFilter ? (document.getElementById('rep-end-date')?.value || '') : '';
      const today = new Date().toISOString().substring(0, 10);

      function inDateRange(dateStr) {
        if (!applyDateFilter || (!start && !end)) return true;
        if (!dateStr) return true;
        const d = String(dateStr).substring(0, 10);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      }

      const allSales = data.sales || [];
      const allDebts = data.debts || [];
      const allAgents = data.agents || [];
      const allSubscribers = data.subscribers || [];
      const allSettlements = data.agentSettlements || [];
      const targets = data.agentTargets || [];

      const filteredSales = allSales.filter(s => inDateRange(s.startDate || s.date || s.createdAt));
      const filteredDebts = allDebts.filter(d => inDateRange(d.date || d.dueDate || d.createdAt));
      const filteredSettlements = allSettlements.filter(st => inDateRange(st.date || st.createdAt));
      const filteredSubscribers = allSubscribers.filter(sub => inDateRange(sub.activationDate || sub.createdAt));

      // 1. Calculations for Financial Summary
      let totalSalesVolume = 0;
      let totalCashReceived = 0;
      let totalSalesRemaining = 0;
      let renewalSalesSum = 0;
      let renewalSalesCount = 0;
      let deviceSalesSum = 0;
      let deviceSalesCount = 0;

      filteredSales.forEach(s => {
        const price = Number(s.price) || 0;
        totalSalesVolume += price;

        const isCash = s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد';
        const paid = isCash ? price : (Number(s.agentPaid) || 0);
        const rem = isCash ? 0 : Math.max(0, price - paid);

        totalCashReceived += paid;
        totalSalesRemaining += rem;

        const type = (s.subscriptionType || s.saleType || '').toLowerCase();
        if (type.includes('تجديد') || type.includes('اشتراك') || type.includes('شهر') || type.includes('سنة')) {
          renewalSalesSum += price;
          renewalSalesCount++;
        } else {
          deviceSalesSum += price;
          deviceSalesCount++;
        }
      });

      const totalCustomerDebtsRemaining = allDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
      const activeCustomerDebtsCount = allDebts.filter(d => (Number(d.remainingAmount) || 0) > 0).length;

      // Agent specific debts & payments to main
      const agentNamesSet = new Set(allAgents.map(a => a.name));
      allAgents.forEach(a => {
        if (a.username) agentNamesSet.add(a.username);
        if (a.code) agentNamesSet.add(a.code);
      });

      const agentDebtsList = allDebts.filter(d => 
        d.debtor === 'الوكيل والزبون' || 
        d.agentName || 
        agentNamesSet.has(d.seller) || 
        (d.notes && allAgents.some(a => d.notes.includes(a.name)))
      );
      const totalDueFromAgents = agentDebtsList.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);

      // Payments to main by agents
      let totalPaidToMain = 0;
      const relevantSales = allSales.filter(s => agentNamesSet.has(s.seller) || agentNamesSet.has(s.agentName));
      relevantSales.forEach(s => {
        let salePaid = Number(s.agentPaid) || 0;
        if (s.paymentStatus === 'تم التسديد' && salePaid === 0) {
          salePaid = Number(s.price) || 0;
        }
        totalPaidToMain += salePaid;
      });

      const totalSettlementsAmount = filteredSettlements.reduce((sum, st) => 
        sum + (Number(st.receivedAmount) || Number(st.paidAmount) || Number(st.amount) || 0), 0
      );

      const activeSubscribersCount = allSubscribers.filter(sub => {
        if (sub.status === 'منتهي') return false;
        if (!sub.expiryDate) return true;
        return sub.expiryDate >= today;
      }).length;

      // Create Workbook
      const wb = XLSX.utils.book_new();

      // ==========================================
      // SHEET 1: الملخص المالي التنفيذي
      // ==========================================
      const summaryData = [
        { 'المؤشر المالي': 'اسم النظام والجهة', 'القيمة': 'الساري للبث الأرضي - وكيل قنوات الرابعة الرياضية', 'البيان والملاحظات': 'نظام إدارة المركز والمبيعات والوكلاء' },
        { 'المؤشر المالي': 'نوع المصنف', 'القيمة': 'نسخة احتياطية للبيانات المالية (Financial Backup Excel)', 'البيان والملاحظات': 'تصدير شامل ومنظم عبر مكتبة SheetJS' },
        { 'المؤشر المالي': 'تاريخ ووقت التصدير', 'القيمة': new Date().toLocaleString('ar-IQ'), 'البيان والملاحظات': 'توقيت النظام الرسمي' },
        { 'المؤشر المالي': 'النطاق الزمني المحدد', 'القيمة': (start || end) ? `من: ${start || 'البداية'} | إلى: ${end || 'اليوم'}` : 'كافة السجلات التاريخية المسجلة', 'البيان والملاحظات': applyDateFilter ? 'مفلتر حسب التاريخ المحدد في صفحة التقارير' : 'نسخة تاريخية شاملة بالكامل' },
        { 'المؤشر المالي': '============================', 'القيمة': '============================', 'البيان والملاحظات': '============================' },
        { 'المؤشر المالي': 'إجمالي حجم المبيعات والاشتراكات (د.ع)', 'القيمة': totalSalesVolume, 'البيان والملاحظات': `إجمالي المبيعات لعدد (${filteredSales.length}) فاتورة/عملية` },
        { 'المؤشر المالي': 'إجمالي المقبوضات النقدية الفعلية (د.ع)', 'القيمة': totalCashReceived, 'البيان والملاحظات': 'المبالغ المستلمة والمسددة نقدياً' },
        { 'المؤشر المالي': 'المبالغ المتبقية في ذمة الزبائن/دين (د.ع)', 'القيمة': totalSalesRemaining, 'البيان والملاحظات': 'متبقي الفواتير غير المسددة نقدياً للفترة المحددة' },
        { 'المؤشر المالي': 'إجمالي الديون القائمة في النظام (د.ع)', 'القيمة': totalCustomerDebtsRemaining, 'البيان والملاحظات': `متبقي كافة سجلات الديون لعدد (${activeCustomerDebtsCount}) دين قائم` },
        { 'المؤشر المالي': 'إجمالي المبالغ المطلوبة من الوكلاء للرئيسية (د.ع)', 'القيمة': totalDueFromAgents, 'البيان والملاحظات': 'إجمالي الذمم والديون المطلوبة من الوكلاء للمركز الرئيسي' },
        { 'المؤشر المالي': 'إجمالي المبالغ المسددة للرئيسية (د.ع)', 'القيمة': totalPaidToMain, 'البيان والملاحظات': 'إجمالي ما تم تسديده للمركز الرئيسي من مبيعات الوكلاء' },
        { 'المؤشر المالي': 'إجمالي مبالغ تسديدات الوكلاء المودعة (د.ع)', 'القيمة': totalSettlementsAmount, 'البيان والملاحظات': `مجموع حركات تسديدات الصندوق لعدد (${filteredSettlements.length}) حركة` },
        { 'المؤشر المالي': 'إجمالي إيراد اشتراكات التجديد (د.ع)', 'القيمة': renewalSalesSum, 'البيان والملاحظات': `مجموع مبيعات التجديدات لعدد (${renewalSalesCount}) عملية` },
        { 'المؤشر المالي': 'إجمالي مبيعات الأجهزة والملحقات (د.ع)', 'القيمة': deviceSalesSum, 'البيان والملاحظات': `مجموع مبيعات الأجهزة لعدد (${deviceSalesCount}) جهاز/منتج` },
        { 'المؤشر المالي': '============================', 'القيمة': '============================', 'البيان والملاحظات': '============================' },
        { 'المؤشر المالي': 'إجمالي عدد المشتركين المسجلين', 'القيمة': allSubscribers.length, 'البيان والملاحظات': 'قاعدة بيانات المشتركين الكاملة' },
        { 'المؤشر المالي': 'عدد المشتركين النشطين (ساري)', 'القيمة': activeSubscribersCount, 'البيان والملاحظات': 'الاشتراكات الفعالة غير المنتهية' },
        { 'المؤشر المالي': 'عدد الوكلاء المعتمدين', 'القيمة': allAgents.length, 'البيان والملاحظات': 'الوكلاء الموزعون النشطون' },
        { 'المؤشر المالي': 'حالة سلامة وتطابق النسخة', 'القيمة': 'سليمة ومتكاملة 100%', 'البيان والملاحظات': 'تم التدقيق والتجميع الآلي بواسطة محرك النظام' }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 38 }, { wch: 32 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "الملخص_المالي");

      // ==========================================
      // SHEET 2: سجل المبيعات والاشتراكات
      // ==========================================
      const salesData = filteredSales.map(s => {
        const price = Number(s.price) || 0;
        const isCash = s.paymentMethod === 'نقد' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد';
        const paid = isCash ? price : (Number(s.agentPaid) || 0);
        const remaining = isCash ? 0 : Math.max(0, price - paid);
        const sellerName = window.resolveAgentName ? window.resolveAgentName(s) : (s.seller || s.agentName || 'المركز');
        const mainSettled = s.centerPaymentStatus || s.paidToMain || (isCash ? 'تم التسديد للرئيسية' : 'مطلوب للرئيسية');

        return {
          'رمز الفاتورة': s.code || '-',
          'التاريخ': s.startDate || s.date || '-',
          'اسم الزبون / المشترك': s.customerName || '-',
          'رقم الهاتف': s.customerPhone || '-',
          'البائع / الوكيل': sellerName,
          'نوع العملية / الباقة': s.subscriptionType || s.saleType || 'اشتراك',
          'رقم الجهاز / الكارت': s.deviceNumber || '-',
          'السعر الإجمالي (د.ع)': price,
          'المبلغ المدفوع (د.ع)': paid,
          'المتبقي / الديون (د.ع)': remaining,
          'حالة الدفع': isCash ? 'نقد' : 'دين',
          'تسديد الرئيسية': mainSettled,
          'تاريخ الانتهاء': s.endDate || '-',
          'ملاحظات': s.notes || ''
        };
      });
      const wsSales = XLSX.utils.json_to_sheet(salesData.length > 0 ? salesData : [{ 'تنبيه': 'لا توجد مبيعات في الفترة المحددة' }]);
      wsSales['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 18 },
        { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSales, "سجل_المبيعات_والاشتراكات");

      // ==========================================
      // SHEET 3: سجل الديون والمستحقات
      // ==========================================
      const debtsData = filteredDebts.map(d => {
        const total = Number(d.totalAmount) || 0;
        const paid = Number(d.paidAmount) || 0;
        const remaining = Number(d.remainingAmount) || (total - paid);
        return {
          'اسم المدين / الزبون': d.customerName || '-',
          'الوكيل / جهة البيع': d.seller || d.agentName || '-',
          'رمز الفاتورة': d.saleCode || '-',
          'رقم الهاتف': d.customerPhone || d.phone || '-',
          'رقم الجهاز': d.deviceNumber || '-',
          'المبلغ الكلي للدين (د.ع)': total,
          'المبلغ المسدد (د.ع)': paid,
          'المبلغ المتبقي (د.ع)': remaining,
          'تاريخ الدين': d.date || '-',
          'تاريخ الاستحقاق': d.dueDate || '-',
          'حالة الدين': remaining <= 0 ? 'مسدد بالكامل' : 'متبقي دين',
          'ملاحظات': d.notes || ''
        };
      });
      const wsDebts = XLSX.utils.json_to_sheet(debtsData.length > 0 ? debtsData : [{ 'تنبيه': 'لا توجد ديون مسجلة' }]);
      wsDebts['!cols'] = [
        { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 15 }, { wch: 20 },
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
        { wch: 16 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsDebts, "سجل_الديون_والمستحقات");

      // ==========================================
      // SHEET 4: أرصدة وحسابات الوكلاء
      // ==========================================
      const agentsData = allAgents.map(ag => {
        const agName = ag.name;
        const agSales = allSales.filter(s => s.seller === agName || s.agentName === agName);
        const agSalesSum = agSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        const agDebts = allDebts.filter(d => (d.seller === agName || d.agentName === agName) && (Number(d.remainingAmount) || 0) > 0);
        const agDebtsSum = agDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
        const agSettlements = allSettlements.filter(st => st.agentName === agName || (ag.username && st.agentName === ag.username));
        const agSettlementsSum = agSettlements.reduce((sum, st) => sum + (Number(st.receivedAmount) || Number(st.paidAmount) || Number(st.amount) || 0), 0);
        const agTarget = ag.target || (targets.find(t => t.agentId === ag.id)?.target || '-');
        const agPrize = ag.prize || (targets.find(t => t.agentId === ag.id)?.prize || '-');
        const agNotes = (ag.notes || ag.targetNotes) || (targets.find(t => t.agentId === ag.id)?.notes || '');

        return {
          'رمز الوكيل': ag.code || '-',
          'اسم الوكيل': ag.name || '-',
          'اسم المستخدم': ag.username || '-',
          'رقم الهاتف': ag.phone || '-',
          'سعر المركز المخصص (د.ع)': Number(ag.price) || 0,
          'عدد عمليات البيع': agSales.length,
          'إجمالي المبيعات (د.ع)': agSalesSum,
          'الديون القائمة (د.ع)': agDebtsSum,
          'إجمالي التسديدات للمركز (د.ع)': agSettlementsSum,
          'الهدف المحدد': agTarget,
          'المكافأة المستحقة': agPrize,
          'ملاحظات وحالة الإنجاز': agNotes
        };
      });
      const wsAgents = XLSX.utils.json_to_sheet(agentsData.length > 0 ? agentsData : [{ 'تنبيه': 'لا يوجد وكلاء' }]);
      wsAgents['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
        { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
        { wch: 20 }, { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsAgents, "أرصدة_وحسابات_الوكلاء");

      // ==========================================
      // SHEET 5: سجل تسديدات الوكلاء والصندوق
      // ==========================================
      const settlementsData = filteredSettlements.map(st => ({
        'رمز الحركة': st.id || '-',
        'التاريخ والوقت': st.date || '-',
        'اسم الوكيل': st.agentName || '-',
        'المبلغ المسدد (د.ع)': Number(st.receivedAmount) || Number(st.paidAmount) || Number(st.amount) || 0,
        'طريقة التسديد': st.paymentMethod || 'نقداً',
        'اسم المستلم / المسؤول': st.receivedBy || 'المركز الرئيسي',
        'البيان والملاحظات': st.notes || ''
      }));
      const wsSettlements = XLSX.utils.json_to_sheet(settlementsData.length > 0 ? settlementsData : [{ 'تنبيه': 'لا توجد حركات تسديد في الفترة المحددة' }]);
      wsSettlements['!cols'] = [
        { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
        { wch: 20 }, { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSettlements, "سجل_تسديدات_الوكلاء");

      // ==========================================
      // SHEET 6: قاعدة المشتركين
      // ==========================================
      const subsData = filteredSubscribers.map(sub => {
        let centerStatus = '-';
        if (typeof window.getSubscriberMainSettlementStatus === 'function') {
          const st = window.getSubscriberMainSettlementStatus(sub, allDebts, allSales);
          centerStatus = st ? st.status : '-';
        }
        return {
          'اسم المشترك': sub.name || '-',
          'رقم الهاتف': sub.phone || '-',
          'رقم الجهاز / الكارت': sub.deviceNumber || '-',
          'جهة البيع / الوكيل': sub.owner || '-',
          'تاريخ التفعيل': sub.activationDate || '-',
          'تاريخ الانتهاء': sub.expiryDate || '-',
          'حالة الاشتراك': sub.status || 'نشط',
          'تم التسديد للرئيسية': centerStatus,
          'المبلغ المدفوع (د.ع)': Number(sub.price) || 0
        };
      });
      const wsSubs = XLSX.utils.json_to_sheet(subsData.length > 0 ? subsData : [{ 'تنبيه': 'لا يوجد مشتركون' }]);
      wsSubs['!cols'] = [
        { wch: 22 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSubs, "قاعدة_المشتركين");

      // File name format
      const datePart = (start || end) ? `${start || 'all'}_إلى_${end || 'all'}` : 'شامل_كافة_الفترات';
      const fileName = `النسخة_الاحتياطية_المالية_الساري_${datePart}_${today}.xlsx`;

      // Trigger download
      XLSX.writeFile(wb, fileName);
      window.showToast(`تم تصدير النسخة الاحتياطية المالية إلى ملف Excel (${fileName}) بنجاح!`, 'success');
    } catch (err) {
      console.error('Error exporting financial backup Excel:', err);
      window.showToast('حدث خطأ أثناء تصدير ملف Excel، يرجى المحاولة ثانية', 'error');
    }
  };

  // --- Page: Products (المنتجات والمخزن) ---
  let productFilter = { category: 'all', search: '' };

  function getCategoryIcon(cat) {
    if (!cat) return '📦';
    const c = cat.trim();
    if (c.includes('أريل') || c.includes('اريل')) return '📡';
    if (c.includes('كابل') || c.includes('سلك')) return '🔌';
    if (c.includes('ريمونت') || c.includes('تحكم')) return '📱';
    if (c.includes('فيش') || c.includes('كونكتر')) return '🔩';
    if (c.includes('جديد')) return '📦';
    if (c.includes('مستعمل')) return '🔄';
    return '📦';
  }

  window.setProductFilter = function(key, val) {
    productFilter[key] = val;
    const mainEl = document.getElementById('main-content');
    if (mainEl) window.renderProducts(mainEl);
  };

  window.onProductSearchInput = function(val) {
    productFilter.search = val || '';
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      window.renderProducts(mainEl);
      const searchBox = document.getElementById('product-search-input');
      if (searchBox) {
        searchBox.focus();
        const len = searchBox.value.length;
        searchBox.setSelectionRange(len, len);
      }
    }
  };

  window.renderProducts = function(container) {
    const user = getEngine().currentUser;
    const isAdmin = user && (user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي');
    const data = getData();
    let products = data.products || window.DEFAULT_PRODUCTS || [];

    // Ensure all products have required attributes
    products = products.map(p => ({
      id: p.id || 'prod-' + Math.random().toString(36).substr(2, 9),
      code: p.code || 'PRD',
      name: p.name || 'منتج',
      category: p.category || 'عام',
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      unit: p.unit || 'قطعة',
      image: p.image || '',
      description: p.description || ''
    }));

    // Collect all unique categories
    const standardCategories = ['أريل', 'كابلات', 'ريمونت', 'فيش', 'اجهزة جديدة', 'اجهزة مستعملة'];
    const customCategories = Array.from(new Set(products.map(p => p.category))).filter(c => c && !standardCategories.includes(c));
    const allCategories = ['الكل', ...standardCategories, ...customCategories];

    // Filter products by category
    let filtered = [...products];
    if (productFilter.category !== 'all' && productFilter.category !== 'الكل') {
      filtered = filtered.filter(p => p.category === productFilter.category);
    }

    // Filter products by search input
    if (productFilter.search) {
      const qRaw = productFilter.search.trim();
      const qNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(qRaw) : qRaw.toLowerCase();
      filtered = filtered.filter(p => {
        const nameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(p.name || '') : (p.name || '').toLowerCase();
        const codeNorm = (p.code || '').toLowerCase();
        const catNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(p.category || '') : (p.category || '').toLowerCase();
        const descNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(p.description || '') : (p.description || '').toLowerCase();

        return nameNorm.includes(qNorm) ||
               codeNorm.includes(qRaw.toLowerCase()) ||
               catNorm.includes(qNorm) ||
               descNorm.includes(qNorm);
      });
    }

    // Metrics calculations
    const totalItems = products.length;
    const totalStockQty = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const totalStockValue = products.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
    const lowStockCount = products.filter(p => Number(p.stock) <= 5).length;

    // Agent target resolution
    const agentName = user?.agentName || user?.displayName || '';
    const myAgent = (data.agents || []).find(a => 
      (user && a.id === user.uid) || 
      (agentName && a.name === agentName) || 
      (user && user.username && a.username === user.username) || 
      (user && user.agentCode && a.code === user.agentCode)
    );
    const targetObj = (data.agentTargets || []).find(t => 
      (user && t.agentId === user.uid) || 
      (myAgent && t.agentId === myAgent.id) || 
      (agentName && t.agentName === agentName)
    );
    const myTarget = (myAgent && myAgent.target) || (targetObj && targetObj.target) || '';
    const myPrize = (myAgent && myAgent.prize) || (targetObj && targetObj.prize) || '';
    const myNotes = (myAgent && (myAgent.notes || myAgent.targetNotes)) || (targetObj && targetObj.notes) || '';

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">${isAdmin ? 'لوحة تحكم المخزن المركزي' : 'دليل المنتجات والملحقات المتوفرة'}</span>
            <h1>${isAdmin ? 'دليل المنتجات والمخزن' : 'المنتجات والهدف'}</h1>
            <p class="subtitle">${isAdmin ? 'إدارة المنتجات، تحديث أسعار المفرد والكميات المتوفرة في المخزن مع مزامنة لحظية فورية للوكلاء' : 'استعراض أصناف الملحقات والأجهزة وأسعار المفرد والكميات المتاحة في المركز ومتابعة التاركت والهدف'}</p>
          </div>
          <div class="header-actions">
            ${isAdmin ? `
              <button class="btn btn-primary" onclick="openProductModal()">
                <span>➕</span> <span>إضافة منتج جديد</span>
              </button>
            ` : `
              <div class="badge badge-success sync-notice-badge" style="font-size: 0.82rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px; white-space: normal; line-height: 1.4; max-width: 100%; box-sizing: border-box; text-align: right; border-radius: var(--radius-md);">
                <span style="flex-shrink: 0;">🟢</span> <span>الأسعار والكميات متزامنة لحظياً مع المركز الرئيسي</span>
              </div>
            `}
          </div>
        </div>

        <!-- 2. Top Box on Products & Inventory Page: Target & Prize Display -->
        ${!isAdmin ? `
        <div class="content-card" style="margin-bottom: 24px; padding: 22px 24px; border: 2px solid var(--primary); background: var(--card-bg); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(37, 99, 235, 0.12); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0;">
                🎯
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text);">الهدف والمكافأة الخاصة بك</h3>
                  <span class="badge badge-primary" style="font-size: 0.8rem; font-weight: 700;">الوكيل: ${escapeHtml(myAgent ? myAgent.name : (agentName || 'وكيل معتمد'))}</span>
                </div>
                <p style="margin: 3px 0 0 0; color: var(--text-sub); font-size: 0.85rem;">
                  الهدف المحدد لك والمكافأة المستحقة عند تحقيقه من إدارة المركز الرئيسي
                </p>
              </div>
            </div>
            <div class="badge badge-success" style="font-size: 0.82rem; padding: 6px 12px;">
              <span>🔒</span> <span>بيانات خاصة بحسابك فقط</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
            <!-- Agent Target -->
            <div style="padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--line);">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--muted); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span>🎯</span> <span>الهدف المطلوب تحقيقه (Target):</span>
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary);">
                ${myTarget ? escapeHtml(myTarget) : '<span style="color: var(--muted); font-weight: 500; font-size: 0.95rem;">لم يتم تحديد هدف بعد من قبل الإدارة</span>'}
              </div>
            </div>

            <!-- Prize / Reward -->
            <div style="padding: 16px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--line);">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--green); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span>🎁</span> <span>المكافأة / الجائزة المستحقة (Prize):</span>
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--green);">
                ${myPrize ? escapeHtml(myPrize) : '<span style="color: var(--muted); font-weight: 500; font-size: 0.95rem;">سيتم تحديد المكافأة من قبل الإدارة</span>'}
              </div>
            </div>

            ${myNotes ? `
            <!-- Achievement Status / Notes -->
            <div style="padding: 14px 18px; border-radius: var(--radius-md); background: var(--surface); border: 1px solid var(--line); grid-column: 1 / -1;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-sub); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                <span>📝</span> <span>حالة الإنجاز وملاحظات الإدارة:</span>
              </div>
              <div style="font-size: 0.95rem; font-weight: 600; color: var(--text);">
                ${escapeHtml(myNotes)}
              </div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : `
        <!-- Admin Targets Overview Box on Products Page -->
        <div class="content-card" style="margin-bottom: 24px; padding: 18px 24px; border: 1px solid var(--line); border-top: 3px solid var(--primary); background: var(--card-bg); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.6rem;">🎯</span>
              <div>
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text);">أهداف وجوائز الوكلاء</h3>
                <p style="margin: 2px 0 0 0; color: var(--text-sub); font-size: 0.84rem;">
                  يظهر لكل وكيل بشكل فردي هدفه وجائزته في أعلى صفحته هنا. يمكنك إدارة أهداف الوكلاء من صفحة التقارير والاهداف.
                </p>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="navigateTo('reports')" style="font-size: 0.84rem; padding: 6px 14px; font-weight: 700;">
              <span>🎯</span> <span>إدارة الأهداف والجوائز ←</span>
            </button>
          </div>
          ${(data.agents || []).length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line);">
              ${(data.agents || []).map(ag => {
                const aTarget = ag.target || (data.agentTargets || []).find(t => t.agentId === ag.id)?.target || '';
                const aPrize = ag.prize || (data.agentTargets || []).find(t => t.agentId === ag.id)?.prize || '';
                return `
                  <div style="padding: 10px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <strong style="color: var(--text); font-size: 0.9rem;">👤 ${escapeHtml(ag.name)}</strong>
                      <span class="badge badge-neutral" style="font-size: 0.72rem;">${escapeHtml(ag.code || 'وكيل')}</span>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--primary); font-weight: 700;">
                      🎯 الهدف: ${aTarget ? escapeHtml(aTarget) : '<span style="color: var(--muted); font-weight: 400;">لم يُحدد بعد</span>'}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--green); font-weight: 700;">
                      🎁 الجائزة: ${aPrize ? escapeHtml(aPrize) : '<span style="color: var(--muted); font-weight: 400;">لم تُحدد بعد</span>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
        `}

        <!-- Summary Statistics Grid -->
        ${isAdmin ? `
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي الأصناف المسجلة</span><div class="stat-icon">📦</div></div>
            <div class="stat-value-group"><span class="stat-value">${totalItems}</span><span class="stat-unit">صنف</span></div>
            <div class="stat-footer"><span>المعروض حالياً: ${filtered.length} صنف</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي القطع في المخزن</span><div class="stat-icon">📊</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--green);">${formatNumber(totalStockQty)}</span><span class="stat-unit">قطعة</span></div>
            <div class="stat-footer"><span>رصيد المخزن الفعلي</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">القيمة الإجمالية للمخزن</span><div class="stat-icon">💰</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--primary);">${formatIQD(totalStockValue)}</span></div>
            <div class="stat-footer"><span>بسعر القطعة المفرد</span></div>
          </div>
          <div class="stat-card" style="${lowStockCount > 0 ? 'border: 2px solid var(--warning);' : ''}">
            <div class="stat-card-header"><span class="stat-title">أصناف تحتاج تزويداً</span><div class="stat-icon">⚠️</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: ${lowStockCount > 0 ? '#b45309' : 'var(--success)'};">${lowStockCount}</span><span class="stat-unit">أصناف</span></div>
            <div class="stat-footer"><span>الكمية المتبقية 5 أو أقل</span></div>
          </div>
        </div>
        ` : ''}

        <!-- Filter & Search Controls Bar -->
        <div class="content-card" style="margin-bottom: 24px;">
          <div class="filters-bar" style="flex-direction: column; align-items: stretch; gap: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <!-- Category Filter Chips -->
              <div class="filter-chips">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--muted); margin-left: 4px;">الفئة:</span>
                ${allCategories.map(cat => {
                  const isActive = productFilter.category === cat || (cat === 'الكل' && productFilter.category === 'all');
                  const targetVal = cat === 'الكل' ? 'all' : cat;
                  return `
                    <span class="chip ${isActive ? 'active' : ''}" onclick="setProductFilter('category', '${escapeHtml(targetVal)}')">
                      ${getCategoryIcon(cat)} ${escapeHtml(cat)}
                    </span>
                  `;
                }).join('')}
              </div>

              <!-- Instant Search Box -->
              <div class="search-box" style="position: relative; display: flex; align-items: center; min-width: 280px;">
                <span class="search-icon">🔍</span>
                <input type="text" id="product-search-input" placeholder="بحث باسم المنتج، الرمز، أو الفئة..." value="${escapeHtml(productFilter.search)}" oninput="onProductSearchInput(this.value)">
                ${productFilter.search ? `<button type="button" onclick="onProductSearchInput('')" style="position: absolute; left: 10px; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 0.9rem; padding: 2px 6px;" title="إلغاء البحث">✕</button>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Products Cards Grid -->
        ${filtered.length === 0 ? `
          <div class="content-card" style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
            <h3 style="color: var(--text-main); margin-bottom: 6px;">لا توجد منتجات مطابقة للبحث أو الفلتر</h3>
            <p style="color: var(--muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 18px;">يرجى تجربة كلمات بحث أخرى أو إزالة الفلتر المختار.</p>
            <button class="btn btn-secondary" onclick="setProductFilter('category', 'all'); onProductSearchInput('');">إعادة ضبط الفلاتر</button>
          </div>
        ` : `
          <div class="products-grid">
            ${filtered.map(p => {
              const stockNum = Number(p.stock) || 0;
              let stockClass = 'in-stock';
              let stockLabel = `متوفر (${formatNumber(stockNum)})`;
              if (stockNum === 0) {
                stockClass = 'out-of-stock';
                stockLabel = 'نفدت الكمية';
              } else if (stockNum <= 5) {
                stockClass = 'low-stock';
                stockLabel = `كمية منخفضة (${formatNumber(stockNum)})`;
              }

              return `
                <div class="product-card" id="card-product-${p.id}">
                  <!-- Top Image with overlays -->
                  <div class="product-image-box">
                    ${p.image ? `
                      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="product-image" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                      <div class="product-fallback-icon" style="display: none;">${getCategoryIcon(p.category)}</div>
                    ` : `
                      <div class="product-fallback-icon">${getCategoryIcon(p.category)}</div>
                    `}
                    <div class="product-category-badge">${escapeHtml(p.category)}</div>
                    <div class="product-stock-pill ${stockClass}">${stockLabel}</div>
                  </div>

                  <!-- Body with Name, Code, Description & Metrics -->
                  <div class="product-card-body">
                    <div class="product-header-info">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <h3 class="product-title">${escapeHtml(p.name)}</h3>
                        <span class="product-code-tag">${escapeHtml(p.code)}</span>
                      </div>
                      ${p.description ? `<p class="product-desc" title="${escapeHtml(p.description)}">${escapeHtml(p.description)}</p>` : ''}
                    </div>

                    <!-- Metrics: Unit Price & Stock Quantity clearly shown below image -->
                    <div class="product-metrics-box">
                      <div class="product-metric">
                        <span class="product-metric-label">سعر القطعة المفرد</span>
                        <span class="product-metric-value price">${formatIQD(p.price)}</span>
                      </div>
                      <div class="product-metric">
                        <span class="product-metric-label">الكمية في المخزن</span>
                        <span class="product-metric-value">${formatNumber(p.stock)} <span style="font-size: 0.75rem; color: var(--muted); font-weight: normal;">${escapeHtml(p.unit || 'قطعة')}</span></span>
                      </div>
                    </div>

                    <!-- Admin or View-Only Controls -->
                    ${isAdmin ? `
                      <div class="product-admin-actions">
                        <!-- Quick Quantity Adjusters -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 0.75rem; color: var(--muted);">تعديل سريع:</span>
                          <div class="product-quick-qty">
                            <button type="button" class="product-quick-btn" onclick="quickAdjustStock('${p.id}', -1)" title="إنقاص الكمية (-1)">-</button>
                            <span style="font-size: 0.8rem; font-weight: 700; padding: 0 4px; font-family: monospace;">${stockNum}</span>
                            <button type="button" class="product-quick-btn" onclick="quickAdjustStock('${p.id}', 1)" title="زيادة الكمية (+1)">+</button>
                          </div>
                        </div>

                        <!-- Edit & Delete Buttons -->
                        <div style="display: flex; gap: 6px;">
                          <button class="btn btn-secondary btn-sm" onclick="openProductModal('${p.id}')" title="تعديل السعر والكمية والبيانات" style="font-size: 0.8rem; padding: 4px 10px;">
                            <span>✏️</span> تعديل
                          </button>
                          <button class="btn btn-outline-danger btn-sm" onclick="deleteProduct('${p.id}')" title="حذف المنتج" style="font-size: 0.8rem; padding: 4px 8px;">
                            <span>🗑️</span>
                          </button>
                        </div>
                      </div>
                    ` : `
                      <div style="padding-top: 8px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.78rem; color: var(--muted);">حالة التوفر للوكلاء:</span>
                        <span class="badge ${stockNum > 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 0.78rem;">
                          ${stockNum > 0 ? '🟢 متاح للاستلام والبيع' : '🔴 غير متوفر حالياً'}
                        </span>
                      </div>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  };

  // Quick quantity adjustment for Admin with immediate sync
  window.quickAdjustStock = async function(prodId, delta) {
    const data = getData();
    const products = [...(data.products || window.DEFAULT_PRODUCTS || [])];
    const idx = products.findIndex(p => p.id === prodId);
    if (idx === -1) return;

    const currentStock = Number(products[idx].stock) || 0;
    const newStock = Math.max(0, currentStock + delta);
    products[idx].stock = newStock;

    await getEngine().commitData('products', products);
    window.showToast(`تم تحديث كمية (${products[idx].name}): ${newStock} ${products[idx].unit || 'قطعة'}`, 'success');
  };

  // Handle image upload from laptop file input
  window.handleProductImageUpload = function(input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const base64Data = e.target.result;
        const hiddenInput = document.getElementById('pf-image');
        if (hiddenInput) hiddenInput.value = base64Data;
        const previewImg = document.getElementById('pf-image-preview');
        const previewContainer = document.getElementById('pf-image-preview-container');
        if (previewImg) previewImg.src = base64Data;
        if (previewContainer) previewContainer.style.display = 'flex';
        window.showToast('تم تحميل الصورة بنجاح', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Open Add / Edit Product Modal (Admin restricted)
  window.openProductModal = function(prodId) {
    const data = getData();
    const products = data.products || window.DEFAULT_PRODUCTS || [];
    const existing = prodId ? products.find(p => p.id === prodId) : null;
    const modalContainer = document.getElementById('modal-container');

    const standardCategories = ['أريل', 'كابلات', 'ريمونت', 'فيش', 'اجهزة جديدة', 'اجهزة مستعملة'];
    const customCategories = Array.from(new Set(products.map(p => p.category))).filter(c => c && !standardCategories.includes(c));
    const categoriesList = [...standardCategories, ...customCategories];

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${existing ? 'تعديل بيانات المنتج والمخزن' : 'إضافة منتج جديد للمخزن'}</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="product-form">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label>اسم المنتج *</label>
                  <input type="text" id="pf-name" required placeholder="مثال: ريمونت شامل، أريل خارجي..." value="${escapeHtml(existing?.name || '')}">
                </div>
                <div class="form-group">
                  <label>رمز / كود المنتج *</label>
                  <input type="text" id="pf-code" required placeholder="مثال: ANT-01, RMT-02" value="${escapeHtml(existing?.code || '')}" style="font-family: monospace;">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>فئة المنتج *</label>
                  <div style="display: flex; gap: 8px;">
                    <select id="pf-category" onchange="const c = document.getElementById('pf-custom-cat'); if(this.value==='__custom__'){ c.style.display='block'; c.focus(); } else { c.style.display='none'; }">
                      ${categoriesList.map(cat => `
                        <option value="${escapeHtml(cat)}" ${existing?.category === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>
                      `).join('')}
                      <option value="__custom__">➕ فئة جديدة مخصصة...</option>
                    </select>
                  </div>
                  <input type="text" id="pf-custom-cat" placeholder="أدخل اسم الفئة الجديدة..." style="display: none; margin-top: 8px;">
                </div>
                <div class="form-group">
                  <label>وحدة القياس</label>
                  <input type="text" id="pf-unit" placeholder="قطعة، جهاز، بكرة، كيس..." value="${escapeHtml(existing?.unit || 'قطعة')}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>سعر القطعة المفرد (د.ع) *</label>
                  <input type="number" id="pf-price" required min="0" step="500" placeholder="مثال: 15000" value="${existing ? existing.price : ''}" style="font-weight: 700; color: var(--green);">
                  <span class="form-help">السعر المعروض للبيع المفرد بالدينار العراقي</span>
                </div>
                <div class="form-group">
                  <label>الكمية المتوفرة في المخزن *</label>
                  <input type="number" id="pf-stock" required min="0" step="1" placeholder="مثال: 50" value="${existing ? existing.stock : ''}" style="font-weight: 700;">
                  <span class="form-help">الرصيد الفعلي المتوفر في المخزن الرئيسي</span>
                </div>
              </div>

              <div class="form-group">
                <label>صورة المنتج</label>
                <input type="hidden" id="pf-image" value="${escapeHtml(existing?.image || '')}">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div id="pf-image-preview-container" style="display: ${existing?.image ? 'flex' : 'none'}; align-items: center; gap: 10px;">
                    <img id="pf-image-preview" src="${escapeHtml(existing?.image || '')}" alt="معاينة الصورة" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="document.getElementById('pf-image').value=''; document.getElementById('pf-image-preview-container').style.display='none'; document.getElementById('pf-image-preview').src='';" style="font-size: 0.75rem; padding: 4px 8px;">حذف الصورة</button>
                  </div>
                  <input type="file" id="pf-file-input" accept="image/*" style="display: none;" onchange="handleProductImageUpload(this)">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('pf-file-input').click()" style="width: fit-content; display: inline-flex; align-items: center; gap: 6px;">
                    <span>📁</span> <span>تحميل صورة من لابتوبي</span>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label>مواصفات وملاحظات المنتج</label>
                <textarea id="pf-desc" rows="2" placeholder="وصف المنتج، الموديل، المواصفات الفنية...">${escapeHtml(existing?.description || '')}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary">${existing ? 'حفظ التعديلات والمزامنة' : 'إضافة المنتج للمخزن'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('product-form').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('pf-name').value.trim();
      const code = document.getElementById('pf-code').value.trim();
      const catSelect = document.getElementById('pf-category').value;
      const customCat = document.getElementById('pf-custom-cat').value.trim();
      const category = (catSelect === '__custom__' && customCat) ? customCat : catSelect;
      const unit = document.getElementById('pf-unit').value.trim() || 'قطعة';
      const price = Number(document.getElementById('pf-price').value) || 0;
      const stock = Number(document.getElementById('pf-stock').value) || 0;
      const image = document.getElementById('pf-image').value.trim();
      const description = document.getElementById('pf-desc').value.trim();

      const latestData = getData();
      let allProducts = [...(latestData.products || window.DEFAULT_PRODUCTS || [])];

      if (existing) {
        const pIdx = allProducts.findIndex(p => p.id === existing.id);
        if (pIdx !== -1) {
          allProducts[pIdx] = {
            ...allProducts[pIdx],
            name, code, category, unit, price, stock, image, description,
            updatedAt: new Date().toISOString()
          };
        }
        await getEngine().commitData('products', allProducts);
        window.showToast('تم تحديث بيانات المنتج والمخزن ومزامنتها بنجاح', 'success');
      } else {
        const newProd = {
          id: 'prod-' + Date.now(),
          name, code, category, unit, price, stock, image, description,
          createdAt: new Date().toISOString()
        };
        allProducts = [newProd, ...allProducts];
        await getEngine().commitData('products', allProducts);
        window.showToast('تمت إضافة المنتج الجديد للمخزن ومزامنته فوراً', 'success');
      }

      window.closeModal();
    };
  };

  // Delete product (Admin restricted)
  window.deleteProduct = function(prodId) {
    const data = getData();
    const products = data.products || window.DEFAULT_PRODUCTS || [];
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    window.showConfirmModal('حذف المنتج', `هل تريد بالتأكيد حذف منتج (${prod.name}) من المخزن؟ سيتم حذفه نهائياً من كافة الأجهزة لضمان عدم الحذف بالخطأ.`, async () => {
      await getEngine().deleteItem('products', prodId);
      window.showToast(`تم حذف المنتج (${prod.name}) بنجاح`, 'success');
    }, 'حذف المنتج', 'إلغاء', true);
  };

  // --- Page 8: Pricing (جدول الأسعار التفاعلي الديناميكي لجميع الوكلاء والمركز) ---
  window.renderPricing = function(container) {
    const data = getData();
    const agents = data.agents || [];
    const pricing = data.pricing || window.DEFAULT_PRICING || {};

    const hq = pricing.headquarters || {
      device: 50000,
      sub1: 25000,
      sub2: 50000,
      sub3: 75000,
      status: 'معتمدة'
    };

    const defAgent = pricing.agentDefault || pricing.agent || {
      device: 45000,
      sub1: 18000,
      sub2: 36000,
      sub3: 54000,
      status: 'معتمدة'
    };

    // Ensure agentPrices mapping exists
    if (!pricing.agentPrices) pricing.agentPrices = {};

    // Auto-populate any registered agent if missing in pricing table
    agents.forEach(ag => {
      if (!pricing.agentPrices[ag.id]) {
        pricing.agentPrices[ag.id] = {
          agentId: ag.id,
          agentName: ag.name,
          agentCode: ag.code,
          device: ag.price || defAgent.device || 45000,
          sub1: defAgent.sub1 || 18000,
          sub2: defAgent.sub2 || 36000,
          sub3: defAgent.sub3 || 54000,
          status: 'معتمدة'
        };
      } else {
        pricing.agentPrices[ag.id].agentName = ag.name;
        pricing.agentPrices[ag.id].agentCode = ag.code;
        if (!pricing.agentPrices[ag.id].status) pricing.agentPrices[ag.id].status = 'معتمدة';
      }
    });

    let approvedCount = 1; // HQ is always approved
    let draftCount = 0;
    agents.forEach(ag => {
      const ap = pricing.agentPrices[ag.id];
      if (ap && ap.status === 'معتمدة') approvedCount++;
      else draftCount++;
    });

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">جدول التسعير الرسمي الموحد</span>
            <h1>الأسعار والرسائل (جدول أسعار الوكلاء والمركز)</h1>
            <p class="subtitle">جدول تفاعلي شامل لتحديد أسعار الأجهزة وتجديد الاشتراكات لكل وكيل بشكل مستقل مع التثبيت الفوري في العمليات</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="resetAllAgentsWholesale()">
              <span>🔄</span> <span>تطبيق أسعار الجملة للكل</span>
            </button>
            <button class="btn btn-primary" onclick="saveAllPricingTable()">
              <span>💾</span> <span>حفظ الأسعار</span>
            </button>
          </div>
        </div>

        <!-- Note Banner as requested -->
        <div class="content-card" style="margin-bottom: 20px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.28); padding: 14px 18px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 14px;">
          <span style="font-size: 1.8rem;">💡</span>
          <div style="font-size: 0.93rem; color: var(--text); line-height: 1.6;">
            <strong style="color: #2563eb; display: block; margin-bottom: 2px; font-size: 1rem;">ملاحظة هامة حول تثبيت الأسعار:</strong>
            حفظ الأسعار لا يغيّر أي سعر محفوظ في عمليات سابقة - السعر الجديد يثبت داخل العملية الجديدة فقط من لحظة الحفظ.
          </div>
        </div>

        <!-- Summary Stats Grid -->
        <div class="stat-grid" style="margin-bottom: 20px;">
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي جهات البيع</span><div class="stat-icon">🏢</div></div>
            <div class="stat-value-group"><span class="stat-value">${agents.length + 1}</span><span class="stat-unit">جهة</span></div>
            <div class="stat-footer"><span>المركز الرئيسي + ${agents.length} وكيل</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الأسعار المعتمدة</span><div class="stat-icon">🟢</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--success);">${approvedCount}</span><span class="stat-unit">جهة معتمدة</span></div>
            <div class="stat-footer"><span>تُطبق فوراً عند إنشاء البيع</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الأسعار المسودة</span><div class="stat-icon">🟡</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--warning);">${draftCount}</span><span class="stat-unit">مسودة</span></div>
            <div class="stat-footer"><span>لم تُعتمد بعد للبيع</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">سعر جهاز المركز (المرجع)</span><div class="stat-icon">📡</div></div>
            <div class="stat-value-group"><span class="stat-value">${formatNumber(hq.device || 50000)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>سعر البيع المباشر للمشترك</span></div>
          </div>
        </div>

        <!-- Interactive Dynamic Pricing Table -->
        <div class="content-card" style="padding: 0; overflow: hidden;">
          <div class="card-header-bar" style="padding: 16px 20px; border-bottom: 1px solid var(--line); margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.4rem;">📊</span>
              <h3 style="margin: 0;">جدول الأسعار التفاعلي لكافة الوكلاء والمركز الرئيسي (Inline Editing)</h3>
            </div>
            <small style="color: var(--muted);">يمكن تعديل أي حقل سعر مباشرة داخل الجدول ثم الضغط على "حفظ الأسعار"</small>
          </div>

          <div class="pricing-table-container">
            <table class="pricing-data-table">
              <thead>
                <tr>
                  <th>الجهة / الوكيل</th>
                  <th>جهاز جديد (د.ع)</th>
                  <th>شهر (د.ع)</th>
                  <th>شهرين (د.ع)</th>
                  <th>3 أشهر (د.ع)</th>
                  <th>الحالة</th>
                  <th style="text-align: center;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                <!-- 1. Headquarters Row (المركز الرئيسي - السعر المرجعي الأساسي) -->
                <tr class="tr-headquarters">
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 1.3rem;">🏢</span>
                      <div>
                        <strong style="color: var(--green); display: block; font-size: 0.95rem;">المركز الرئيسي</strong>
                        <span class="badge badge-success" style="font-size: 0.72rem; padding: 2px 6px;">السعر المرجعي الأساسي</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input type="text" inputmode="numeric" class="inline-price-input" id="p-hq-device" value="${formatNumber(hq.device || 50000)}" oninput="formatInputWithCommas(this)" title="سعر الجهاز الجديد بالمركز">
                  </td>
                  <td>
                    <input type="text" inputmode="numeric" class="inline-price-input" id="p-hq-sub1" value="${formatNumber(hq.sub1 || 25000)}" oninput="formatInputWithCommas(this)" title="اشتراك شهر واحد بالمركز">
                  </td>
                  <td>
                    <input type="text" inputmode="numeric" class="inline-price-input" id="p-hq-sub2" value="${formatNumber(hq.sub2 || 50000)}" oninput="formatInputWithCommas(this)" title="اشتراك شهرين بالمركز">
                  </td>
                  <td>
                    <input type="text" inputmode="numeric" class="inline-price-input" id="p-hq-sub3" value="${formatNumber(hq.sub3 || 75000)}" oninput="formatInputWithCommas(this)" title="اشتراك 3 أشهر بالمركز">
                  </td>
                  <td>
                    <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; font-size: 0.85rem;">
                      <span>🟢</span> <span>معتمدة (المرجع)</span>
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="resetHQToDefault()" style="font-size: 0.75rem; padding: 4px 8px;" title="استعادة أسعار المركز الافتراضية">
                      🔄 استعادة
                    </button>
                  </td>
                </tr>

                <!-- 2. Agents Rows (جميع الوكلاء المسجلين في النظام) -->
                ${agents.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align: center; color: var(--muted); padding: 30px;">
                      لا يوجد وكلاء مسجلون حالياً. عند إضافة وكيل جديد من صفحة الوكلاء سيظهر هنا تلقائياً.
                    </td>
                  </tr>
                ` : agents.map((ag, idx) => {
                  const ap = pricing.agentPrices[ag.id] || {
                    device: ag.price || defAgent.device || 45000,
                    sub1: defAgent.sub1 || 18000,
                    sub2: defAgent.sub2 || 36000,
                    sub3: defAgent.sub3 || 54000,
                    status: 'معتمدة'
                  };
                  const isApproved = ap.status === 'معتمدة';

                  return `
                    <tr id="row-agent-${ag.id}">
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem; background: var(--surface-alt); border: 1px solid var(--line);">
                            #${idx + 1}
                          </div>
                          <div>
                            <strong style="display: block; font-size: 0.92rem;">${escapeHtml(ag.name)}</strong>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                              <span class="badge badge-neutral" style="font-family: monospace; font-size: 0.72rem; padding: 1px 5px;">${escapeHtml(ag.code || 'AG')}</span>
                              <span style="color: var(--muted); font-size: 0.75rem;">${escapeHtml(ag.phone || '')}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <input type="text" inputmode="numeric" class="inline-price-input" id="price-${ag.id}-device" value="${formatNumber(ap.device || 45000)}" oninput="formatInputWithCommas(this)">
                      </td>
                      <td>
                        <input type="text" inputmode="numeric" class="inline-price-input" id="price-${ag.id}-sub1" value="${formatNumber(ap.sub1 || 18000)}" oninput="formatInputWithCommas(this)">
                      </td>
                      <td>
                        <input type="text" inputmode="numeric" class="inline-price-input" id="price-${ag.id}-sub2" value="${formatNumber(ap.sub2 || 36000)}" oninput="formatInputWithCommas(this)">
                      </td>
                      <td>
                        <input type="text" inputmode="numeric" class="inline-price-input" id="price-${ag.id}-sub3" value="${formatNumber(ap.sub3 || 54000)}" oninput="formatInputWithCommas(this)">
                      </td>
                      <td>
                        <select class="status-badge-select ${isApproved ? 'approved' : 'draft'}" id="status-${ag.id}" onchange="this.className = 'status-badge-select ' + (this.value === 'معتمدة' ? 'approved' : 'draft')">
                          <option value="معتمدة" ${isApproved ? 'selected' : ''}>🟢 معتمدة (تُطبق في البيع)</option>
                          <option value="مسودة" ${!isApproved ? 'selected' : ''}>🟡 مسودة (لم تُعتمد)</option>
                        </select>
                      </td>
                      <td style="text-align: center;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 4px 7px;" onclick="copyHQToAgent('${ag.id}')" title="نسخ أسعار المركز لهذا الوكيل">
                            🏢 المركز
                          </button>
                          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 4px 7px;" onclick="resetAgentToWholesale('${ag.id}')" title="استعادة أسعار الجملة القياسية">
                            🔄 جملة
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="padding: 16px 20px; background: var(--surface-alt); border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="font-size: 0.85rem; color: var(--muted); display: flex; align-items: center; gap: 6px;">
              <span>ℹ️</span>
              <span>الأسعار بالدينار العراقي (د.ع). الوكيل الذي حالته "معتمدة" تُطبق أسعاره تلقائياً، والوكيل "مسودة" يُطبق أسعار الجملة الافتراضية.</span>
            </div>
            <button class="btn btn-primary" onclick="saveAllPricingTable()">
              <span>💾</span> <span>حفظ وتثبيت الأسعار لكافة الوكلاء والمركز</span>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  window.saveAllPricingTable = async function() {
    const data = getData();
    const agents = data.agents || [];

    const hqPrices = {
      device: parseNumber(document.getElementById('p-hq-device')?.value) || 50000,
      sub1: parseNumber(document.getElementById('p-hq-sub1')?.value) || 25000,
      sub2: parseNumber(document.getElementById('p-hq-sub2')?.value) || 50000,
      sub3: parseNumber(document.getElementById('p-hq-sub3')?.value) || 75000,
      status: 'معتمدة'
    };

    const updatedAgentPrices = {};
    agents.forEach(ag => {
      const dev = parseNumber(document.getElementById(`price-${ag.id}-device`)?.value) || 45000;
      const s1 = parseNumber(document.getElementById(`price-${ag.id}-sub1`)?.value) || 18000;
      const s2 = parseNumber(document.getElementById(`price-${ag.id}-sub2`)?.value) || 36000;
      const s3 = parseNumber(document.getElementById(`price-${ag.id}-sub3`)?.value) || 54000;
      const st = document.getElementById(`status-${ag.id}`)?.value || 'معتمدة';

      updatedAgentPrices[ag.id] = {
        agentId: ag.id,
        agentName: ag.name,
        agentCode: ag.code,
        device: dev,
        sub1: s1,
        sub2: s2,
        sub3: s3,
        status: st
      };
    });

    const newPricing = {
      headquarters: hqPrices,
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
        sub3: 54000
      },
      agentPrices: updatedAgentPrices,
      updatedAt: new Date().toISOString()
    };

    await getEngine().commitData('pricing', newPricing);
    window.showToast('تم حفظ واعتماد جدول الأسعار بنجاح! الأسعار الجديدة معتمدة للعمليات القادمة', 'success');
  };

  window.savePricingSettings = window.saveAllPricingTable;

  window.copyHQToAgent = function(agentId) {
    const dev = document.getElementById('p-hq-device')?.value || '50,000';
    const s1 = document.getElementById('p-hq-sub1')?.value || '25,000';
    const s2 = document.getElementById('p-hq-sub2')?.value || '50,000';
    const s3 = document.getElementById('p-hq-sub3')?.value || '75,000';

    const elDev = document.getElementById(`price-${agentId}-device`);
    const elS1 = document.getElementById(`price-${agentId}-sub1`);
    const elS2 = document.getElementById(`price-${agentId}-sub2`);
    const elS3 = document.getElementById(`price-${agentId}-sub3`);

    if (elDev) elDev.value = dev;
    if (elS1) elS1.value = s1;
    if (elS2) elS2.value = s2;
    if (elS3) elS3.value = s3;

    window.showToast('تم نسخ أسعار المركز لهذا الوكيل، انقر "حفظ الأسعار" للتثبيت', 'info');
  };

  window.resetAgentToWholesale = function(agentId) {
    const elDev = document.getElementById(`price-${agentId}-device`);
    const elS1 = document.getElementById(`price-${agentId}-sub1`);
    const elS2 = document.getElementById(`price-${agentId}-sub2`);
    const elS3 = document.getElementById(`price-${agentId}-sub3`);

    if (elDev) elDev.value = '45,000';
    if (elS1) elS1.value = '18,000';
    if (elS2) elS2.value = '36,000';
    if (elS3) elS3.value = '54,000';

    window.showToast('تم استعادة أسعار الجملة القياسية لهذا الوكيل', 'info');
  };

  window.resetAllAgentsWholesale = function() {
    const data = getData();
    const agents = data.agents || [];
    agents.forEach(ag => {
      window.resetAgentToWholesale(ag.id);
    });
    window.showToast('تم تطبيق أسعار الجملة الافتراضية لكافة الوكلاء، انقر "حفظ الأسعار" لتثبيتها', 'info');
  };

  window.resetHQToDefault = function() {
    const elDev = document.getElementById('p-hq-device');
    const elS1 = document.getElementById('p-hq-sub1');
    const elS2 = document.getElementById('p-hq-sub2');
    const elS3 = document.getElementById('p-hq-sub3');

    if (elDev) elDev.value = '50,000';
    if (elS1) elS1.value = '25,000';
    if (elS2) elS2.value = '50,000';
    if (elS3) elS3.value = '75,000';

    window.showToast('تم استعادة أسعار المركز الافتراضية', 'info');
  };

  // --- Page 9: Users ---
  window.renderUsers = function(container) {
    const data = getData();
    const users = data.users || [];
    const currentUser = getEngine().currentUser;
    const isMainAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'أدمن' || currentUser.role === 'مدير رئيسي');
    
    // Filter to only show relevant users
    const filteredUsers = users.filter(u => u.username === 'admin' || u.username === 'abodsari' || u.role === 'agent');

    const adminUsers = filteredUsers.filter(u => u.role === 'admin' || u.role === 'أدمن' || u.role === 'مدير رئيسي' || u.username === 'admin' || u.username === 'abodsari');

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">إدارة الحسابات والأدوار</span>
            <h1>حساب الادمن</h1>
            <p class="subtitle">حسابات الدخول للأدمن وربطها مع Firebase Auth</p>
          </div>
        </div>

        <div class="content-card" style="margin-bottom: 24px; border: 1px solid var(--danger);">
          <div class="card-header-bar">
            <h3 style="color: var(--danger);">⚠️ إدارة حصة استهلاك Firebase (Firestore Quota)</h3>
          </div>
          <p style="padding: 10px 16px;">حالة النظام الحالية: <strong>${window.firestoreQuotaExceeded ? 'تم تجاوز الحصة (العمل محلياً فقط)' : 'طبيعية'}</strong></p>
          <div style="padding: 0 16px 16px 16px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="window.syncEngine.resetQuota(); window.location.reload();">إعادة تعيين حالة الحصة (محاولة الاتصال مجدداً)</button>
            <button class="btn btn-danger" onclick="window.clearAllDataUI()">مسح جميع البيانات والبدء من جديد</button>
          </div>
        </div>

        <div class="content-card" style="margin-bottom: 24px;">
          <div class="card-header-bar">
            <h3>🛡️ جدول الأدمن والمدراء</h3>
            <span class="badge badge-primary">${adminUsers.length} حساب</span>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>اسم الحساب (Username)</th>
                  <th>الدور / الصلاحية</th>
                  <th>رمز الوكيل</th>
                  <th>كلمة المرور</th>
                </tr>
              </thead>
              <tbody>
                ${adminUsers.map((u) => `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">
                          ${(u.displayName || u.username).substring(0, 1)}
                        </div>
                        <strong>${escapeHtml(u.displayName || u.username)}</strong>
                      </div>
                    </td>
                    <td><span style="font-family: monospace; font-size: 0.9rem;">${escapeHtml(u.username)}</span></td>
                    <td>
                      <span class="badge badge-primary">مدير رئيسي</span>
                    </td>
                    <td>${escapeHtml(u.agentCode || '-')}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <span id="pass-${u.uid}" style="color: var(--muted); font-size: 0.85rem;">••••••••</span>
                        <button class="icon-btn" onclick="togglePasswordVisibility('${u.uid}', '${escapeHtml(u.password || '')}')" title="عرض/إخفاء كلمة المرور">👁️</button>
                        <button class="icon-btn" onclick="openUserModal('${u.uid}')" title="تعديل الحساب">✏️</button>
                        ${u.username !== 'admin' ? `<button class="icon-btn btn-del" onclick="deleteUser('${u.uid}')" title="حذف الحساب">🗑️</button>` : ''}
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

  window.openUserModal = function(uid) {
    const data = getData();
    const users = data.users || [];
    const agents = data.agents || [];
    const existing = uid ? users.find(u => u.uid === uid) : null;
    const modalContainer = document.getElementById('modal-container');

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${existing ? 'تعديل بيانات الحساب' : 'إضافة حساب جديد'}</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="user-mgmt-form">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label>اسم المستخدم (Username) *</label>
                  <input type="text" id="u-username" required placeholder="3-40 حرف..." value="${escapeHtml(existing?.username || '')}">
                  <span class="form-help">حروف إنجليزية وأرقام ونقاط فقط</span>
                </div>
                <div class="form-group">
                  <label>الاسم الظاهر الكامل *</label>
                  <input type="text" id="u-display" required value="${escapeHtml(existing?.displayName || '')}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>نوع الصلاحية *</label>
                  <select id="u-role" onchange="toggleAgentUserFields(this.value)">
                    <option value="agent" ${existing?.role === 'agent' ? 'selected' : ''}>وكيل</option>
                    <option value="admin" ${existing?.role === 'admin' ? 'selected' : ''}>مدير رئيسي (أدمن)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>كلمة المرور ${existing ? '(اتركها فارغة لعدم التغيير)' : '*'}</label>
                  <input type="password" id="u-pass" placeholder="6 أحرف على الأقل..." ${existing ? '' : 'required'}>
                </div>
              </div>

              <div id="u-agent-extra" class="form-group" style="${existing?.role === 'admin' ? 'display: none;' : 'display: block;'}">
                <label>رمز الوكيل (Agent Code) *</label>
                <input type="text" id="u-agent-code" placeholder="مثال: AG-001" value="${escapeHtml(existing?.agentCode || '')}">
                <span class="form-help">أدخل كود أو رمز الوكيل يدوياً</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary">حفظ الحساب</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.toggleAgentUserFields = function(role) {
      const extra = document.getElementById('u-agent-extra');
      if (extra) extra.style.display = role === 'admin' ? 'none' : 'block';
    };

    document.getElementById('user-mgmt-form').onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('u-username').value.trim().toLowerCase();
      const displayName = document.getElementById('u-display').value.trim();
      const role = document.getElementById('u-role').value;
      const password = document.getElementById('u-pass').value.trim();
      const agentCode = role === 'agent' ? document.getElementById('u-agent-code').value.trim() : '';
      const agentName = role === 'agent' ? displayName : '';

      const users = data.users || [];
      const agents = data.agents || [];

      let userObj;
      if (existing) {
        existing.username = username;
        existing.displayName = displayName;
        existing.role = role;
        existing.agentName = agentName;
        existing.agentCode = agentCode;
        if (password) {
          existing.password = password;
        }
        userObj = existing;
      } else {
        const newUid = 'u-' + Date.now();
        userObj = {
          id: newUid,
          uid: newUid,
          username,
          displayName,
          role,
          agentName,
          agentCode,
          password: password || 'agent123'
        };
        users.push(userObj);
      }

      // Sync with agents collection if role === agent
      if (role === 'agent') {
        const existingAgentIndex = agents.findIndex(a => a.id === userObj.uid || a.code === agentCode || a.username === username);
        if (existingAgentIndex >= 0) {
          agents[existingAgentIndex].name = displayName;
          agents[existingAgentIndex].code = agentCode || agents[existingAgentIndex].code;
          agents[existingAgentIndex].username = username;
          if (password) agents[existingAgentIndex].password = password;
        } else {
          agents.push({
            id: userObj.uid,
            name: displayName,
            code: agentCode || 'AG-' + Math.floor(100 + Math.random() * 900),
            phone: '',
            price: 45000,
            username,
            password: password || userObj.password || 'agent123',
            createdAt: new Date().toISOString()
          });
        }
        try {
          await getEngine().commitData('agents', agents);
        } catch (err) {
          console.warn('Failed to sync agent:', err);
        }
      }

      try {
        await getEngine().commitData('users', users);
        if (role === 'agent') {
          await getEngine().saveAgentCredentials(userObj.uid, username, password || userObj.password, { name: displayName, code: agentCode });
        }
        window.showToast('تم حفظ الحساب وتحديث البيانات الرئيسية بنجاح', 'success');
        window.closeModal();
        if (typeof window.renderUsers === 'function') {
          const mainEl = document.getElementById('main-content');
          if (mainEl) window.renderUsers(mainEl);
        }
      } catch (err) {
        console.error('Failed to save user:', err);
        window.showToast('حدث خطأ أثناء حفظ الحساب في القاعدة الرئيسية', 'error');
      }
    };
  };

  window.deleteUser = function(uid) {
    window.showConfirmModal('حذف الحساب نهائياً', 'هل تريد حذف حساب المستخدم هذا نهائياً؟ سيتم مسح الحساب ولن يعود عند إعادة تحميل الصفحة.', async () => {
      const data = getData();
      const targetUser = (data.users || []).find(u => u.uid === uid || u.id === uid);
      if (getEngine() && typeof getEngine().addDeletedUserTombstone === 'function') {
        getEngine().addDeletedUserTombstone(uid, targetUser?.username);
      }
      await getEngine().deleteItem('users', uid);
      window.showToast('تم حذف الحساب نهائياً بنجاح', 'success');
      if (typeof window.renderUsers === 'function') {
        const mainEl = document.getElementById('main-content');
        if (mainEl) window.renderUsers(mainEl);
      }
    }, 'حذف الحساب نهائياً', 'إلغاء', true);
  };

  window.activateLegacyAccounts = function() {
    const tempPass = prompt('أدخل كلمة المرور المؤقتة لتفعيل الحسابات القديمة (على الأقل 6 خانات):', 'sari123456');
    if (!tempPass || tempPass.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');
      return;
    }
    window.showToast('تم تفعيل الحسابات القديمة بكلمة المرور المؤقتة المحددة', 'success');
  };

  // --- Agent Dashboard (role === 'agent') ---
  let agentFilter = { status: 'all', search: '' };
  let agentSubsFilter = { status: 'all', payment: 'all' };
  let agentSubsSearch = '';

  window.agentSubsFilter = agentSubsFilter;

  window.setAgentFilter = function(key, val) {
    agentFilter[key] = val;
    const mainEl = document.getElementById('main-content');
    if (mainEl) window.renderAgentDashboard(mainEl);
  };

  window.setAgentSubsFilter = function(key, val) {
    agentSubsFilter[key] = val;
    const mainEl = document.getElementById('main-content');
    if (mainEl) window.renderAgentDashboard(mainEl);
  };

  window.onAgentSearchInput = function(val) {
    agentFilter.search = (val || '').trim().toLowerCase();
    // Re-filter and update without destroying focus if element exists
    const searchBox = document.getElementById('agent-search-input');
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      window.renderAgentDashboard(mainEl);
      const newSearchBox = document.getElementById('agent-search-input');
      if (newSearchBox) {
        newSearchBox.focus();
        newSearchBox.setSelectionRange(newSearchBox.value.length, newSearchBox.value.length);
      }
    }
  };

  window.onAgentSubsSearchInput = function(val) {
    agentSubsSearch = (val || '').trim().toLowerCase();
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      window.renderAgentDashboard(mainEl);
      const newSearchBox = document.getElementById('agent-subs-search-input');
      if (newSearchBox) {
        newSearchBox.focus();
        newSearchBox.setSelectionRange(newSearchBox.value.length, newSearchBox.value.length);
      }
    }
  };

  // --- Audio Alert for Pending Requests (Admin & Agent) ---
  window.isAdminSoundEnabled = function() {
    return localStorage.getItem('sari_admin_sound_enabled') !== 'false';
  };

  window.isAgentSoundEnabled = function() {
    return localStorage.getItem('sari_agent_sound_enabled') !== 'false';
  };

  window.isAdminRepeatingSoundEnabled = function() {
    return localStorage.getItem('sari_admin_repeating_sound_enabled') !== 'false';
  };

  window.toggleAdminRepeatingSound = function() {
    const isCurrentlyEnabled = window.isAdminRepeatingSoundEnabled();
    const newState = !isCurrentlyEnabled;
    localStorage.setItem('sari_admin_repeating_sound_enabled', newState ? 'true' : 'false');

    if (typeof window.showToast === 'function') {
      window.showToast(newState ? '🔁 تم تفعيل التنبيه الصوتي المتكرر للطلبات المعلقة' : '⏹️ تم إيقاف التنبيه الصوتي المتكرر', 'info');
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl && window.currentPage === 'pending-requests') {
      window.renderPendingRequests(mainEl);
    }
  };

  window.getAdminSoundVolume = function() {
    const v = localStorage.getItem('sari_admin_sound_volume');
    return v !== null ? parseFloat(v) : 20.0;
  };

  window.setAdminSoundVolume = function(val) {
    localStorage.setItem('sari_admin_sound_volume', String(val));
    window.playNotificationChime(true, 'admin');
    if (typeof window.showToast === 'function') {
      window.showToast(`🔊 تم ضبط مستوى صوت التنبيه إلى (${val}x)`, 'success');
    }
    const mainEl = document.getElementById('main-content');
    if (mainEl && window.currentPage === 'pending-requests') {
      window.renderPendingRequests(mainEl);
    }
  };

  // Repeating audio alert interval for pending requests
  if (!window._adminRepeatingSoundInterval) {
    window._adminRepeatingSoundInterval = setInterval(() => {
      try {
        if (window.currentPage === 'pending-requests') {
          const engine = getEngine();
          const subs = engine?.data?.agentSubmissions || [];
          if (subs.length > 0 && window.isAdminSoundEnabled() && window.isAdminRepeatingSoundEnabled()) {
            window.playNotificationChime(true, 'admin');
          }
        }
      } catch (e) {}
    }, 15000); // Repeat every 15 seconds if pending requests are present and repeating sound is active
  }

  // --- Universfield Attention Chime Audio Loading & Pre-decoding ---
  let _sariChimeBuffer = null;
  let _sariChimeLoading = false;

  async function loadSariChimeBuffer() {
    if (_sariChimeBuffer) return _sariChimeBuffer;
    if (_sariChimeLoading) return null;
    _sariChimeLoading = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!window._sariAudioCtx) {
        window._sariAudioCtx = new AudioCtx();
      }
      const ctx = window._sariAudioCtx;

      let arrayBuffer = null;
      // 1. Try from window._sariChimeBase64 if present (zero latency, 100% offline)
      if (window._sariChimeBase64) {
        try {
          const res = await fetch(window._sariChimeBase64);
          arrayBuffer = await res.arrayBuffer();
        } catch (e) {}
      }

      // 2. Fallback to static mp3 files
      if (!arrayBuffer) {
        const audioUrls = ['/attention-chime.mp3', '/universfield-attention-chime-123107.mp3'];
        for (const url of audioUrls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              arrayBuffer = await res.arrayBuffer();
              break;
            }
          } catch (e) {}
        }
      }

      if (arrayBuffer && ctx) {
        _sariChimeBuffer = await new Promise((resolve, reject) => {
          ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });
        window._sariChimeAudioBuffer = _sariChimeBuffer;
      }
    } catch (err) {
      console.warn('Note on pre-decoding chime:', err);
    } finally {
      _sariChimeLoading = false;
    }
    return _sariChimeBuffer;
  }

  // Pre-load on startup
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      loadSariChimeBuffer().catch(() => {});
    }, 200);
  }

  window.playNotificationChime = function(force = false, role = 'agent') {
    try {
      if (role === 'admin') {
        if (!window.isAdminSoundEnabled() && !force) return;
      } else {
        if (!window.isAgentSoundEnabled() && !force) return;
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!window._sariAudioCtx && AudioCtx) {
        window._sariAudioCtx = new AudioCtx();
      }
      const ctx = window._sariAudioCtx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const volMult = typeof window.getAdminSoundVolume === 'function' ? window.getAdminSoundVolume() : 20.0;
      const gainScale = role === 'admin' ? Math.max(0.2, (volMult / 20.0)) : 1.0;

      let playedViaWebAudio = false;

      // 1. Play via Web Audio API BufferSource (High fidelity, zero delay, precise gain amplification)
      if (ctx && ctx.state !== 'closed') {
        const buffer = _sariChimeBuffer || window._sariChimeAudioBuffer;
        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(gainScale, ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start(0);
          playedViaWebAudio = true;
        } else {
          loadSariChimeBuffer().then(buf => {
            if (buf && ctx && ctx.state !== 'closed') {
              const src = ctx.createBufferSource();
              src.buffer = buf;
              const g = ctx.createGain();
              g.gain.setValueAtTime(gainScale, ctx.currentTime);
              src.connect(g);
              g.connect(ctx.destination);
              src.start(0);
            }
          }).catch(() => {});
        }
      }

      // 2. Fallback via HTML5 Audio element
      if (!playedViaWebAudio) {
        const audioSrc = window._sariChimeBase64 || '/attention-chime.mp3';
        const audio = new Audio(audioSrc);
        audio.volume = Math.min(1.0, Math.max(0.1, gainScale > 1.0 ? 1.0 : gainScale));
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Notification audio alert error:', e);
    }
  };

  window.testNotificationChime = function(role = 'agent') {
    window.playNotificationChime(true, role);
    if (typeof window.showToast === 'function') {
      window.showToast('🔔 تم تشغيل نغمة التنبيه المعتمدة (Universfield Attention Chime) بنجاح!', 'info');
    }
  };

  window.toggleAdminSound = function() {
    const isCurrentlyEnabled = window.isAdminSoundEnabled();
    const newState = isCurrentlyEnabled ? 'false' : 'true';
    localStorage.setItem('sari_admin_sound_enabled', newState);

    if (newState === 'true') {
      window.playNotificationChime(true, 'admin');
      if (typeof window.showToast === 'function') {
        window.showToast('🔔 تم تفعيل التنبيه الصوتي للطلبات المعلقة عند الأدمن', 'success');
      }
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast('🔕 تم كتم التنبيه الصوتي للطلبات المعلقة', 'info');
      }
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl && window.currentPage === 'pending-requests') {
      window.renderPendingRequests(mainEl);
    }
  };

  window.toggleAgentSound = function() {
    const isCurrentlyEnabled = window.isAgentSoundEnabled();
    const newState = isCurrentlyEnabled ? 'false' : 'true';
    localStorage.setItem('sari_agent_sound_enabled', newState);

    if (newState === 'true') {
      window.playNotificationChime(true, 'agent');
      if (typeof window.showToast === 'function') {
        window.showToast('🔔 تم تفعيل صوت تنبيه الطلبات المعلقة في لوحة الوكيل', 'success');
      }
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast('🔕 تم كتم صوت التنبيه مؤقتاً', 'info');
      }
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl && (window.currentPage === 'agent-dash' || window.currentPage === 'agent-sales')) {
      window.renderAgentDashboard(mainEl);
    }
  };

  let lastAgentSubmissionIds = null;
  let lastAdminSubmissionIds = null;
  let newlyArrivedSubmissionIds = new Set();

  window.getNewlyArrivedSubmissionIds = function() {
    return newlyArrivedSubmissionIds;
  };

  window.resetAgentNotificationBaseline = function() {
    lastAgentSubmissionIds = null;
    lastAdminSubmissionIds = null;
    newlyArrivedSubmissionIds.clear();
  };

  window.checkAdminPendingSubmissionsNotification = function() {
    try {
      const engine = getEngine();
      if (!engine) return;
      const user = engine.currentUser;
      if (!user) return;

      const isAdmin = user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي';
      if (!isAdmin) return;

      const data = getData();
      const subs = data.agentSubmissions || [];
      const currentIds = new Set(subs.map(s => s.id));

      if (lastAdminSubmissionIds === null) {
        lastAdminSubmissionIds = currentIds;
        return;
      }

      let newCount = 0;
      const addedIds = [];
      for (const id of currentIds) {
        if (!lastAdminSubmissionIds.has(id)) {
          newCount++;
          addedIds.push(id);
          newlyArrivedSubmissionIds.add(id);
        }
      }

      // Remove deleted IDs from newlyArrived set
      for (const id of Array.from(newlyArrivedSubmissionIds)) {
        if (!currentIds.has(id)) {
          newlyArrivedSubmissionIds.delete(id);
        }
      }

      lastAdminSubmissionIds = currentIds;

      if (newCount > 0) {
        // 1. Play alert sound for Admin
        window.playNotificationChime(false, 'admin');

        // 2. Visual Toast Alert
        if (typeof window.showToast === 'function') {
          const msg = newCount === 1 
            ? '🔔 وصول طلب تجديد جديد بانتظار اعتمادك في صفحة الطلبات المعلقة!' 
            : `🔔 وصول ${newCount} طلبات تجديد جديدة بانتظار اعتمادك في صفحة الطلبات المعلقة!`;
          window.showToast(msg, 'warning');
        }

        // 3. Highlight sidebar badge with animation
        const badge = document.getElementById('pending-requests-badge');
        if (badge) {
          badge.classList.add('sidebar-pending-pulse');
          setTimeout(() => badge.classList.remove('sidebar-pending-pulse'), 8000);
        }

        // 4. If current page is pending-requests, refresh view to show new card highlights and sound
        const mainEl = document.getElementById('main-content');
        if (mainEl && window.currentPage === 'pending-requests' && typeof window.renderPendingRequests === 'function') {
          window.renderPendingRequests(mainEl);
        }
      }
    } catch (err) {
      console.warn('Error checking admin pending submissions:', err);
    }
  };

  window.checkAgentPendingSubmissionsNotification = function() {
    try {
      const engine = getEngine();
      if (!engine) return;
      const user = engine.currentUser;
      if (!user) return;

      const isAgent = user.role !== 'admin' && user.role !== 'أدمن' && user.role !== 'مدير رئيسي';
      const isAgentDash = (window.currentPage === 'agent-dash' || window.currentPage === 'agent-sales');
      if (!isAgent && !isAgentDash) return;

      const agentName = user.agentName || user.displayName;
      const data = getData();
      const subs = data.agentSubmissions || [];

      // Filter submissions for this agent that are pending
      const myPending = subs.filter(s => {
        const belongsToMe = !isAgent || (s.seller === agentName || s.agentName === agentName || s.submittedBy === user.uid);
        const isPending = !s.status || s.status === 'Pending' || s.approvalStatus === 'قيد الاعتماد';
        return belongsToMe && isPending;
      });

      const currentIds = new Set(myPending.map(s => s.id));

      if (lastAgentSubmissionIds === null) {
        lastAgentSubmissionIds = currentIds;
        return;
      }

      let newCount = 0;
      for (const id of currentIds) {
        if (!lastAgentSubmissionIds.has(id)) {
          newCount++;
        }
      }

      lastAgentSubmissionIds = currentIds;

      if (newCount > 0) {
        window.playNotificationChime(false, 'agent');
        if (typeof window.showToast === 'function') {
          window.showToast(`🔔 ورد ${newCount === 1 ? 'طلب معلق جديد' : `${newCount} طلبات معلقة جديدة`} في لوحة الوكيل!`, 'info');
        }
      }
    } catch (err) {
      console.warn('Error checking agent pending submissions:', err);
    }
  };

  // Pre-unlock AudioContext on user interaction to comply with autoplay restrictions & warm up chime buffer
  ['click', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      if (window._sariAudioCtx && window._sariAudioCtx.state === 'suspended') {
        window._sariAudioCtx.resume().catch(() => {});
      }
      if (!_sariChimeBuffer && !window._sariChimeAudioBuffer && typeof loadSariChimeBuffer === 'function') {
        loadSariChimeBuffer().catch(() => {});
      }
    }, { once: false, passive: true });
  });

  // --- Calculate "Paid to Main / Due to Main" for a Subscriber ---
  window.getSubscriberMainDebtStatus = function(s, data, agentName) {
    if (!data) data = (typeof getData === 'function' ? getData() : {});
    const debts = data.debts || [];
    const sales = data.sales || [];
    const devNum = (s.deviceNumber || '').trim();
    const sName = (s.name || '').trim();

    // Debts linked to this subscriber/device for this agent
    const matchedDebts = debts.filter(d => {
      const isAgent = !agentName || d.seller === agentName || d.agentName === agentName || (d.notes && d.notes.includes(agentName));
      if (!isAgent) return false;

      const matchDev = devNum && (d.deviceNumber === devNum || (d.notes && d.notes.includes(devNum)));
      const matchName = sName && (d.customerName === sName || (d.customerName && d.customerName.includes(sName)) || (d.notes && d.notes.includes(sName)));
      const matchSale = d.saleId && sales.some(sal => sal.id === d.saleId && (sal.deviceNumber === devNum || sal.customerName === sName));
      return matchDev || matchName || matchSale;
    });

    const totalRemaining = matchedDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    const totalPaid = matchedDebts.reduce((sum, d) => sum + (Number(d.paidAmount) || 0), 0);

    // Sales for this device
    const matchedSales = sales.filter(sal => {
      const isAgent = !agentName || sal.seller === agentName || sal.agentName === agentName;
      return isAgent && devNum && sal.deviceNumber === devNum;
    });

    const unpaidSales = matchedSales.filter(sal => {
      const isDebt = sal.paymentMethod === 'دين' || sal.paymentStatus === 'دين' || sal.paymentStatus === 'عليه دين' || sal.paymentStatus === 'غير مسدد';
      const due = (Number(sal.price) || 0) - (Number(sal.agentPaid) || 0);
      return isDebt && due > 0;
    });
    const unpaidSalesDue = unpaidSales.reduce((sum, sal) => sum + ((Number(sal.price) || 0) - (Number(sal.agentPaid) || 0)), 0);

    // 1. Direct payment status check on subscriber record from Headquarters
    const isDirectDebt = s.paymentStatus === 'دين' || s.paymentStatus === 'غير مدفوع' || s.paymentMethod === 'دين';
    const isDirectCash = s.paymentStatus === 'مدفوع' || s.paymentStatus === 'نقد' || s.paymentStatus === 'تم التسديد' || s.paymentMethod === 'نقد';

    // If there is any unpaid/debt amount (overdue or credit renewal) or explicitly marked as debt by Headquarters:
    const overallDue = (Number(totalRemaining) > 0) 
      ? Number(totalRemaining) 
      : (Number(unpaidSalesDue) > 0 
          ? Number(unpaidSalesDue) 
          : (Number(s.remainingAmount) || (isDirectDebt ? (Number(s.price) || 25000) : 0)));

    if (overallDue > 0 || isDirectDebt) {
      const displayAmount = overallDue > 0 ? formatIQD(overallDue) : (s.price ? formatIQD(s.price) : '25,000 د.ع');
      return {
        status: 'مطلوب للرئيسية',
        isPaid: false,
        paymentType: 'دين',
        due: overallDue || Number(s.price) || 25000,
        paid: totalPaid,
        html: `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span class="badge badge-danger" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 700; width: fit-content; padding: 2px 7px; border-radius: 6px;">
              <span>⏳</span> <span>مطلوب (دين)</span>
            </span>
            <div style="font-weight: 800; color: var(--danger); font-size: 0.85rem; font-family: monospace;">
              المتبقي: ${displayAmount}
            </div>
            ${totalPaid > 0 ? `<div style="font-size: 0.72rem; color: var(--muted);">(المسدد: ${formatNumber(totalPaid)} د.ع)</div>` : ''}
          </div>
        `
      };
    }

    // When subscription is renewed in cash, fully settled, or marked as paid by Headquarters:
    const paidSum = totalPaid > 0 ? totalPaid : (Number(s.paidAmount) || Number(matchedSales[0]?.price) || Number(s.price) || 25000);
    return {
      status: 'تم التسديد للرئيسية',
      isPaid: true,
      paymentType: 'نقد',
      due: 0,
      paid: paidSum,
      html: `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 700; width: fit-content; padding: 2px 7px; border-radius: 6px;">
            <span>✅</span> <span>نقد (مسدد)</span>
          </span>
          <div style="font-weight: 800; color: var(--green); font-size: 0.85rem; font-family: monospace;">
            المسدد: ${formatIQD(paidSum)}
          </div>
        </div>
      `
    };
  };

  // --- Determine who activated the subscription (Agent requested vs Headquarters activated) ---
  window.getSubscriberActivator = function(sub, data, agentName) {
    if (!data) data = (typeof getData === 'function' ? getData() : {});
    const devNum = String(sub.deviceNumber || '').trim();
    const subName = String(sub.name || '').trim();

    // 1. Explicit property on subscriber record
    if (sub.activatedByType === 'agent' || sub.requestedByAgent === true) {
      const name = sub.activatedBy || sub.owner || agentName || 'الوكيل';
      return {
        isAgent: true,
        type: 'agent',
        name: name,
        html: `
          <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;">
            <span>👤</span> <span>الوكيل (${escapeHtml(name)})</span>
          </span>
        `
      };
    }

    if (sub.activatedByType === 'hq' || sub.activatedBy === 'المركز الرئيسي' || sub.activatedBy === 'الرئيسية') {
      return {
        isAgent: false,
        type: 'hq',
        name: 'المركز الرئيسي',
        html: `
          <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;">
            <span>🏢</span> <span>المركز الرئيسي</span>
          </span>
        `
      };
    }

    // 2. Check pending or past agent submissions
    const submissions = data.agentSubmissions || [];
    const matchedSubmission = submissions.find(s => {
      const sDev = String(s.deviceNumber || '').trim();
      const sCust = String(s.customerName || '').trim();
      return (devNum && sDev === devNum) || (subName && sCust === subName);
    });
    if (matchedSubmission) {
      const name = matchedSubmission.agentName || matchedSubmission.seller || agentName || 'الوكيل';
      return {
        isAgent: true,
        type: 'agent',
        name: name,
        html: `
          <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;">
            <span>👤</span> <span>الوكيل (${escapeHtml(name)})</span>
          </span>
        `
      };
    }

    // 3. Check sales records for approved agent requests
    const sales = data.sales || [];
    const matchedSales = sales.filter(s => {
      const sDev = String(s.deviceNumber || '').trim();
      const sCust = String(s.customerName || '').trim();
      return (devNum && sDev === devNum) || (subName && sCust === subName);
    });

    const approvedAgentSale = matchedSales.find(s => s.approvalStatus === 'معتمدة' || s.requestedBy || s.submittedBy);
    if (approvedAgentSale) {
      const name = approvedAgentSale.agentName || approvedAgentSale.seller || agentName || 'الوكيل';
      return {
        isAgent: true,
        type: 'agent',
        name: name,
        html: `
          <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;">
            <span>👤</span> <span>الوكيل (${escapeHtml(name)})</span>
          </span>
        `
      };
    }

    // 4. If activated by Headquarters without an agent order/submission:
    return {
      isAgent: false,
      type: 'hq',
      name: 'المركز الرئيسي',
      html: `
        <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px;">
          <span>🏢</span> <span>المركز الرئيسي</span>
        </span>
      `
    };
  };

  window.renderAgentDashboard = function(container) {
    const user = getEngine().currentUser;
    const data = getData();
    const agentName = user.agentName || user.displayName;
    const today = new Date().toISOString().substring(0, 10);
    const isSoundEnabled = window.isAgentSoundEnabled ? window.isAgentSoundEnabled() : true;

    const allMySales = (data.sales || []).filter(s => 
      s.seller === agentName || 
      s.agentName === agentName ||
      s.seller === user.displayName || 
      s.seller === user.username ||
      s.agentCode === user.agentCode ||
      (user.agentCode && s.seller && s.seller.includes(user.agentCode)) ||
      (typeof window.resolveAgentName === 'function' && window.resolveAgentName(s) === agentName)
    );
    const myDebts = (data.debts || []).filter(d => (d.seller === agentName || (d.customerName && d.customerName.includes(agentName))) && d.remainingAmount > 0);
    const mySubmissions = (data.agentSubmissions || []).filter(s => s.seller === agentName || s.agentName === agentName || s.submittedBy === user.uid);
    const allMySubscribers = (data.subscribers || []).filter(s => 
      s.owner === agentName || 
      s.owner === user.displayName || 
      s.owner === user.agentCode ||
      s.agentName === agentName ||
      s.seller === agentName ||
      (user.agentCode && s.owner && s.owner.includes(user.agentCode)) ||
      (typeof window.resolveAgentName === 'function' && window.resolveAgentName(s) === agentName)
    );

    // Harmonize subscriber status identical to Headquarters
    allMySubscribers.forEach(s => {
      const activeStatus = window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(s, today) : (s.status || (s.expiryDate && s.expiryDate >= today ? 'فعال' : 'غير فعال'));
      s.activeStatus = activeStatus;
      s.status = activeStatus;
    });

    // Ensure all active customers registered to this agent are present in sales history (سجل عملياتك ومبيعاتك للزبائن)
    allMySubscribers.forEach(sub => {
      const activeStatus = sub.activeStatus || (window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(sub, today) : sub.status);
      if (activeStatus !== 'فعال') return;

      const cleanDev = String(sub.deviceNumber || '').trim();
      const cleanName = String(sub.name || '').trim();

      const existingSaleIndex = allMySales.findIndex(s => {
        const sDev = String(s.deviceNumber || '').trim();
        const sName = String(s.customerName || '').trim();
        return (cleanDev && cleanDev !== '-' && sDev && sDev === cleanDev) ||
               (cleanName && sName && sName === cleanName) ||
               (sub.saleId && s.id === sub.saleId) ||
               (s.subscriberId && s.subscriberId === sub.id);
      });

      const subType = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(sub, data.sales) : (sub.subscriptionType || '1 شهر');

      if (existingSaleIndex >= 0) {
        allMySales[existingSaleIndex].activeStatus = 'فعال';
        allMySales[existingSaleIndex].status = 'فعال';
        if (!allMySales[existingSaleIndex].subscriptionType || allMySales[existingSaleIndex].subscriptionType === 'اشتراك') {
          allMySales[existingSaleIndex].subscriptionType = subType;
        }
        if (!allMySales[existingSaleIndex].startDate && sub.activationDate) {
          allMySales[existingSaleIndex].startDate = sub.activationDate;
        }
        if (!allMySales[existingSaleIndex].endDate && sub.expiryDate) {
          allMySales[existingSaleIndex].endDate = sub.expiryDate;
        }
      } else {
        const debtStatus = window.getSubscriberMainDebtStatus ? window.getSubscriberMainDebtStatus(sub, data, agentName) : null;
        const isCash = sub.paymentMethod === 'نقد' || sub.paymentStatus === 'نقد' || sub.paymentStatus === 'تم التسديد' || sub.paymentStatus === 'مدفوع' || (debtStatus && debtStatus.isPaid);

        const syntheticSale = {
          id: sub.saleId || ('sale-sub-' + (sub.id || Math.random().toString(36).substring(2, 9))),
          code: sub.code || ('INV-' + (cleanDev ? cleanDev.slice(-4) : (sub.id ? String(sub.id).slice(-4) : '0000'))),
          customerName: sub.name,
          customerPhone: sub.phone || '',
          deviceNumber: sub.deviceNumber || '',
          saleType: sub.saleType || 'اشتراك',
          subscriptionType: subType,
          startDate: sub.activationDate || sub.startDate || today,
          endDate: sub.expiryDate || sub.endDate || '-',
          price: Number(sub.price) || 25000,
          seller: agentName,
          agentName: agentName,
          agentCode: user.agentCode || '',
          paymentMethod: isCash ? 'نقد' : 'دين',
          paymentStatus: isCash ? 'تم التسديد' : 'دين',
          agentPaid: isCash ? (Number(sub.price) || 25000) : 0,
          status: 'فعال',
          activeStatus: 'فعال',
          isSynthesizedFromSubscriber: true,
          createdAt: sub.activationDate || sub.createdAt || new Date().toISOString()
        };
        allMySales.push(syntheticSale);
      }
    });

    // Apply agent filters to sales
    let filteredSales = allMySales.map(s => {
      const isActive = (s.activeStatus === 'فعال' || s.status === 'فعال' || (s.endDate && s.endDate >= today));
      const activeStatus = isActive ? 'فعال' : 'غير فعال';
      return { ...s, activeStatus: activeStatus, status: activeStatus };
    });

    if (agentFilter.status !== 'all') {
      filteredSales = filteredSales.filter(s => s.activeStatus === agentFilter.status);
    }

    if (agentFilter.search) {
      const qRaw = agentFilter.search.trim();
      const qNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(qRaw) : qRaw.toLowerCase();
      const qDigits = qRaw.replace(/\D/g, '');

      filteredSales = filteredSales.filter(s => {
        const cNameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.customerName || '') : (s.customerName || '').toLowerCase();
        const phoneClean = (s.customerPhone || '').replace(/\D/g, '');
        const devClean = (s.deviceNumber || '').replace(/\D/g, '');
        const devRaw = (s.deviceNumber || '').toLowerCase();

        return cNameNorm.includes(qNorm) ||
               (qDigits && (phoneClean.includes(qDigits) || devClean.includes(qDigits))) ||
               devRaw.includes(qRaw.toLowerCase()) ||
               (s.customerPhone || '').includes(qRaw);
      });
    }

    // Filter subscribers - strictly identical to Headquarters status logic + Subscriber table filters (نقد/دين & فعال/غير فعال)
    let filteredSubs = allMySubscribers.map(s => {
      const activeStatus = window.getSubscriberActiveStatus ? window.getSubscriberActiveStatus(s, today) : (s.status || (s.expiryDate && s.expiryDate >= today ? 'فعال' : 'غير فعال'));
      const debtStatus = window.getSubscriberMainDebtStatus ? window.getSubscriberMainDebtStatus(s, data, agentName) : { status: 'نقد', isPaid: true, paymentType: 'نقد' };
      const activator = window.getSubscriberActivator ? window.getSubscriberActivator(s, data, agentName) : { name: 'المركز الرئيسي' };
      return { 
        ...s, 
        activeStatus: activeStatus, 
        status: activeStatus,
        debtStatus: debtStatus,
        paymentType: debtStatus.paymentType || (debtStatus.isPaid ? 'نقد' : 'دين'),
        activator: activator
      };
    });

    // 1. Status filter (فعال / غير فعال)
    if (agentSubsFilter.status !== 'all') {
      filteredSubs = filteredSubs.filter(s => s.activeStatus === agentSubsFilter.status);
    }

    // 2. Payment filter (نقد / دين)
    if (agentSubsFilter.payment !== 'all') {
      filteredSubs = filteredSubs.filter(s => s.paymentType === agentSubsFilter.payment);
    }
    const subSearchQuery = agentSubsSearch || '';
    if (subSearchQuery) {
      const qRaw = subSearchQuery.trim();
      const qNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(qRaw) : qRaw.toLowerCase();
      const qDigits = qRaw.replace(/\D/g, '');

      filteredSubs = filteredSubs.filter(s => {
        const nameNorm = window.normalizeSearchQuery ? window.normalizeSearchQuery(s.name || '') : (s.name || '').toLowerCase();
        const phoneClean = (s.phone || '').replace(/\D/g, '');
        const devClean = (s.deviceNumber || '').replace(/\D/g, '');
        const devRaw = (s.deviceNumber || '').toLowerCase();

        return nameNorm.includes(qNorm) ||
               (qDigits && (phoneClean.includes(qDigits) || devClean.includes(qDigits))) ||
               devRaw.includes(qRaw) ||
               (s.phone || '').includes(qRaw);
      });
    }

    const totalSold = allMySales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const totalDue = myDebts.reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
    
    // Comprehensive calculation of total paid to main by this agent:
    // 1. Sales payments (cash sales or recorded payments on credit sales)
    const countedDebtIds = new Set();
    let calculatedPaid = 0;
    allMySales.forEach(s => {
      let salePaid = Number(s.agentPaid) || 0;
      if (s.paymentStatus === 'تم التسديد' && salePaid === 0) {
        salePaid = Number(s.price) || 0;
      }
      const linkedDebt = (data.debts || []).find(d => 
        (d.saleId && d.saleId === s.id) || 
        (s.code && d.saleCode === s.code) || 
        (s.deviceNumber && d.deviceNumber === s.deviceNumber)
      );
      if (linkedDebt) {
        countedDebtIds.add(linkedDebt.id);
        salePaid = Math.max(salePaid, Number(linkedDebt.paidAmount) || 0);
      }
      calculatedPaid += salePaid;
    });

    // 2. Any debts belonging to this agent with payments (e.g. from debts page) not linked to allMySales
    const standaloneAgentDebts = (data.debts || []).filter(d => 
      !countedDebtIds.has(d.id) && 
      (d.seller === agentName || d.agentName === agentName || (d.customerName && (d.customerName === agentName || d.customerName.includes(agentName))))
    );
    standaloneAgentDebts.forEach(d => {
      calculatedPaid += (Number(d.paidAmount) || 0);
    });

    const totalPaid = calculatedPaid;
    const activeNotifs = (typeof window.getNotifications === 'function' ? window.getNotifications() : []).slice(0, 3);

    container.innerHTML = `
      <div class="page-view">
        <div class="page-header">
          <div class="header-text">
            <span class="greeting-small">أهلاً بك، الوكيل المعتمد</span>
            <h1>${escapeHtml(agentName)}</h1>
            <p class="subtitle">رمز الوكيل: ${escapeHtml(user.agentCode || 'AG')} | إدارة مبيعات الأجهزة والاشتراكات الميدانية</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" onclick="openAgentSaleModal('جهاز جديد')">
              <span>📦</span> <span>بيع جهاز</span>
            </button>
            <button class="btn btn-secondary" onclick="openAgentSaleModal('تجديد اشتراك')">
              <span>🔄</span> <span>تجديد اشتراك</span>
            </button>
          </div>
        </div>

        ${activeNotifs.length > 0 ? `
          <div class="content-card" style="margin-bottom: 20px; border-right: 4px solid var(--green); background: linear-gradient(to left, var(--card-bg), var(--surface-alt)); padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.25rem;">📢</span>
                <strong style="font-size: 0.95rem; color: var(--ink);">تعميمات وتوجيهات الإدارة العامة للمركز</strong>
                <span class="badge badge-info" style="font-size: 0.7rem;">مباشر Firestore</span>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.toggleNotificationDropdown(true)" style="padding: 3px 10px; font-size: 0.78rem;">
                عرض الكل في شريط الإشعارات 🔔
              </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${activeNotifs.map(n => `
                <div style="padding: 10px 14px; background: var(--card-bg); border-radius: var(--radius-sm); border: 1px solid var(--line); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                      <strong style="font-size: 0.88rem; color: var(--ink);">${escapeHtml(n.title)}</strong>
                      <span style="font-size: 0.7rem; color: var(--muted);">— بواسطة: ${escapeHtml(n.sender || 'المدير العام')}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.83rem; color: var(--text-sub); line-height: 1.45;">${escapeHtml(n.message)}</p>
                  </div>
                  <button class="btn btn-sm btn-secondary" onclick="window.markNotificationAsRead('${n.id}')" title="تحديد كمقروء" style="padding: 2px 8px; font-size: 0.74rem; white-space: nowrap;">
                    ✓ استلمت
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">إجمالي المبيعات</span><div class="stat-icon">💰</div></div>
            <div class="stat-value-group"><span class="stat-value">${formatNumber(totalSold)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>عدد العمليات: ${allMySales.length}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">المبالغ المسددة</span><div class="stat-icon">✅</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--success);">${formatNumber(totalPaid)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>الدفعات المستلمة</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">الديون المستحقة عليك</span><div class="stat-icon">⏳</div></div>
            <div class="stat-value-group"><span class="stat-value" style="color: var(--danger);">${formatNumber(totalDue)}</span><span class="stat-unit">د.ع</span></div>
            <div class="stat-footer"><span>المتبقي للإدارة</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header"><span class="stat-title">طلبات بانتظار الاعتماد</span><div class="stat-icon">🔔</div></div>
            <div class="stat-value-group"><span class="stat-value">${mySubmissions.length}</span><span class="stat-unit">طلب</span></div>
            <div class="stat-footer"><span>قيد مراجعة الأدمن</span></div>
          </div>
        </div>

        <!-- Pending Submissions for this Agent -->
        ${mySubmissions.length > 0 ? `
          <div class="content-card pending-alert-card" style="border: 2px solid var(--warning); background: var(--warning-bg); margin-bottom: 24px; max-width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden;">
            <div class="card-header-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
              <h3 style="color: var(--warning); display: flex; align-items: center; gap: 6px; font-size: 1.05rem; word-break: break-word;">
                <span>🔔</span>
                <span>طلباتك المرسلة بانتظار اعتماد الأدمن (${mySubmissions.length})</span>
              </h3>
            </div>

            <!-- Desktop Table View -->
            <div class="table-responsive desktop-only-table" style="max-width: 100%; min-width: 0;">
              <table class="data-table" style="width: 100%;">
                <thead>
                  <tr>
                    <th>الزبون</th>
                    <th>رقم الجهاز</th>
                    <th>نوع الاشتراك</th>
                    <th>فترة الاشتراك</th>
                    <th>المبلغ</th>
                    <th>الحالة</th>
                    <th style="text-align: center; width: 64px;">إلغاء الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  ${mySubmissions.map(req => `
                    <tr>
                      <td><strong class="cell-title">${escapeHtml(req.customerName)}</strong></td>
                      <td style="font-family: monospace; font-size: 0.84rem;"><span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal('${escapeHtml(req.deviceNumber)}')" title="انقر لعرض QR Code">${escapeHtml(req.deviceNumber)}</span></td>
                      <td>${escapeHtml(req.subscriptionType)}</td>
                      <td>
                        <div class="cell-date-range" style="direction: ltr;">
                          <span class="cell-date-from">بدء: ${escapeHtml(req.startDate || '-')}</span>
                          <span class="cell-date-to">انتهاء: ${escapeHtml(req.endDate || '-')}</span>
                        </div>
                      </td>
                      <td><strong>${formatIQD(req.price)}</strong></td>
                      <td><span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 4px;"><span>⏳</span> <span>قيد الاعتماد</span></span></td>
                      <td style="text-align: center;">
                        <button type="button" class="btn-cancel-sub" onclick="cancelAgentSubmission('${escapeHtml(req.id)}')" title="إلغاء الطلب وسحبه من الاعتماد" aria-label="إلغاء الطلب" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 1.15rem; font-weight: 900; cursor: pointer; transition: all 0.2s; line-height: 1;">
                          ✕
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Cards View for Pending Submissions -->
            <div class="mobile-only-cards" style="display: none; flex-direction: column; gap: 10px; width: 100%;">
              ${mySubmissions.map(req => `
                <div style="background: var(--card-bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-sm); width: 100%; box-sizing: border-box;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <strong style="color: var(--text-main); font-size: 0.92rem;">👤 ${escapeHtml(req.customerName)}</strong>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="badge badge-warning" style="font-size: 0.72rem; padding: 2px 8px;">⏳ قيد الاعتماد</span>
                      <button type="button" class="btn-cancel-sub" onclick="cancelAgentSubmission('${escapeHtml(req.id)}')" title="إلغاء الطلب وسحبه من الاعتماد" aria-label="إلغاء الطلب" style="display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 1.1rem; font-weight: 900; cursor: pointer; transition: all 0.2s; line-height: 1;">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.82rem;">
                    <span style="color: var(--muted);">الجهاز:</span>
                    <span style="font-family: monospace; font-weight: 700; color: var(--green); cursor: pointer; text-decoration: underline;" onclick="showDeviceBarcodeModal('${escapeHtml(req.deviceNumber)}')">📱 ${escapeHtml(req.deviceNumber)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.82rem;">
                    <span style="color: var(--muted);">الاشتراك:</span>
                    <span class="badge badge-neutral" style="font-size: 0.72rem;">${escapeHtml(req.subscriptionType)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.82rem;">
                    <span style="color: var(--muted);">الفترة:</span>
                    <span style="direction: ltr; font-size: 0.78rem; color: var(--text-sub);">${escapeHtml(req.startDate || '-')} ~ ${escapeHtml(req.endDate || '-')}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px dashed var(--line);">
                    <span style="color: var(--muted); font-size: 0.82rem;">المبلغ:</span>
                    <strong style="color: var(--green); font-size: 0.95rem;">${formatIQD(req.price)}</strong>
                  </div>
                </div>
              `).join('')}
            </div>

          </div>
        ` : ''}



        <!-- Agent's Customers / Subscribers List -->
        <div class="content-card">
          <div class="card-header-bar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <h3 style="margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>👥</span> <span>قائمة المشتركين والزبائن المسجلين لك (${filteredSubs.length})</span>
              </h3>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <!-- Filter for Cash / Debt (نقد / دين) -->
              <div class="filter-chips">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--muted); margin-left: 2px;">الدفع:</span>
                <span class="chip ${agentSubsFilter.payment === 'all' ? 'active' : ''}" onclick="setAgentSubsFilter('payment', 'all')">الكل</span>
                <span class="chip ${agentSubsFilter.payment === 'نقد' ? 'active' : ''}" onclick="setAgentSubsFilter('payment', 'نقد')">💵 نقد</span>
                <span class="chip ${agentSubsFilter.payment === 'دين' ? 'active' : ''}" onclick="setAgentSubsFilter('payment', 'دين')">⏳ دين</span>
              </div>

              <!-- Filter for Active / Inactive (فعال / غير فعال) -->
              <div class="filter-chips">
                <span style="font-size: 0.82rem; font-weight: 700; color: var(--muted); margin-left: 2px;">الحالة:</span>
                <span class="chip ${agentSubsFilter.status === 'all' ? 'active' : ''}" onclick="setAgentSubsFilter('status', 'all')">الكل</span>
                <span class="chip ${agentSubsFilter.status === 'فعال' ? 'active' : ''}" onclick="setAgentSubsFilter('status', 'فعال')">🟢 فعال</span>
                <span class="chip ${agentSubsFilter.status === 'غير فعال' ? 'active' : ''}" onclick="setAgentSubsFilter('status', 'غير فعال')">🔴 غير فعال</span>
              </div>

              <!-- Search Input for Subscribers -->
              <div class="search-box" style="position: relative; display: flex; align-items: center;">
                <span class="search-icon">🔍</span>
                <input type="text" id="agent-subs-search-input" placeholder="بحث بالاسم، الهاتف، الجهاز..." value="${escapeHtml(agentSubsSearch)}" oninput="onAgentSubsSearchInput(this.value)">
                ${agentSubsSearch ? `<button type="button" onclick="onAgentSubsSearchInput('')" style="position: absolute; left: 10px; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 0.9rem; padding: 2px 6px;" title="إلغاء البحث">✕</button>` : ''}
              </div>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المشترك / الهاتف</th>
                  <th>رقم الجهاز</th>
                  <th>نوع البيع</th>
                  <th>فترة الاشتراك</th>
                  <th>حالة الاشتراك</th>
                  <th>من فعّل الاشتراك</th>
                  <th>الدفع</th>
                  <th style="text-align: center;">إجراءات / تجديد</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSubs.length === 0 ? `<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 30px;">لا يوجد مشتركون مطابقون للفلتر أو البحث المحدد</td></tr>` : 
                  filteredSubs.map(sub => {
                    const isActive = (sub.activeStatus === 'فعال');
                    const debtStatus = isActive ? (sub.debtStatus || (window.getSubscriberMainDebtStatus ? window.getSubscriberMainDebtStatus(sub, data, agentName) : { html: '-' })) : { html: '<span style="color: var(--muted);">-</span>' };
                    const activator = isActive ? (sub.activator || (window.getSubscriberActivator ? window.getSubscriberActivator(sub, data, agentName) : { html: '-' })) : { html: '<span style="color: var(--muted);">-</span>' };
                    const subTypeLabel = isActive ? (window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(sub, data.sales) : (sub.subscriptionType || '1 شهر')) : '';
                    return `
                    <tr>
                      <td>
                        <strong class="cell-title">${escapeHtml(sub.name)}</strong>
                        <div class="cell-subtitle" style="direction: ltr; text-align: right;">${escapeHtml(sub.phone || '-')}</div>
                      </td>
                      <td style="font-family: monospace; font-size: 0.84rem;"><span style="cursor: pointer; color: var(--green); text-decoration: underline; font-weight: 700;" onclick="showDeviceBarcodeModal('${escapeHtml(sub.deviceNumber)}')" title="انقر لعرض QR Code">${escapeHtml(sub.deviceNumber)}</span></td>
                      <td>
                        ${subTypeLabel ? `
                        <span class="badge" style="font-weight: 700; font-size: 0.82rem; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 3px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                          📅 ${escapeHtml(subTypeLabel)}
                        </span>` : `<span style="color: var(--muted);">-</span>`}
                      </td>
                      <td>
                        <div class="cell-date-range" style="direction: ltr;">
                          <span class="cell-date-from">بدء: ${escapeHtml(sub.activationDate || '-')}</span>
                          <span class="cell-date-to">انتهاء: ${escapeHtml(sub.expiryDate || '-')}</span>
                        </div>
                      </td>
                      <td>
                        <span class="badge ${sub.activeStatus === 'فعال' ? 'badge-success' : 'badge-danger'}">
                          ${escapeHtml(sub.activeStatus)}
                        </span>
                      </td>
                      <td>
                        ${activator.html}
                      </td>
                      <td>
                        ${debtStatus.html}
                      </td>
                      <td style="text-align: center;">
                        <button type="button" class="btn btn-warning btn-sm" onclick="openAgentRenewalModal('${sub.id}')" style="font-size: 0.8rem; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 700; box-shadow: 0 1px 3px rgba(0,0,0,0.1); ${sub.activeStatus === 'فعال' ? 'display: none;' : ''}" title="فتح نافذة تجديد الاشتراك">
                          <span>🔄</span> <span>تجديد</span>
                        </button>
                      </td>
                    </tr>
                    `;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  window.renderAgentSales = function(container) {
    window.renderAgentDashboard(container);
  };

  // Agent Cancel Pending Submission (Cancels approval & removes from Admin Pending Requests page)
  window.cancelAgentSubmission = async function(subId) {
    if (!subId) return;
    const confirmMessage = 'هل أنت متأكد من إلغاء هذا الطلب وسحبه من الاعتماد؟\nسيتم حذف الطلب نهائياً من قائمة الانتظار ومن صفحة الطلبات للإدارة الرئيسية.';
    window.showConfirmDialog('إلغاء الطلب', confirmMessage, async () => {
      try {
        const engine = getEngine();
        const data = getData();
        const subs = data.agentSubmissions || [];
        const req = subs.find(s => s.id === subId);
        const submittedBy = (req && req.submittedBy) || engine.currentUser?.uid || 'general';

        // 1. Delete from Firestore paths
        if (typeof engine.deleteFirestoreSubmission === 'function') {
          await Promise.all([
            engine.deleteFirestoreSubmission(submittedBy, subId),
            engine.deleteFirestoreSubmission('general', subId),
            engine.deleteFirestoreSubmission('agent', subId),
            engine.deleteFirestoreSubmission(engine.currentUser?.uid, subId)
          ]);
        }
        if (typeof engine.deleteItem === 'function') {
          await engine.deleteItem('agentSubmissions', subId);
        }

        // 2. Commit updated list locally and to cloud
        const updatedSubs = subs.filter(s => s.id !== subId);
        await engine.commitData('agentSubmissions', updatedSubs);

        // 3. Update pending approvals badge
        if (typeof window.updatePendingApprovalsBadge === 'function') {
          window.updatePendingApprovalsBadge();
        }

        window.showToast('تم إلغاء الطلب وسحبه بنجاح من الاعتماد والصفحة الرئيسية', 'info');

        // 4. Re-render UI
        const mainEl = document.getElementById('main-content');
        if (mainEl && typeof window.renderAgentDashboard === 'function') {
          window.renderAgentDashboard(mainEl);
        } else if (typeof window.navigateTo === 'function') {
          window.navigateTo(window.currentPage || 'agent-dash');
        }
      } catch (err) {
        console.error('Error cancelling agent submission:', err);
        window.showToast('حدث خطأ أثناء إلغاء الطلب', 'error');
      }
    });
  };

  // Check if a device is registered to the agent
  window.isDeviceRegisteredToAgent = function(deviceNumber, user, data) {
    if (!deviceNumber || !user) return false;
    const cleanDev = String(deviceNumber).trim();
    if (!cleanDev) return false;

    // Admin has access to all devices
    const isAdmin = user.role === 'admin' || user.role === 'أدمن' || user.role === 'مدير رئيسي';
    if (isAdmin) return true;

    const agentName = (user.agentName || '').trim();
    const displayName = (user.displayName || '').trim();
    const agentCode = (user.agentCode || '').trim();
    const username = (user.username || '').trim().toLowerCase();
    const uid = (user.uid || '').trim();

    const matchesAgent = (val) => {
      if (!val) return false;
      const str = String(val).trim();
      if (agentName && str === agentName) return true;
      if (displayName && str === displayName) return true;
      if (agentCode && str === agentCode) return true;
      if (uid && str === uid) return true;
      if (username && str.toLowerCase() === username) return true;
      return false;
    };

    const latestData = data || (typeof getData === 'function' ? getData() : {});

    // 1. Check in subscribers list
    const subscribers = latestData.subscribers || [];
    const foundSub = subscribers.find(s => String(s.deviceNumber || '').trim() === cleanDev);
    if (foundSub) {
      if (matchesAgent(foundSub.owner) || matchesAgent(foundSub.agentName) || matchesAgent(foundSub.agentCode) || matchesAgent(foundSub.agentId) || matchesAgent(foundSub.submittedBy) || matchesAgent(foundSub.ownerId)) {
        return true;
      }
      return false;
    }

    // 2. Check in sales history
    const sales = latestData.sales || [];
    const foundSale = sales.find(s => String(s.deviceNumber || '').trim() === cleanDev);
    if (foundSale) {
      if (matchesAgent(foundSale.seller) || matchesAgent(foundSale.agentName) || matchesAgent(foundSale.agentCode) || matchesAgent(foundSale.submittedBy) || matchesAgent(foundSale.sellerId)) {
        return true;
      }
      return false;
    }

    // 3. Check in pre-allocated barcode codes
    const codes = latestData.codes || [];
    const foundCode = codes.find(c => String(c.number || '').trim() === cleanDev);
    if (foundCode && foundCode.assignedAgent) {
      if (matchesAgent(foundCode.assignedAgent)) {
        return true;
      }
    }

    return false;
  };

  // Show Alert when device is not registered to the agent
  window.showDeviceNotRegisteredAlert = function(onClose) {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      modalContainer.innerHTML = `
        <div class="modal-overlay active" id="device-warning-modal" onclick="if (event.target === this) window.closeModal()">
          <div class="modal-dialog" style="max-width: 480px; text-align: center; border-top: 5px solid var(--danger); box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
            <div class="modal-body" style="padding: 28px 24px;">
              <div style="font-size: 3.2rem; margin-bottom: 12px; line-height: 1;">🚫</div>
              <h3 style="color: var(--danger); font-size: 1.2rem; font-weight: 800; margin-bottom: 14px;">تنبيه: هذا الجهاز غير مسجل لك</h3>
              
              <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 16px; margin-bottom: 16px; text-align: center;">
                <p style="color: var(--text-main); font-size: 1rem; font-weight: 700; line-height: 1.6; margin: 0 0 10px 0;">
                  تنبيه: هذا الجهاز غير مسجل لك، سيتم الغاء إرسال الطلب للأدمن للاعتماد
                </p>
                <div style="color: #dc2626; font-size: 0.95rem; font-weight: 800; border-top: 1px dashed rgba(239, 68, 68, 0.3); padding-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <span>⚠️</span> <span>يجب ان تقوم ببيع اشتراك لزبون تابع لك</span>
                </div>
              </div>
              
              <p style="color: var(--muted); font-size: 0.82rem; margin: 0; line-height: 1.4;">
                تم إلغاء العملية بالكامل ولم يتم حفظ المشترك أو إرسال أي طلب للمركز الرئيسي.
              </p>
            </div>
            <div class="modal-footer" style="justify-content: center; padding-top: 0; border-top: none; padding-bottom: 22px;">
              <button type="button" class="btn btn-primary" id="btn-close-device-warn" style="min-width: 140px; font-weight: 700; padding: 10px 24px; font-size: 0.95rem;">حسناً، فهمت</button>
            </div>
          </div>
        </div>
      `;

      const btnClose = document.getElementById('btn-close-device-warn');
      if (btnClose) {
        btnClose.onclick = () => {
          window.closeModal();
          if (typeof onClose === 'function') onClose();
        };
      }
    }

    if (typeof window.showToast === 'function') {
      window.showToast('تنبيه: هذا الجهاز غير مسجل لك، سيتم الغاء إرسال الطلب للأدمن للاعتماد. يجب ان تقوم ببيع اشتراك لزبون تابع لك', 'error');
    }
  };

  // Agent Submit Sale Modal
  window.openAgentSaleModal = function(type) {
    const user = getEngine().currentUser;
    const agPricing = window.getAgentPricing ? window.getAgentPricing(user?.agentName || user?.displayName) : {};
    const defaultPrice = type === 'جهاز جديد' ? (agPricing.device || 45000) : (agPricing.sub1 || 18000);
    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().substring(0, 10);
    const endDef = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${type === 'جهاز جديد' ? 'طلب بيع جهاز جديد للزبون' : 'طلب تجديد اشتراك للزبون'}</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="agent-sub-form">
            <div class="modal-body">
              <div class="form-group">
                <label>رقم الجهاز *</label>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="as-device" required placeholder="رقم الجهاز..." style="font-family: monospace;" oninput="onAgentDeviceInput(this.value)">
                  <button type="button" class="btn btn-secondary" onclick="openScannerModal((code) => { document.getElementById('as-device').value = code; onAgentDeviceInput(code); })">📷 مسح</button>
                </div>
                <div id="as-device-alert" style="display: none; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.35); color: #dc2626; padding: 10px 12px; border-radius: 8px; font-size: 0.84rem; font-weight: 700; margin-top: 8px; text-align: right; line-height: 1.5;">
                  <span>⚠️ تنبيه: هذا الجهاز غير مسجل لك، سيتم الغاء إرسال الطلب للأدمن للاعتماد.</span><br>
                  <span style="color: #b91c1c; font-weight: 800;">📢 يجب ان تقوم ببيع اشتراك لزبون تابع لك</span>
                </div>
              </div>

              <!-- Customer Name & Phone: Manually entered and NOT locked for New Device Sale -->
              <div class="form-row">
                <div class="form-group">
                  <label>اسم الزبون * ${type === 'جهاز جديد' ? '<span style="color: var(--green); font-size: 0.8rem; font-weight: normal;">(إدخال يدوي)</span>' : '<span style="color: var(--muted); font-size: 0.8rem; font-weight: normal;">(تلقائي/يدوي)</span>'}</label>
                  <input type="text" id="as-name" required placeholder="${type === 'جهاز جديد' ? 'أدخل اسم الزبون يدوياً...' : 'أدخل رقم الجهاز ليتم جلب اسم الزبون تلقائياً...'}" ${type !== 'جهاز جديد' ? 'readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600;"' : 'style="font-weight: 600;"'}>
                </div>
                <div class="form-group">
                  <label>رقم هاتف الزبون ${type === 'جهاز جديد' ? '<span style="color: var(--green); font-size: 0.8rem; font-weight: normal;">(إدخال يدوي)</span>' : ''}</label>
                  <input type="text" id="as-phone" placeholder="0770xxxxxxx" ${type !== 'جهاز جديد' ? 'readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600;"' : ''}>
                </div>
              </div>

              ${type === 'تجديد اشتراك' ? `
              <!-- Subscription Duration Selection (Automatically calculates End Date) -->
              <div class="form-row">
                <div class="form-group">
                  <label>فترة الاشتراك *</label>
                  <select id="as-sub" onchange="updateAgentSubPrice('${type}')">
                    <option value="اشتراك شهر واحد">اشتراك شهر واحد</option>
                    <option value="اشتراك شهرين">اشتراك شهرين</option>
                    <option value="اشتراك 3 أشهر">اشتراك 3 أشهر</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>المبلغ المتوقع (د.ع)</label>
                  <input type="text" id="as-price" value="${formatNumber(defaultPrice)}" readonly style="background: var(--surface-alt); font-weight: 700; color: var(--green);">
                </div>
              </div>

              <!-- Subscription Start & End Dates (Automatically calculated) -->
              <div class="form-row">
                <div class="form-group">
                  <label>تاريخ بدء الاشتراك *</label>
                  <input type="date" id="as-start" value="${today}" onchange="updateAgentSubPrice('${type}')" style="background: var(--surface); font-weight: 600;">
                </div>
                <div class="form-group">
                  <label>تاريخ انتهاء الاشتراك * <span style="font-size: 0.78rem; color: var(--muted);">(محسوب تلقائياً)</span></label>
                  <input type="date" id="as-end" value="${endDef}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600;">
                </div>
              </div>
              ` : `
              <!-- Price for New Device Sale -->
              <div class="form-group" style="margin-bottom: 12px;">
                <label>سعر الجهاز (د.ع) *</label>
                <input type="text" id="as-price" value="${formatNumber(defaultPrice)}" readonly style="background: var(--surface-alt); font-weight: 700; color: var(--green);">
              </div>
              `}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary">إرسال الطلب للاعتماد</button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.onAgentDeviceInput = function(val) {
      const alertBox = document.getElementById('as-device-alert');
      // For New Device Sale: Customer Name and Phone Number must be entered manually by the agent (do not auto-fill or lock them)
      if (type === 'جهاز جديد') {
        if (alertBox) alertBox.style.display = 'none';
        const nameInput = document.getElementById('as-name');
        const phoneInput = document.getElementById('as-phone');
        if (nameInput) {
          nameInput.readOnly = false;
          nameInput.style.background = '';
          nameInput.style.cursor = '';
        }
        if (phoneInput) {
          phoneInput.readOnly = false;
          phoneInput.style.background = '';
          phoneInput.style.cursor = '';
        }
        return;
      }

      const cleanVal = (val || '').trim();
      if (!cleanVal || cleanVal.length < 5) {
        if (alertBox) alertBox.style.display = 'none';
        return;
      }

      const curData = getData();
      const isRegisteredToMe = window.isDeviceRegisteredToAgent(cleanVal, user, curData);
      const nameInput = document.getElementById('as-name');
      const phoneInput = document.getElementById('as-phone');

      if (!isRegisteredToMe) {
        if (alertBox) alertBox.style.display = 'block';
        if (nameInput) {
          nameInput.value = '';
          nameInput.readOnly = true;
          nameInput.style.background = 'var(--surface-alt)';
          nameInput.style.cursor = 'not-allowed';
        }
        if (phoneInput) {
          phoneInput.value = '';
          phoneInput.readOnly = true;
          phoneInput.style.background = 'var(--surface-alt)';
          phoneInput.style.cursor = 'not-allowed';
        }
        return;
      }

      if (alertBox) alertBox.style.display = 'none';

      const subscribers = curData.subscribers || [];
      const sales = curData.sales || [];
      const foundSub = subscribers.find(s => String(s.deviceNumber || '').trim() === cleanVal);
      const foundSale = sales.find(s => String(s.deviceNumber || '').trim() === cleanVal);

      if (foundSub) {
        if (nameInput) {
          nameInput.value = foundSub.name || '';
          nameInput.readOnly = true;
          nameInput.style.background = 'var(--surface-alt)';
          nameInput.style.cursor = 'not-allowed';
        }
        if (phoneInput) {
          phoneInput.value = foundSub.phone || '';
          phoneInput.readOnly = true;
          phoneInput.style.background = 'var(--surface-alt)';
          phoneInput.style.cursor = 'not-allowed';
        }
      } else if (foundSale) {
        if (nameInput) {
          nameInput.value = foundSale.customerName || '';
          nameInput.readOnly = true;
          nameInput.style.background = 'var(--surface-alt)';
          nameInput.style.cursor = 'not-allowed';
        }
        if (phoneInput) {
          phoneInput.value = foundSale.customerPhone || '';
          phoneInput.readOnly = true;
          phoneInput.style.background = 'var(--surface-alt)';
          phoneInput.style.cursor = 'not-allowed';
        }
      }
    };

    window.updateAgentSubPrice = function(saleType) {
      const u = getEngine().currentUser;
      const agPr = window.getAgentPricing ? window.getAgentPricing(u?.agentName || u?.displayName) : {};
      let price = 45000;
      let months = 1;
      if (saleType === 'جهاز جديد') {
        price = agPr.device || 45000;
      } else {
        const subVal = document.getElementById('as-sub')?.value || 'اشتراك شهر واحد';
        if (subVal === 'اشتراك شهر واحد') { price = agPr.sub1 || 18000; months = 1; }
        else if (subVal === 'اشتراك شهرين') { price = agPr.sub2 || 36000; months = 2; }
        else if (subVal === 'اشتراك 3 أشهر') { price = agPr.sub3 || 54000; months = 3; }

        const start = document.getElementById('as-start')?.value || today;
        const endElem = document.getElementById('as-end');
        if (endElem && start) {
          if (typeof window.addMonthsToDate === 'function') {
            endElem.value = window.addMonthsToDate(start, months);
          } else {
            const parts = start.split('-').map(Number);
            const target = new Date(parts[0], parts[1] - 1 + months, parts[2]);
            if (target.getDate() !== parts[2]) target.setDate(0);
            endElem.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
          }
        }
      }
      const priceElem = document.getElementById('as-price');
      if (priceElem) priceElem.value = formatNumber(price);
    };

    window.updateAgentSubPrice(type);

    document.getElementById('agent-sub-form').onsubmit = async (e) => {
      e.preventDefault();
      const customerName = document.getElementById('as-name').value.trim();
      const customerPhone = document.getElementById('as-phone').value.trim();
      const deviceNumber = document.getElementById('as-device').value.trim();
      const isNewDev = type === 'جهاز جديد';
      const subscriptionType = isNewDev ? 'جهاز جديد' : (document.getElementById('as-sub')?.value || 'اشتراك شهر واحد');
      const price = parseNumber(document.getElementById('as-price').value) || defaultPrice;
      const startDate = isNewDev ? today : (document.getElementById('as-start')?.value || today);
      const endDate = isNewDev ? '-' : (document.getElementById('as-end')?.value || endDef);

      const latestData = getData();

      // Validation 1: Pending check
      const subs = latestData.agentSubmissions || [];
      const hasPending = subs.some(s => s.deviceNumber === deviceNumber);
      if (hasPending) {
        alert('هذا الجهاز لديه طلب معلق حالياً بانتظار اعتماد الأدمن!');
        return;
      }

      // Validation 2: Pre-assigned / allocated check in codes (non-blocking notification)
      const codes = latestData.codes || [];
      if (codes.length > 0) {
        const foundCode = codes.find(c => c.number === deviceNumber);
        if (!foundCode) {
          window.showToast('تنبيه: رقم الجهاز غير مسجل في الأكواد المسبقة، ولكن سيتم إرسال الطلب للأدمن للمراجعة', 'info');
        } else if (foundCode.assignedAgent && foundCode.assignedAgent !== user.agentName && foundCode.assignedAgent !== user.username) {
          window.showToast(`تنبيه: هذا الكود مخصص للوكيل (${foundCode.assignedAgent})، ولكن سيتم إرسال الطلب للأدمن للمراجعة`, 'info');
        }
      }

      // Validation 3: New device vs existing renewal check
      if (type === 'جهاز جديد') {
        const isAlreadyRegistered = (latestData.subscribers || []).some(s => s.deviceNumber === deviceNumber);
        if (isAlreadyRegistered) {
          window.showToast('تنبيه: هذا الجهاز مسجل مسبقاً، سيتم إرسال طلب تجديده للأدمن للاعتماد', 'info');
        }
      } else {
        // Renewal check: Device MUST be registered to this agent
        const isRegisteredToMe = window.isDeviceRegisteredToAgent(deviceNumber, user, latestData);
        if (!isRegisteredToMe) {
          window.showDeviceNotRegisteredAlert();
          return;
        }
      }

      await window.submitAgentSale({
        customerName,
        customerPhone,
        deviceNumber,
        subscriptionType,
        saleType: type,
        price,
        startDate,
        endDate
      });
      window.closeModal();
    };
  };

  // --- Agent Subscription Renewal Modal ---
  window.openAgentRenewalModal = function(subId) {
    const user = getEngine().currentUser;
    const data = getData();
    const sub = (data.subscribers || []).find(s => s.id === subId);
    if (!sub) {
      window.showToast('المشترك غير موجود في السجل', 'error');
      return;
    }

    const modalContainer = document.getElementById('modal-container');
    const today = new Date().toISOString().substring(0, 10);
    const agPricing = window.getAgentPricing ? window.getAgentPricing(user?.agentName || user?.displayName) : {};

    // Renewal start date: starts on current expiry date if future, else today
    const startDate = (sub.expiryDate && sub.expiryDate >= today) ? sub.expiryDate : today;
    const initialMonths = 1;
    let initialEndDate = '';
    if (typeof window.addMonthsToDate === 'function') {
      initialEndDate = window.addMonthsToDate(startDate, initialMonths);
    } else {
      const parts = startDate.split('-').map(Number);
      const target = new Date(parts[0], parts[1] - 1 + initialMonths, parts[2]);
      if (target.getDate() !== parts[2]) target.setDate(0);
      initialEndDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    }

    const defaultPrice = agPricing.sub1 || 18000;

    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 580px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3 style="display: flex; align-items: center; gap: 8px;">
                <span>🔄</span> <span>طلب تجديد اشتراك المشترك</span>
              </h3>
              <p class="subtitle" style="margin: 3px 0 0; font-size: 0.84rem; color: var(--muted);">
                تجديد اشتراك الزبون وإرسال الطلب للاعتماد من قبل إدارة المركز
              </p>
            </div>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="agent-renewal-form">
            <div class="modal-body">
              <!-- Subscriber info (Pre-filled & READ-ONLY) -->
              <div class="form-group">
                <label>رقم الجهاز <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                <input type="text" id="ren-device" value="${escapeHtml(sub.deviceNumber)}" readonly style="font-family: monospace; background: var(--surface-alt); cursor: not-allowed; font-weight: 700; color: var(--ink);">
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>اسم المشترك / الزبون <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                  <input type="text" id="ren-name" value="${escapeHtml(sub.name)}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 700; color: var(--ink);">
                </div>
                <div class="form-group">
                  <label>رقم الهاتف <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                  <input type="text" id="ren-phone" value="${escapeHtml(sub.phone || '-')}" readonly style="background: var(--surface-alt); cursor: not-allowed; direction: ltr; text-align: right; font-weight: 600;">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>الوكيل المسؤول <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                  <input type="text" value="${escapeHtml(sub.owner || user.agentName || user.displayName || 'الوكيل')}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600;">
                </div>
                <div class="form-group">
                  <label>حالة الاشتراك الحالية <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                  <input type="text" value="${escapeHtml(sub.status || sub.activeStatus || 'فعال')}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600; color: ${sub.status === 'فعال' || sub.activeStatus === 'فعال' ? 'var(--success)' : 'var(--danger)'};">
                </div>
              </div>

              <!-- ONLY THIS FIELD IS EDITABLE BY THE AGENT: Subscription Period (فترة الاشتراك) -->
              <div style="background: rgba(36, 91, 137, 0.06); padding: 14px; border-radius: var(--radius-md); border: 2px solid var(--green); margin: 8px 0 16px;">
                <div class="form-group" style="margin-bottom: 10px;">
                  <label style="color: var(--green); font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>⚡ فترة الاشتراك المراد تجديدها * (تعديل الوكيل)</span>
                    <span class="badge badge-success" style="font-size: 0.72rem;">حقل قابل للتعديل</span>
                  </label>
                  <select id="ren-duration" onchange="window.updateAgentRenewalModalPrice('${sub.id}')" style="font-weight: 700; font-size: 0.95rem; border: 1.5px solid var(--green);">
                    <option value="اشتراك شهر واحد" data-months="1">اشتراك شهر واحد (1 شهر)</option>
                    <option value="اشتراك شهرين" data-months="2">اشتراك شهرين (2 أشهر)</option>
                    <option value="اشتراك 3 أشهر" data-months="3">اشتراك 3 أشهر</option>
                  </select>
                </div>

                <div class="form-row" style="margin-bottom: 0;">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>تاريخ بدء التجديد <span class="badge badge-neutral" style="font-size: 0.7rem;">للقراءة فقط</span></label>
                    <input type="date" id="ren-start" value="${startDate}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 600;">
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label>تاريخ انتهاء التجديد الجديد <span class="badge badge-neutral" style="font-size: 0.7rem;">محسوب تلقائياً</span></label>
                    <input type="date" id="ren-end" value="${initialEndDate}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 700; color: var(--green);">
                  </div>
                </div>
              </div>

              <!-- Price (Automatically calculated based on period and agent pricing - READ-ONLY) -->
              <div class="form-group">
                <label>المبلغ المتوقع للعملية (د.ع) <span class="badge badge-neutral" style="font-size: 0.7rem;">محسوب تلقائياً حسب تسعيرة الوكيل</span></label>
                <input type="text" id="ren-price" value="${formatNumber(defaultPrice)}" readonly style="background: var(--surface-alt); cursor: not-allowed; font-weight: 800; color: var(--green); font-size: 1.15rem;">
              </div>

              <div class="modal-notice-warning">
                <span>ℹ️</span> <span>سيتم إرسال هذا الطلب كطلب معلق (Pending) إلى المركز الرئيسي لاعتماده وتثبيته.</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-renewal" style="display: inline-flex; align-items: center; gap: 6px;">
                <span>🔄</span> <span>إرسال طلب التجديد للاعتماد</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    window.updateAgentRenewalModalPrice = function(subscriberId) {
      const u = getEngine().currentUser;
      const agPr = window.getAgentPricing ? window.getAgentPricing(u?.agentName || u?.displayName) : {};
      const durationSelect = document.getElementById('ren-duration');
      const selectedOption = durationSelect ? durationSelect.options[durationSelect.selectedIndex] : null;
      const months = selectedOption ? (Number(selectedOption.getAttribute('data-months')) || 1) : 1;

      let price = agPr.sub1 || 18000;
      if (months === 1) price = agPr.sub1 || 18000;
      else if (months === 2) price = agPr.sub2 || 36000;
      else if (months === 3) price = agPr.sub3 || 54000;
      else price = (agPr.sub1 || 18000) * months;

      const priceElem = document.getElementById('ren-price');
      if (priceElem) priceElem.value = formatNumber(price);

      const start = document.getElementById('ren-start')?.value || startDate;
      const endElem = document.getElementById('ren-end');
      if (endElem && start) {
        if (typeof window.addMonthsToDate === 'function') {
          endElem.value = window.addMonthsToDate(start, months);
        } else {
          const parts = start.split('-').map(Number);
          const target = new Date(parts[0], parts[1] - 1 + months, parts[2]);
          if (target.getDate() !== parts[2]) target.setDate(0);
          endElem.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
        }
      }
    };

    document.getElementById('agent-renewal-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-renewal');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> <span>جاري إرسال الطلب...</span>';
      }

      const subscriptionType = document.getElementById('ren-duration').value;
      const price = parseNumber(document.getElementById('ren-price').value) || defaultPrice;
      const renStart = document.getElementById('ren-start').value || startDate;
      const renEnd = document.getElementById('ren-end').value || initialEndDate;

      const latestData = getData();
      const isRegisteredToMe = window.isDeviceRegisteredToAgent(sub.deviceNumber, user, latestData);
      if (!isRegisteredToMe) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>🔄</span> <span>إرسال طلب التجديد للاعتماد</span>';
        }
        window.showDeviceNotRegisteredAlert();
        return;
      }

      const pendingList = latestData.agentSubmissions || [];
      const hasPending = pendingList.some(s => s.deviceNumber === sub.deviceNumber);
      if (hasPending) {
        alert('هذا الجهاز لديه طلب معلق حالياً بانتظار اعتماد الأدمن!');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>🔄</span> <span>إرسال طلب التجديد للاعتماد</span>';
        }
        return;
      }

      await window.submitAgentSale({
        customerName: sub.name,
        customerPhone: sub.phone || '',
        deviceNumber: sub.deviceNumber,
        subscriptionType,
        saleType: 'تجديد اشتراك',
        price,
        startDate: renStart,
        endDate: renEnd
      });

      window.closeModal();
      window.showToast(`تم إرسال طلب تجديد الاشتراك للزبون (${sub.name}) بنجاح للاعتماد`, 'success');
    };
  };

})();
