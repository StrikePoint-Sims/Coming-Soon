/* ═══════════════════════════════════════════════════════════════════════════
   features.js — Recurring transactions, CSV import, budgets,
                 document vault, settings tabs render
   ═══════════════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────────────────
   #1 — Recurring Transactions
   ──────────────────────────────────────────────────────────────────────────── */

async function checkRecurring() {
  const templates = (State.recurringTemplates || []).filter(t => t.active);
  if (!templates.length) return;

  const today     = todayStr();
  const drafts    = (State.txns || []).filter(t => t.status === 'draft');
  const batch     = [];

  for (const tmpl of templates) {
    if (!tmpl.nextDueDate || tmpl.nextDueDate > today) continue;
    // Check if a draft already exists for this template
    const alreadyDrafted = drafts.some(d => d.recurringTemplateId === tmpl.id);
    if (alreadyDrafted) continue;

    batch.push({ tmpl, draftData: {
      type:          tmpl.type || 'expense',
      amount:        tmpl.amount,
      description:   tmpl.description,
      category:      tmpl.category,
      paymentMethod: tmpl.paymentMethod || 'business',
      vendorId:      tmpl.vendorId || '',
      date:          tmpl.nextDueDate,
      notes:         tmpl.notes || '',
      status:        'draft',
      recurringTemplateId: tmpl.id,
      deductibility: categoryMeta(tmpl.category)?.ded || 'full',
    }});
  }

  if (!batch.length) return;

  for (const item of batch) {
    await saveTxn(item.draftData);
    const next = _advanceNextDueDate(item.tmpl);
    await dbSet('recurringTemplates', item.tmpl.id, { nextDueDate: next });
  }
}

function _advanceNextDueDate(tmpl) {
  const base = new Date(tmpl.nextDueDate + 'T12:00:00');
  if (tmpl.frequency === 'weekly') {
    base.setDate(base.getDate() + 7);
  } else if (tmpl.frequency === 'bi-weekly') {
    base.setDate(base.getDate() + 14);
  } else if (tmpl.frequency === 'monthly') {
    base.setMonth(base.getMonth() + 1);
  } else if (tmpl.frequency === 'quarterly') {
    base.setMonth(base.getMonth() + 3);
  } else if (tmpl.frequency === 'semi-annual') {
    base.setMonth(base.getMonth() + 6);
  } else if (tmpl.frequency === 'annually') {
    base.setFullYear(base.getFullYear() + 1);
  }
  return base.toISOString().slice(0, 10);
}

async function confirmDraft(txnId) {
  await dbSet('transactions', txnId, { status: 'normal', confirmedAt: Date.now() });
  toast('Transaction confirmed');
}

async function skipDraft(txnId) {
  await deleteTxn(txnId);
  toast('Skipped');
}

function renderDraftsPanel() {
  const drafts = (State.txns || []).filter(t => t.status === 'draft');
  if (!drafts.length) {
    document.getElementById('draftsOverlay')?.classList.remove('open');
    return;
  }

  document.getElementById('draftsContent').innerHTML = `
    <div class="panel-header">
      <h3>Recurring — Ready to Confirm</h3>
      <button class="panel-close" onclick="document.getElementById('draftsOverlay').classList.remove('open')">✕</button>
    </div>
    <div class="panel-body">
      <p class="panel-hint">These recurring transactions are due. Review and confirm or skip each one.</p>
      ${drafts.map(d => `
        <div class="draft-row">
          <div class="draft-info">
            <div class="draft-desc">${d.description}</div>
            <div class="draft-meta">${fmtDate(d.date)} · ${d.category} · ${fmt$(d.amount)}</div>
          </div>
          <div class="draft-actions">
            <button class="btn-primary sm" onclick="confirmDraft('${d.id}')">Confirm</button>
            <button class="btn-ghost sm" onclick="skipDraft('${d.id}')">Skip</button>
            <button class="btn-ghost sm" onclick="openPanel('txn','${d.id}')">Edit</button>
          </div>
        </div>`).join('')}
    </div>`;

  document.getElementById('draftsOverlay')?.classList.add('open');
}

function renderRecurringDraftBanner() {
  const drafts = (State.txns || []).filter(t => t.status === 'draft');
  const el     = document.getElementById('recurringBanner');
  if (!el) return;
  if (drafts.length) {
    el.style.display = '';
    el.innerHTML = `
      <div class="recurring-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        ${drafts.length} recurring transaction${drafts.length>1?'s are':' is'} ready to confirm
        <button class="btn-link" onclick="renderDraftsPanel()">Review →</button>
      </div>`;
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   #2 — Bank CSV Import
   ──────────────────────────────────────────────────────────────────────────── */

let _csvRows      = [];
let _csvMapping   = {};
let _csvCandidates = [];

function openCSVImport() {
  document.getElementById('csvInput')?.click();
}

function handleCSVFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    _csvRows = parseCSV(e.target.result);
    if (_csvRows.length < 2) { toast('CSV appears empty or invalid', 'error'); return; }
    showCSVMappingModal(_csvRows);
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const cols = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
}

function showCSVMappingModal(rows) {
  const headers = rows[0];
  const preview = rows.slice(1, 4);
  const saved   = State.settings?.csvMapping || {};

  const colOpts = (saved) => headers.map((h, i) =>
    `<option value="${i}" ${saved == i ? 'selected':''}>${h}</option>`
  ).join('');

  const noOpt = `<option value="">— None —</option>`;

  document.getElementById('importContent').innerHTML = `
    <div class="panel-header">
      <h3>Import Bank CSV</h3>
      <button class="panel-close" onclick="document.getElementById('importOverlay').classList.remove('open')">✕</button>
    </div>
    <div class="panel-body">
      <p class="panel-hint">Match your CSV columns to transaction fields. The app will remember this mapping.</p>
      <div class="csv-mapping">
        <div class="form-row two-col">
          <div><label>Date column</label>
            <select id="mapDate">${colOpts(saved.date)}</select></div>
          <div><label>Description column</label>
            <select id="mapDesc">${colOpts(saved.description)}</select></div>
        </div>
        <div class="form-row two-col">
          <div><label>Amount column</label>
            <select id="mapAmt">${colOpts(saved.amount)}</select></div>
          <div><label>Type column (Dr/Cr) <em>optional</em></label>
            <select id="mapType">${noOpt}${colOpts(saved.type)}</select></div>
        </div>
      </div>
      <div class="csv-preview">
        <h4>Preview (first 3 rows)</h4>
        <table class="report-table">
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${preview.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="panel-actions">
        <button class="btn-primary" onclick="runCSVImport()">Import ${rows.length - 1} Transactions</button>
      </div>
    </div>`;

  document.getElementById('importOverlay')?.classList.add('open');
}

async function runCSVImport() {
  const mapDate = parseInt(document.getElementById('mapDate')?.value ?? 0);
  const mapDesc = parseInt(document.getElementById('mapDesc')?.value ?? 1);
  const mapAmt  = parseInt(document.getElementById('mapAmt')?.value ?? 2);
  const mapType = document.getElementById('mapType')?.value;

  // Save mapping
  await saveSettings({ csvMapping: { date: mapDate, description: mapDesc, amount: mapAmt, type: mapType || '' } });

  _csvCandidates = [];
  const dataRows = _csvRows.slice(1);
  for (const row of dataRows) {
    const rawDate = row[mapDate]?.trim() || '';
    const rawDesc = row[mapDesc]?.trim() || '';
    const rawAmt  = parseFloat((row[mapAmt] || '').replace(/[$,()]/g,'').trim()) || 0;
    const rawType = mapType !== '' ? (row[parseInt(mapType)] || '').toLowerCase() : '';

    let type = 'expense';
    if (rawType) {
      type = rawType.includes('cr') || rawType.includes('credit') || rawType.includes('dep') ? 'income' : 'expense';
    } else if (rawAmt < 0) {
      type = 'expense';
    } else {
      type = 'income';
    }

    const amount = Math.abs(rawAmt);
    const date   = _normalizeDate(rawDate);
    if (!date || !amount) continue;

    const suggested = suggestCategory(rawDesc);
    _csvCandidates.push({
      _tempId: Math.random().toString(36).slice(2),
      type,
      date,
      amount,
      description: rawDesc,
      category: suggested || '',
      paymentMethod: 'business',
      status: 'review',
    });
  }

  document.getElementById('importOverlay')?.classList.remove('open');
  toast(`${_csvCandidates.length} transactions imported — review below`);
  State.filters.status = 'review';
  navigate('transactions');
}

function _normalizeDate(str) {
  if (!str) return '';
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Try M/D/YYYY or M/D/YY
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  }
  return '';
}

async function acceptCSVTransaction(tempId) {
  const cand = _csvCandidates.find(c => c._tempId === tempId);
  if (!cand) return;
  const { _tempId, ...data } = cand;
  if (!data.category) { toast('Please select a category first', 'error'); return; }
  await saveTxn({ ...data, status: 'normal' });
  _csvCandidates = _csvCandidates.filter(c => c._tempId !== tempId);
  toast('Transaction accepted');
}

function renderCSVReviewQueue() {
  if (!_csvCandidates.length) return '';
  const cats = (State.categories || []);
  return `
    <div class="review-queue-banner">
      <strong>${_csvCandidates.length} imported transactions need review</strong>
      <button class="btn-link" onclick="acceptAllCSV()">Accept All</button>
    </div>
    ${_csvCandidates.map(c => `
      <div class="review-row">
        <div class="review-row-meta">
          <span class="review-date">${fmtDate(c.date)}</span>
          <span class="review-desc">${c.description || '—'}</span>
          <span class="review-amt ${c.type==='income'?'green':'red'}">${fmt$(c.amount)}</span>
        </div>
        <div class="review-row-actions">
          <select onchange="_csvCandidates.find(x=>x._tempId==='${c._tempId}').category=this.value">
            <option value="">Select category…</option>
            ${cats.map(cat=>`<option value="${cat.name}" ${c.category===cat.name?'selected':''}>${cat.name}</option>`).join('')}
          </select>
          <select onchange="_csvCandidates.find(x=>x._tempId==='${c._tempId}').type=this.value">
            <option value="expense" ${c.type==='expense'?'selected':''}>Expense</option>
            <option value="income"  ${c.type==='income' ?'selected':''}>Income</option>
          </select>
          <button class="btn-primary sm" onclick="acceptCSVTransaction('${c._tempId}')">Accept</button>
          <button class="btn-ghost sm" onclick="_csvCandidates=_csvCandidates.filter(x=>x._tempId!=='${c._tempId}')">✕</button>
        </div>
      </div>`).join('')}`;
}

async function acceptAllCSV() {
  const pending = [..._csvCandidates];
  let count = 0;
  for (const c of pending) {
    if (!c.category) continue;
    const { _tempId, ...data } = c;
    await saveTxn({ ...data, status: 'normal' });
    _csvCandidates = _csvCandidates.filter(x => x._tempId !== _tempId);
    count++;
  }
  toast(`${count} transactions accepted`);
}

/* ────────────────────────────────────────────────────────────────────────────
   #4 — Budget Management
   ──────────────────────────────────────────────────────────────────────────── */

async function saveBudget(category, monthlyAmount) {
  const existing = (State.budgets || []).find(b => b.category === category);
  const amount   = parseFloat(monthlyAmount) || 0;
  if (existing) {
    await dbSet('budgets', existing.id, { amount, updatedAt: Date.now() });
  } else {
    await dbAdd('budgets', { category, amount, period: 'monthly', taxYear: new Date().getFullYear() });
  }
}

async function deleteBudget(id) {
  await dbDelete('budgets', id);
}

function renderBudgetsSettingsTab() {
  const cats    = (State.categories || []).filter(c => c.type === 'expense');
  const budgets = State.budgets || [];
  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = b; });

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Monthly Spending Targets</h4>
        <p class="hint">Set a monthly budget per category. The Dashboard will show how you're tracking.</p>
      </div>
      <table class="settings-table">
        <thead><tr><th>Category</th><th>Monthly Target</th><th></th></tr></thead>
        <tbody>
          ${cats.map(c => {
            const b = budgetMap[c.name];
            return `<tr>
              <td>${c.name}</td>
              <td>
                <div class="amount-input-wrap sm">
                  <span class="dollar-sign">$</span>
                  <input type="number" class="amount-input" id="budget_${c.name.replace(/\W/g,'_')}"
                    value="${b ? b.amount : ''}" placeholder="0"
                    onchange="saveBudget('${c.name}', this.value)">
                </div>
              </td>
              <td>${b ? `<button class="btn-link red" onclick="deleteBudget('${b.id}')">Clear</button>` : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   #9 — Document Vault Settings Tab
   ──────────────────────────────────────────────────────────────────────────── */

const DOC_CATEGORIES = [
  'Formation & Legal','Tax & IRS','Banking & Loans','Insurance',
  'Real Estate','Vendor Contracts','Other',
];

function openDocumentUpload() {
  document.getElementById('docInput')?.click();
}

async function handleDocumentFile(input) {
  input.value = '';
  toast('Document vault uploads require Firebase Storage (paid plan). Receipts on transactions are stored automatically.', 'error');
}

function _promptDocCategory() {
  const opts = DOC_CATEGORIES.map((c, i) => `${i+1}. ${c}`).join('\n');
  const idx  = parseInt(prompt(`Select category:\n${opts}`) || '0') - 1;
  return DOC_CATEGORIES[idx] || 'Other';
}

function renderDocumentsTab() {
  const docs = State.documents || [];

  const grid = docs.length
    ? `<div class="doc-grid">
        ${docs.map(d => `
          <div class="doc-card">
            <div class="doc-icon">${d.mimeType?.includes('pdf') ? '📄' : '🖼️'}</div>
            <div class="doc-info">
              <div class="doc-name">${d.name}</div>
              <div class="doc-cat">${d.category}</div>
              <div class="doc-date">${fmtDate(d.uploadedAt ? new Date(d.uploadedAt).toISOString().slice(0,10) : '')}</div>
            </div>
            <div class="doc-actions">
              <button class="btn-link" onclick="previewReceipt('${d.fileUrl}','${d.mimeType||''}')">View</button>
              <button class="btn-link red" onclick="deleteDoc('${d.id}','${d.filename}')">Delete</button>
            </div>
          </div>`).join('')}
      </div>`
    : `<div class="empty-vault">
         <div class="empty-vault-icon">🗂️</div>
         <p>No documents yet. Upload your LLC Certificate, EIN letter, and SBA agreement to keep everything in one place.</p>
       </div>`;

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Business Document Vault</h4>
        <button class="btn-secondary" onclick="openDocumentUpload()">+ Upload Document</button>
      </div>
      ${grid}
    </div>`;
}

async function deleteDoc(id, filename) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  await deleteDocument(id, filename);
  toast('Document deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   Settings Modal Tabs
   ──────────────────────────────────────────────────────────────────────────── */

function openSettings(tab = 'assets') {
  renderSettingsTab(tab);
  document.getElementById('settingsOverlay')?.classList.add('open');
}

function openSettingsTab(tab) {
  openSettings(tab);
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  renderSettingsTab(tab);
}

function renderSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const body = document.getElementById('settingsBody');
  if (!body) return;
  switch (tab) {
    case 'assets':       body.innerHTML = renderAssetsTab();            break;
    case 'loans':        body.innerHTML = renderLoansTab();             break;
    case 'recurring':    body.innerHTML = renderRecurringTab();         break;
    case 'budgets':      body.innerHTML = renderBudgetsSettingsTab();   break;
    case 'categories':   body.innerHTML = renderCategoriesTab();        break;
    case 'documents':    body.innerHTML = renderDocumentsTab();         break;
    case 'memberships':  body.innerHTML = renderMembershipsTab();       break;
    case 'hourlyrates':  body.innerHTML = renderHourlyRatesTab();       break;
  }
}

/* Assets Tab */
function renderAssetsTab() {
  const assets = State.assets || [];

  const rows = assets.map(a => {
    const bv = computeAssetBookValue(a);
    return `<tr>
      <td>${a.name}</td>
      <td>${fmtDate(a.purchaseDate)}</td>
      <td class="num">${fmt$(a.cost)}</td>
      <td class="num">${fmt$(bv.bookValue)}</td>
      <td>
        <button class="btn-link" onclick="openAssetEdit('${a.id}')">Edit</button>
        <button class="btn-link red" onclick="deleteAsset('${a.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No assets yet.</td></tr>';

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Capital Assets</h4>
        <button class="btn-secondary" onclick="openAssetEdit(null)">+ Add Asset</button>
      </div>
      <table class="settings-table">
        <thead><tr><th>Asset</th><th>Purchase Date</th><th>Cost</th><th>Book Value</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div id="assetEditForm" style="display:none"></div>
    </div>`;
}

function openAssetEdit(id) {
  const a = id ? (State.assets || []).find(x => x.id === id) : null;
  document.getElementById('assetEditForm').style.display = '';
  document.getElementById('assetEditForm').innerHTML = `
    <div class="inline-form">
      <div class="form-row two-col">
        <div><label>Name *</label><input type="text" id="assetName" value="${a?.name||''}"></div>
        <div><label>Purchase Date</label><input type="date" id="assetDate" value="${a?.purchaseDate||''}"></div>
      </div>
      <div class="form-row two-col">
        <div><label>Cost ($)</label><input type="number" id="assetCost" value="${a?.cost||''}" min="0" step="0.01"></div>
        <div><label>Useful Life (years)</label><input type="number" id="assetLife" value="${a?.usefulLifeYears||7}" min="1"></div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Depreciation Method</label>
          <select id="assetMethod">
            <option value="straight-line" ${a?.depreciationMethod==='straight-line'?'selected':''}>Straight-line</option>
            <option value="section179" ${a?.depreciationMethod==='section179'?'selected':''}>Section 179 (full year 1)</option>
          </select>
        </div>
        <div><label>Section 179 Amount ($)</label><input type="number" id="assetS179" value="${a?.section179Amount||0}" min="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <input type="text" id="assetNotes" value="${a?.notes||''}">
      </div>
      <div class="panel-actions">
        <button class="btn-primary sm" onclick="saveAssetForm('${id||''}')">Save Asset</button>
        <button class="btn-ghost sm" onclick="document.getElementById('assetEditForm').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

async function saveAssetForm(id) {
  const name = document.getElementById('assetName')?.value?.trim();
  if (!name) return;
  const data = {
    name,
    purchaseDate:      document.getElementById('assetDate')?.value || '',
    cost:              parseFloat(document.getElementById('assetCost')?.value || 0),
    usefulLifeYears:   parseInt(document.getElementById('assetLife')?.value || 7),
    depreciationMethod: document.getElementById('assetMethod')?.value || 'straight-line',
    section179Amount:  parseFloat(document.getElementById('assetS179')?.value || 0),
    notes:             document.getElementById('assetNotes')?.value?.trim() || '',
    category:          'Equipment (Capital)',
  };
  if (id) await dbSet('assets', id, data);
  else await dbAdd('assets', data);
  toast(id ? 'Asset updated' : 'Asset added');
  renderSettingsTab('assets');
}

async function deleteAsset(id) {
  if (!confirm('Delete this asset?')) return;
  await dbDelete('assets', id);
  renderSettingsTab('assets');
  toast('Asset deleted');
}

/* Loans Tab */
function renderLoansTab() {
  const loans = State.loans || [];

  const rows = loans.map(l => {
    const bal = computeLoanBalance(l, State.txns || []);
    return `<tr>
      <td>${l.name}</td>
      <td>${l.lender || '—'}</td>
      <td class="num">${fmt$(l.originalAmount)}</td>
      <td class="num">${fmt$(bal.remainingBalance)}</td>
      <td>
        <button class="btn-link" onclick="openLoanEdit('${l.id}')">Edit</button>
        <button class="btn-link red" onclick="deleteLoan('${l.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No loans yet.</td></tr>';

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Loans</h4>
        <button class="btn-secondary" onclick="openLoanEdit(null)">+ Add Loan</button>
      </div>
      <table class="settings-table">
        <thead><tr><th>Loan</th><th>Lender</th><th>Original</th><th>Balance</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div id="loanEditForm" style="display:none"></div>
    </div>`;
}

function openLoanEdit(id) {
  const l = id ? (State.loans || []).find(x => x.id === id) : null;
  document.getElementById('loanEditForm').style.display = '';
  document.getElementById('loanEditForm').innerHTML = `
    <div class="inline-form">
      <div class="form-row two-col">
        <div><label>Name *</label><input type="text" id="loanName" value="${l?.name||''}"></div>
        <div><label>Lender</label><input type="text" id="loanLender" value="${l?.lender||''}"></div>
      </div>
      <div class="form-row two-col">
        <div><label>Original Amount ($)</label><input type="number" id="loanAmt" value="${l?.originalAmount||''}" min="0" step="0.01"></div>
        <div><label>Interest Rate (e.g. 0.095 = 9.5%)</label><input type="number" id="loanRate" value="${l?.interestRate||0}" min="0" step="0.001"></div>
      </div>
      <div class="form-row two-col">
        <div><label>Term (months)</label><input type="number" id="loanTerm" value="${l?.termMonths||''}" min="1"></div>
        <div><label>Monthly Payment ($)</label><input type="number" id="loanPmt" value="${l?.monthlyPayment||''}" min="0" step="0.01"></div>
      </div>
      <div class="form-row two-col">
        <div><label>Start Date</label><input type="date" id="loanStart" value="${l?.startDate||''}"></div>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="loanNotes" rows="2">${l?.notes||''}</textarea>
      </div>
      <div class="panel-actions">
        <button class="btn-primary sm" onclick="saveLoanForm('${id||''}')">Save Loan</button>
        <button class="btn-ghost sm" onclick="document.getElementById('loanEditForm').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

async function saveLoanForm(id) {
  const name = document.getElementById('loanName')?.value?.trim();
  if (!name) return;
  const data = {
    name,
    lender:        document.getElementById('loanLender')?.value?.trim() || '',
    originalAmount: parseFloat(document.getElementById('loanAmt')?.value || 0),
    interestRate:  parseFloat(document.getElementById('loanRate')?.value || 0),
    termMonths:    parseInt(document.getElementById('loanTerm')?.value || 0),
    monthlyPayment: parseFloat(document.getElementById('loanPmt')?.value || 0),
    startDate:     document.getElementById('loanStart')?.value || '',
    notes:         document.getElementById('loanNotes')?.value?.trim() || '',
  };
  if (id) await dbSet('loans', id, data);
  else await dbAdd('loans', data);
  toast(id ? 'Loan updated' : 'Loan added');
  renderSettingsTab('loans');
}

async function deleteLoan(id) {
  if (!confirm('Delete this loan?')) return;
  await dbDelete('loans', id);
  renderSettingsTab('loans');
  toast('Loan deleted');
}

/* Recurring Tab */
function renderRecurringTab() {
  const templates = State.recurringTemplates || [];

  const rows = templates.map(t => `
    <tr>
      <td>${t.description}</td>
      <td>${t.category}</td>
      <td class="num">${fmt$(t.amount)}</td>
      <td>${t.frequency} / day ${t.dayOfMonth || '—'}</td>
      <td>${fmtDate(t.nextDueDate)}</td>
      <td>
        <label class="toggle-label">
          <input type="checkbox" ${t.active?'checked':''} onchange="toggleRecurring('${t.id}', this.checked)">
          <span>${t.active ? 'Active' : 'Inactive'}</span>
        </label>
      </td>
      <td>
        <button class="btn-link" onclick="openRecurringEdit('${t.id}')">Edit</button>
        <button class="btn-link red" onclick="deleteRecurringTemplate('${t.id}')">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty">No recurring templates.</td></tr>';

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Recurring Transactions</h4>
        <button class="btn-secondary" onclick="openRecurringEdit(null)">+ Add Recurring</button>
      </div>
      <table class="settings-table">
        <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Frequency</th><th>Next Due</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div id="recurringEditForm" style="display:none"></div>
    </div>`;
}

function openRecurringEdit(id) {
  const t = id ? (State.recurringTemplates || []).find(x => x.id === id) : null;
  const cats = (State.categories || []);
  document.getElementById('recurringEditForm').style.display = '';
  document.getElementById('recurringEditForm').innerHTML = `
    <div class="inline-form">
      <div class="form-row two-col">
        <div><label>Description *</label><input type="text" id="recDesc" value="${t?.description||''}"></div>
        <div><label>Amount ($)</label><input type="number" id="recAmt" value="${t?.amount||''}" min="0" step="0.01"></div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Category</label>
          <select id="recCat">
            ${cats.map(c=>`<option value="${c.name}" ${t?.category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Payment Method</label>
          <select id="recPM">
            <option value="business" ${t?.paymentMethod==='business'?'selected':''}>Business Account</option>
            <option value="personal" ${t?.paymentMethod==='personal'?'selected':''}>Personal Card</option>
          </select>
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Frequency</label>
          <select id="recFreq">
            <option value="weekly"      ${t?.frequency==='weekly'     ?'selected':''}>Weekly</option>
            <option value="bi-weekly"   ${t?.frequency==='bi-weekly'  ?'selected':''}>Bi-Weekly (every 2 weeks)</option>
            <option value="monthly"     ${t?.frequency==='monthly'    ?'selected':''}>Monthly</option>
            <option value="quarterly"   ${t?.frequency==='quarterly'  ?'selected':''}>Quarterly (every 3 months)</option>
            <option value="semi-annual" ${t?.frequency==='semi-annual'?'selected':''}>Semi-Annual (every 6 months)</option>
            <option value="annually"    ${t?.frequency==='annually'   ?'selected':''}>Annually</option>
          </select>
        </div>
        <div><label>Day of Month (1–28)</label><input type="number" id="recDay" value="${t?.dayOfMonth||1}" min="1" max="28"></div>
      </div>
      <div class="form-row">
        <label class="toggle-label">
          <input type="checkbox" id="recActive" ${t?.active?'checked':''}>
          <span>Active (will generate drafts when due)</span>
        </label>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="recNotes" rows="2">${t?.notes||''}</textarea>
      </div>
      <div class="panel-actions">
        <button class="btn-primary sm" onclick="saveRecurringForm('${id||''}')">Save</button>
        <button class="btn-ghost sm" onclick="document.getElementById('recurringEditForm').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

async function saveRecurringForm(id) {
  const desc = document.getElementById('recDesc')?.value?.trim();
  if (!desc) return;
  const dayOfMonth = parseInt(document.getElementById('recDay')?.value || 1);
  const frequency  = document.getElementById('recFreq')?.value || 'monthly';
  const data = {
    description:   desc,
    amount:        parseFloat(document.getElementById('recAmt')?.value || 0),
    category:      document.getElementById('recCat')?.value || '',
    paymentMethod: document.getElementById('recPM')?.value  || 'business',
    type:          'expense',
    frequency,
    dayOfMonth,
    active:        document.getElementById('recActive')?.checked || false,
    nextDueDate:   nextDueDate(dayOfMonth, frequency),
    notes:         document.getElementById('recNotes')?.value?.trim() || '',
  };
  if (id) await dbSet('recurringTemplates', id, data);
  else await dbAdd('recurringTemplates', data);
  toast(id ? 'Template updated' : 'Recurring template added');
  renderSettingsTab('recurring');
}

async function toggleRecurring(id, active) {
  await dbSet('recurringTemplates', id, { active });
  toast(active ? 'Activated' : 'Deactivated');
}

async function deleteRecurringTemplate(id) {
  if (!confirm('Delete this recurring template?')) return;
  await dbDelete('recurringTemplates', id);
  renderSettingsTab('recurring');
  toast('Template deleted');
}

/* Categories Tab */
function renderCategoriesTab() {
  const cats = (State.categories || []).sort((a,b) => a.order - b.order);

  const rows = cats.map(c => `
    <tr>
      <td>${c.name}</td>
      <td><span class="badge ${c.type==='income'?'green':'blue'}">${c.type}</span></td>
      <td>${c.irsLine || '—'}</td>
      <td>
        <input type="text" class="qb-input" placeholder="QB account name"
          value="${c.qbAccountName||''}"
          onchange="saveQBMapping('${c.id}', this.value)">
      </td>
      <td>
        ${c.isCustom ? `<button class="btn-link red" onclick="deleteCategory('${c.id}')">Delete</button>` : ''}
      </td>
    </tr>`).join('');

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Categories</h4>
        <button class="btn-secondary" onclick="openCategoryAdd()">+ Add Category</button>
      </div>
      <p class="hint">The "QB Account Name" column lets you map categories to QuickBooks account names for IIF export.</p>
      <table class="settings-table">
        <thead><tr><th>Category</th><th>Type</th><th>IRS Line</th><th>QB Account Name</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div id="categoryAddForm" style="display:none"></div>
    </div>`;
}

function openCategoryAdd() {
  document.getElementById('categoryAddForm').style.display = '';
  document.getElementById('categoryAddForm').innerHTML = `
    <div class="inline-form">
      <div class="form-row two-col">
        <div><label>Name *</label><input type="text" id="catName" placeholder="e.g. Coaching Fees"></div>
        <div>
          <label>Type</label>
          <select id="catType">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>
      <div class="form-row two-col">
        <div><label>IRS Line</label><input type="text" id="catIRS" placeholder="e.g. 11"></div>
        <div>
          <label>Deductibility</label>
          <select id="catDed">
            <option value="full">Full</option>
            <option value="fifty_pct">50% (Meals)</option>
            <option value="none">Non-deductible</option>
            <option value="na">N/A (Income)</option>
          </select>
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn-primary sm" onclick="saveCategoryAdd()">Add Category</button>
        <button class="btn-ghost sm" onclick="document.getElementById('categoryAddForm').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

async function saveCategoryAdd() {
  const name = document.getElementById('catName')?.value?.trim();
  if (!name) return;
  const data = {
    name,
    type:       document.getElementById('catType')?.value || 'expense',
    irsLine:    document.getElementById('catIRS')?.value?.trim() || '',
    ded:        document.getElementById('catDed')?.value || 'full',
    isCustom:   true,
    order:      (State.categories || []).length,
    qbAccountName: '',
  };
  await dbAdd('categories', data);
  toast('Category added');
  renderSettingsTab('categories');
}

async function saveQBMapping(id, name) {
  await dbSet('categories', id, { qbAccountName: name });
}

async function deleteCategory(id) {
  if (!confirm('Delete this custom category?')) return;
  await dbDelete('categories', id);
  renderSettingsTab('categories');
  toast('Category deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   #10 — Quick-Log Dashboard Widget
   ──────────────────────────────────────────────────────────────────────────── */

function renderQuickLogWidget() {
  const cats = (State.categories || []).filter(c => c.type === 'expense');
  return `
    <div class="quick-log-widget">
      <div class="quick-log-title">Log It Fast</div>
      <div class="quick-log-row">
        <div class="amount-input-wrap">
          <span class="dollar-sign">$</span>
          <input type="number" id="qlAmount" class="amount-input" placeholder="0.00" min="0" step="0.01">
        </div>
        <select id="qlCategory">
          <option value="">Category…</option>
          ${cats.map(c=>`<option value="${c.name}">${c.name}</option>`).join('')}
        </select>
        <select id="qlPayment">
          <option value="business">Business</option>
          <option value="personal">Personal Card</option>
          <option value="sba">SBA</option>
          <option value="capital">Capital</option>
        </select>
        <button class="btn-primary" onclick="saveQuickLog()">+ Add</button>
      </div>
      <div class="quick-log-hint">
        <a href="#" onclick="openPanel('txn');return false">Need more fields?</a>
      </div>
    </div>`;
}

async function saveQuickLog() {
  const amount   = parseFloat(document.getElementById('qlAmount')?.value || 0);
  const category = document.getElementById('qlCategory')?.value || '';
  const pm       = document.getElementById('qlPayment')?.value || 'business';

  if (!amount || amount <= 0) { shake('qlAmount');    return; }
  if (!category)              { shake('qlCategory');  return; }

  const catMeta = categoryMeta(category);
  await saveTxn({
    type: 'expense', amount, category,
    date: todayStr(),
    paymentMethod: pm,
    description: '',
    deductibility: catMeta?.ded || 'full',
    reimbursementStatus: pm === 'personal' ? 'pending' : 'na',
    status: 'normal',
  });

  document.getElementById('qlAmount').value = '';
  document.getElementById('qlCategory').value = '';
  toast('Expense logged');
}

/* ────────────────────────────────────────────────────────────────────────────
   #6 — Quarterly Tax Estimate Widget (Dashboard)
   ──────────────────────────────────────────────────────────────────────────── */

function renderTaxEstimateWidget() {
  const txns = (State.txns || []).filter(t => t.taxYear === new Date().getFullYear() && t.status !== 'draft');
  const est  = computeQuarterlyEstimate(txns);

  if (est.ytdNetProfit <= 0) return '';

  return `
    <div class="tax-estimate-card">
      <div class="tax-estimate-title">Estimated Q${est.currentQuarter} Payment</div>
      <div class="tax-estimate-rows">
        <div class="tax-row"><span>YTD Net Profit</span><span>${fmt$(est.ytdNetProfit)}</span></div>
        <div class="tax-row"><span>Self-Employment Tax (est.)</span><span>${fmt$(est.seEstimate)}</span></div>
        <div class="tax-row"><span>Federal Income Tax (22% bracket est.)</span><span>${fmt$(est.federalEstimate)}</span></div>
        <div class="tax-row total"><span>Suggested Quarterly Payment</span><span>${fmt$(est.quarterlyPayment)}</span></div>
      </div>
      <div class="tax-disclaimer">Estimate only — consult your CPA before paying.</div>
    </div>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   #15 — QuickBooks IIF Export
   ──────────────────────────────────────────────────────────────────────────── */

function exportQuickBooks() {
  const txns = filteredTransactions();
  const cats = State.categories || [];
  const content = buildIIFContent(txns, cats);
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'strikepoint_transactions.iif';
  a.click();
  URL.revokeObjectURL(url);
  toast('QuickBooks IIF file downloaded');
}

/* ────────────────────────────────────────────────────────────────────────────
   Help Panel
   ──────────────────────────────────────────────────────────────────────────── */

function openHelp(tab = 'start') {
  renderHelpTab(tab);
  document.getElementById('helpOverlay')?.classList.add('open');
}

function switchHelpTab(tab) {
  document.querySelectorAll('.help-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  renderHelpTab(tab);
}

function renderHelpTab(tab) {
  document.querySelectorAll('.help-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  const body = document.getElementById('helpTabBody');
  if (!body) return;

  switch (tab) {
    case 'start': body.innerHTML = renderGettingStarted(); break;
    case 'howto': body.innerHTML = renderHowTo();          break;
    case 'cpa':   body.innerHTML = renderCPAGuide();       break;
  }
}

function renderGettingStarted() {
  const steps = [
    { key: 'signin',    label: 'Sign in with your business Gmail account', done: true },
    { key: 'loans',     label: 'Go to <strong>Settings → Loans</strong> and confirm your SBA and TrackMan loans', done: (State.loans||[]).length > 0 },
    { key: 'vendor',    label: 'Go to <strong>Vendors</strong> and add your key vendors', done: (State.vendors||[]).length > 0 },
    { key: 'txn',       label: 'Log your first expense in <strong>Transactions</strong>', done: (State.txns||[]).some(t=>t.status==='normal') },
    { key: 'receipt',   label: 'Attach a receipt to a transaction', done: (State.txns||[]).some(t=>t.receiptUrl) },
    { key: 'dashboard', label: 'Check the <strong>Dashboard</strong> to see your financial snapshot', done: false },
    { key: 'time',      label: 'Go to <strong>Time</strong> and log your first hours worked', done: (State.timeEntries||[]).length > 0 },
    { key: 'recurring', label: 'Go to <strong>Settings → Recurring</strong> and activate your SBA and rent templates', done: (State.recurringTemplates||[]).some(t=>t.active) },
    { key: 'documents', label: 'Go to <strong>Settings → Documents</strong> and upload your LLC Certificate and EIN letter', done: (State.documents||[]).length > 0 },
  ];

  return `
    <div class="getting-started">
      ${steps.map(s => `
        <div class="gs-step ${s.done ? 'done' : ''}">
          <div class="gs-check">${s.done ? '✓' : ''}</div>
          <div class="gs-label">${s.label}</div>
        </div>`).join('')}
    </div>`;
}

function renderHowTo() {
  const items = [
    ['Log an expense', 'Transactions → + Add Transaction → fill Amount, Description, Category, Payment Method → Save'],
    ['Personal card expense', 'Select "Personal Card" as payment — automatically flagged for reimbursement'],
    ['Attach a receipt', 'In Add/Edit panel, drag-and-drop or click the receipt zone → JPG, PNG, PDF supported'],
    ['Mark reimbursed', 'Reports → Reimbursements → click "Mark Reimbursed" next to the transaction'],
    ['Log a loan payment', 'Add Transaction → Category: Interest — Loan → More Options → enter Interest and Principal split'],
    ['Add a vendor', 'Vendors → + Add Vendor → enter name, category, email → Save'],
    ['Flag a 1099 vendor', 'Vendor panel → More Details → enter EIN and enable "1099 Eligible"'],
    ['Add a capital asset', 'Settings → Assets → + Add Asset → name, cost, depreciation method'],
    ['Run year-end reports', 'Reports → set Tax Year → Profit & Loss → Print or Export'],
    ['Log time worked', 'Time → Hours tab → + Log Time → hours, description, category'],
    ['Log mileage', 'Time → Mileage tab → + Log Mileage → miles, purpose, from/to'],
    ['Set up recurring expense', 'Settings → Recurring → + Add Recurring → frequency + day of month'],
    ['Import bank CSV', 'Transactions → Import CSV → upload file → map columns → review'],
    ['Set a budget', 'Settings → Budgets → click a category → set monthly target'],
    ['Upload a business document', 'Settings → Documents → + Upload Document'],
    ['Export for QuickBooks', 'Transactions → Export ▾ → Export for QuickBooks (IIF)'],
  ];

  return `
    <div class="howto-list">
      ${items.map(([task, steps]) => `
        <div class="howto-item">
          <div class="howto-task">${task}</div>
          <div class="howto-steps">${steps}</div>
        </div>`).join('')}
    </div>`;
}

function renderCPAGuide() {
  const exports = [
    ['Profit & Loss Report', 'Reports → Profit & Loss → set Tax Year → Print/Export'],
    ['Tax Deductibility Summary', 'Reports → Tax Deductibility → Export CSV'],
    ['1099 Vendor Report', 'Reports → 1099 Vendors → Export CSV (EIN + payment totals)'],
    ['Owner Draws & Contributions', 'Reports → Owner Draws & Capital → Export CSV'],
    ['Loan Amortization', 'Reports → Loan Amortization → Print (interest paid = deductible)'],
    ['Capital Assets', 'Reports → Capital Assets → Print (depreciation schedule)'],
    ['Reimbursements', 'Reports → Reimbursements → Export CSV'],
    ['Hours by Category', 'Time → Export CSV (owner active participation records)'],
    ['Mileage Log', 'Reports → Mileage Log → Export CSV'],
    ['CT Sales Tax', 'Reports → CT Sales Tax → Export CSV (for CT DRS filing)'],
    ['QuickBooks Import', 'Transactions → Export ▾ → Export for QuickBooks (IIF)'],
  ];

  return `
    <div class="cpa-guide">
      <p class="cpa-intro">Every January, export these reports and send them to your CPA along with your bank statements.</p>
      <div class="cpa-list">
        ${exports.map(([label, how]) => `
          <div class="cpa-item">
            <div class="cpa-label">📋 ${label}</div>
            <div class="cpa-how">${how}</div>
          </div>`).join('')}
      </div>
      <div class="cpa-note">
        <strong>Tip:</strong> Run the Missing Receipts report first and attach any missing receipts before exporting — your CPA will need documentation for all expenses over $75.
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBERSHIPS — Tier system + MRR
   ═══════════════════════════════════════════════════════════════════════════ */

function renderMembershipsTab() {
  const tiers = State.membershipTiers || [];

  const tierRows = tiers.map(t => `
    <tr>
      <td><strong>${t.name}</strong></td>
      <td class="num">${fmt$(t.price)}</td>
      <td>${t.billingCycle === 'annual' ? 'Annual' : 'Monthly'}</td>
      <td>${t.description || '—'}</td>
      <td>
        <button class="btn-link" onclick="openTierEdit('${t.id}')">Edit</button>
        <button class="btn-link red" onclick="deleteTier('${t.id}')">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">No membership tiers yet.</td></tr>';

  // Active member summary
  const activeMems = (State.customers || []).filter(c => c.membershipStatus === 'active');
  const mrr = activeMems.reduce((s, c) => {
    const tier = tiers.find(t => t.id === c.membershipTierId);
    if (!tier) return s;
    return s + (tier.billingCycle === 'annual' ? (tier.price / 12) : tier.price);
  }, 0);

  // Members due for billing
  const today = todayStr();
  const dueForBilling = activeMems.filter(c => c.nextBillingDate && c.nextBillingDate <= today);

  return `
    <div class="settings-tab-body">
      <!-- MRR summary -->
      ${tiers.length ? `
      <div class="mem-summary-row">
        <div class="mem-stat"><div class="mem-stat-val">${activeMems.length}</div><div class="mem-stat-lbl">Active Members</div></div>
        <div class="mem-stat"><div class="mem-stat-val green">${fmt$(mrr)}</div><div class="mem-stat-lbl">Est. MRR</div></div>
        <div class="mem-stat"><div class="mem-stat-val">${fmt$(mrr * 12)}</div><div class="mem-stat-lbl">Est. ARR</div></div>
        ${dueForBilling.length ? `<div class="mem-stat"><button class="alert-chip amber" onclick="generateMembershipInvoices()">⚡ ${dueForBilling.length} billing due — Generate</button></div>` : ''}
      </div>` : ''}

      <div class="settings-section-header">
        <h4>Membership Tiers</h4>
        <button class="btn-secondary" onclick="openTierEdit(null)">+ Add Tier</button>
      </div>
      <table class="settings-table">
        <thead><tr><th>Tier Name</th><th class="num">Price</th><th>Billing</th><th>Description</th><th></th></tr></thead>
        <tbody>${tierRows}</tbody>
      </table>
      <div id="tierEditForm" style="display:none"></div>

      <div class="settings-section-header" style="margin-top:24px">
        <h4>Members by Tier</h4>
      </div>
      ${tiers.length ? tiers.map(tier => {
        const mems = (State.customers || []).filter(c => c.membershipTierId === tier.id && c.membershipStatus === 'active');
        return `<div class="tier-member-group">
          <div class="tier-member-header">${tier.name} — ${mems.length} active · ${fmt$(tier.price)}/${tier.billingCycle === 'annual' ? 'yr' : 'mo'}</div>
          ${mems.length ? mems.map(m => `
            <div class="tier-member-row">
              <span>${m.name}</span>
              <span class="text-muted" style="font-size:12px">${m.nextBillingDate ? 'Next bill: ' + fmtDate(m.nextBillingDate) : ''}</span>
              <button class="btn-link" onclick="navigate('customers');setTimeout(()=>openCustPanel('${m.id}'),200)">Edit</button>
            </div>`).join('') : '<div class="tier-member-row text-muted">No active members in this tier</div>'}
        </div>`;
      }).join('') : ''}
    </div>`;
}

function openTierEdit(id) {
  const t = id ? (State.membershipTiers || []).find(x => x.id === id) : null;
  document.getElementById('tierEditForm').style.display = '';
  document.getElementById('tierEditForm').innerHTML = `
    <div class="inline-form">
      <div class="form-row two-col">
        <div><label>Tier Name *</label><input type="text" id="tierName" value="${t?.name||''}" placeholder="e.g. Founding Member"></div>
        <div><label>Price ($)</label><input type="number" id="tierPrice" value="${t?.price||''}" min="0" step="0.01"></div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Billing Cycle</label>
          <select id="tierCycle">
            <option value="monthly" ${t?.billingCycle==='monthly'||!t?'selected':''}>Monthly</option>
            <option value="annual"  ${t?.billingCycle==='annual'?'selected':''}>Annual</option>
          </select>
        </div>
        <div><label>Description</label><input type="text" id="tierDesc" value="${t?.description||''}" placeholder="e.g. Full simulator access"></div>
      </div>
      <div class="panel-actions">
        <button class="btn-primary sm" onclick="saveTierForm('${id||''}')">Save Tier</button>
        <button class="btn-ghost sm" onclick="document.getElementById('tierEditForm').style.display='none'">Cancel</button>
      </div>
    </div>`;
}

async function saveTierForm(id) {
  const name = document.getElementById('tierName')?.value?.trim();
  if (!name) return;
  const data = {
    name,
    price:        parseFloat(document.getElementById('tierPrice')?.value || 0),
    billingCycle: document.getElementById('tierCycle')?.value || 'monthly',
    description:  document.getElementById('tierDesc')?.value?.trim() || '',
  };
  if (id) await dbSet('membershipTiers', id, data);
  else    await dbAdd('membershipTiers', data);
  toast(id ? 'Tier updated' : 'Tier added');
  renderSettingsTab('memberships');
}

async function deleteTier(id) {
  if (!confirm('Delete this tier? Members assigned to it will be unaffected.')) return;
  await dbDelete('membershipTiers', id);
  renderSettingsTab('memberships');
  toast('Tier deleted');
}

async function generateMembershipInvoices() {
  const tiers   = State.membershipTiers || [];
  const today   = todayStr();
  const due     = (State.customers || []).filter(c =>
    c.membershipStatus === 'active' && c.nextBillingDate && c.nextBillingDate <= today
  );
  if (!due.length) { toast('No members due for billing'); return; }

  let count = 0;
  for (const cust of due) {
    const tier = tiers.find(t => t.id === cust.membershipTierId);
    if (!tier) continue;
    await saveTxn({
      type:          'income',
      amount:        tier.price,
      description:   `${tier.name} — ${cust.name}`,
      category:      'Membership Revenue',
      paymentMethod: 'business',
      date:          today,
      customerId:    cust.id,
      taxYear:       new Date().getFullYear(),
      status:        'normal',
    });
    // Advance next billing date
    const next = new Date(cust.nextBillingDate + 'T12:00:00');
    if (tier.billingCycle === 'annual') next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);
    await dbSet('customers', cust.id, { nextBillingDate: next.toISOString().slice(0,10) });
    count++;
  }
  toast(`${count} membership invoice${count !== 1 ? 's' : ''} logged as income`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HOURLY RATES — Per-category rate, time value reporting
   ═══════════════════════════════════════════════════════════════════════════ */

function renderHourlyRatesTab() {
  const rates = State.hourlyRates || {};
  const cats  = State.timeCategories || [];

  const rows = cats.map(cat => {
    const rate = rates[cat] || '';
    return `
      <tr>
        <td>${cat}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--text-3)">$</span>
            <input type="number" class="rate-input" value="${rate}" min="0" step="0.01"
              placeholder="—" onchange="saveHourlyRate('${cat.replace(/'/g,"\\'")}', this.value)">
            <span style="color:var(--text-3);font-size:12px">/hr</span>
          </div>
        </td>
        <td class="num text-muted" style="font-size:12px">${rate ? fmt$(rate) + '/hr' : 'Not set'}</td>
      </tr>`;
  }).join('');

  const defaultRate = rates['__default'] || '';

  return `
    <div class="settings-tab-body">
      <div class="settings-section-header">
        <h4>Hourly Rates by Category</h4>
      </div>
      <p class="hint">Set hourly rates to see the estimated value of your time in reports. These are for your reference only — not invoiced.</p>
      <div class="inline-form" style="margin-bottom:16px">
        <div class="form-row two-col">
          <div>
            <label>Default Rate (applies to all unset categories)</label>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="color:var(--text-3)">$</span>
              <input type="number" id="defaultRate" value="${defaultRate}" min="0" step="0.01" placeholder="0.00"
                onchange="saveHourlyRate('__default', this.value)">
              <span style="color:var(--text-3);font-size:12px">/hr</span>
            </div>
          </div>
        </div>
      </div>
      <table class="settings-table">
        <thead><tr><th>Time Category</th><th>Rate</th><th>Preview</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function saveHourlyRate(category, value) {
  const rates = { ...(State.hourlyRates || {}), [category]: parseFloat(value) || 0 };
  State.hourlyRates = rates;
  await dbSet('meta', 'settings', { hourlyRates: rates });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTIONS — 12-month forward projection
   ═══════════════════════════════════════════════════════════════════════════ */

function renderProjectionsReport() {
  const tiers   = State.membershipTiers || [];
  const custs   = State.customers || [];
  const txns    = (State.txns || []).filter(t => t.status !== 'draft');
  const recur   = (State.recurringTemplates || []).filter(t => t.active);

  // Compute MRR from memberships
  const activeMems = custs.filter(c => c.membershipStatus === 'active');
  const memberMRR  = activeMems.reduce((s, c) => {
    const tier = tiers.find(t => t.id === c.membershipTierId);
    return s + (tier ? (tier.billingCycle === 'annual' ? tier.price/12 : tier.price) : 0);
  }, 0);

  // Recurring monthly expenses
  const recurMonthly = recur.filter(r => r.type === 'expense' || !r.type).reduce((s, r) => {
    if (r.frequency === 'monthly')  return s + (r.amount || 0);
    if (r.frequency === 'weekly')   return s + (r.amount || 0) * 4.33;
    if (r.frequency === 'annually') return s + (r.amount || 0) / 12;
    return s;
  }, 0);

  // Last 3 months average income and expenses (variable portion)
  const now    = new Date();
  const months = Array.from({length:3}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const recentTxns = txns.filter(t => months.some(m => t.date?.startsWith(m)));
  const avgVarIncome  = recentTxns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)  / 3;
  const avgVarExpense = recentTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) / 3 - recurMonthly;

  const totalMonthlyIncome  = memberMRR + Math.max(avgVarIncome, 0);
  const totalMonthlyExpense = recurMonthly + Math.max(avgVarExpense, 0);
  const monthlyNet = totalMonthlyIncome - totalMonthlyExpense;

  // Break-even check
  const breakEvenMRR = totalMonthlyExpense;
  const gapToBreakEven = breakEvenMRR - memberMRR;

  // Build 12-month projection table
  let cumulativeNet = 0;
  const rows = Array.from({length:12}, (_,i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const mo   = d.toLocaleString('default',{month:'short'});
    const yr   = d.getFullYear();
    cumulativeNet += monthlyNet;
    return { label:`${mo} ${yr}`, income:totalMonthlyIncome, expense:totalMonthlyExpense, net:monthlyNet, cumulative:cumulativeNet };
  });

  return `
    <div class="report-section">
      <div class="bs-equation" style="margin-bottom:20px">
        <div class="bs-eq-item">
          <div class="bs-eq-val green">${fmt$(memberMRR)}</div>
          <div class="bs-eq-label">Membership MRR</div>
        </div>
        <div class="bs-eq-sign">+</div>
        <div class="bs-eq-item">
          <div class="bs-eq-val green">${fmt$(Math.max(avgVarIncome,0))}</div>
          <div class="bs-eq-label">Avg Variable Income</div>
        </div>
        <div class="bs-eq-sign">−</div>
        <div class="bs-eq-item">
          <div class="bs-eq-val red">${fmt$(totalMonthlyExpense)}</div>
          <div class="bs-eq-label">Monthly Expenses</div>
        </div>
        <div class="bs-eq-sign">=</div>
        <div class="bs-eq-item">
          <div class="bs-eq-val ${monthlyNet>=0?'green':'red'}">${fmt$(monthlyNet)}</div>
          <div class="bs-eq-label">Est. Monthly Net</div>
        </div>
      </div>

      ${gapToBreakEven > 0 ? `
      <div style="background:var(--amber-bg);border-left:4px solid var(--amber);padding:12px 16px;border-radius:var(--radius);margin-bottom:16px;font-size:13px">
        <strong>Break-even Gap:</strong> You need ${fmt$(gapToBreakEven)} more in monthly revenue to cover expenses.
        That's approximately ${Math.ceil(gapToBreakEven / ((tiers[0]?.price)||299))} more members at your most popular tier.
      </div>` : `
      <div style="background:var(--green-bg);border-left:4px solid var(--green);padding:12px 16px;border-radius:var(--radius);margin-bottom:16px;font-size:13px">
        <strong>✓ Profitable:</strong> At current rates, projected monthly net is ${fmt$(monthlyNet)}.
      </div>`}

      <div style="margin-bottom:12px">
        <canvas id="projectionChart" height="200"></canvas>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Net</th><th class="num">Cumulative</th></tr></thead>
          <tbody>
            ${rows.map(r=>`
            <tr>
              <td>${r.label}</td>
              <td class="num amount-income">+${fmt$(r.income)}</td>
              <td class="num amount-expense">−${fmt$(r.expense)}</td>
              <td class="num ${r.net>=0?'green':'red'}">${r.net>=0?'+':''}${fmt$(r.net)}</td>
              <td class="num ${r.cumulative>=0?'green':'red'}">${r.cumulative>=0?'+':''}${fmt$(r.cumulative)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="hint" style="margin-top:12px">Projections are estimates based on current membership MRR and 3-month average activity. Consult your CPA for financial planning.</p>
    </div>`;
}

function renderProjectionsReportWithCharts(container) {
  if (!container) return;
  container.innerHTML = renderProjectionsReport();
  requestAnimationFrame(() => {
    const txns = (State.txns||[]).filter(t=>t.status!=='draft');
    const now  = new Date();
    const tiers = State.membershipTiers||[];
    const custs = State.customers||[];
    const recur = (State.recurringTemplates||[]).filter(t=>t.active);
    const activeMems = custs.filter(c=>c.membershipStatus==='active');
    const memberMRR  = activeMems.reduce((s,c)=>{
      const tier=tiers.find(t=>t.id===c.membershipTierId);
      return s+(tier?(tier.billingCycle==='annual'?tier.price/12:tier.price):0);
    },0);
    const recurMonthly = recur.filter(r=>r.type==='expense'||!r.type).reduce((s,r)=>{
      if(r.frequency==='monthly') return s+(r.amount||0);
      if(r.frequency==='weekly')  return s+(r.amount||0)*4.33;
      if(r.frequency==='annually') return s+(r.amount||0)/12;
      return s;
    },0);
    const months3 = Array.from({length:3},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-i-1,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
    const recentTxns = txns.filter(t=>months3.some(m=>t.date?.startsWith(m)));
    const avgInc  = recentTxns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)/3;
    const avgExp  = recentTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)/3;
    const totalInc = memberMRR + Math.max(avgInc,0);
    const totalExp = recurMonthly + Math.max(avgExp-recurMonthly,0);

    const labels = Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);return d.toLocaleString('default',{month:'short',year:'2-digit'});});
    upsertChart('projectionChart','bar',{
      labels,
      datasets:[
        {label:'Income',data:Array(12).fill(totalInc),backgroundColor:'rgba(22,163,74,.3)',borderColor:'#16a34a',borderWidth:1.5},
        {label:'Expenses',data:Array(12).fill(totalExp),backgroundColor:'rgba(220,38,38,.3)',borderColor:'#dc2626',borderWidth:1.5},
      ]
    },{plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}});
  });
}
