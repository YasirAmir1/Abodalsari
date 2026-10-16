const fs = require("fs");
let code = fs.readFileSync("app-features.js", "utf8");

// 1. Remove misplaced toolbar from renderDebts if present
const wrongDebtsTarget = "<!-- Status Classification Toolbar above Subscribers Table";
const wrongIdx = code.indexOf(wrongDebtsTarget);
const debtsTableIdx = code.indexOf("<table class=\"data-table\">");
if (wrongIdx !== -1 && wrongIdx < debtsTableIdx) {
  const beforeWrong = code.slice(0, wrongIdx);
  const afterTable = code.slice(debtsTableIdx);
  code = beforeWrong + "  <div class=\"table-responsive\">\n            " + afterTable;
  console.log("Removed misplaced toolbar from renderDebts");
}

// 2. Hide renewal button for agent subscribers and keep only for Main/HQ subscribers
const typeLabelIdx = code.indexOf("const typeLabel = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, sales)");
const returnTrIdx = code.indexOf("return '<tr style=\"' + rowHighlightStyle + '\">' +", typeLabelIdx);

if (typeLabelIdx !== -1 && returnTrIdx !== -1) {
  const oldChunk = code.slice(typeLabelIdx, returnTrIdx);
  const newChunk = `const typeLabel = window.getSubscriberTypeLabel ? window.getSubscriberTypeLabel(s, sales) : (s.subscriptionType || '1 شهر');
      
      // Determine if subscriber belongs to Main / Headquarters vs Agent
      const ownerClean = String(s.owner || '').trim();
      const isMainOwner = !ownerClean || 
                          ownerClean === 'المركز الرئيسي' || 
                          ownerClean === 'الرئيسية' || 
                          ownerClean === 'الادارة' || 
                          ownerClean === 'الإدارة' || 
                          ownerClean === 'main' || 
                          ownerClean === 'hq';

      // زر التجديد يظهر لجميع المشتركين لتفعيل وتجديد اشتراكاتهم مباشرة ورفع القيود
      const showRenewalBtn = true;
      
      `;
  code = code.slice(0, typeLabelIdx) + newChunk + code.slice(returnTrIdx);
  console.log("Inserted showRenewalBtn logic");
}

// 3. Update the cell in renderSubscriberRows to only show renewal button if showRenewalBtn is true
const oldBtnRegex = /'<button class="btn btn-sm btn-success" onclick="openAdminSubscriberRenewalModal\([^)]+\)"[^>]+>🔄 تجديد<\/button>' \+/;
if (oldBtnRegex.test(code)) {
  code = code.replace(oldBtnRegex, "(showRenewalBtn ? ('<button class=\"btn btn-sm btn-success\" onclick=\"openAdminSubscriberRenewalModal(\\'' + s.id + '\\')\" title=\"تجديد اشتراك مشترك المركز الرئيسي وتعديل البيانات\" style=\"padding: 1px 6px; font-size: 0.72rem; border-radius: 4px; background: var(--success, #10b981); color: #fff; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;\">🔄 تجديد</button>') : '') +");
  console.log("Updated renewal button rendering with showRenewalBtn");
}

// 4. Place Status Classification Toolbar and New Sale button replica directly above Subscribers Table
const subsTableNeedle = "<div class=\"table-responsive\">\n            <table class=\"data-table subscribers-table\">";
const subsTableNeedleAlt = "<div class=\"table-responsive\">            <table class=\"data-table subscribers-table\">";

const toolbarHTML = `
        <!-- Status Classification Toolbar & Quick Actions above Subscribers Table (تصنيف المشتركين وزر تسجيل بيع جديد) -->
        <div class="subscribers-status-filter-toolbar">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.9rem; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 6px;">
              <span>⚡</span>
              <span>تصنيف حسب حالة الاشتراك:</span>
            </span>
            <div style="display: inline-flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="sub-status-btn \${subFilter.status === 'all' && subFilter.expiring !== '7days' ? 'active-all' : ''}" onclick="setSubFilter('status', 'all'); setSubFilter('expiring', 'all');">
                <span>الكل</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">\${countAll}</span>
              </button>
              <button type="button" class="sub-status-btn \${subFilter.status === 'فعال' ? 'active-active' : ''}" onclick="setSubFilter('status', 'فعال'); setSubFilter('expiring', 'all');">
                <span>🟢 فعال</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">\${countActive}</span>
              </button>
              <button type="button" class="sub-status-btn \${subFilter.status === 'غير فعال' ? 'active-inactive' : ''}" onclick="setSubFilter('status', 'غير فعال'); setSubFilter('expiring', 'all');">
                <span>🔴 غير فعال</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">\${countInactive}</span>
              </button>
              <button type="button" class="sub-status-btn \${subFilter.status === 'منتهي قريباً' || subFilter.expiring === '7days' ? 'active-expiring' : ''}" onclick="setSubFilter('status', 'منتهي قريباً'); setSubFilter('expiring', '7days');">
                <span>⏳ منتهي قريباً</span>
                <span class="badge" style="background: rgba(0,0,0,0.12); padding: 2px 7px; border-radius: 12px; font-size: 0.78rem;">\${countExpiring}</span>
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
              عرض <strong style="color: var(--text);">\${subs.length}</strong> من إجمالي <strong style="color: var(--text);">\${countAll}</strong> مشترك
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table subscribers-table">`;

if (code.includes(subsTableNeedle)) {
  code = code.replace(subsTableNeedle, toolbarHTML);
  console.log("Inserted toolbarHTML using subsTableNeedle");
} else if (code.includes(subsTableNeedleAlt)) {
  code = code.replace(subsTableNeedleAlt, toolbarHTML);
  console.log("Inserted toolbarHTML using subsTableNeedleAlt");
} else {
  // Regex search for table-responsive before subscribers-table
  const regex = /<div class="table-responsive">\s*<table class="data-table subscribers-table">/;
  if (regex.test(code)) {
    code = code.replace(regex, toolbarHTML);
    console.log("Inserted toolbarHTML using regex");
  } else {
    console.error("Could not find insertion point for toolbar above subscribers-table");
  }
}

fs.writeFileSync("app-features.js", code, "utf8");
console.log("app-features.js processed successfully");
