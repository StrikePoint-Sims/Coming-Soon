/* ═══════════════════════════════════════════════════════════════════════════
   reports.js — All 20 report card renders + Report Library view
   ═══════════════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────────────────
   Report Library — categorized grid of 20 reports
   ──────────────────────────────────────────────────────────────────────────── */
const REPORT_GROUPS = [
  {
    id: 'statements',
    label: 'Financial Statements',
    color: '#0f172a',
    colorDim: 'rgba(15,23,42,0.07)',
    badge: 'CPA Ready',
    reports: [
      { id:'pl',         icon:'📊', title:'Income Statement (P&L)',  desc:'Revenue · expenses · net profit · Schedule C' },
      { id:'balancesheet',icon:'⚖️', title:'Balance Sheet',          desc:'Assets · liabilities · owner equity' },
      { id:'cfstmt',     icon:'📑', title:'Cash Flow Statement',     desc:'Operating · investing · financing activities' },
      { id:'ownerdraws', icon:'👤', title:'Owner Equity Statement',  desc:'Contributions · draws · retained earnings' },
    ],
  },
  {
    id: 'tax',
    label: 'Tax & Compliance',
    color: '#2563eb',
    colorDim: 'rgba(37,99,235,0.10)',
    reports: [
      { id:'deduct',    icon:'✂️',  title:'Tax Deductibility',   desc:'100% / 50% / non-deductible breakdown' },
      { id:'r1099',     icon:'📋', title:'1099 Vendors',         desc:'$600+ payments · EIN status · export' },
      { id:'salestax',  icon:'🏛️', title:'CT Sales Tax',         desc:'Taxable revenue · 6.35% collected' },
      { id:'missingr',  icon:'🧾', title:'Missing Receipts',     desc:'Expenses >$75 with no documentation' },
    ],
  },
  {
    id: 'cash',
    label: 'Cash & Finance',
    color: '#16a34a',
    colorDim: 'rgba(22,163,74,0.09)',
    reports: [
      { id:'cashflow',  icon:'💸', title:'Monthly Cash Flow',    desc:'Income vs expenses by month · chart' },
      { id:'balance',   icon:'📉', title:'Running Balance',      desc:'Cumulative balance over time' },
      { id:'bycat',     icon:'📈', title:'Expense by Category',  desc:'Bar chart + sortable table' },
      { id:'reimburse', icon:'💳', title:'Reimbursements',       desc:'Personal card charges · mark reimbursed' },
      { id:'runway',    icon:'🛣️', title:'Runway & Burn Rate',   desc:'Monthly burn · cash position · projection' },
    ],
  },
  {
    id: 'ops',
    label: 'Operations & Planning',
    color: '#d97706',
    colorDim: 'rgba(217,119,6,0.09)',
    reports: [
      { id:'budget',      icon:'🎯', title:'Budget vs. Actual',    desc:'Spend vs targets · all categories' },
      { id:'loans',       icon:'🏦', title:'Loan Amortization',    desc:'Interest vs principal · remaining balance' },
      { id:'assets',      icon:'🏗️', title:'Capital Assets',       desc:'Depreciation schedule · book values' },
      { id:'compare',     icon:'↔️',  title:'Period Comparison',    desc:'Side-by-side any two date ranges' },
      { id:'projections', icon:'🔮', title:'12-Month Projections',  desc:'MRR · recurring costs · break-even · chart' },
    ],
  },
  {
    id: 'time',
    label: 'Time & Mileage',
    color: '#7c3aed',
    colorDim: 'rgba(124,58,237,0.09)',
    reports: [
      { id:'mileage',   icon:'🚗', title:'Mileage Log',          desc:'Business miles · IRS deduction · export' },
      { id:'hourscat',  icon:'⏱️', title:'Hours by Category',    desc:'Where your time goes · doughnut chart' },
      { id:'weeklyhrs', icon:'📅', title:'Weekly Hours',         desc:'Hours per week · last 8 weeks' },
      { id:'monthlyhrs',icon:'🗓️', title:'Monthly Hours',        desc:'Month-by-month time summary' },
    ],
  },
];

// Flat lookup for backward compat
const REPORT_CARDS = REPORT_GROUPS.flatMap(g => g.reports);

function renderReportLibrary() {
  // Quick-access: core financial statements + key tax reports
  const pinned = ['pl','balancesheet','cfstmt','deduct','missingr','r1099'];
  const pinnedCards = REPORT_CARDS.filter(r => pinned.includes(r.id));

  const groupsHTML = REPORT_GROUPS.map(g => `
    <div class="rlib-group ${g.id === 'statements' ? 'rlib-group--featured' : ''}">
      <div class="rlib-group-header">
        <div class="rlib-group-dot" style="background:${g.color}"></div>
        <span class="rlib-group-label" style="color:${g.id === 'statements' ? g.color : ''}">${g.label}</span>
        ${g.badge ? `<span class="rlib-group-badge" style="background:${g.colorDim};color:${g.color}">${g.badge}</span>` : ''}
        <span class="rlib-group-count">${g.reports.length} reports</span>
      </div>
      <div class="rlib-cards ${g.id === 'statements' ? 'rlib-cards--featured' : ''}">
        ${g.reports.map(r => _reportCard(r, g.color, g.colorDim, g.id === 'statements')).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="report-library">
      <div class="rlib-pinned-section">
        <div class="rlib-section-label">Quick Access</div>
        <div class="rlib-pinned">
          ${pinnedCards.map(r => `
            <button class="rlib-quick-btn" onclick="openReport('${r.id}')">
              <span class="rlib-quick-icon">${r.icon}</span>
              <span>${r.title}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="rlib-divider"></div>
      ${groupsHTML}
    </div>`;
}

function _reportCard(r, color, colorDim, featured = false) {
  return `
    <div class="rlib-card ${featured ? 'rlib-card--featured' : ''}" onclick="openReport('${r.id}')"
         style="${featured ? `border-color:${color}22` : ''}">
      <div class="rlib-card-icon" style="background:${colorDim};color:${color}">${r.icon}</div>
      <div class="rlib-card-body">
        <div class="rlib-card-title" style="${featured ? `color:${color}` : ''}">${r.title}</div>
        <div class="rlib-card-desc">${r.desc}</div>
      </div>
      <div class="rlib-card-arrow" style="color:${color}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Report wrapper — clean header with breadcrumb, actions bar
   ──────────────────────────────────────────────────────────────────────────── */
function reportShell(title, controlsHTML, bodyHTML, { exportFn = '', printable = true } = {}) {
  // Find which group this report belongs to for the accent color
  const groupForReport = REPORT_GROUPS.find(g => g.reports.some(r => r.title === title));
  const accentColor = groupForReport?.color || 'var(--accent)';

  return `
    <div class="report-shell">
      <div class="report-shell-topbar">
        <div class="rshell-nav">
          <button class="rshell-back-btn" onclick="navigate('dashboard')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </button>
          <span class="rshell-nav-sep">›</span>
          <button class="rshell-back-btn" onclick="navigate('reports')">
            All Reports
          </button>
        </div>
        <div class="rshell-title-wrap">
          <div class="rshell-accent-bar" style="background:${accentColor}"></div>
          <h2 class="rshell-title">${title}</h2>
        </div>
        <div class="rshell-actions">
          ${exportFn ? `<button class="btn-secondary sm" onclick="${exportFn}()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>` : ''}
          ${printable ? `<button class="btn-secondary sm" onclick="window.print()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>` : ''}
        </div>
      </div>
      ${controlsHTML ? `<div class="report-controls">${controlsHTML}</div>` : ''}
      <div class="report-body">${bodyHTML}</div>
    </div>`;
}

function taxYearSelector(selected) {
  const year = new Date().getFullYear();
  const opts = [year, year - 1, year - 2].map(y =>
    `<option value="${y}" ${selected == y ? 'selected' : ''}>${y}</option>`
  ).join('');
  return `<select id="rptTaxYear" onchange="rerenderCurrentReport()">${opts}</select>`;
}

/* Current open report (for rerenderCurrentReport) */
let _currentReport = null;
function openReport(id) {
  // Navigate to reports view first if not already there
  if (typeof navigate === 'function' && State.currentView !== 'reports') {
    State.currentView = 'reports';
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.view === 'reports')
    );
    document.querySelectorAll('.tab-item').forEach(el =>
      el.classList.toggle('active', el.dataset.view === 'reports')
    );
  }
  _currentReport = id;
  const mainEl = document.getElementById('mainContent');
  if (!mainEl) return;
  mainEl.innerHTML = renderReport(id);
  // Run any post-render chart hooks
  _postRenderCharts(id);
}

function rerenderCurrentReport() {
  if (_currentReport) openReport(_currentReport);
}

function renderReport(id) {
  switch (id) {
    case 'pl':          return renderPLReport();
    case 'balancesheet':return renderBalanceSheetReport();
    case 'deduct':     return renderDeductReport();
    case 'bycat':      return renderByCatReport();
    case 'cashflow':   return renderCashFlowReport();
    case 'balance':    return renderBalanceReport();
    case 'reimburse':  return renderReimburseReport();
    case 'r1099':      return render1099Report();
    case 'loans':      return renderLoansReport();
    case 'assets':     return renderAssetsReport();
    case 'cfstmt':     return renderCFStmtReport();
    case 'ownerdraws': return renderOwnerDrawsReport();
    case 'missingr':   return renderMissingReceiptsReport();
    case 'hourscat':   return renderHoursCatReport();
    case 'weeklyhrs':  return renderWeeklyHrsReport();
    case 'monthlyhrs': return renderMonthlyHrsReport();
    case 'budget':     return renderBudgetReport();
    case 'runway':     return renderRunwayReport();
    case 'salestax':   return renderSalesTaxReport();
    case 'compare':    return renderCompareReport();
    case 'mileage':      return renderMileageReport();
    case 'projections':  return renderProjectionsReport();
    default: return '<p>Report not found.</p>';
  }
}

function _postRenderCharts(id) {
  requestAnimationFrame(() => {
    switch (id) {
      case 'bycat':    { const b = computeByCategory(filteredTransactions().filter(t=>t.type==='expense')); renderExpenseByCategoryChart('rptByCatChart', b); break; }
      case 'cashflow': renderCashFlowChart('rptCashFlowChart', 12); break;
      case 'balance':  renderRunningBalanceChart('rptBalanceChart'); break;
      case 'hourscat': renderHoursByCategoryChart('rptHoursCatChart'); break;
      case 'weeklyhrs': renderWeeklyHoursChart('rptWeeklyHrsChart'); break;
      case 'budget':   renderBudgetChart('rptBudgetChart'); break;
      case 'runway':       renderRunwayChart('rptRunwayChart'); break;
      case 'projections':  renderProjectionsReportWithCharts(document.getElementById('reportContent')); break;
      case 'compare':  {
        const pA = _comparePeriodA();
        const pB = _comparePeriodB();
        renderPeriodComparisonChart('rptCompareChart', pA, pB);
        break;
      }
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   1. Profit & Loss
   ──────────────────────────────────────────────────────────────────────────── */
function renderPLReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.status !== 'draft');
  const incTxns = txns.filter(t => t.type === 'income');
  const expTxns = txns.filter(t => t.type === 'expense');
  const incByCat = computeByCategory(incTxns);
  const expByCat = computeByCategory(expTxns);
  const totalInc = incByCat.reduce((s,c) => s + c.total, 0);
  const totalExp = expByCat.reduce((s,c) => s + c.deductible, 0);
  const netPL    = totalInc - expByCat.reduce((s,c) => s + c.total, 0);

  const incRows = incByCat.map(c =>
    `<tr><td>${c.category}</td><td class="num">${fmt$(c.total)}</td><td></td></tr>`
  ).join('');
  const expRows = expByCat.map(c => {
    const meta = categoryMeta(c.category);
    const line = meta?.irsLine ? `Line ${meta.irsLine}` : '';
    return `<tr><td>${c.category} <span class="irs-line">${line}</span></td>
      <td class="num">${fmt$(c.total)}</td>
      <td class="num">${fmt$(c.deductible)}</td></tr>`;
  }).join('');

  const body = `
    <table class="report-table pl-table">
      <thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Deductible</th></tr></thead>
      <tbody>
        <tr class="section-header"><td colspan="3">INCOME</td></tr>
        ${incRows}
        <tr class="subtotal"><td>Total Income</td><td class="num green">${fmt$(totalInc)}</td><td></td></tr>
        <tr class="section-header"><td colspan="3">EXPENSES</td></tr>
        ${expRows}
        <tr class="subtotal"><td>Total Expenses</td><td class="num red">${fmt$(expByCat.reduce((s,c)=>s+c.total,0))}</td>
          <td class="num">${fmt$(totalExp)}</td></tr>
        <tr class="grand-total"><td>Net Profit / Loss</td>
          <td class="num ${netPL >= 0 ? 'green':'red'}" colspan="2">${fmt$(netPL)}</td></tr>
      </tbody>
    </table>
    <p class="report-note">Deductible column reflects 100% of full-deductible and 50% of meals/entertainment. Non-deductible items (Owner Draw, Owner Capital) excluded from deductible total.</p>`;

  return reportShell(`Income Statement (P&L) — ${taxYear}`, taxYearSelector(taxYear), body, { exportFn: 'exportPLCSV' });
}

function exportPLCSV() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.status !== 'draft');
  const inc = computeByCategory(txns.filter(t=>t.type==='income'));
  const exp = computeByCategory(txns.filter(t=>t.type==='expense'));
  const rows = [
    ['Type','Category','Total','Deductible'],
    ...inc.map(c => ['Income', c.category, c.total.toFixed(2), '']),
    ...exp.map(c => ['Expense', c.category, c.total.toFixed(2), c.deductible.toFixed(2)]),
  ];
  exportCSV(['Type','Category','Total','Deductible'], rows, `pl_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   BALANCE SHEET
   ──────────────────────────────────────────────────────────────────────────── */
function renderBalanceSheetReport() {
  const taxYear = _selectedTaxYear();
  const allTxns = (State.txns || []).filter(t => t.status !== 'draft');
  // For balance sheet we use cumulative data through end of tax year
  const ytdTxns = allTxns.filter(t => {
    const y = parseInt((t.date||'').slice(0,4));
    return y <= taxYear;
  });

  const bs = computeBalanceSheet(taxYear, ytdTxns, State.assets || [], State.loans || []);

  const assetRows = bs.assets.map(a =>
    `<tr class="${a.isSubtotal?'subtotal':''}${a.isTotal?' grand-total':''}">
       <td style="padding-left:${a.indent?'28px':'12px'}">${a.label}</td>
       <td class="num ${a.isTotal?'':'text-muted'}">${a.isTotal||a.isSubtotal ? fmt$(a.value) : ''}</td>
       <td class="num">${!a.isTotal && !a.isSubtotal ? fmt$(a.value) : (a.isTotal ? '' : '')}</td>
     </tr>`
  ).join('');

  const liabRows = bs.liabilities.map(l =>
    `<tr class="${l.isSubtotal?'subtotal':''}${l.isTotal?' grand-total':''}">
       <td style="padding-left:${l.indent?'28px':'12px'}">${l.label}</td>
       <td class="num ${l.isTotal||l.isSubtotal?'':'text-muted'}">${l.isTotal||l.isSubtotal ? fmt$(l.value) : ''}</td>
       <td class="num">${!l.isTotal && !l.isSubtotal ? fmt$(l.value) : ''}</td>
     </tr>`
  ).join('');

  const equityRows = bs.equity.map(e =>
    `<tr class="${e.isSubtotal?'subtotal':''}${e.isTotal?' grand-total':''}">
       <td style="padding-left:${e.indent?'28px':'12px'}">${e.label}</td>
       <td class="num ${e.isTotal||e.isSubtotal?'':'text-muted'}">${e.isTotal||e.isSubtotal ? fmt$(e.value) : ''}</td>
       <td class="num">${!e.isTotal && !e.isSubtotal ? fmt$(e.value) : ''}</td>
     </tr>`
  ).join('');

  // Balanced check
  const diff = Math.abs(bs.totalAssets - bs.totalLiabEquity);
  const balanced = diff < 1;

  const body = `
    <div class="bs-equation">
      <div class="bs-eq-item">
        <div class="bs-eq-val">${fmt$(bs.totalAssets)}</div>
        <div class="bs-eq-label">Total Assets</div>
      </div>
      <div class="bs-eq-sign">=</div>
      <div class="bs-eq-item">
        <div class="bs-eq-val">${fmt$(bs.totalLiabilities)}</div>
        <div class="bs-eq-label">Total Liabilities</div>
      </div>
      <div class="bs-eq-sign">+</div>
      <div class="bs-eq-item ${bs.totalEquity < 0 ? 'neg' : ''}">
        <div class="bs-eq-val">${fmt$(bs.totalEquity)}</div>
        <div class="bs-eq-label">Owner's Equity</div>
      </div>
    </div>
    ${!balanced ? `<div class="alert-banner amber">⚠ Balance sheet is out of balance by ${fmt$(diff)}. This is expected if not all transactions are categorized — the estimated cash position may differ from your actual bank balance.</div>` : ''}

    <div class="bs-two-col">

      <!-- ASSETS -->
      <div class="bs-section">
        <div class="bs-section-header blue">Assets</div>
        <table class="report-table bs-table">
          <colgroup><col style="width:60%"><col style="width:20%"><col style="width:20%"></colgroup>
          <tbody>
            <tr class="bs-cat-header"><td colspan="3">CURRENT ASSETS</td></tr>
            ${bs.currentAssets.map(a => `
              <tr>
                <td style="padding-left:24px">${a.label}</td>
                <td></td>
                <td class="num">${fmt$(a.value)}</td>
              </tr>`).join('')}
            <tr class="subtotal">
              <td>Total Current Assets</td>
              <td class="num">${fmt$(bs.totalCurrentAssets)}</td>
              <td></td>
            </tr>
            <tr class="bs-cat-header"><td colspan="3">NON-CURRENT ASSETS</td></tr>
            ${bs.nonCurrentAssets.map(a => `
              <tr>
                <td style="padding-left:24px">${a.label}</td>
                <td></td>
                <td class="num">${fmt$(a.value)}</td>
              </tr>`).join('')}
            <tr class="subtotal">
              <td>Total Non-Current Assets</td>
              <td class="num">${fmt$(bs.totalNonCurrentAssets)}</td>
              <td></td>
            </tr>
            <tr class="grand-total">
              <td>TOTAL ASSETS</td>
              <td class="num green" colspan="2">${fmt$(bs.totalAssets)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- LIABILITIES + EQUITY -->
      <div class="bs-section">
        <div class="bs-section-header red">Liabilities</div>
        <table class="report-table bs-table">
          <colgroup><col style="width:60%"><col style="width:20%"><col style="width:20%"></colgroup>
          <tbody>
            <tr class="bs-cat-header"><td colspan="3">CURRENT LIABILITIES</td></tr>
            ${bs.currentLiabilities.length ? bs.currentLiabilities.map(l => `
              <tr><td style="padding-left:24px">${l.label}</td><td></td><td class="num">${fmt$(l.value)}</td></tr>`).join('')
            : `<tr><td style="padding-left:24px;color:var(--text-3);font-style:italic">None</td><td></td><td></td></tr>`}
            <tr class="subtotal">
              <td>Total Current Liabilities</td>
              <td class="num">${fmt$(bs.totalCurrentLiabilities)}</td>
              <td></td>
            </tr>
            <tr class="bs-cat-header"><td colspan="3">LONG-TERM LIABILITIES</td></tr>
            ${bs.longTermLiabilities.map(l => `
              <tr><td style="padding-left:24px">${l.label}</td><td></td><td class="num">${fmt$(l.value)}</td></tr>`).join('')
            || `<tr><td style="padding-left:24px;color:var(--text-3);font-style:italic">None</td><td></td><td></td></tr>`}
            <tr class="subtotal">
              <td>Total Long-Term Liabilities</td>
              <td class="num">${fmt$(bs.totalLongTermLiabilities)}</td>
              <td></td>
            </tr>
            <tr class="grand-total">
              <td>TOTAL LIABILITIES</td>
              <td class="num red" colspan="2">${fmt$(bs.totalLiabilities)}</td>
            </tr>
          </tbody>
        </table>

        <div class="bs-section-header equity" style="margin-top:16px">Owner's Equity</div>
        <table class="report-table bs-table">
          <colgroup><col style="width:60%"><col style="width:20%"><col style="width:20%"></colgroup>
          <tbody>
            ${bs.equityItems.map(e => `
              <tr class="${e.isTotal?'grand-total':e.isSubtotal?'subtotal':''}">
                <td style="padding-left:${e.indent?'24px':'12px'}">${e.label}</td>
                ${e.isTotal
                  ? `<td class="num ${e.value>=0?'green':'red'}" colspan="2">${fmt$(e.value)}</td>`
                  : `<td></td><td class="num ${e.value<0?'red':''}">${fmt$(e.value)}</td>`}
              </tr>`).join('')}
          </tbody>
        </table>

        <table class="report-table bs-table" style="margin-top:8px">
          <tbody>
            <tr class="grand-total" style="font-size:15px">
              <td>TOTAL LIABILITIES + EQUITY</td>
              <td class="num ${balanced?'green':'amber'}" colspan="2">${fmt$(bs.totalLiabEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="report-note">Cash position is estimated from logged transactions — verify against your actual bank statement. Accounts receivable and accounts payable are not tracked; add those figures manually when sharing with your CPA. This report is generated as of December 31, ${taxYear}.</p>`;

  return reportShell(`Balance Sheet — ${taxYear}`, taxYearSelector(taxYear), body, { exportFn: 'exportBalanceSheetCSV' });
}

function exportBalanceSheetCSV() {
  const taxYear = _selectedTaxYear();
  const allTxns = (State.txns||[]).filter(t => t.status !== 'draft' && parseInt((t.date||'').slice(0,4)) <= taxYear);
  const bs = computeBalanceSheet(taxYear, allTxns, State.assets||[], State.loans||[]);
  const rows = [
    ['ASSETS','',''],
    ['Current Assets','',''],
    ...bs.currentAssets.map(a => ['', a.label, a.value.toFixed(2)]),
    ['', 'Total Current Assets', bs.totalCurrentAssets.toFixed(2)],
    ['Non-Current Assets','',''],
    ...bs.nonCurrentAssets.map(a => ['', a.label, a.value.toFixed(2)]),
    ['', 'Total Non-Current Assets', bs.totalNonCurrentAssets.toFixed(2)],
    ['TOTAL ASSETS', '', bs.totalAssets.toFixed(2)],
    ['','',''],
    ['LIABILITIES','',''],
    ...bs.currentLiabilities.map(l => ['', l.label, l.value.toFixed(2)]),
    ['', 'Total Current Liabilities', bs.totalCurrentLiabilities.toFixed(2)],
    ...bs.longTermLiabilities.map(l => ['', l.label, l.value.toFixed(2)]),
    ['', 'Total Long-Term Liabilities', bs.totalLongTermLiabilities.toFixed(2)],
    ['TOTAL LIABILITIES', '', bs.totalLiabilities.toFixed(2)],
    ['','',''],
    ["OWNER'S EQUITY",'',''],
    ...bs.equityItems.filter(e=>!e.isTotal).map(e => ['', e.label, e.value.toFixed(2)]),
    ["TOTAL EQUITY", '', bs.totalEquity.toFixed(2)],
    ['','',''],
    ['TOTAL LIABILITIES + EQUITY', '', bs.totalLiabEquity.toFixed(2)],
  ];
  exportCSV(['Section','Line Item','Amount'], rows, `balance_sheet_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Tax Deductibility
   ──────────────────────────────────────────────────────────────────────────── */
function renderDeductReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.type === 'expense' && t.status !== 'draft');
  const ded     = computeDeductibility(txns);

  const mkRows = (items) => items.map(t =>
    `<tr><td>${fmtDate(t.date)}</td><td>${t.description || '—'}</td><td>${t.category}</td>
     <td class="num">${fmt$(t.amount)}</td><td class="num">${fmt$(t.deductibleAmount)}</td></tr>`
  ).join('') || '<tr><td colspan="5" class="empty">None</td></tr>';

  const body = `
    <div class="ded-summary-strip">
      <div class="ded-chip green">Fully Deductible: ${fmt$(ded.fullTotal)}</div>
      <div class="ded-chip amber">50% Deductible: ${fmt$(ded.fiftyTotal)} (net: ${fmt$(ded.fiftyTotal*0.5)})</div>
      <div class="ded-chip red">Non-Deductible: ${fmt$(ded.noneTotal)}</div>
    </div>
    <h4 class="report-section-title">Fully Deductible (100%)</h4>
    <table class="report-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="num">Deductible</th></tr></thead>
    <tbody>${mkRows(ded.full)}</tbody></table>
    <h4 class="report-section-title">50% Deductible (Meals)</h4>
    <table class="report-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="num">Deductible</th></tr></thead>
    <tbody>${mkRows(ded.fifty)}</tbody></table>
    <h4 class="report-section-title">Non-Deductible</h4>
    <table class="report-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th class="num">Deductible</th></tr></thead>
    <tbody>${mkRows(ded.none)}</tbody></table>`;

  return reportShell('Tax Deductibility', taxYearSelector(taxYear), body, { exportFn: 'exportDeductCSV' });
}

function exportDeductCSV() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.type === 'expense' && t.status !== 'draft');
  const ded     = computeDeductibility(txns);
  const all     = [...ded.full, ...ded.fifty, ...ded.none];
  const rows    = all.map(t => [t.date, t.description, t.category, t.amount.toFixed(2), t.deductibleAmount.toFixed(2), t.ded]);
  exportCSV(['Date','Description','Category','Amount','Deductible','Type'], rows, `deductibility_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   3. Expense by Category
   ──────────────────────────────────────────────────────────────────────────── */
function renderByCatReport() {
  const txns   = filteredTransactions().filter(t => t.type === 'expense');
  const byCat  = computeByCategory(txns);
  const total  = byCat.reduce((s,c) => s+c.total, 0);

  const rows = byCat.map(c => {
    const pct = total > 0 ? ((c.total / total)*100).toFixed(1) : '0.0';
    return `<tr><td>${c.category}</td><td class="num">${fmt$(c.total)}</td>
      <td class="num">${pct}%</td><td><div class="bar-cell"><div class="bar-fill" style="width:${pct}%"></div></div></td></tr>`;
  }).join('') || '<tr><td colspan="4" class="empty">No expense data.</td></tr>';

  const body = `
    <div class="chart-wrap" style="height:300px"><canvas id="rptByCatChart"></canvas></div>
    <table class="report-table">
      <thead><tr><th>Category</th><th class="num">Total</th><th class="num">%</th><th>Proportion</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td><strong>Total</strong></td><td class="num"><strong>${fmt$(total)}</strong></td><td colspan="2"></td></tr></tfoot>
    </table>`;

  return reportShell('Expense by Category', '', body, { exportFn: 'exportByCatCSV' });
}

function exportByCatCSV() {
  const txns  = filteredTransactions().filter(t => t.type === 'expense');
  const byCat = computeByCategory(txns);
  const total = byCat.reduce((s,c) => s+c.total, 0);
  const rows  = byCat.map(c => [c.category, c.total.toFixed(2), total > 0 ? ((c.total/total)*100).toFixed(1) : '0.0']);
  exportCSV(['Category','Total','Pct'], rows, 'expense_by_category.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   4. Monthly Cash Flow
   ──────────────────────────────────────────────────────────────────────────── */
function renderCashFlowReport() {
  const months  = computeMonthlyPL(State.txns || [], 12);

  const rows = months.map(m =>
    `<tr><td>${fmtMonth(m.month)}</td>
     <td class="num green">${fmt$(m.income)}</td>
     <td class="num red">${fmt$(m.expenses)}</td>
     <td class="num ${m.net >= 0 ? 'green':'red'}">${fmt$(m.net)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty">No data.</td></tr>';

  const body = `
    <div class="chart-wrap" style="height:280px"><canvas id="rptCashFlowChart"></canvas></div>
    <table class="report-table">
      <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Net</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('Monthly Cash Flow', '', body, { exportFn: 'exportCashFlowCSV' });
}

function exportCashFlowCSV() {
  const months = computeMonthlyPL(State.txns || [], 24);
  const rows   = months.map(m => [m.month, m.income.toFixed(2), m.expenses.toFixed(2), m.net.toFixed(2)]);
  exportCSV(['Month','Income','Expenses','Net'], rows, 'monthly_cashflow.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   5. Running Balance
   ──────────────────────────────────────────────────────────────────────────── */
function renderBalanceReport() {
  const txns = filteredTransactions();
  const rows = computeRunningBalance(txns);

  const tableRows = rows.slice(-30).reverse().map(r =>
    `<tr><td>${fmtDate(r.date)}</td><td>${r.description || '—'}</td>
     <td class="num ${r.type==='income'?'green':'red'}">${r.type==='income'?'+':'-'}${fmt$(r.amount)}</td>
     <td class="num ${r.balance>=0?'':'red'}">${fmt$(r.balance)}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty">No transactions.</td></tr>';

  const body = `
    <div class="chart-wrap" style="height:260px"><canvas id="rptBalanceChart"></canvas></div>
    <p class="report-note">Showing last 30 transactions. Export CSV for full history.</p>
    <table class="report-table">
      <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;

  return reportShell('Running Balance', '', body, { exportFn: 'exportBalanceCSV' });
}

function exportBalanceCSV() {
  const rows = computeRunningBalance(filteredTransactions());
  exportCSV(['Date','Description','Type','Amount','Balance'],
    rows.map(r => [r.date, r.description, r.type, r.amount.toFixed(2), r.balance.toFixed(2)]),
    'running_balance.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   6. Reimbursements
   ──────────────────────────────────────────────────────────────────────────── */
function renderReimburseReport() {
  const r = computeReimbursements(State.txns || []);
  const pending = r.pendingItems || [];
  const reimbursed = r.reimbursedItems || [];
  const pendingTotal = r.totalPending || 0;

  const mkRow = (t, showAction) =>
    `<tr>
       <td>${fmtDate(t.date)}</td>
       <td>${t.description || '—'}</td>
       <td>${t.category}</td>
       <td class="num">${fmt$(t.amount)}</td>
       ${showAction ? `<td><button class="btn-link" onclick="markReimbursed('${t.id}')">Mark Reimbursed</button></td>` : '<td>✓</td>'}
     </tr>`;

  const body = `
    <div class="reimburse-summary">
      <div class="kpi-chip amber">Pending: ${fmt$(pendingTotal)}</div>
      <div class="kpi-chip green">Reimbursed: ${fmt$(r.totalReimbursed || 0)}</div>
    </div>
    <h4 class="report-section-title">Pending Reimbursement</h4>
    <table class="report-table">
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th>Action</th></tr></thead>
      <tbody>${pending.map(t => mkRow(t, true)).join('') || '<tr><td colspan="5" class="empty">No pending reimbursements.</td></tr>'}</tbody>
    </table>
    <h4 class="report-section-title">Reimbursed</h4>
    <table class="report-table">
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th>Status</th></tr></thead>
      <tbody>${reimbursed.map(t => mkRow(t, false)).join('') || '<tr><td colspan="5" class="empty">None reimbursed yet.</td></tr>'}</tbody>
    </table>`;

  return reportShell('Reimbursements', '', body, { exportFn: 'exportReimburseCSV' });
}

async function markReimbursed(id) {
  await dbSet('transactions', id, { reimbursementStatus: 'reimbursed', reimbursedAt: Date.now() });
  toast('Marked as reimbursed');
  openReport('reimburse');
}

function exportReimburseCSV() {
  const r = computeReimbursements(State.txns || []);
  const pending = r.pendingItems || [];
  const reimbursed = r.reimbursedItems || [];
  const all = [
    ...pending.map(t => [t.date, t.description, t.category, t.amount.toFixed(2), 'Pending']),
    ...reimbursed.map(t => [t.date, t.description, t.category, t.amount.toFixed(2), 'Reimbursed']),
  ];
  exportCSV(['Date','Description','Category','Amount','Status'], all, 'reimbursements.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   7. 1099 Vendors
   ──────────────────────────────────────────────────────────────────────────── */
function render1099Report() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear);
  const vendors = compute1099Vendors(State.vendors || [], txns);

  const rows = vendors.map(v => {
    const alert = v.ytd >= 600 && !v.ein ? '<span class="badge red">Missing EIN</span>' : '';
    const badge = v.ytd >= 600 ? '<span class="badge amber">1099 Required</span>' : '';
    return `<tr>
      <td>${v.name}</td>
      <td>${v.ein || '<span class="text-muted">—</span>'}</td>
      <td class="num">${fmt$(v.ytd)}</td>
      <td>${badge} ${alert}</td>
      <td><button class="btn-link" onclick="openPanel('vendor','${v.id}')">Edit</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No 1099-eligible vendors.</td></tr>';

  const body = `
    <p class="report-note">Vendors marked 1099 Eligible with $600+ in payments require a 1099-NEC by January 31.</p>
    <table class="report-table">
      <thead><tr><th>Vendor</th><th>EIN / SSN</th><th class="num">YTD Paid</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('1099 Vendors', taxYearSelector(taxYear), body, { exportFn: 'export1099CSV' });
}

function export1099CSV() {
  const taxYear = _selectedTaxYear();
  const vendors = compute1099Vendors(State.vendors || [], (State.txns||[]).filter(t=>t.taxYear==taxYear));
  const rows    = vendors.map(v => [v.name, v.ein || '', v.ytd.toFixed(2), v.ytd >= 600 ? '1099 Required' : 'Under $600']);
  exportCSV(['Vendor','EIN','YTD Paid','Status'], rows, `1099_vendors_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   8. Loan Amortization
   ──────────────────────────────────────────────────────────────────────────── */
function renderLoansReport() {
  const loans = State.loans || [];
  if (!loans.length) return reportShell('Loan Amortization', '', '<p class="empty-note">No loans configured. Add loans in Settings → Loans.</p>');

  const sections = loans.map(loan => {
    const bal    = computeLoanAmortization(loan, State.txns || []);
    const rows   = bal.schedule.slice(0, 24).map(r =>
      `<tr><td>${fmtMonth(r.month)}</td>
       <td class="num">${fmt$(r.payment)}</td>
       <td class="num">${fmt$(r.interest)}</td>
       <td class="num">${fmt$(r.principal)}</td>
       <td class="num">${fmt$(r.balance)}</td></tr>`
    ).join('');

    return `
      <div class="loan-section">
        <h4>${loan.name}</h4>
        <div class="loan-meta-row">
          <span>Original: ${fmt$(loan.originalAmount)}</span>
          <span>Rate: ${loan.interestRate > 0 ? (loan.interestRate*100).toFixed(2)+'%' : '0% APR'}</span>
          <span>Term: ${loan.termMonths} months</span>
          <span>Monthly: ${fmt$(loan.monthlyPayment)}</span>
          <span class="badge ${bal.remainingBalance < loan.originalAmount*0.1 ? 'green':'blue'}">
            Balance: ${fmt$(bal.remainingBalance)}
          </span>
        </div>
        <div class="paid-summary">Interest paid to date: ${fmt$(bal.totalInterestPaid)} · Principal paid: ${fmt$(bal.totalPrincipalPaid)}</div>
        <table class="report-table">
          <thead><tr><th>Month</th><th class="num">Payment</th><th class="num">Interest</th><th class="num">Principal</th><th class="num">Balance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${bal.schedule.length > 24 ? `<p class="report-note">Showing first 24 months. Export CSV for full schedule.</p>` : ''}
      </div>`;
  }).join('');

  return reportShell('Loan Amortization', '', sections, { exportFn: 'exportLoansCSV' });
}

function exportLoansCSV() {
  const rows = [];
  (State.loans || []).forEach(loan => {
    const bal = computeLoanAmortization(loan, State.txns || []);
    bal.schedule.forEach(r => {
      rows.push([loan.name, r.month, r.payment.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.balance.toFixed(2)]);
    });
  });
  exportCSV(['Loan','Month','Payment','Interest','Principal','Balance'], rows, 'loan_amortization.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   9. Capital Assets
   ──────────────────────────────────────────────────────────────────────────── */
function renderAssetsReport() {
  const assets = State.assets || [];
  if (!assets.length) return reportShell('Capital Assets', '', '<p class="empty-note">No assets configured. Add assets in Settings → Assets.</p>');

  const rows = assets.map(a => {
    const bv  = computeAssetBookValue(a);
    const dep = a.cost - bv.bookValue;
    return `<tr>
      <td>${a.name}</td>
      <td>${fmtDate(a.purchaseDate)}</td>
      <td class="num">${fmt$(a.cost)}</td>
      <td>${a.depreciationMethod || 'Straight-line'}</td>
      <td class="num">${fmt$(dep)}</td>
      <td class="num">${fmt$(bv.bookValue)}</td>
      <td><button class="btn-link" onclick="openSettingsTab('assets')">Edit</button></td>
    </tr>`;
  }).join('');

  const totalCost = assets.reduce((s,a) => s + a.cost, 0);
  const totalBV   = assets.reduce((s,a) => s + computeAssetBookValue(a).bookValue, 0);

  const body = `
    <table class="report-table">
      <thead><tr><th>Asset</th><th>Purchase Date</th><th class="num">Cost</th><th>Method</th><th class="num">Depreciation</th><th class="num">Book Value</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td><strong>Total</strong></td><td></td>
        <td class="num"><strong>${fmt$(totalCost)}</strong></td>
        <td></td><td class="num"><strong>${fmt$(totalCost - totalBV)}</strong></td>
        <td class="num"><strong>${fmt$(totalBV)}</strong></td><td></td></tr></tfoot>
    </table>`;

  return reportShell('Capital Assets', '', body, { exportFn: 'exportAssetsCSV' });
}

function exportAssetsCSV() {
  const rows = (State.assets || []).map(a => {
    const bv = computeAssetBookValue(a);
    return [a.name, a.purchaseDate, a.cost.toFixed(2), a.depreciationMethod || 'Straight-line',
      (a.cost - bv.bookValue).toFixed(2), bv.bookValue.toFixed(2)];
  });
  exportCSV(['Asset','Purchase Date','Cost','Method','Depreciation','Book Value'], rows, 'capital_assets.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   10. Cash Flow Statement
   ──────────────────────────────────────────────────────────────────────────── */
function renderCFStmtReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.status !== 'draft');
  const cf      = computeCashFlowStatement(txns);

  const mkRows = (items) => items.map(i =>
    `<tr><td>${i.description || i.category}</td><td class="num ${i.amount >= 0 ? 'green':'red'}">${fmt$(i.amount)}</td></tr>`
  ).join('') || '<tr><td colspan="2" class="empty">None</td></tr>';

  const body = `
    <h4 class="report-section-title">Operating Activities</h4>
    <table class="report-table"><tbody>
      ${mkRows(cf.operating)}
      <tr class="subtotal"><td>Net Operating</td><td class="num ${cf.opTotal>=0?'green':'red'}">${fmt$(cf.opTotal)}</td></tr>
    </tbody></table>
    <h4 class="report-section-title">Investing Activities</h4>
    <table class="report-table"><tbody>
      ${mkRows(cf.investing)}
      <tr class="subtotal"><td>Net Investing</td><td class="num">${fmt$(cf.invTotal)}</td></tr>
    </tbody></table>
    <h4 class="report-section-title">Financing Activities</h4>
    <table class="report-table"><tbody>
      ${mkRows(cf.financing)}
      <tr class="subtotal"><td>Net Financing</td><td class="num">${fmt$(cf.finTotal)}</td></tr>
    </tbody></table>
    <table class="report-table"><tbody>
      <tr class="grand-total"><td>Net Change in Cash</td>
        <td class="num ${cf.netChange>=0?'green':'red'}">${fmt$(cf.netChange)}</td></tr>
    </tbody></table>`;

  return reportShell('Cash Flow Statement', taxYearSelector(taxYear), body, { exportFn: 'exportCFStmtCSV' });
}

function exportCFStmtCSV() {
  const taxYear = _selectedTaxYear();
  const cf      = computeCashFlowStatement((State.txns||[]).filter(t=>t.taxYear==taxYear));
  const all = [
    ...cf.operating.map(i => ['Operating', i.description || i.category, i.amount.toFixed(2)]),
    ...cf.investing.map(i => ['Investing', i.description || i.category, i.amount.toFixed(2)]),
    ...cf.financing.map(i => ['Financing', i.description || i.category, i.amount.toFixed(2)]),
  ];
  exportCSV(['Section','Description','Amount'], all, `cashflow_statement_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   11. Owner Draws & Capital
   ──────────────────────────────────────────────────────────────────────────── */
function renderOwnerDrawsReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.status !== 'draft');
  const draws   = txns.filter(t => t.category === 'Owner Draw');
  const capital = txns.filter(t => t.category === 'Owner Capital Contribution');

  const mkRows = (items) => items.map(t =>
    `<tr><td>${fmtDate(t.date)}</td><td>${t.description || '—'}</td><td class="num">${fmt$(t.amount)}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty">None</td></tr>';

  const totalDraws   = draws.reduce((s,t) => s+t.amount, 0);
  const totalCapital = capital.reduce((s,t) => s+t.amount, 0);

  const body = `
    <div class="reimburse-summary">
      <div class="kpi-chip red">Total Draws: ${fmt$(totalDraws)}</div>
      <div class="kpi-chip green">Total Capital In: ${fmt$(totalCapital)}</div>
      <div class="kpi-chip blue">Net: ${fmt$(totalCapital - totalDraws)}</div>
    </div>
    <h4 class="report-section-title">Owner Draws</h4>
    <table class="report-table"><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>${mkRows(draws)}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num"><strong>${fmt$(totalDraws)}</strong></td></tr></tfoot>
    </table>
    <h4 class="report-section-title">Owner Capital Contributions</h4>
    <table class="report-table"><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>${mkRows(capital)}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num"><strong>${fmt$(totalCapital)}</strong></td></tr></tfoot>
    </table>`;

  return reportShell('Owner Equity Statement', taxYearSelector(taxYear), body, { exportFn: 'exportOwnerDrawsCSV' });
}

function exportOwnerDrawsCSV() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns||[]).filter(t=>t.taxYear==taxYear);
  const all     = txns.filter(t=>['Owner Draw','Owner Capital Contribution'].includes(t.category));
  exportCSV(['Date','Description','Category','Amount'],
    all.map(t=>[t.date,t.description,t.category,t.amount.toFixed(2)]),
    `owner_draws_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   12. Missing Receipts
   ──────────────────────────────────────────────────────────────────────────── */
function renderMissingReceiptsReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.type === 'expense' && t.status !== 'draft');
  const missing = computeMissingReceipts(txns, 75);

  const rows = missing.map(t =>
    `<tr>
       <td>${fmtDate(t.date)}</td>
       <td>${t.description || '—'}</td>
       <td>${t.category}</td>
       <td class="num">${fmt$(t.amount)}</td>
       <td><button class="btn-link" onclick="openPanel('txn','${t.id}')">Add Receipt</button></td>
     </tr>`
  ).join('') || '<tr><td colspan="5" class="empty green">✓ All expenses over $75 have receipts!</td></tr>';

  const body = `
    <p class="report-note">IRS requires documentation for expenses $75 and above. ${missing.length} ${missing.length === 1 ? 'expense is' : 'expenses are'} missing receipts.</p>
    <table class="report-table">
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('Missing Receipts', taxYearSelector(taxYear), body, { exportFn: 'exportMissingReceiptsCSV' });
}

function exportMissingReceiptsCSV() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns||[]).filter(t=>t.taxYear==taxYear && t.type==='expense');
  const missing = computeMissingReceipts(txns, 75);
  exportCSV(['Date','Description','Category','Amount'],
    missing.map(t=>[t.date,t.description,t.category,t.amount.toFixed(2)]),
    `missing_receipts_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   13. Hours by Category
   ──────────────────────────────────────────────────────────────────────────── */
function renderHoursCatReport() {
  const summary = computeTimeSummary(State.timeEntries || []);
  const cats    = summary.byCategory;
  const total   = summary.totalHours;

  const rows = cats.map(c => {
    const pct = total > 0 ? ((c.hours / total)*100).toFixed(1) : '0.0';
    return `<tr><td>${c.category}</td><td class="num">${c.hours.toFixed(1)} hrs</td><td class="num">${pct}%</td></tr>`;
  }).join('') || '<tr><td colspan="3" class="empty">No time logged yet.</td></tr>';

  const body = `
    <div class="chart-two-col">
      <div class="chart-wrap" style="height:240px"><canvas id="rptHoursCatChart"></canvas></div>
      <div id="rptHoursLegend" class="chart-legend"></div>
    </div>
    <table class="report-table">
      <thead><tr><th>Category</th><th class="num">Hours</th><th class="num">%</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td><strong>Total</strong></td><td class="num"><strong>${total.toFixed(1)} hrs</strong></td><td></td></tr></tfoot>
    </table>`;

  return reportShell('Hours by Category', '', body, { exportFn: 'exportHoursCatCSV' });
}

function exportHoursCatCSV() {
  const summary = computeTimeSummary(State.timeEntries || []);
  const total   = summary.totalHours;
  exportCSV(['Category','Hours','Pct'],
    summary.byCategory.map(c=>[c.category, c.hours.toFixed(1), total>0?((c.hours/total)*100).toFixed(1):'0.0']),
    'hours_by_category.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   14. Weekly Hours
   ──────────────────────────────────────────────────────────────────────────── */
function renderWeeklyHrsReport() {
  const summary = computeTimeSummary(State.timeEntries || []);
  const weeks   = summary.byWeek;

  const rows = weeks.map(w => {
    const d = new Date(w.week + 'T12:00:00');
    const label = 'Week of ' + fmtDate(w.week);
    return `<tr><td>${label}</td><td class="num">${w.hours.toFixed(1)} hrs</td></tr>`;
  }).join('') || '<tr><td colspan="2" class="empty">No time data.</td></tr>';

  const body = `
    <div class="chart-wrap" style="height:260px"><canvas id="rptWeeklyHrsChart"></canvas></div>
    <table class="report-table">
      <thead><tr><th>Week</th><th class="num">Hours</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('Weekly Hours', '', body, { exportFn: 'exportWeeklyHrsCSV' });
}

function exportWeeklyHrsCSV() {
  const weeks = computeTimeSummary(State.timeEntries||[]).byWeek;
  exportCSV(['Week','Hours'], weeks.map(w=>['Week of '+w.week, w.hours.toFixed(1)]), 'weekly_hours.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   15. Monthly Hours Summary
   ──────────────────────────────────────────────────────────────────────────── */
function renderMonthlyHrsReport() {
  const summary = computeTimeSummary(State.timeEntries || []);
  const months  = summary.byMonth;

  const rows = months.map(m =>
    `<tr><td>${fmtMonth(m.month)}</td><td class="num">${m.hours.toFixed(1)} hrs</td>
     <td>${m.entryCount} entries</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty">No time data.</td></tr>';

  const body = `
    <table class="report-table">
      <thead><tr><th>Month</th><th class="num">Hours</th><th>Entries</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td><strong>Total</strong></td>
        <td class="num"><strong>${summary.totalHours.toFixed(1)} hrs</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`;

  return reportShell('Monthly Hours Summary', '', body, { exportFn: 'exportMonthlyHrsCSV' });
}

function exportMonthlyHrsCSV() {
  const months = computeTimeSummary(State.timeEntries||[]).byMonth;
  exportCSV(['Month','Hours','Entries'], months.map(m=>[m.month, m.hours.toFixed(1), m.entryCount]), 'monthly_hours.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   16. Budget vs. Actual
   ──────────────────────────────────────────────────────────────────────────── */
function renderBudgetReport() {
  const status = computeBudgetStatus(State.budgets || [], filteredTransactions());
  const active = status.filter(s => s.budget > 0);

  const rows = active.map(s => {
    const cls = s.pct > 1 ? 'red' : s.pct > 0.75 ? 'amber' : 'green';
    const label = s.pct > 1 ? 'Over budget' : s.pct > 0.75 ? 'Near limit' : 'On track';
    return `<tr>
      <td>${s.category}</td>
      <td class="num">${fmt$(s.budget)}</td>
      <td class="num ${s.pct > 0.75 ? cls : ''}">${fmt$(s.actual)}</td>
      <td class="num">${fmt$(Math.max(0, s.budget - s.actual))}</td>
      <td><span class="badge ${cls}">${label}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No budgets set. Add budgets in Settings → Budgets.</td></tr>';

  const body = `
    <div class="chart-wrap" style="height:300px"><canvas id="rptBudgetChart"></canvas></div>
    <table class="report-table">
      <thead><tr><th>Category</th><th class="num">Budget</th><th class="num">Actual</th><th class="num">Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('Budget vs. Actual', '', body, { exportFn: 'exportBudgetCSV' });
}

function exportBudgetCSV() {
  const status = computeBudgetStatus(State.budgets||[], filteredTransactions());
  exportCSV(['Category','Budget','Actual','Remaining','Pct'],
    status.filter(s=>s.budget>0).map(s=>[s.category,s.budget.toFixed(2),s.actual.toFixed(2),
      Math.max(0,s.budget-s.actual).toFixed(2),(s.pct*100).toFixed(1)+'%']),
    'budget_vs_actual.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   17. Runway & Burn Rate
   ──────────────────────────────────────────────────────────────────────────── */
function renderRunwayReport() {
  const txns     = State.txns || [];
  const burnData = computeBurnRate(txns, 3);
  const runway   = computeRunway(burnData, txns);

  const runwayMonths = isFinite(runway.runwayMonths) ? runway.runwayMonths.toFixed(1) : '∞';
  const runwayDate   = runway.runwayDate || '—';
  const alertCls     = !isFinite(runway.runwayMonths) ? 'green' : runway.runwayMonths < 3 ? 'red' : runway.runwayMonths < 6 ? 'amber' : 'green';

  const body = `
    <div class="runway-summary">
      <div class="runway-stat">
        <div class="runway-label">Monthly Burn Rate</div>
        <div class="runway-value">${fmt$(burnData.monthlyBurn)}</div>
        <div class="runway-sub">3-month average</div>
      </div>
      <div class="runway-stat">
        <div class="runway-label">Estimated Cash Position</div>
        <div class="runway-value">${fmt$(runway.currentCash)}</div>
        <div class="runway-sub">Capital in − draws − net expenses + income</div>
      </div>
      <div class="runway-stat ${alertCls}">
        <div class="runway-label">Runway</div>
        <div class="runway-value">${runwayMonths} months</div>
        <div class="runway-sub">${runway.runwayDate ? 'Through ~' + runwayDate : 'No burn — funds last indefinitely'}</div>
      </div>
    </div>
    ${runway.runwayMonths < 3 ? '<div class="alert-banner red">⚠ Less than 3 months of runway remaining.</div>' : ''}
    <div class="burn-breakdown">
      <span>Fixed burn: ${fmt$(burnData.fixedBurn)}/mo</span>
      <span>Variable burn: ${fmt$(burnData.variableBurn)}/mo</span>
    </div>
    <div class="chart-wrap" style="height:260px"><canvas id="rptRunwayChart"></canvas></div>
    <p class="report-note">Cash position is estimated from logged transactions. Verify against your actual bank balance.</p>`;

  return reportShell('Runway & Burn Rate', '', body);
}

/* ────────────────────────────────────────────────────────────────────────────
   18. CT Sales Tax
   ──────────────────────────────────────────────────────────────────────────── */
function renderSalesTaxReport() {
  const taxYear = _selectedTaxYear();
  const txns    = (State.txns || []).filter(t => t.taxYear == taxYear && t.status !== 'draft');
  const st      = computeSalesTax(txns, 0.0635);

  const rows = st.monthly.map(m =>
    `<tr><td>${fmtMonth(m.month)}</td>
     <td class="num">${fmt$(m.taxableRevenue)}</td>
     <td class="num">${fmt$(m.taxCollected)}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty">No taxable income transactions.</td></tr>';

  const body = `
    <p class="report-note">Only income transactions with "CT Sales Tax Collected" enabled are included. CT Sales Tax rate: 6.35%. Verify taxable items with your CPA — golf simulator sessions may be subject to CT admissions/amusement tax.</p>
    <div class="reimburse-summary">
      <div class="kpi-chip blue">Taxable Revenue: ${fmt$(st.totalTaxable)}</div>
      <div class="kpi-chip amber">Tax Collected: ${fmt$(st.totalTax)}</div>
    </div>
    <table class="report-table">
      <thead><tr><th>Month</th><th class="num">Taxable Revenue</th><th class="num">CT Tax (6.35%)</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td><strong>Total</strong></td>
        <td class="num"><strong>${fmt$(st.totalTaxable)}</strong></td>
        <td class="num"><strong>${fmt$(st.totalTax)}</strong></td></tr></tfoot>
    </table>`;

  return reportShell('CT Sales Tax', taxYearSelector(taxYear), body, { exportFn: 'exportSalesTaxCSV' });
}

function exportSalesTaxCSV() {
  const taxYear = _selectedTaxYear();
  const st      = computeSalesTax((State.txns||[]).filter(t=>t.taxYear==taxYear), 0.0635);
  exportCSV(['Month','Taxable Revenue','CT Tax (6.35%)'],
    st.monthly.map(m=>[m.month, m.taxableRevenue.toFixed(2), m.taxCollected.toFixed(2)]),
    `ct_sales_tax_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   19. Period Comparison
   ──────────────────────────────────────────────────────────────────────────── */
let _compareA = { preset: 'this_month', label: 'This Month' };
let _compareB = { preset: 'last_month', label: 'Last Month' };

function _comparePeriodA() { return _resolvePeriodForCompare(_compareA); }
function _comparePeriodB() { return _resolvePeriodForCompare(_compareB); }

function _resolvePeriodForCompare(p) {
  const range = resolveDateRange(p.preset, p.from, p.to);
  return { ...range, label: p.label };
}

function renderCompareReport() {
  const presets = [
    { value: 'this_month',    label: 'This Month' },
    { value: 'last_month',    label: 'Last Month' },
    { value: 'this_quarter',  label: 'This Quarter' },
    { value: 'last_quarter',  label: 'Last Quarter' },
    { value: 'this_year',     label: 'This Year' },
    { value: 'last_year',     label: 'Last Year' },
  ];
  const selA = _compareA.preset;
  const selB = _compareB.preset;

  const pA = _comparePeriodA();
  const pB = _comparePeriodB();
  const comp = computePeriodComparison(State.txns || [], pA, pB);

  const rows = comp.map(r => {
    const change = r.amtB - r.amtA;
    const chgCls = r.type === 'income'
      ? (change >= 0 ? 'green' : 'red')
      : (change <= 0 ? 'green' : 'red');
    const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';
    return `<tr>
      <td>${r.category}</td>
      <td class="num">${fmt$(r.amtA)}</td>
      <td class="num">${fmt$(r.amtB)}</td>
      <td class="num ${chgCls}">${arrow} ${fmt$(Math.abs(change))}</td>
      <td class="num ${chgCls}">${r.amtA > 0 ? ((change/r.amtA)*100).toFixed(1)+'%' : '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No data for selected periods.</td></tr>';

  const controls = `
    <div class="compare-controls">
      <div class="compare-group">
        <label>Period A</label>
        <select onchange="setCompareA(this.value, this.options[this.selectedIndex].text)">
          ${presets.map(p=>`<option value="${p.value}" ${selA===p.value?'selected':''}>${p.label}</option>`).join('')}
        </select>
      </div>
      <div class="compare-vs">vs.</div>
      <div class="compare-group">
        <label>Period B</label>
        <select onchange="setCompareB(this.value, this.options[this.selectedIndex].text)">
          ${presets.map(p=>`<option value="${p.value}" ${selB===p.value?'selected':''}>${p.label}</option>`).join('')}
        </select>
      </div>
    </div>`;

  const body = `
    <div class="chart-wrap" style="height:280px"><canvas id="rptCompareChart"></canvas></div>
    <table class="report-table">
      <thead><tr><th>Category</th>
        <th class="num">${_compareA.label}</th>
        <th class="num">${_compareB.label}</th>
        <th class="num">Change $</th>
        <th class="num">Change %</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return reportShell('Period Comparison', controls, body, { exportFn: 'exportCompareCSV' });
}

function setCompareA(preset, label) { _compareA = { preset, label }; openReport('compare'); }
function setCompareB(preset, label) { _compareB = { preset, label }; openReport('compare'); }

function exportCompareCSV() {
  const comp = computePeriodComparison(State.txns||[], _comparePeriodA(), _comparePeriodB());
  exportCSV([`Category`,`${_compareA.label}`,`${_compareB.label}`,'Change $','Change %'],
    comp.map(r=>{
      const chg = r.amtB - r.amtA;
      return [r.category, r.amtA.toFixed(2), r.amtB.toFixed(2), chg.toFixed(2),
        r.amtA > 0 ? ((chg/r.amtA)*100).toFixed(1)+'%' : '—'];
    }), 'period_comparison.csv');
}

/* ────────────────────────────────────────────────────────────────────────────
   20. Mileage Log
   ──────────────────────────────────────────────────────────────────────────── */
function renderMileageReport() {
  const taxYear = _selectedTaxYear();
  const entries = (State.mileageEntries || []).filter(e => e.taxYear == taxYear);
  const summary = computeMileageSummary(entries);

  const rows = entries.sort((a,b) => b.date.localeCompare(a.date)).map(e =>
    `<tr>
       <td>${fmtDate(e.date)}</td>
       <td>${e.fromLocation || '—'} → ${e.toLocation || '—'}</td>
       <td class="num">${(e.miles * (e.roundTrip ? 2 : 1)).toFixed(1)}</td>
       <td>${e.purpose || '—'}</td>
       <td class="num green">${fmt$(e.deduction)}</td>
       <td><button class="btn-link" onclick="openPanel('mileage','${e.id}')">Edit</button></td>
     </tr>`
  ).join('') || '<tr><td colspan="6" class="empty">No mileage logged for this tax year.</td></tr>';

  const body = `
    <div class="reimburse-summary">
      <div class="kpi-chip blue">Total Miles: ${summary.totalMiles.toFixed(1)}</div>
      <div class="kpi-chip green">IRS Deduction: ${fmt$(summary.totalDeduction)}</div>
      <div class="kpi-chip gray">Rate: $${IRS_RATE_2026}/mile (2026)</div>
    </div>
    <table class="report-table">
      <thead><tr><th>Date</th><th>Route</th><th class="num">Miles</th><th>Purpose</th><th class="num">Deduction</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2"><strong>Total</strong></td>
        <td class="num"><strong>${summary.totalMiles.toFixed(1)}</strong></td>
        <td></td>
        <td class="num green"><strong>${fmt$(summary.totalDeduction)}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`;

  return reportShell('Mileage Log', taxYearSelector(taxYear), body, { exportFn: 'exportMileageCSV' });
}

function exportMileageCSV() {
  const taxYear = _selectedTaxYear();
  const entries = (State.mileageEntries||[]).filter(e=>e.taxYear==taxYear);
  exportCSV(['Date','From','To','Miles','Round Trip','Purpose','IRS Rate','Deduction'],
    entries.map(e=>[e.date, e.fromLocation||'', e.toLocation||'',
      e.miles, e.roundTrip?'Yes':'No', e.purpose||'',
      '$'+IRS_RATE_2026, e.deduction.toFixed(2)]),
    `mileage_log_${taxYear}.csv`);
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */
function _selectedTaxYear() {
  const el = document.getElementById('rptTaxYear');
  if (el) return parseInt(el.value);
  return State.currentTaxYear || new Date().getFullYear();
}
