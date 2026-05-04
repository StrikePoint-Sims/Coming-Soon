/* ═══════════════════════════════════════════════════════════════════════════
   panels.js — All panel render, open, close, save functions
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Panel state ── */
let currentPanelType = null;
let currentPanelId   = null;
let currentReceipt   = null; // { file, url, filename } for pending uploads

/* ────────────────────────────────────────────────────────────────────────────
   Panel router
   ──────────────────────────────────────────────────────────────────────────── */
function openPanel(type, id = null, defaultTxnType = null) {
  currentPanelType = type;
  currentPanelId   = id;
  currentReceipt   = null;

  switch (type) {
    case 'txn':       openTxnPanel(id, defaultTxnType); break;
    case 'customer':  openCustPanel(id);     break;
    case 'vendor':    openVendorPanel(id);   break;
    case 'time':      openTimePanel(id);     break;
    case 'mileage':   openMileagePanel(id);  break;
    default: console.warn('Unknown panel type:', type);
  }
}

function closePanel(overlayId) {
  const overlay = document.getElementById(overlayId || _overlayForType(currentPanelType));
  if (overlay) overlay.classList.remove('open');
  currentPanelType = null;
  currentPanelId   = null;
  currentReceipt   = null;
}

function _overlayForType(type) {
  const map = {
    txn: 'txnOverlay', customer: 'custOverlay', vendor: 'vendorOverlay',
    time: 'timeOverlay', mileage: 'mileageOverlay',
  };
  return map[type] || '';
}

function _openOverlay(id) {
  document.getElementById(id)?.classList.add('open');
}

/* ────────────────────────────────────────────────────────────────────────────
   TRANSACTION PANEL
   ──────────────────────────────────────────────────────────────────────────── */
function openTxnPanel(id, defaultTxnType = null) {
  const txn = id ? State.txns.find(t => t.id === id) : null;
  const cats = State.categories || [];
  const expCats = cats.filter(c => c.type === 'expense').sort((a,b) => a.order - b.order);
  const incCats = cats.filter(c => c.type === 'income').sort((a,b) => a.order - b.order);
  const vendors  = State.vendors  || [];
  const customers = State.customers || [];
  const loans    = State.loans    || [];
  const assets   = State.assets   || [];

  const type        = txn?.type || defaultTxnType || 'expense';
  const amount      = txn?.amount      || '';
  const description = txn?.description || '';
  const date        = txn?.date        || todayStr();
  const category    = txn?.category    || '';
  const pm          = txn?.paymentMethod || 'business';
  const notes       = txn?.notes       || '';
  const vendorId    = txn?.vendorId    || '';
  const customerId  = txn?.customerId  || '';
  const isTaxable   = txn?.isTaxable   || false;
  const interestAmt = txn?.interestAmount != null ? txn.interestAmount : '';
  const principalAmt = txn?.principalAmount != null ? txn.principalAmount : '';
  const loanId      = txn?.loanId      || '';
  const assetId     = txn?.assetId     || '';
  const receiptUrl  = txn?.receiptUrl  || '';
  const receiptFilename = txn?.receiptFilename || '';

  const isMobile = window.innerWidth < 768;
  const hasCamera = 'mediaDevices' in navigator;

  // Update static header title
  const titleEl = document.getElementById('txnPanelTitle');
  if (titleEl) titleEl.textContent = id ? 'Edit Transaction' : 'Add Transaction';

  document.getElementById('txnPanelContent').innerHTML = `
    <div class="type-toggle" id="txnTypeToggle">
      <button class="type-btn ${type==='expense'?'active-expense':''}" data-type="expense" onclick="setTxnType('expense')">Expense</button>
      <button class="type-btn ${type==='income'?'active-income':''}" data-type="income" onclick="setTxnType('income')">Income</button>
    </div>
    <div class="panel-form">
      <div class="form-row">
        <label>Amount</label>
        <div class="amount-input-wrap">
          <span class="dollar-sign">$</span>
          <input type="number" id="txnAmount" value="${amount}" placeholder="0.00" min="0" step="0.01"
            oninput="onTxnAmountChange()" class="amount-input">
        </div>
      </div>

      <div class="form-row">
        <label>Description</label>
        <input type="text" id="txnDesc" value="${description}" placeholder="e.g. Comcast monthly bill"
          oninput="onTxnDescInput(this.value)" autocomplete="off">
        <div class="suggestion-chip" id="suggChip" style="display:none">
          <span id="suggText"></span>
          <button type="button" onclick="acceptSuggestion()">✓ Use</button>
        </div>
      </div>

      <div class="form-row">
        <label>Category</label>
        <select id="txnCategory" onchange="onCategoryChange(this.value)">
          <option value="">Select category…</option>
          <optgroup label="Expenses" id="expCatGroup">
            ${expCats.map(c => `<option value="${c.name}" ${category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </optgroup>
          <optgroup label="Income" id="incCatGroup">
            ${incCats.map(c => `<option value="${c.name}" ${category===c.name?'selected':''}>${c.name}</option>`).join('')}
          </optgroup>
        </select>
      </div>

      <div class="form-row two-col">
        <div>
          <label>Date</label>
          <input type="date" id="txnDate" value="${date}">
        </div>
        <div>
          <label>Payment Method</label>
          <select id="txnPaymentMethod" onchange="onPaymentMethodChange(this.value)">
            <option value="business"  ${pm==='business' ?'selected':''}>Business Account</option>
            <option value="personal"  ${pm==='personal' ?'selected':''}>Personal Card</option>
            <option value="sba"       ${pm==='sba'      ?'selected':''}>SBA Funds</option>
            <option value="capital"   ${pm==='capital'  ?'selected':''}>Owner Capital</option>
          </select>
        </div>
      </div>

      <!-- Receipt zone -->
      <div class="form-row">
        <label>Receipt / Invoice</label>
        ${receiptUrl
          ? `<div class="receipt-attached">
               <span class="receipt-name">📎 ${receiptFilename || 'Receipt'}</span>
               <button type="button" class="btn-link" onclick="previewReceipt('${receiptUrl}','')">View</button>
               <button type="button" class="btn-link red" onclick="removeReceipt()">Remove</button>
             </div>`
          : `<div class="receipt-zone" id="receiptZone"
                onclick="document.getElementById('receiptInput').click()"
                ondragover="event.preventDefault()"
                ondrop="handleReceiptDrop(event)">
               <div class="receipt-zone-inner">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                 <span>Drop file here or click to browse</span>
                 <span class="receipt-hint">JPG, PNG, PDF supported</span>
               </div>
             </div>
             ${isMobile && hasCamera ? `
               <div class="camera-btns">
                 <button type="button" class="btn-secondary sm" onclick="openCameraCapture()">📷 Take Photo</button>
                 <button type="button" class="btn-secondary sm" onclick="document.getElementById('receiptInput').click()">📁 Browse</button>
               </div>` : ''}
             <div class="receipt-preview-pending" id="receiptPending" style="display:none">
               <span id="receiptPendingName"></span>
               <button type="button" class="btn-link red" onclick="clearPendingReceipt()">✕</button>
             </div>`
        }
      </div>

      <!-- Duplicate warning -->
      <div class="duplicate-warning" id="dupWarning" style="display:none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span id="dupMsg">A similar transaction already exists.</span>
      </div>

      <!-- More options -->
      <div class="more-options-toggle" onclick="toggleMoreOptions()">
        <span id="moreLabel">▾ More options</span>
      </div>
      <div class="more-options-body" id="moreOptionsBody" style="display:none">

        <div class="form-row" id="vendorRow">
          <label>Vendor</label>
          <select id="txnVendor">
            <option value="">None</option>
            ${vendors.map(v => `<option value="${v.id}" ${vendorId===v.id?'selected':''}>${v.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-row" id="customerRow">
          <label>Customer</label>
          <select id="txnCustomer">
            <option value="">None</option>
            ${customers.map(c => `<option value="${c.id}" ${customerId===c.id?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-row" id="taxableRow" style="display:none">
          <label class="toggle-label">
            <input type="checkbox" id="txnTaxable" ${isTaxable?'checked':''}>
            <span>CT Sales Tax Collected on this income</span>
          </label>
        </div>

        <div class="form-row" id="loanSplitRow" style="display:none">
          <label>Loan Payment Split</label>
          <select id="txnLoan">
            <option value="">Select loan…</option>
            ${loans.map(l => `<option value="${l.id}" ${loanId===l.id?'selected':''}>${l.name}</option>`).join('')}
          </select>
          <div class="two-col" style="margin-top:8px">
            <div>
              <label style="font-size:12px">Interest portion ($)</label>
              <input type="number" id="txnInterest" value="${interestAmt}" placeholder="0.00" min="0" step="0.01">
            </div>
            <div>
              <label style="font-size:12px">Principal portion ($)</label>
              <input type="number" id="txnPrincipal" value="${principalAmt}" placeholder="0.00" min="0" step="0.01">
            </div>
          </div>
        </div>

        <div class="form-row" id="assetRow" style="display:none">
          <label>Link to Capital Asset</label>
          <select id="txnAsset">
            <option value="">None</option>
            ${assets.map(a => `<option value="${a.id}" ${assetId===a.id?'selected':''}>${a.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <label>Notes</label>
          <textarea id="txnNotes" rows="2" placeholder="Optional notes…">${notes}</textarea>
        </div>
      </div><!-- /more-options-body -->

      <div class="panel-actions">
        <button class="btn-primary" onclick="saveTxnPanel()">Save</button>
        ${id ? `<button class="btn-ghost red" onclick="deleteTxnPanel('${id}')">Delete</button>` : ''}
      </div>
    </div>
  `;

  // Wire visibility
  _updateTxnTypeUI(type);
  _openOverlay('txnOverlay');

  // Auto-suggest if editing
  if (description) onTxnDescInput(description, true);
}

function setTxnType(type) {
  document.querySelectorAll('#txnTypeToggle .type-btn').forEach(b => {
    b.classList.remove('active-expense','active-income');
    if (b.dataset.type === type) b.classList.add(type === 'expense' ? 'active-expense' : 'active-income');
  });
  _updateTxnTypeUI(type);
}

function _updateTxnTypeUI(type) {
  const isExpense = type === 'expense';
  const catSel = document.getElementById('txnCategory');
  if (catSel) {
    document.getElementById('expCatGroup').style.display = '';
    document.getElementById('incCatGroup').style.display = '';
    // Highlight appropriate default
    if (!catSel.value) {
      catSel.querySelector(`optgroup[label="${isExpense ? 'Expenses' : 'Income'}"] option`)?.setAttribute('selected','');
    }
  }
  const taxRow = document.getElementById('taxableRow');
  if (taxRow) taxRow.style.display = isExpense ? 'none' : '';
}

function onCategoryChange(val) {
  const loanCats = ['Interest — Loan'];
  const assetCats = ['Equipment (Capital)', 'Buildout / Improvements'];
  document.getElementById('loanSplitRow').style.display = loanCats.includes(val) ? '' : 'none';
  document.getElementById('assetRow').style.display     = assetCats.includes(val) ? '' : 'none';
}

function onPaymentMethodChange(val) {
  // Could add UI hints; currently no extra logic needed
}

function onTxnAmountChange() {
  checkDuplicate();
}

let _suggPending = null;
function onTxnDescInput(val, silent = false) {
  checkDuplicate();
  const catSel = document.getElementById('txnCategory');
  if (!catSel || catSel.value) return; // don't suggest if already picked
  const suggestion = suggestCategory(val);
  const chip = document.getElementById('suggChip');
  const txt  = document.getElementById('suggText');
  if (suggestion && chip && txt) {
    txt.textContent = 'Suggested: ' + suggestion;
    chip.style.display = '';
    _suggPending = suggestion;
  } else if (chip) {
    chip.style.display = 'none';
    _suggPending = null;
  }
}

function acceptSuggestion() {
  if (!_suggPending) return;
  const catSel = document.getElementById('txnCategory');
  if (catSel) catSel.value = _suggPending;
  document.getElementById('suggChip').style.display = 'none';
  onCategoryChange(_suggPending);
  _suggPending = null;
}

function checkDuplicate() {
  const amount = parseFloat(document.getElementById('txnAmount')?.value || 0);
  const date   = document.getElementById('txnDate')?.value;
  const desc   = document.getElementById('txnDesc')?.value || '';
  const warn   = document.getElementById('dupWarning');
  if (!warn || !amount || !date) return;

  const candidate = { amount, date, description: desc };
  const existing  = (State.txns || []).filter(t => t.id !== currentPanelId && t.status !== 'draft');
  if (isDuplicate(candidate, existing)) {
    document.getElementById('dupMsg').textContent =
      `A $${fmt$(amount)} transaction on ${fmtDate(date)} may already exist.`;
    warn.style.display = '';
  } else {
    warn.style.display = 'none';
  }
}

function toggleMoreOptions() {
  const body  = document.getElementById('moreOptionsBody');
  const label = document.getElementById('moreLabel');
  const open  = body.style.display === 'none' || body.style.display === '';
  body.style.display  = open ? '' : 'none';
  label.textContent   = open ? '▴ Fewer options' : '▾ More options';
}

/* Receipt handlers */
function handleReceiptDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) setPendingReceipt(file);
}

function openCameraCapture() {
  const inp = document.getElementById('cameraInput');
  if (inp) { inp.value = ''; inp.click(); }
}

function setPendingReceipt(file) {
  currentReceipt = { file };
  const pend = document.getElementById('receiptPending');
  const name = document.getElementById('receiptPendingName');
  if (pend && name) {
    name.textContent = '📎 ' + file.name;
    pend.style.display = '';
  }
  const zone = document.getElementById('receiptZone');
  if (zone) zone.classList.add('has-file');
}

function clearPendingReceipt() {
  currentReceipt = null;
  const pend = document.getElementById('receiptPending');
  if (pend) pend.style.display = 'none';
  const zone = document.getElementById('receiptZone');
  if (zone) zone.classList.remove('has-file');
}

function removeReceipt() {
  if (!currentPanelId) return;
  const txn = State.txns.find(t => t.id === currentPanelId);
  if (!txn?.receiptUrl) return;
  if (!confirm('Remove this receipt? This cannot be undone.')) return;
  deleteReceipt(currentPanelId, txn.receiptFilename)
    .then(() => dbSet('transactions', currentPanelId, { receiptUrl: '', receiptFilename: '' }))
    .then(() => { toast('Receipt removed'); openPanel('txn', currentPanelId); })
    .catch(e => toast('Error: ' + e.message, 'error'));
}

function previewReceipt(url, mime) {
  const overlay = document.getElementById('previewOverlay');
  const content = document.getElementById('previewContent');
  if (!overlay || !content) return;
  const isPDF = mime === 'application/pdf' || url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  content.innerHTML = isPDF
    ? `<iframe src="${url}" style="width:100%;height:80vh;border:0;border-radius:8px"></iframe>`
    : `<img src="${url}" style="max-width:100%;max-height:80vh;border-radius:8px;display:block;margin:auto">`;
  overlay.classList.add('open');
}

async function saveTxnPanel() {
  const amount   = parseFloat(document.getElementById('txnAmount')?.value || 0);
  const desc     = document.getElementById('txnDesc')?.value?.trim() || '';
  const category = document.getElementById('txnCategory')?.value || '';
  const date     = document.getElementById('txnDate')?.value || '';
  const pm       = document.getElementById('txnPaymentMethod')?.value || 'business';

  if (!amount || amount <= 0) { shake('txnAmount'); return; }
  if (!category)              { shake('txnCategory'); return; }
  if (!date)                  { shake('txnDate'); return; }

  const type = document.querySelector('#txnTypeToggle .type-btn.active-expense') ? 'expense'
             : document.querySelector('#txnTypeToggle .type-btn.active-income') ? 'income'
             : 'expense';

  const catMeta = categoryMeta(category);
  const ded     = catMeta?.ded || 'full';

  const data = {
    type, amount, description: desc, category, date,
    paymentMethod: pm,
    deductibility: ded,
    reimbursementStatus: pm === 'personal' ? (currentPanelId
      ? (State.txns.find(t=>t.id===currentPanelId)?.reimbursementStatus || 'pending')
      : 'pending') : 'na',
    isTaxable: document.getElementById('txnTaxable')?.checked || false,
    vendorId: document.getElementById('txnVendor')?.value || '',
    customerId: document.getElementById('txnCustomer')?.value || '',
    loanId: document.getElementById('txnLoan')?.value || '',
    assetId: document.getElementById('txnAsset')?.value || '',
    interestAmount: parseFloat(document.getElementById('txnInterest')?.value || 0) || 0,
    principalAmount: parseFloat(document.getElementById('txnPrincipal')?.value || 0) || 0,
    notes: document.getElementById('txnNotes')?.value?.trim() || '',
    status: 'normal',
  };

  // Learn keyword
  const vendorName = (State.vendors || []).find(v => v.id === data.vendorId)?.name || '';
  if (category) learnKeyword(desc, category, vendorName).catch(() => {});

  try {
    const btn = document.querySelector('.panel-actions .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const txnId = await saveTxn(data, currentPanelId || null);

    if (currentReceipt?.file) {
      const { receiptUrl, receiptFilename } = await uploadReceipt(txnId, currentReceipt.file);
      await dbSet('transactions', txnId, { receiptUrl, receiptFilename });
    }

    closePanel('txnOverlay');
    toast(currentPanelId ? 'Transaction updated' : 'Transaction saved');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    const btn = document.querySelector('.panel-actions .btn-primary');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

async function deleteTxnPanel(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try {
    await deleteTxn(id);
    closePanel('txnOverlay');
    toast('Transaction deleted');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   CUSTOMER PANEL
   ──────────────────────────────────────────────────────────────────────────── */
function openCustPanel(id) {
  const cust = id ? (State.customers || []).find(c => c.id === id) : null;
  const name           = cust?.name             || '';
  const email          = cust?.email            || '';
  const phone          = cust?.phone            || '';
  const type           = cust?.type             || 'member';
  const memberTierId   = cust?.membershipTierId || '';
  const memberStatus   = cust?.membershipStatus || 'active';
  const nextBilling    = cust?.nextBillingDate  || '';
  const startDate      = cust?.startDate        || '';
  const status         = cust?.status           || 'active';
  const notes          = cust?.notes            || '';
  const tiers          = State.membershipTiers  || [];

  // Txn history for this customer
  let historyHTML = '';
  if (id) {
    const custTxns = (State.txns || []).filter(t => t.customerId === id).slice(0, 10);
    const total    = custTxns.reduce((s, t) => s + (t.type === 'income' ? t.amount : 0), 0);
    historyHTML = `
      <div class="panel-section">
        <div class="section-header-row">
          <h4>Transaction History</h4>
          <span class="section-badge">${fmt$(total)} total</span>
        </div>
        ${custTxns.length ? `
          <table class="panel-table">
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              ${custTxns.map(t => `<tr onclick="openPanel('txn','${t.id}')" style="cursor:pointer">
                <td>${fmtDate(t.date)}</td>
                <td>${t.description || '—'}</td>
                <td>${fmt$(t.amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<p class="empty-note">No transactions linked yet.</p>'}
      </div>`;
  }

  document.getElementById('custPanelContent').innerHTML = `
    <div class="panel-header">
      <h3>${id ? 'Edit Customer' : 'Add Customer'}</h3>
      <button class="panel-close" onclick="closePanel('custOverlay')">✕</button>
    </div>
    <div class="panel-body">
      <div class="form-row two-col">
        <div>
          <label>Name *</label>
          <input type="text" id="custName" value="${name}" placeholder="Full name">
        </div>
        <div>
          <label>Type</label>
          <select id="custType">
            <option value="member"   ${type==='member'  ?'selected':''}>Member</option>
            <option value="walk-in"  ${type==='walk-in' ?'selected':''}>Walk-in</option>
            <option value="corporate"${type==='corporate'?'selected':''}>Corporate</option>
            <option value="other"    ${type==='other'   ?'selected':''}>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Email</label>
          <input type="email" id="custEmail" value="${email}" placeholder="email@example.com">
        </div>
        <div>
          <label>Phone</label>
          <input type="tel" id="custPhone" value="${phone}" placeholder="(203) 555-0000">
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Membership Tier</label>
          <select id="custTierId">
            <option value="">— None —</option>
            ${tiers.map(t => `<option value="${t.id}" ${memberTierId===t.id?'selected':''}>${t.name} (${fmt$(t.price)}/${t.billingCycle==='annual'?'yr':'mo'})</option>`).join('')}
          </select>
          ${tiers.length === 0 ? '<small style="color:var(--text-3)">Add tiers in Settings → Memberships</small>' : ''}
        </div>
        <div>
          <label>Membership Status</label>
          <select id="custMemStatus">
            <option value="active"   ${memberStatus==='active'  ?'selected':''}>Active</option>
            <option value="paused"   ${memberStatus==='paused'  ?'selected':''}>Paused</option>
            <option value="cancelled"${memberStatus==='cancelled'?'selected':''}>Cancelled</option>
          </select>
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Start Date</label>
          <input type="date" id="custStart" value="${startDate}">
        </div>
        <div>
          <label>Next Billing Date</label>
          <input type="date" id="custNextBilling" value="${nextBilling}">
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Status</label>
          <select id="custStatus">
            <option value="active"   ${status==='active'  ?'selected':''}>Active</option>
            <option value="inactive" ${status==='inactive'?'selected':''}>Inactive</option>
            <option value="prospect" ${status==='prospect'?'selected':''}>Prospect</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="custNotes" rows="2" placeholder="Optional notes…">${notes}</textarea>
      </div>
      <div class="panel-actions">
        <button class="btn-primary" onclick="saveCustPanel()">Save</button>
        ${id ? `<button class="btn-ghost red" onclick="deleteCustPanel('${id}')">Delete</button>` : ''}
      </div>
      ${historyHTML}
    </div>
  `;
  _openOverlay('custOverlay');
}

async function saveCustPanel() {
  const name = document.getElementById('custName')?.value?.trim();
  if (!name) { shake('custName'); return; }
  const data = {
    name,
    email: document.getElementById('custEmail')?.value?.trim() || '',
    phone: document.getElementById('custPhone')?.value?.trim() || '',
    type:             document.getElementById('custType')?.value       || 'member',
    membershipTierId: document.getElementById('custTierId')?.value     || '',
    membershipStatus: document.getElementById('custMemStatus')?.value  || 'active',
    nextBillingDate:  document.getElementById('custNextBilling')?.value || '',
    startDate:        document.getElementById('custStart')?.value      || '',
    status:           document.getElementById('custStatus')?.value     || 'active',
    notes:            document.getElementById('custNotes')?.value?.trim() || '',
  };
  try {
    if (currentPanelId) await dbSet('customers', currentPanelId, data);
    else await dbAdd('customers', data);
    closePanel('custOverlay');
    toast(currentPanelId ? 'Customer updated' : 'Customer added');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteCustPanel(id) {
  if (!confirm('Delete this customer?')) return;
  await dbDelete('customers', id);
  closePanel('custOverlay');
  toast('Customer deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   VENDOR PANEL
   ──────────────────────────────────────────────────────────────────────────── */
function openVendorPanel(id) {
  const v = id ? (State.vendors || []).find(x => x.id === id) : null;
  const name     = v?.name     || '';
  const category = v?.category || '';
  const contact  = v?.contact  || '';
  const email    = v?.email    || '';
  const phone    = v?.phone    || '';
  const website  = v?.website  || '';
  const ein      = v?.ein      || '';
  const address  = v?.address  || '';
  const is1099   = v?.is1099Eligible || false;
  const notes    = v?.notes    || '';

  // YTD payments for this vendor
  let ytdHTML = '';
  if (id) {
    const ytd = (State.txns || [])
      .filter(t => t.vendorId === id && t.taxYear === (State.currentTaxYear || new Date().getFullYear()))
      .reduce((s, t) => s + (t.type === 'expense' ? t.amount : 0), 0);
    const alert = is1099 && ytd >= 600
      ? `<div class="alert-chip amber">⚠ $${fmt$(ytd)} paid YTD — 1099 required</div>` : '';
    ytdHTML = `<div class="vendor-ytd">YTD Payments: ${fmt$(ytd)} ${alert}</div>`;
  }

  document.getElementById('vendorPanelContent').innerHTML = `
    <div class="panel-header">
      <h3>${id ? 'Edit Vendor' : 'Add Vendor'}</h3>
      <button class="panel-close" onclick="closePanel('vendorOverlay')">✕</button>
    </div>
    <div class="panel-body">
      ${ytdHTML}
      <div class="form-row two-col">
        <div>
          <label>Name *</label>
          <input type="text" id="vendorName" value="${name}" placeholder="Company or person name">
        </div>
        <div>
          <label>Category</label>
          <select id="vendorCategory">
            ${(State.categories||[]).filter(c=>c.type==='expense').map(c =>
              `<option value="${c.name}" ${category===c.name?'selected':''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Contact Name</label>
          <input type="text" id="vendorContact" value="${contact}" placeholder="Primary contact">
        </div>
        <div>
          <label>Email</label>
          <input type="email" id="vendorEmail" value="${email}" placeholder="vendor@example.com">
        </div>
      </div>
      <div class="form-row two-col">
        <div>
          <label>Phone</label>
          <input type="tel" id="vendorPhone" value="${phone}" placeholder="(203) 555-0000">
        </div>
        <div>
          <label>Website</label>
          <input type="url" id="vendorWebsite" value="${website}" placeholder="https://…">
        </div>
      </div>
      <div class="more-options-toggle" onclick="toggleVendorMore()">
        <span id="vendorMoreLabel">▾ More details (1099, address, EIN)</span>
      </div>
      <div id="vendorMoreBody" style="display:none">
        <div class="form-row two-col">
          <div>
            <label>EIN / SSN</label>
            <input type="text" id="vendorEIN" value="${ein}" placeholder="XX-XXXXXXX">
          </div>
          <div>
            <label class="toggle-label" style="margin-top:20px">
              <input type="checkbox" id="vendor1099" ${is1099?'checked':''}>
              <span>1099 Eligible</span>
            </label>
          </div>
        </div>
        <div class="form-row">
          <label>Address</label>
          <input type="text" id="vendorAddress" value="${address}" placeholder="Street, City, State, ZIP">
        </div>
        <div class="form-row">
          <label>Notes</label>
          <textarea id="vendorNotes" rows="2">${notes}</textarea>
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn-primary" onclick="saveVendorPanel()">Save</button>
        ${id ? `<button class="btn-ghost red" onclick="deleteVendorPanel('${id}')">Delete</button>` : ''}
      </div>
    </div>
  `;
  _openOverlay('vendorOverlay');
}

function toggleVendorMore() {
  const body  = document.getElementById('vendorMoreBody');
  const label = document.getElementById('vendorMoreLabel');
  const open  = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  label.textContent  = open ? '▴ Fewer details' : '▾ More details (1099, address, EIN)';
}

async function saveVendorPanel() {
  const name = document.getElementById('vendorName')?.value?.trim();
  if (!name) { shake('vendorName'); return; }
  const data = {
    name,
    category: document.getElementById('vendorCategory')?.value || '',
    contact:  document.getElementById('vendorContact')?.value?.trim() || '',
    email:    document.getElementById('vendorEmail')?.value?.trim() || '',
    phone:    document.getElementById('vendorPhone')?.value?.trim() || '',
    website:  document.getElementById('vendorWebsite')?.value?.trim() || '',
    ein:      document.getElementById('vendorEIN')?.value?.trim() || '',
    is1099Eligible: document.getElementById('vendor1099')?.checked || false,
    address:  document.getElementById('vendorAddress')?.value?.trim() || '',
    notes:    document.getElementById('vendorNotes')?.value?.trim() || '',
  };
  try {
    if (currentPanelId) await dbSet('vendors', currentPanelId, data);
    else await dbAdd('vendors', data);
    closePanel('vendorOverlay');
    toast(currentPanelId ? 'Vendor updated' : 'Vendor added');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteVendorPanel(id) {
  if (!confirm('Delete this vendor?')) return;
  await dbDelete('vendors', id);
  closePanel('vendorOverlay');
  toast('Vendor deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   TIME PANEL
   ──────────────────────────────────────────────────────────────────────────── */
function openTimePanel(id) {
  const entry = id ? (State.timeEntries || []).find(e => e.id === id) : null;
  const date     = entry?.date     || todayStr();
  const hours    = entry?.hours    || '';
  const desc     = entry?.description || '';
  const category = entry?.category || '';
  const notes    = entry?.notes    || '';

  const timeCats = State.timeCategories || [
    'Business Development','Operations & Management','Marketing & Sales',
    'Finance & Accounting','Legal & Compliance','Buildout & Setup',
    'Customer Relations','Technology & Systems','Admin & Other',
  ];

  document.getElementById('timePanelContent').innerHTML = `
    <div class="panel-header">
      <h3>${id ? 'Edit Time Entry' : 'Log Time'}</h3>
      <button class="panel-close" onclick="closePanel('timeOverlay')">✕</button>
    </div>
    <div class="panel-body">
      <div class="form-row two-col">
        <div>
          <label>Date</label>
          <input type="date" id="timeDate" value="${date}">
        </div>
        <div>
          <label>Hours</label>
          <input type="number" id="timeHours" value="${hours}" placeholder="1.5" min="0.1" step="0.25">
          <span class="field-hint">Decimals OK (1.5 = 1h 30m)</span>
        </div>
      </div>
      <div class="form-row">
        <label>Description *</label>
        <input type="text" id="timeDesc" value="${desc}" placeholder="e.g. Reviewed contractor bids">
      </div>
      <div class="form-row">
        <label>Category</label>
        <select id="timeCategory">
          <option value="">Select…</option>
          ${timeCats.map(c => `<option value="${c}" ${category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="timeNotes" rows="2" placeholder="Optional…">${notes}</textarea>
      </div>
      <div class="panel-actions">
        <button class="btn-primary" onclick="saveTimePanel()">Save</button>
        ${id ? `<button class="btn-ghost red" onclick="deleteTimePanel('${id}')">Delete</button>` : ''}
      </div>
    </div>
  `;
  _openOverlay('timeOverlay');
}

async function saveTimePanel() {
  const hours = parseFloat(document.getElementById('timeHours')?.value || 0);
  const desc  = document.getElementById('timeDesc')?.value?.trim() || '';
  const date  = document.getElementById('timeDate')?.value || '';
  if (!hours || hours <= 0) { shake('timeHours'); return; }
  if (!desc)                { shake('timeDesc');  return; }
  const data = {
    date, hours,
    description: desc,
    category: document.getElementById('timeCategory')?.value || '',
    notes:    document.getElementById('timeNotes')?.value?.trim() || '',
    taxYear:  date ? parseInt(date.slice(0,4)) : new Date().getFullYear(),
  };
  try {
    if (currentPanelId) await dbSet('timeEntries', currentPanelId, { ...data, updatedAt: Date.now() });
    else await dbAdd('timeEntries', data);
    closePanel('timeOverlay');
    toast(currentPanelId ? 'Time entry updated' : 'Time logged');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteTimePanel(id) {
  if (!confirm('Delete this time entry?')) return;
  await dbDelete('timeEntries', id);
  closePanel('timeOverlay');
  toast('Time entry deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   MILEAGE PANEL
   ──────────────────────────────────────────────────────────────────────────── */
const IRS_RATE_2026 = 0.70;

function openMileagePanel(id) {
  const entry = id ? (State.mileageEntries || []).find(e => e.id === id) : null;
  const date     = entry?.date     || todayStr();
  const miles    = entry?.miles    || '';
  const purpose  = entry?.purpose  || '';
  const from     = entry?.fromLocation || '';
  const to       = entry?.toLocation   || '';
  const roundT   = entry?.roundTrip    || false;
  const notes    = entry?.notes        || '';
  const deduction = miles ? (parseFloat(miles) * (roundT ? 2 : 1) * IRS_RATE_2026).toFixed(2) : '0.00';

  document.getElementById('mileagePanelContent').innerHTML = `
    <div class="panel-header">
      <h3>${id ? 'Edit Mileage Entry' : 'Log Mileage'}</h3>
      <button class="panel-close" onclick="closePanel('mileageOverlay')">✕</button>
    </div>
    <div class="panel-body">
      <div class="form-row two-col">
        <div>
          <label>Date</label>
          <input type="date" id="mileageDate" value="${date}">
        </div>
        <div>
          <label>Miles</label>
          <input type="number" id="mileageMiles" value="${miles}" placeholder="0" min="0" step="0.1"
            oninput="updateMileageDeduction()">
        </div>
      </div>
      <div class="form-row">
        <label>Purpose *</label>
        <input type="text" id="mileagePurpose" value="${purpose}" placeholder="e.g. Bank meeting — SBA application">
      </div>
      <div class="form-row two-col">
        <div>
          <label>From (optional)</label>
          <input type="text" id="mileageFrom" value="${from}" placeholder="Starting location">
        </div>
        <div>
          <label>To (optional)</label>
          <input type="text" id="mileageTo" value="${to}" placeholder="Destination">
        </div>
      </div>
      <div class="form-row">
        <label class="toggle-label">
          <input type="checkbox" id="mileageRound" ${roundT?'checked':''} onchange="updateMileageDeduction()">
          <span>Round trip (doubles miles)</span>
        </label>
      </div>
      <div class="mileage-deduction-preview">
        IRS Deduction (2026 @ $${IRS_RATE_2026}/mile): <strong id="mileageDedPreview">$${deduction}</strong>
      </div>
      <div class="form-row">
        <label>Notes</label>
        <textarea id="mileageNotes" rows="2">${notes}</textarea>
      </div>
      <div class="panel-actions">
        <button class="btn-primary" onclick="saveMileagePanel()">Save</button>
        ${id ? `<button class="btn-ghost red" onclick="deleteMileagePanel('${id}')">Delete</button>` : ''}
      </div>
    </div>
  `;
  _openOverlay('mileageOverlay');
}

function updateMileageDeduction() {
  const miles  = parseFloat(document.getElementById('mileageMiles')?.value || 0);
  const round  = document.getElementById('mileageRound')?.checked;
  const actual = miles * (round ? 2 : 1);
  const ded    = (actual * IRS_RATE_2026).toFixed(2);
  const el = document.getElementById('mileageDedPreview');
  if (el) el.textContent = '$' + ded;
}

async function saveMileagePanel() {
  const miles   = parseFloat(document.getElementById('mileageMiles')?.value || 0);
  const purpose = document.getElementById('mileagePurpose')?.value?.trim() || '';
  const date    = document.getElementById('mileageDate')?.value || '';
  if (!miles || miles <= 0) { shake('mileageMiles');   return; }
  if (!purpose)             { shake('mileagePurpose'); return; }
  const roundTrip = document.getElementById('mileageRound')?.checked || false;
  const actualMiles = miles * (roundTrip ? 2 : 1);
  const data = {
    date, miles,
    purpose,
    fromLocation: document.getElementById('mileageFrom')?.value?.trim() || '',
    toLocation:   document.getElementById('mileageTo')?.value?.trim() || '',
    roundTrip,
    ratePerMile: IRS_RATE_2026,
    deduction: parseFloat((actualMiles * IRS_RATE_2026).toFixed(2)),
    notes:  document.getElementById('mileageNotes')?.value?.trim() || '',
    taxYear: date ? parseInt(date.slice(0,4)) : new Date().getFullYear(),
  };
  try {
    if (currentPanelId) await dbSet('mileageEntries', currentPanelId, { ...data, updatedAt: Date.now() });
    else await dbAdd('mileageEntries', data);
    closePanel('mileageOverlay');
    toast(currentPanelId ? 'Mileage updated' : 'Mileage logged');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

async function deleteMileagePanel(id) {
  if (!confirm('Delete this mileage entry?')) return;
  await dbDelete('mileageEntries', id);
  closePanel('mileageOverlay');
  toast('Mileage entry deleted');
}

/* ────────────────────────────────────────────────────────────────────────────
   Utility: shake animation on invalid fields
   ──────────────────────────────────────────────────────────────────────────── */
function shake(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // reflow
  el.classList.add('shake');
  el.focus();
  setTimeout(() => el.classList.remove('shake'), 500);
}

/* ────────────────────────────────────────────────────────────────────────────
   Global file input handler (wired from app.html hidden inputs)
   ──────────────────────────────────────────────────────────────────────────── */
function handleReceiptFileInput(input) {
  const file = input.files[0];
  if (file) setPendingReceipt(file);
  input.value = ''; // reset so same file can be re-picked
}

function handleCameraFileInput(input) {
  const file = input.files[0];
  if (file) setPendingReceipt(file);
  input.value = '';
}
