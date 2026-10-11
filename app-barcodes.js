/**
 * Barcodes & Codes Module: 16-digit Generator, Scanner, QR Rendering, PDF Print
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

  function normalizeDigits(str) {
    if (!str) return '';
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return String(str).replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
                      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d));
  }

  let selectedCodeIds = new Set();

  window.renderBarcodes = function(container) {
    const data = getData();
    const codes = data.codes || [];

    container.innerHTML = `
      <div class="page-view">
        <!-- Banner -->
        <div class="barcode-banner">
          <div>
            <h2>إدارة الأكواد والباركود 📦</h2>
            <p style="opacity: 0.9; margin-top: 4px;">توليد أرقام الأجهزة المكونة من 16 رقماً، طباعة بطاقات QR، والمسح عبر الكاميرا</p>
          </div>
          <div style="font-size: 1.8rem; font-weight: 800; background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: var(--radius-md);">
            ${codes.length} <span style="font-size: 1rem; font-weight: 600;">كود مسجل</span>
          </div>
        </div>

        <!-- Controls Toolbar -->
        <div class="content-card">
          <div class="filters-bar" style="margin-bottom: 0;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="openAddSingleCodeModal()">
                <span>➕</span> <span>إضافة رقم فردي</span>
              </button>
              <button class="btn btn-secondary" onclick="openScannerModal((code) => addSingleCodeDirect(code))">
                <span>📷</span> <span>مسح بالكاميرا / قارئ USB</span>
              </button>
              <button class="btn btn-secondary" onclick="openExcelImportCodesModal()">
                <span>📥</span> <span>استيراد من Excel</span>
              </button>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary" onclick="openPrintModal()">
                <span>🖨️</span> <span>طباعة المحددة / PDF (${selectedCodeIds.size})</span>
              </button>
              <button class="btn btn-secondary" onclick="exportCodesExcel()">
                <span>📤</span> <span>تصدير Excel</span>
              </button>
              <button class="btn btn-outline-danger" onclick="confirmDeleteNewCodes()">
                <span>🗑️</span> <span>حذف وتصفير الأكواد (للبدء من جديد)</span>
              </button>
            </div>
          </div>

          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--line); display: flex; align-items: center; justify-content: space-between;">
            <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer;">
              <input type="checkbox" id="check-select-all" onchange="toggleSelectAllCodes(this.checked)" ${selectedCodeIds.size === codes.length && codes.length > 0 ? 'checked' : ''}>
              <span>تحديد كافة الأكواد (${codes.length})</span>
            </label>
            <span style="font-size: 0.85rem; color: var(--muted);">تم تحديد: ${selectedCodeIds.size} كود</span>
          </div>
        </div>

        <!-- Barcode Cards Grid -->
        <div class="barcode-grid" id="barcode-cards-container">
          ${codes.length === 0 ? `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">لا توجد أكواد مسجلة بعد. استخدم زر "إضافة رقم فردي" أو "استيراد من Excel" لإضافة أكواد جديدة.</p>` :
            codes.map((c, idx) => `
              <div class="barcode-card">
                <div class="barcode-card-header">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" class="barcode-select-item" data-id="${c.id}" ${selectedCodeIds.has(c.id) ? 'checked' : ''} onchange="toggleSelectCode('${c.id}', this.checked)">
                    <span>#${idx + 1}</span>
                  </label>
                  <span class="badge ${c.status === 'مفعل' ? 'badge-success' : 'badge-neutral'}">${escapeHtml(c.status || 'جديد')}</span>
                </div>

                <div class="barcode-number">${escapeHtml(c.number)}</div>

                <!-- QR Container -->
                <div class="qr-box" id="qr-${c.id}"></div>

                <div style="width: 100%; border-top: 1px dashed var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 8px;">
                  <!-- Empty box for manual handwriting info after printing -->
                  <div class="barcode-empty-info-box" onclick="editBarcodeSubscriber('${c.id}')" title="مربع كتابة معلومات المشترك (انقر للتعديل أو اتركه فارغاً للتدوين اليدوي بعد الطباعة)">
                    <div class="info-box-header">
                      <span>معلومات المشترك (تدوين يدوي بعد الطباعة):</span>
                      ${c.subscriberName ? `<button type="button" class="info-box-clear" onclick="event.stopPropagation(); clearBarcodeSubscriber('${c.id}')" title="تفريغ المربع">✕ تفريغ</button>` : ''}
                    </div>
                    <div class="info-box-body">
                      ${c.subscriberName ? escapeHtml(c.subscriberName) : '<span class="empty-hint">مربع فارغ لكتابة وتدوين المعلومات يدوياً بعد الطباعة على ورق</span>'}
                    </div>
                  </div>

                  <div style="display: flex; justify-content: flex-end; align-items: center;">
                    <button class="icon-btn btn-del" onclick="deleteSingleCode('${c.id}')" title="حذف الكود">🗑️</button>
                  </div>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    // Render QRs after DOM update
    setTimeout(() => {
      codes.forEach(c => {
        const el = document.getElementById(`qr-${c.id}`);
        if (el && !el.hasChildNodes() && typeof QRCode !== 'undefined') {
          new QRCode(el, {
            text: c.number,
            width: 152,
            height: 152,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      });
    }, 50);
  };

  window.toggleSelectAllCodes = function(checked) {
    const data = getData();
    const codes = data.codes || [];
    if (checked) {
      codes.forEach(c => selectedCodeIds.add(c.id));
    } else {
      selectedCodeIds.clear();
    }
    window.renderBarcodes(document.getElementById('main-content'));
  };

  window.toggleSelectCode = function(id, checked) {
    if (checked) selectedCodeIds.add(id);
    else selectedCodeIds.delete(id);
    const counterEl = document.querySelector('.barcode-banner');
    if (counterEl) {
      const headerCheck = document.getElementById('check-select-all');
      if (headerCheck) headerCheck.checked = selectedCodeIds.size === (getData().codes || []).length;
    }
  };

  // Generate 16-digit random code: first digit 1-9 (never 0)
  function generate16DigitUnique(existingSet) {
    let code = '';
    do {
      const firstDigit = Math.floor(1 + Math.random() * 9);
      let rest = '';
      for (let i = 0; i < 15; i++) {
        rest += Math.floor(Math.random() * 10);
      }
      code = firstDigit + rest;
    } while (existingSet.has(code));
    return code;
  }

  window.openGenerateCodesModal = function() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 440px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>توليد أرقام عشوائية 16 رقماً</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="gen-codes-form">
            <div class="modal-body">
              <div class="form-group">
                <label>العدد المطلوب توليده (1 - 500) *</label>
                <input type="number" id="gen-count" min="1" max="500" value="20" required autofocus>
                <span class="form-help">جميع الأرقام فريدة ومكونة من 16 خانة، وتبدأ بأرقام غير الصفر.</span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary">توليد الآن</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('gen-codes-form').onsubmit = async (e) => {
      e.preventDefault();
      const count = Number(document.getElementById('gen-count').value) || 10;
      const data = getData();
      const codes = data.codes || [];
      const existingSet = new Set(codes.map(c => c.number));
      const newItems = [];
      const today = new Date().toISOString().substring(0, 10);

      for (let i = 0; i < count; i++) {
        const num = generate16DigitUnique(existingSet);
        existingSet.add(num);
        newItems.push({
          id: 'code-' + Date.now() + '-' + i,
          number: num,
          subscriberName: '',
          status: 'جديد',
          createdAt: today
        });
      }

      await getEngine().commitData('codes', [...newItems, ...codes]);
      window.showToast(`تم توليد ${count} كود بنجاح!`, 'success');
      window.closeModal();
    };
  };

  window.openAddSingleCodeModal = function() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 440px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>إضافة رقم جهاز فردي</h3>
            <button type="button" class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <form id="single-code-form">
            <div class="modal-body">
              <div class="form-group">
                <label>رقم الجهاز *</label>
                <input type="text" id="single-code-num" placeholder="مثال: 8492048593028471" required maxlength="16">
              </div>
              <div class="form-group">
                <label>اسم المشترك (اختياري)</label>
                <input type="text" id="single-code-sub" placeholder="اسم المشترك...">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary">حفظ الكود</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('single-code-form').onsubmit = async (e) => {
      e.preventDefault();
      const rawNum = document.getElementById('single-code-num').value;
      const cleanNum = normalizeDigits(rawNum).replace(/\D/g, '');
      const subName = document.getElementById('single-code-sub').value.trim();

      if (cleanNum.length !== 16) {
        alert('رقم الجهاز يجب أن يتكون من 16 رقماً تماماً');
        return;
      }

      await addSingleCodeDirect(cleanNum, subName);
      window.closeModal();
    };
  };

  async function addSingleCodeDirect(cleanNum, subName = '') {
    const data = getData();
    const codes = data.codes || [];
    if (codes.some(c => c.number === cleanNum)) {
      window.showToast('هذا الرقم مسجل مسبقاً في النظام!', 'error');
      return;
    }

    const newItem = {
      id: 'code-' + Date.now(),
      number: cleanNum,
      subscriberName: subName,
      status: subName ? 'مفعل' : 'جديد',
      createdAt: new Date().toISOString().substring(0, 10)
    };

    await getEngine().commitData('codes', [newItem, ...codes]);
    window.showToast(`تمت إضافة الرقم: ${cleanNum}`, 'success');
  }
  window.addSingleCodeDirect = addSingleCodeDirect;

  window.deleteSingleCode = function(id) {
    window.showConfirmModal('حذف الكود', 'هل تريد حذف هذا الكود نهائياً؟', async () => {
      selectedCodeIds.delete(id);
      if (typeof getEngine().deleteItem === 'function') {
        await getEngine().deleteItem('codes', id);
      } else {
        const data = getData();
        const updated = (data.codes || []).filter(c => c.id !== id);
        await getEngine().commitData('codes', updated);
      }
      window.showToast('تم حذف الكود بنجاح', 'success');
      window.renderBarcodes(document.getElementById('main-content'));
    }, 'حذف الكود', 'إلغاء', true);
  };

  window.confirmDeleteNewCodes = function() {
    const data = getData();
    const codes = data.codes || [];
    if (codes.length === 0) {
      window.showToast('لا توجد أكواد أو باركودات حالياً لمسحها', 'info');
      return;
    }

    window.showConfirmModal(
      'تصفير ومسح الأكواد بالكامل',
      `هل أنت متأكد من رغبتك في حذف وتصفير جميع الأكواد والباركودات الموجودة في الصفحة بالكامل (العدد: ${codes.length} كود)؟\n\nسيتم مسحها بالكامل من النظام السحابي والمحلي لتتمكن من البدء من جديد.`,
      async () => {
        selectedCodeIds.clear();
        if (typeof getEngine().clearCollection === 'function') {
          await getEngine().clearCollection('codes');
        } else {
          await getEngine().commitData('codes', []);
        }
        window.showToast('تم تصفير ومسح جميع الباركودات بنجاح. يمكنك الآن البدء من جديد.', 'success');
        window.renderBarcodes(document.getElementById('main-content'));
      },
      'تصفير وحذف الكل',
      'إلغاء',
      true
    );
  };

  window.clearBarcodeSubscriber = function(id) {
    const data = getData();
    const code = (data.codes || []).find(c => c.id === id);
    if (!code) return;
    code.subscriberName = '';
    code.status = 'جديد';
    getEngine().commitData('codes', data.codes);
    window.showToast('تم تفريغ مربع المشترك', 'info');
    window.renderBarcodes(document.getElementById('main-content'));
  };

  window.editBarcodeSubscriber = function(id) {
    const data = getData();
    const code = (data.codes || []).find(c => c.id === id);
    if (!code) return;
    const name = prompt('أدخل اسم أو معلومات المشترك لهذا الكود (أو اتركه فارغاً للتدوين اليدوي على الورق):', code.subscriberName || '');
    if (name !== null) {
      code.subscriberName = name.trim();
      code.status = code.subscriberName ? 'مفعل' : 'جديد';
      getEngine().commitData('codes', data.codes);
      window.showToast('تم حفظ معلومات المشترك للكود', 'success');
      window.renderBarcodes(document.getElementById('main-content'));
    }
  };

  // Print selected barcodes modal with 2 columns x 3 rows per page (6 barcodes per page)
  window.openPrintModal = function() {
    const data = getData();
    const codes = data.codes || [];
    const toPrint = selectedCodeIds.size > 0 ? codes.filter(c => selectedCodeIds.has(c.id)) : codes;

    if (toPrint.length === 0) {
      alert('لا توجد أكواد للطباعة');
      return;
    }

    const estimatedPages = Math.ceil(toPrint.length / 6);

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" style="max-width: 500px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>طباعة بطاقات الباركود و PDF</h3>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--surface-alt); padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--line); margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700;">عدد البطاقات المحددة:</span>
                <span class="badge badge-info" style="font-size: 0.95rem; font-weight: 800;">${toPrint.length} كود</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; color: var(--muted); margin-bottom: 6px;">
                <span>تخطيط الورقة في PDF / الطباعة:</span>
                <strong style="color: var(--primary);">عمودين × 3 أسطر (6 بطاقات لكل ورقة)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; color: var(--muted);">
                <span>عدد أوراق PDF المتوقعة:</span>
                <strong style="color: var(--ink);">${estimatedPages} ورقة</strong>
              </div>
            </div>

            <div style="border-right: 3px solid var(--primary); padding-right: 10px; font-size: 0.85rem; color: var(--muted); line-height: 1.6;">
              <p style="margin: 0 0 4px 0;">✅ يتم تنسيق كل ورقة بمقاس A4 لتشمل عمودين و3 صفوف متناسقة تماماً دون تجاوز الصفحة.</p>
              <p style="margin: 0;">✅ تحتوي كل بطاقة على رقم الجهاز المكون من 16 رقماً، رمز QR واضح، ومربع فارغ لكتابة وتدوين بيانات المشترك يدوياً بعد الطباعة على ورق.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-primary" onclick="executeBarcodePrint()">متابعة والطباعة / PDF 🖨️</button>
          </div>
        </div>
      </div>
    `;

    window.executeBarcodePrint = function() {
      window.closeModal();

      const PAGE_SIZE = 6; // Exactly 2 columns x 3 rows per page
      const pages = [];
      for (let i = 0; i < toPrint.length; i += PAGE_SIZE) {
        pages.push(toPrint.slice(i, i + PAGE_SIZE));
      }

      const printHtml = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>طباعة بطاقات الباركود - الساري للبث الأرضي</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              background: #fff;
              color: #000;
              font-family: 'Cairo', system-ui, -apple-system, sans-serif;
              direction: rtl;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page {
              width: 100%;
              height: 284mm;
              max-height: 284mm;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              gap: 5mm;
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
              padding: 2mm 0;
            }
            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .barcode-print-card {
              border: 1.5px solid #111;
              border-radius: 8px;
              padding: 6px 10px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              background: #fff;
              overflow: hidden;
            }
            .card-top {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
              font-weight: 800;
              color: #222;
              border-bottom: 1px solid #ccc;
              padding-bottom: 3px;
            }
            .card-top .brand {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .card-num {
              font-family: 'Courier New', Courier, monospace;
              font-size: 15px;
              font-weight: 900;
              letter-spacing: 1.5px;
              color: #000;
              margin: 3px 0;
            }
            .card-qr {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 2px 0;
            }
            .card-qr img, .card-qr canvas {
              display: block;
              margin: 0 auto;
            }
            .card-empty-box {
              width: 100%;
              border: 1.5px dashed #333;
              border-radius: 5px;
              padding: 4px 8px;
              text-align: right;
              min-height: 44px;
              background: #fafafa;
            }
            .box-label {
              display: block;
              font-size: 9px;
              color: #444;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .box-content {
              font-size: 11px;
              font-weight: 800;
              color: #000;
              min-height: 20px;
            }
            @media screen {
              body {
                background: #e2e8f0;
                padding: 20px;
              }
              .print-page {
                background: #fff;
                margin: 0 auto 20px auto;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                padding: 6mm 8mm;
                height: 297mm;
                max-height: 297mm;
                width: 210mm;
              }
            }
          </style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
        </head>
        <body>
          ${pages.map((pageCards, pIdx) => `
            <div class="print-page">
              ${pageCards.map((c, idx) => `
                <div class="barcode-print-card">
                  <div class="card-top">
                    <span class="brand">الساري للبث الأرضي</span>
                    <span>#${pIdx * PAGE_SIZE + idx + 1}</span>
                  </div>
                  <div class="card-num">${c.number}</div>
                  <div class="card-qr" id="print-qr-${c.id}"></div>
                  <div class="card-empty-box">
                    <span class="box-label">بيانات المشترك / معلومات الجهاز (تدوين يدوي):</span>
                    <div class="box-content">${escapeHtml(c.subscriberName || '')}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
          <script>
            window.onload = function() {
              ${toPrint.map(c => `
                try {
                  new QRCode(document.getElementById('print-qr-${c.id}'), {
                    text: "${c.number}",
                    width: 150,
                    height: 150,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                  });
                } catch(e) {}
              `).join('')}
              setTimeout(() => {
                window.focus();
                window.print();
              }, 600);
            };
          <\/script>
        </body>
        </html>
      `;

      let printWin = null;
      try {
        printWin = window.open('', '_blank');
      } catch (e) {
        printWin = null;
      }

      if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
      } else {
        // Fallback for iframe / popup blocker
        let printIframe = document.getElementById('barcode-print-frame');
        if (!printIframe) {
          printIframe = document.createElement('iframe');
          printIframe.id = 'barcode-print-frame';
          printIframe.style.position = 'fixed';
          printIframe.style.right = '0';
          printIframe.style.bottom = '0';
          printIframe.style.width = '0';
          printIframe.style.height = '0';
          printIframe.style.border = '0';
          document.body.appendChild(printIframe);
        }
        const doc = printIframe.contentWindow.document;
        doc.open();
        doc.write(printHtml);
        doc.close();
      }
    };
  };

  window.exportCodesExcel = function() {
    const data = getData();
    const rows = (data.codes || []).map(c => ({
      'رقم الجهاز (16 خانة)': "'" + c.number,
      'اسم المشترك': c.subscriberName || '-',
      'الحالة': c.status,
      'تاريخ الإنشاء': c.createdAt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأكواد والباركود");
    XLSX.writeFile(wb, `أكواد_الساري_${new Date().toISOString().substring(0,10)}.xlsx`);
  };

  // Excel Import for Barcodes & Device Codes
  window.openExcelImportCodesModal = function() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeModal()">
        <div class="modal-dialog" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>استيراد أكواد وأرقام الأجهزة من Excel</h3>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.9rem; color: var(--text-sub);">
              اختر ملف Excel (.xlsx أو .xls أو .csv) يحتوي على عمود لأرقام الأجهزة (16 خانة)، وعمود اختياري لاسم المشترك. سيتم تجاهل الأرقام المكررة تلقائياً.
            </p>
            <div class="form-group" style="margin-top: 14px;">
              <label>ملف Excel / CSV *</label>
              <input type="file" id="codes-excel-file" accept=".xlsx,.xls,.csv">
            </div>
            <div id="codes-import-status" style="margin-top: 12px; font-size: 0.88rem;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.closeModal()">إلغاء</button>
            <button type="button" class="btn btn-primary" id="btn-process-codes-excel">بدء الاستيراد</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-process-codes-excel').onclick = function() {
      const fileInput = document.getElementById('codes-excel-file');
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
          let codeIdx = headers.findIndex(h => h.includes('كود') || h.includes('جهاز') || h.includes('باركود') || h.includes('code') || h.includes('number') || h.includes('رقم'));
          let subIdx = headers.findIndex(h => h.includes('اسم') || h.includes('مشترك') || h.includes('name'));

          if (codeIdx === -1) codeIdx = 0;

          const data = getData();
          const existingCodes = [...(data.codes || [])];
          const existingSet = new Set(existingCodes.map(c => c.number));
          const newCodes = [];
          const today = new Date().toISOString().substring(0, 10);
          let duplicatesCount = 0;

          for (let r = 1; r < json.length; r++) {
            const row = json[r];
            if (!row || !row[codeIdx]) continue;
            const cleanNum = normalizeDigits(String(row[codeIdx] || '')).replace(/\D/g, '');
            const subscriber = (subIdx !== -1 && row[subIdx]) ? String(row[subIdx]).trim() : '';

            if (cleanNum.length >= 10) {
              if (existingSet.has(cleanNum)) {
                duplicatesCount++;
                continue;
              }
              existingSet.add(cleanNum);
              newCodes.push({
                id: 'code-' + Date.now() + '-' + r,
                number: cleanNum,
                subscriberName: subscriber,
                status: subscriber ? 'مفعل' : 'جديد',
                createdAt: today
              });
            }
          }

          if (newCodes.length === 0) {
            alert('لم يتم العثور على أرقام أجهزة جديدة صالحة للاستيراد (قد تكون مكررة أو غير صالحة)');
            return;
          }

          await getEngine().commitData('codes', [...newCodes, ...existingCodes]);
          window.showToast(`تم استيراد ${newCodes.length} كود بنجاح (تم تجاوز ${duplicatesCount} مكرر)`, 'success');
          window.closeModal();
          window.renderBarcodes(document.getElementById('main-content'));
        } catch (err) {
          console.error(err);
          alert('حدث خطأ أثناء قراءة ملف Excel: ' + err.message);
        }
      };
      reader.readAsBinaryString(fileInput.files[0]);
    };
  };

  // Camera Scanner Modal using BarcodeDetector API with graceful manual fallback
  window.openScannerModal = function(onScanCallback) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay active" onclick="if (event.target === this) window.closeScannerModal()">
        <div class="modal-dialog" style="max-width: 500px; text-align: center;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>مسح الباركود / الكاميرا أو قارئ USB</h3>
            <button class="modal-close" onclick="window.closeScannerModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="position: relative; width: 100%; height: 260px; background: #000; border-radius: var(--radius-md); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <video id="scanner-video" style="width: 100%; height: 100%; object-fit: cover;" autoplay playsinline muted></video>
              <div style="position: absolute; width: 200px; height: 140px; border: 2px dashed #00ffaa; border-radius: 8px; pointer-events: none;"></div>
            </div>

            <div class="form-group" style="margin-top: 14px; text-align: right;">
              <label>أو إدخال يدوي / قارئ الباركود USB:</label>
              <input type="text" id="scanner-usb-input" placeholder="وجه قارئ الباركود أو اكتب الرقم..." autofocus>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.closeScannerModal()">إغلاق</button>
            <button type="button" class="btn btn-primary" id="btn-manual-submit">تأكيد الرمز</button>
          </div>
        </div>
      </div>
    `;

    let stream = null;
    let scanInterval = null;
    const video = document.getElementById('scanner-video');
    const usbInput = document.getElementById('scanner-usb-input');

    window.closeScannerModal = function() {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (scanInterval) clearInterval(scanInterval);
      window.closeModal();
    };

    // Camera access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          video.srcObject = s;

          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['code_128', 'qr_code', 'ean_13'] });
            scanInterval = setInterval(async () => {
              try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                  const val = normalizeDigits(barcodes[0].rawValue).replace(/\D/g, '');
                  if (val.length >= 10) {
                    closeScannerModal();
                    if (typeof onScanCallback === 'function') onScanCallback(val);
                  }
                }
              } catch (e) {}
            }, 300);
          }
        })
        .catch(err => {
          console.warn('Camera not accessible or permission denied', err);
        });
    }

    // USB barcode reader handles Enter key instantly
    usbInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = normalizeDigits(usbInput.value).replace(/\D/g, '');
        if (val) {
          closeScannerModal();
          if (typeof onScanCallback === 'function') onScanCallback(val);
        }
      }
    });

    document.getElementById('btn-manual-submit').onclick = () => {
      const val = normalizeDigits(usbInput.value).replace(/\D/g, '');
      if (val) {
        closeScannerModal();
        if (typeof onScanCallback === 'function') onScanCallback(val);
      }
    };
  };

})();
