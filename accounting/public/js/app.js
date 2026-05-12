/* ═══════════════════════════════════════════════════════════════════════════
   app.js — Main entry point: auth, State, listeners, navigation, render
   ═══════════════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────────────────
   Global State
   ──────────────────────────────────────────────────────────────────────────── */
const State = {
  user:              null,
  txns:              [],
  customers:         [],
  vendors:           [],
  assets:            [],
  loans:             [],
  categories:        [],
  timeEntries:       [],
  mileageEntries:    [],
  recurringTemplates:[],
  budgets:           [],
  documents:         [],
  settings:          {},
  currentView:       'dashboard',
  currentTaxYear:    new Date().getFullYear(),
  charts:            {},
  filters: {
    preset:  'all',
    from:    '',
    to:      '',
    type:    'all',
    category:'',
    paymentMethod: '',
    search:  '',
    status:  'normal',
  },
  timeCategories: [
    'Business Development','Operations & Management','Marketing & Sales',
    'Finance & Accounting','Legal & Compliance','Buildout & Setup',
    'Customer Relations','Technology & Systems','Admin & Other',
  ],
  membershipTiers: [],
  hourlyRates: {},
};

/* ─── Auth — redirect to management hub if not signed in ─── */
auth.onAuthStateChanged(user => {
  if (!user) {
    // Only redirect if the localStorage auth flag is absent —
    // this prevents a race where Firebase is still restoring its session
    if (!localStorage.getItem('sp_authed')) {
      window.location.href = 'https://www.strikepointsims.com/management/';
    }
    return;
  }
  localStorage.setItem('sp_authed', '1');
  const overlay = document.getElementById('sp-signin-overlay');
  if (overlay) overlay.style.display = 'none';
  State.user = user;
  bootstrapApp(user);
});

async function bootstrapApp(user) {
  // Show user info in sidebar
  document.getElementById('userName') && (document.getElementById('userName').textContent = user.displayName || user.email);
  document.getElementById('userEmail') && (document.getElementById('userEmail').textContent = user.email);
  document.getElementById('userAvatar') && (document.getElementById('userAvatar').textContent = (user.displayName || user.email || '?')[0].toUpperCase());

  if (_isTestMode()) {
    // Offline/test mode: load from localStorage, seed if empty
    _loadOrSeedData();
  } else {
    // Firebase mode: seed Firestore on first login, then start real-time listeners
    try { await seedDefaultData(); } catch(e) { console.warn('Seed error:', e); }
  }

  // Load settings
  try {
    State.settings = await getSettings();
    if (State.settings.taxYear) State.currentTaxYear = State.settings.taxYear;
    if (State.settings.hourlyRates) State.hourlyRates = State.settings.hourlyRates;
  } catch(e) { console.warn('Settings load error:', e); }

  initChartDefaults();

  if (!_isTestMode()) {
    _setupListeners(); // Firestore real-time listeners
  }
  navigate('dashboard');
}

function _seedTestData() {
  // Sample data for testing UI without Firebase
  const now = new Date();
  const year = now.getFullYear();
  const today = now.toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  State.categories = [
    { id: '1', name: 'Advertising & Marketing', type: 'expense', irsLine: '8', ded: 'full', isCustom: false, order: 0 },
    { id: '2', name: 'Professional Fees', type: 'expense', irsLine: '17', ded: 'full', isCustom: false, order: 1 },
    { id: '3', name: 'Rent / Lease', type: 'expense', irsLine: '20', ded: 'full', isCustom: false, order: 2 },
    { id: '4', name: 'Tech / Software / SaaS', type: 'expense', irsLine: '22', ded: 'full', isCustom: false, order: 3 },
    { id: '5', name: 'Utilities', type: 'expense', irsLine: '25', ded: 'full', isCustom: false, order: 4 },
    { id: '6', name: 'Office & Admin Supplies', type: 'expense', irsLine: '22', ded: 'full', isCustom: false, order: 5 },
    { id: '7', name: 'Travel', type: 'expense', irsLine: '24a', ded: 'full', isCustom: false, order: 6 },
    { id: '8', name: 'Membership Revenue', type: 'income', irsLine: '1', ded: 'na', isCustom: false, order: 7 },
    { id: '9', name: 'Walk-in / Session Revenue', type: 'income', irsLine: '1', ded: 'na', isCustom: false, order: 8 },
  ];

  State.loans = [
    { id: 'loan1', name: 'SBA 7(a) Loan', lender: 'Liberty Bank', originalAmount: 150000, interestRate: 0.095, termMonths: 120, startDate: '2026-07-01', monthlyPayment: 1941 },
  ];

  State.vendors = [
    { id: 'v1', name: 'Comcast', category: 'Utilities', email: 'support@comcast.com', is1099Eligible: false },
    { id: 'v2', name: 'TrackMan', category: 'Tech / Software / SaaS', email: 'support@trackman.com', is1099Eligible: false },
  ];

  State.customers = [
    { id: 'c1', name: 'John Smith', type: 'member', status: 'active', membershipTier: 'Founding' },
    { id: 'c2', name: 'Jane Doe', type: 'member', status: 'active', membershipTier: 'Standard' },
  ];

  State.txns = [
    { id: 't1', type: 'income', amount: 500, description: 'Founding member - John Smith', category: 'Membership Revenue', date: today, paymentMethod: 'business', deductibility: 'na', status: 'normal', taxYear: year },
    { id: 't2', type: 'expense', amount: 89, description: 'Comcast internet', category: 'Utilities', date: today, paymentMethod: 'business', deductibility: 'full', status: 'normal', taxYear: year },
    { id: 't3', type: 'expense', amount: 250, description: 'Cloud storage subscription', category: 'Tech / Software / SaaS', date: lastMonth + '-15', paymentMethod: 'personal', deductibility: 'full', reimbursementStatus: 'pending', status: 'normal', taxYear: year },
    { id: 't4', type: 'income', amount: 350, description: 'Walk-in session', category: 'Walk-in / Session Revenue', date: lastMonth + '-10', paymentMethod: 'business', deductibility: 'na', status: 'normal', taxYear: year },
  ];

  State.timeEntries = [
    { id: 'te1', date: today, hours: 3, description: 'Reviewed contractor bids', category: 'Operations & Management', taxYear: year },
    { id: 'te2', date: lastMonth + '-15', hours: 2.5, description: 'Marketing planning', category: 'Marketing & Sales', taxYear: year },
  ];

  State.mileageEntries = [
    { id: 'me1', date: today, miles: 12, purpose: 'Bank meeting - SBA application', roundTrip: false, ratePerMile: 0.70, deduction: 8.40, taxYear: year },
  ];

  State.budgets = [
    { id: 'b1', category: 'Tech / Software / SaaS', amount: 500, period: 'monthly' },
    { id: 'b2', category: 'Utilities', amount: 150, period: 'monthly' },
  ];
}

function _loadOrSeedData() {
  const hasData = _loadFromLS();
  if (!hasData) {
    _seedTestData();
    _saveToLS();
  }
}

function _setupListeners() {
  const onErr = (e) => {
    console.warn('Firestore listener error (test mode?):', e.message);
    // In test mode, just render empty state
    renderAll();
  };

  try {
    col('transactions').orderBy('date', 'desc').onSnapshot(snap => {
      State.txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('customers').orderBy('name').onSnapshot(snap => {
      State.customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('vendors').orderBy('name').onSnapshot(snap => {
      State.vendors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('assets').onSnapshot(snap => {
      State.assets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, onErr);

    col('loans').onSnapshot(snap => {
      State.loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, onErr);

    col('categories').orderBy('order').onSnapshot(snap => {
      State.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('timeEntries').orderBy('date', 'desc').onSnapshot(snap => {
      State.timeEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('mileageEntries').orderBy('date', 'desc').onSnapshot(snap => {
      State.mileageEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('recurringTemplates').onSnapshot(snap => {
      State.recurringTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      checkRecurring().then(() => renderRecurringDraftBanner());
      renderAll();
    }, onErr);

    col('budgets').onSnapshot(snap => {
      State.budgets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('documents').orderBy('uploadedAt', 'desc').onSnapshot(snap => {
      State.documents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);

    col('membershipTiers').onSnapshot(snap => {
      State.membershipTiers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAll();
    }, onErr);
  } catch (e) {
    console.warn('Firestore setup error (test mode?):', e.message);
    // Render UI anyway with empty state
    renderAll();
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Navigation
   ──────────────────────────────────────────────────────────────────────────── */
function navigate(view) {
  State.currentView = view;
  _currentReport    = null; // reset active report

  // Sidebar active state
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
  // Mobile bottom tabs
  document.querySelectorAll('.tab-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );

  // Close "More" overlay if open
  document.getElementById('moreOverlay')?.classList.remove('open');

  // Update top bar title + CTA
  _updateTopBar(view);

  // Render the view
  renderAll();
}

function _updateTopBar(view) {
  const titles = {
    dashboard:    'Dashboard',
    transactions: 'Transactions',
    customers:    'Customers',
    vendors:      'Vendors',
    time:         'Time Tracking',
    reports:      'Reports',
  };
  const ctaLabels = {
    dashboard:    '+ Add Transaction',
    transactions: '+ Add Transaction',
    customers:    '+ Add Customer',
    vendors:      '+ Add Vendor',
    time:         _timeTab === 'mileage' ? '+ Log Mileage' : '+ Log Time',
    reports:      '',
  };
  const ctaActions = {
    dashboard:    "openPanel('txn')",
    transactions: "openPanel('txn')",
    customers:    "openPanel('customer')",
    vendors:      "openPanel('vendor')",
    time:         _timeTab === 'mileage' ? "openPanel('mileage')" : "openPanel('time')",
    reports:      '',
  };

  const titleEl  = document.getElementById('topbarTitle');
  const ctaEl    = document.getElementById('ctaBtn');
  if (titleEl) titleEl.textContent = titles[view] || view;
  if (ctaEl) {
    const label  = ctaLabels[view] || '';
    const action = ctaActions[view] || '';
    if (label) {
      ctaEl.textContent = label;
      ctaEl.setAttribute('onclick', action);
      ctaEl.style.display = '';
    } else {
      ctaEl.style.display = 'none';
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Render All — dispatches to current view renderer
   ──────────────────────────────────────────────────────────────────────────── */
function renderAll() {
  const view = State.currentView;
  switch (view) {
    case 'dashboard':    renderDashboard();    break;
    case 'transactions': renderTransactions(); break;
    case 'customers':    renderCustomers();    break;
    case 'vendors':      renderVendors();      break;
    case 'time':         renderTime();         break;
    case 'reports':      renderReports();      break;
  }
  renderRecurringDraftBanner();
}

/* ────────────────────────────────────────────────────────────────────────────
   Dashboard
   ──────────────────────────────────────────────────────────────────────────── */
function renderDashboard() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const txns   = (State.txns || []).filter(t => t.taxYear === State.currentTaxYear && t.status !== 'draft');
  const income = txns.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const netPL   = income - expense;
  const pending = txns.filter(t => t.paymentMethod === 'personal' && t.reimbursementStatus === 'pending');
  const pendingAmt = pending.reduce((s,t) => s+t.amount, 0);

  // alerts
  const vendors1099 = compute1099Vendors(State.vendors, txns).filter(v => v.ytd >= 600);
  const budgetStatus = computeBudgetStatus(State.budgets || [], txns).filter(s => s.budget > 0);
  const overBudget = budgetStatus.filter(s => s.pct > 1);
  const drafts = (State.txns || []).filter(t => t.status === 'draft');

  // Recent transactions
  const recent = (State.txns || []).filter(t => t.status !== 'draft').slice(0, 6);

  // Membership MRR
  const activeMems = (State.customers || []).filter(c => c.membershipStatus === 'active');
  const mrr = activeMems.reduce((s,c) => {
    const tier = (State.membershipTiers || []).find(t => t.id === c.membershipTierId);
    if (!tier) return s;
    return s + (tier.billingCycle === 'annual' ? (tier.price / 12) : tier.price);
  }, 0);

  main.innerHTML = `
    <div class="dashboard">

      <!-- KPI row — each card is clickable -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-clickable" onclick="openReport('pl')" title="View P&L Report">
          <div class="kpi-label">YTD Income</div>
          <div class="kpi-value green">${fmt$(income)}</div>
          <div class="kpi-sub">${State.currentTaxYear} · View P&amp;L →</div>
        </div>
        <div class="kpi-card kpi-clickable" onclick="openReport('bycat')" title="View Expenses by Category">
          <div class="kpi-label">YTD Expenses</div>
          <div class="kpi-value red">${fmt$(expense)}</div>
          <div class="kpi-sub">By Category →</div>
        </div>
        <div class="kpi-card kpi-clickable" onclick="openReport('pl')" title="View Income Statement">
          <div class="kpi-label">Net P/L</div>
          <div class="kpi-value ${netPL >= 0 ? 'green':'red'}">${fmt$(netPL)}</div>
          <div class="kpi-sub">${netPL >= 0 ? 'Profit' : 'Loss'} · Income Statement →</div>
        </div>
        <div class="kpi-card kpi-clickable" onclick="${pendingAmt > 0 ? "openReport('reimburse')" : "navigate('transactions')"}" title="${pendingAmt > 0 ? 'View Reimbursements' : 'View Transactions'}">
          <div class="kpi-label">Pending Reimbursements</div>
          <div class="kpi-value ${pendingAmt > 0 ? 'amber' : 'green'}">${fmt$(pendingAmt)}</div>
          <div class="kpi-sub">${pending.length} transactions${pendingAmt > 0 ? ' · Resolve →' : ''}</div>
        </div>
        ${mrr > 0 ? `
        <div class="kpi-card kpi-clickable" onclick="navigate('customers')" title="View Members">
          <div class="kpi-label">Monthly Revenue (MRR)</div>
          <div class="kpi-value green">${fmt$(mrr)}</div>
          <div class="kpi-sub">${activeMems.length} active members →</div>
        </div>` : ''}
      </div>

      <!-- Quick Actions — always visible, right below KPIs -->
      <div class="qa-strip">
        <button class="qa-strip-btn primary" onclick="openPanel('txn')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Log Expense
        </button>
        <button class="qa-strip-btn" onclick="openPanel('txn',null,'income')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          Log Income
        </button>
        <button class="qa-strip-btn" onclick="openPanel('time')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Log Time
        </button>
        <button class="qa-strip-btn" onclick="openPanel('mileage')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          Log Mileage
        </button>
        <button class="qa-strip-btn" onclick="navigate('transactions')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          Transactions
        </button>
        <button class="qa-strip-btn" onclick="navigate('reports')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Reports
        </button>
      </div>

      <!-- Smart Alerts bar — only shown when actionable -->
      ${(drafts.length || vendors1099.length || overBudget.length || pendingAmt > 0) ? `
      <div class="alert-strip">
        ${drafts.length ? `<button class="alert-chip amber" onclick="renderDraftsPanel()">
          ⏰ ${drafts.length} recurring draft${drafts.length>1?'s':''} ready to confirm
        </button>` : ''}
        ${vendors1099.length ? `<button class="alert-chip red" onclick="openReport('r1099')">
          ⚠ ${vendors1099.length} vendor${vendors1099.length>1?'s':''} need 1099s
        </button>` : ''}
        ${overBudget.length ? `<button class="alert-chip red" onclick="openReport('budget')">
          📊 ${overBudget.length} categor${overBudget.length>1?'ies':'y'} over budget
        </button>` : ''}
        ${pendingAmt > 0 ? `<button class="alert-chip blue" onclick="openReport('reimburse')">
          💳 ${fmt$(pendingAmt)} in personal card charges to reimburse
        </button>` : ''}
      </div>` : ''}

      <!-- Recurring draft banner (legacy slot) -->
      <div id="recurringBanner"></div>

      <!-- Quick-log widget -->
      ${renderQuickLogWidget()}

      <!-- Recent transactions — core content, always visible -->
      <div class="surface-card">
        <div class="card-header">
          <div class="card-title">Recent Transactions</div>
          <button class="btn-ghost btn-sm" onclick="navigate('transactions')">View all →</button>
        </div>
        ${recent.length ? `
          <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Method</th><th class="num">Amount</th></tr></thead>
            <tbody>
              ${recent.map(t => `<tr onclick="openPanel('txn','${t.id}')" class="clickable">
                <td>${fmtDate(t.date)}</td>
                <td>${t.description || '—'} ${(t.receiptData || t.receiptUrl) ? '📎' : ''}</td>
                <td><span class="cat-badge">${t.category}</span></td>
                <td>${_pmLabel(t.paymentMethod)}</td>
                <td class="num ${t.type==='income'?'amount-income':'amount-expense'}">${t.type==='income'?'+':'-'}${fmt$(t.amount)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          </div>
          <div style="padding:10px 16px;border-top:1px solid var(--border)">
            <button class="btn-link" onclick="navigate('transactions')">View all transactions →</button>
          </div>` : '<p class="empty-note">No transactions yet — use the buttons above to log your first expense or income.</p>'}
      </div>

      <!-- Insights — progressive disclosure (collapsed by default when no data) -->
      <div class="insights-section" id="insightsSection">
        <button class="insights-toggle" onclick="toggleInsights()" id="insightsToggle">
          <span>📊 Insights &amp; Charts</span>
          <span class="insights-toggle-arrow" id="insightsArrow">▸</span>
        </button>
        <div class="insights-body" id="insightsBody" style="display:none">
          ${income > 0 || expense > 0 ? `
          <div class="chart-grid">
            <div class="chart-card full">
              <div class="chart-title">Monthly Cash Flow</div>
              <div class="chart-sub">Last 6 months</div>
              <div class="chart-wrap"><canvas id="dashCashFlow"></canvas></div>
            </div>
            <div class="chart-card full">
              <div class="chart-title">Expenses by Category</div>
              <div class="chart-sub">Current year</div>
              <div class="chart-wrap" style="height:220px"><canvas id="dashExpCat"></canvas></div>
            </div>
          </div>` : '<p class="empty-note" style="padding:32px 20px">Add transactions to see charts.</p>'}

          <div class="dash-lower">
            <div class="dash-card">
              <div class="dash-card-title">Tax Alerts</div>
              ${_buildTaxAlerts()}
              ${renderTaxEstimateWidget()}
            </div>
            <div class="dash-card">
              ${budgetStatus.length ? `
                <div class="dash-card-title">Budget Health</div>
                ${budgetStatus.slice(0,6).map(s => {
                  const pct = Math.min(s.pct * 100, 100);
                  const cls = s.pct > 1 ? 'red' : s.pct > 0.75 ? 'amber' : 'green';
                  return `<div class="budget-bar-row">
                    <div class="budget-bar-label">${s.category}</div>
                    <div class="budget-bar-track">
                      <div class="budget-bar-fill ${cls}" style="width:${pct}%"></div>
                    </div>
                    <div class="budget-bar-val">${fmt$(s.actual)} / ${fmt$(s.budget)}</div>
                  </div>`;
                }).join('')}
                ${budgetStatus.length > 6 ? `<a class="btn-link" style="padding:10px 16px;display:block" onclick="openReport('budget')">View all →</a>` : ''}
              ` : `
                <div class="dash-card-title">Explore Reports</div>
                <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
                  ${[['Income Statement (P&L)','pl'],['Cash Flow','cashflow'],['Tax Deductibility','deduct'],['Missing Receipts','missingr']].map(([l,r])=>`<button class="btn-secondary sm" onclick="openReport('${r}')">${l}</button>`).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // Charts render lazily when insights expanded
  requestAnimationFrame(() => {
    renderRecurringDraftBanner();
  });
}

function toggleInsights() {
  const body  = document.getElementById('insightsBody');
  const arrow = document.getElementById('insightsArrow');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (arrow) arrow.textContent = open ? '▸' : '▾';
  if (!open) {
    requestAnimationFrame(() => {
      renderCashFlowChart('dashCashFlow', 6);
      renderExpenseCategoryChart('dashExpCat');
    });
  }
}

function _buildTaxAlerts() {
  const year = State.currentTaxYear;
  const quarters = [
    { q: 1, due: `${year}-04-15`, label: `Q1 ${year}` },
    { q: 2, due: `${year}-06-16`, label: `Q2 ${year}` },
    { q: 3, due: `${year}-09-15`, label: `Q3 ${year}` },
    { q: 4, due: `${year+1}-01-15`, label: `Q4 ${year}` },
  ];
  const ctBET = { label: `CT Business Entity Tax ($250)`, due: `${year}-04-15` };
  const today = todayStr();

  // Check if CT BET paid
  const ctBETPaid = (State.txns || []).some(t =>
    t.category === 'Taxes & Licenses' && t.amount >= 250 &&
    t.date >= `${year}-01-01` && t.date <= `${year}-04-30`
  );

  const allAlerts = [...quarters.map(q => ({ label: `Federal Est. Tax — ${q.label}`, due: q.due }))];
  if (!ctBETPaid) allAlerts.push(ctBET);

  const upcoming = allAlerts
    .filter(a => a.due >= today)
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 4);

  if (!upcoming.length) return '<p class="empty-note">No upcoming tax deadlines.</p>';

  return upcoming.map(a => {
    const days = daysUntil(a.due);
    const cls  = days <= 7 ? 'red' : days <= 30 ? 'amber' : 'blue';
    return `<div class="tax-alert-row">
      <div class="tax-alert-label">${a.label}</div>
      <div class="tax-alert-due">
        <span class="badge ${cls}">${days === 0 ? 'Today' : days < 0 ? 'Past due' : `${days} days`}</span>
        <span class="tax-alert-date">${fmtDate(a.due)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ────────────────────────────────────────────────────────────────────────────
   Transactions View
   ──────────────────────────────────────────────────────────────────────────── */
function renderTransactions() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const txns = filteredTransactions();
  const { income, expenses, reimbursable } = computeSummary(txns);
  const csvReview = _csvCandidates.length ? renderCSVReviewQueue() : '';

  main.innerHTML = `
    <div class="transactions-view">

      <!-- Filter bar -->
      <div class="filter-bar">
        <div class="filter-group">
          <select id="fPreset" onchange="applyFilter('preset', this.value)">
            <option value="all"          ${State.filters.preset==='all'         ?'selected':''}>All Time</option>
            <option value="this_month"   ${State.filters.preset==='this_month'  ?'selected':''}>This Month</option>
            <option value="last_month"   ${State.filters.preset==='last_month'  ?'selected':''}>Last Month</option>
            <option value="this_quarter" ${State.filters.preset==='this_quarter'?'selected':''}>This Quarter</option>
            <option value="last_quarter" ${State.filters.preset==='last_quarter'?'selected':''}>Last Quarter</option>
            <option value="this_year"    ${State.filters.preset==='this_year'   ?'selected':''}>This Year</option>
            <option value="tax_year"     ${State.filters.preset==='tax_year'    ?'selected':''}>Tax Year ${State.currentTaxYear}</option>
            <option value="custom"       ${State.filters.preset==='custom'      ?'selected':''}>Custom Range</option>
          </select>
          ${State.filters.preset === 'custom' ? `
            <input type="date" id="fFrom" value="${State.filters.from}" onchange="applyFilter('from', this.value)">
            <span>–</span>
            <input type="date" id="fTo" value="${State.filters.to}" onchange="applyFilter('to', this.value)">` : ''}
        </div>
        <div class="filter-group">
          <select id="fType" onchange="applyFilter('type', this.value)">
            <option value="all"     ${State.filters.type==='all'    ?'selected':''}>All Types</option>
            <option value="expense" ${State.filters.type==='expense'?'selected':''}>Expenses</option>
            <option value="income"  ${State.filters.type==='income' ?'selected':''}>Income</option>
          </select>
          <select id="fPM" onchange="applyFilter('paymentMethod', this.value)">
            <option value=""         ${State.filters.paymentMethod===''        ?'selected':''}>All Methods</option>
            <option value="business" ${State.filters.paymentMethod==='business'?'selected':''}>Business Account</option>
            <option value="personal" ${State.filters.paymentMethod==='personal'?'selected':''}>Personal Card</option>
            <option value="sba"      ${State.filters.paymentMethod==='sba'     ?'selected':''}>SBA Funds</option>
          </select>
          <select id="fStatus" onchange="applyFilter('status', this.value)">
            <option value="normal" ${State.filters.status==='normal'?'selected':''}>Normal</option>
            <option value="review" ${State.filters.status==='review'?'selected':''}>Needs Review</option>
            <option value="all"    ${State.filters.status==='all'   ?'selected':''}>All</option>
          </select>
        </div>
        <div class="filter-group search-group">
          <input type="text" id="fSearch" placeholder="Search…" value="${State.filters.search}"
            oninput="applyFilter('search', this.value)">
          ${_hasActiveFilters() ? `<button class="btn-ghost sm" onclick="clearFilters()">Clear</button>` : ''}
        </div>
        <div class="filter-actions">
          <button class="btn-secondary sm" onclick="openCSVImport()">Import CSV</button>
          <div class="export-menu-wrap">
            <button class="btn-secondary sm" onclick="toggleExportMenu()">Export ▾</button>
            <div class="export-menu" id="exportMenu" style="display:none">
              <button onclick="exportTransactionsCSV(filteredTransactions())">Export CSV</button>
              <button onclick="exportQuickBooks()">Export for QuickBooks (IIF)</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary strip -->
      <div class="summary-strip">
        <span class="sum-chip green">Income: ${fmt$(income)}</span>
        <span class="sum-chip red">Expenses: ${fmt$(expenses)}</span>
        <span class="sum-chip ${income - expenses >= 0 ? 'blue':'red'}">Net: ${fmt$(income - expenses)}</span>
        ${reimbursable > 0 ? `<span class="sum-chip amber">Reimbursable: ${fmt$(reimbursable)}</span>` : ''}
        <span class="sum-chip gray">${txns.length} transactions</span>
      </div>

      <!-- CSV review queue -->
      ${csvReview}

      <!-- Table -->
      ${txns.length ? `
        <div class="table-scroll">
          <table class="txn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Method</th>
                <th class="num">Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map(t => `
                <tr onclick="openPanel('txn','${t.id}')" class="clickable ${t.status==='review'?'review-row':''}">
                  <td>${fmtDate(t.date)}</td>
                  <td class="desc-cell">
                    ${t.description || '—'}
                    ${t.paymentMethod === 'personal' ? '<span class="badge amber" title="Personal card">PC</span>' : ''}
                    ${t.status === 'review' ? '<span class="badge blue">Review</span>' : ''}
                  </td>
                  <td><span class="cat-badge">${t.category}</span></td>
                  <td>${_pmLabel(t.paymentMethod)}</td>
                  <td class="num ${t.type==='income'?'green':'red'}">${t.type==='income'?'+':'-'}${fmt$(t.amount)}</td>
                  <td class="receipt-cell">
                    ${(t.receiptData || t.receiptUrl)
                      ? `<button class="btn-link" onclick="event.stopPropagation();previewTxnReceipt('${t.id}')">📎</button>`
                      : (t.amount >= 75 && t.type === 'expense' ? '<span class="missing-receipt" title="Missing receipt">!</span>' : '')}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<p class="empty-note">No transactions match your filters.</p>'}

    </div>`;
}

function applyFilter(key, value) {
  State.filters[key] = value;
  renderTransactions();
}

function clearFilters() {
  State.filters = { preset:'all', from:'', to:'', type:'all', category:'', paymentMethod:'', search:'', status:'normal' };
  renderTransactions();
}

function _hasActiveFilters() {
  const f = State.filters;
  return f.preset !== 'all' || f.type !== 'all' || f.paymentMethod !== '' || f.search !== '' || f.status !== 'normal';
}

function toggleExportMenu() {
  const m = document.getElementById('exportMenu');
  if (m) m.style.display = m.style.display === 'none' ? '' : 'none';
}

function _pmLabel(pm) {
  const map = { business:'Business', personal:'Personal Card', sba:'SBA', capital:'Capital' };
  return map[pm] || pm || '—';
}

/* ────────────────────────────────────────────────────────────────────────────
   Customers View
   ──────────────────────────────────────────────────────────────────────────── */
function renderCustomers() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const search = _custSearch || '';
  const custs  = (State.customers || []).filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  main.innerHTML = `
    <div class="list-view">
      <div class="list-filter-bar">
        <input type="text" placeholder="Search customers…" value="${search}"
          oninput="_custSearch=this.value; renderCustomers()">
      </div>
      ${custs.length ? `
        <table class="txn-table">
          <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Member Tier</th><th>Since</th></tr></thead>
          <tbody>
            ${custs.map(c => `<tr onclick="openPanel('customer','${c.id}')" class="clickable">
              <td>${c.name}</td>
              <td>${c.type || '—'}</td>
              <td><span class="badge ${c.status==='active'?'green':'gray'}">${c.status||'—'}</span></td>
              <td>${c.membershipTier || '—'}</td>
              <td>${fmtDate(c.startDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<p class="empty-note">${search ? 'No customers match your search.' : 'No customers yet. Add your first member or walk-in.'}</p>`}
    </div>`;
}

let _custSearch = '';

/* ────────────────────────────────────────────────────────────────────────────
   Vendors View
   ──────────────────────────────────────────────────────────────────────────── */
function renderVendors() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const search  = _vendorSearch || '';
  const vendors = (State.vendors || []).filter(v =>
    !search || v.name?.toLowerCase().includes(search.toLowerCase())
  );

  // 1099 alert count
  const txns     = State.txns || [];
  const alert1099 = vendors.filter(v => {
    if (!v.is1099Eligible) return false;
    const ytd = txns.filter(t => t.vendorId === v.id && t.taxYear === State.currentTaxYear)
                    .reduce((s,t) => s+t.amount, 0);
    return ytd >= 600;
  });

  main.innerHTML = `
    <div class="list-view">
      ${alert1099.length ? `
        <div class="alert-banner amber">
          ⚠ ${alert1099.length} vendor${alert1099.length>1?'s have':'has'} reached the 1099 threshold ($600+). Add EINs before year-end.
          <button class="btn-link" onclick="openReport('r1099')">View 1099 Report →</button>
        </div>` : ''}
      <div class="list-filter-bar">
        <input type="text" placeholder="Search vendors…" value="${search}"
          oninput="_vendorSearch=this.value; renderVendors()">
      </div>
      ${vendors.length ? `
        <table class="txn-table">
          <thead><tr><th>Vendor</th><th>Category</th><th>1099</th><th>EIN</th><th>Contact</th></tr></thead>
          <tbody>
            ${vendors.map(v => {
              const ytd = txns.filter(t=>t.vendorId===v.id&&t.taxYear===State.currentTaxYear).reduce((s,t)=>s+t.amount,0);
              return `<tr onclick="openPanel('vendor','${v.id}')" class="clickable">
                <td>${v.name}</td>
                <td>${v.category || '—'}</td>
                <td>${v.is1099Eligible
                  ? (ytd>=600?'<span class="badge amber">1099</span>':'<span class="badge gray">Eligible</span>')
                  : '—'}</td>
                <td>${v.ein || '—'}</td>
                <td>${v.email || v.phone || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : `<p class="empty-note">${search ? 'No vendors match.' : 'No vendors yet.'}</p>`}
    </div>`;
}

let _vendorSearch = '';

/* ────────────────────────────────────────────────────────────────────────────
   Time Tracking View
   ──────────────────────────────────────────────────────────────────────────── */
let _timeTab = 'hours';

function renderTime() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const summary     = computeTimeSummary(State.timeEntries || []);
  const mileSummary = computeMileageSummary(State.mileageEntries || []);
  const now         = new Date();
  const weekKey     = getWeekKey(todayStr());
  const monthKey    = now.toISOString().slice(0,7);

  const thisWeekHrs = (State.timeEntries || [])
    .filter(e => getWeekKey(e.date) === weekKey)
    .reduce((s,e) => s + (e.hours||0), 0);
  const thisMonthHrs = (State.timeEntries || [])
    .filter(e => (e.date||'').slice(0,7) === monthKey)
    .reduce((s,e) => s + (e.hours||0), 0);
  const thisMonthMiles = (State.mileageEntries || [])
    .filter(e => (e.date||'').slice(0,7) === monthKey)
    .reduce((s,e) => s + (e.miles*(e.roundTrip?2:1)||0), 0);

  main.innerHTML = `
    <div class="time-view">

      <!-- Stat strip -->
      <div class="time-stat-strip">
        <div class="time-stat">
          <div class="time-stat-val">${thisWeekHrs.toFixed(1)}</div>
          <div class="time-stat-label">hrs this week</div>
        </div>
        <div class="time-stat-sep"></div>
        <div class="time-stat">
          <div class="time-stat-val">${thisMonthHrs.toFixed(1)}</div>
          <div class="time-stat-label">hrs this month</div>
        </div>
        <div class="time-stat-sep"></div>
        <div class="time-stat">
          <div class="time-stat-val">${summary.totalHours.toFixed(1)}</div>
          <div class="time-stat-label">hrs YTD</div>
        </div>
        <div class="time-stat-sep"></div>
        <div class="time-stat accent">
          <div class="time-stat-val">${thisMonthMiles.toFixed(1)} mi</div>
          <div class="time-stat-label">miles this month</div>
        </div>
        <div class="time-stat-sep"></div>
        <div class="time-stat green">
          <div class="time-stat-val">${fmt$(mileSummary.totalDeduction)}</div>
          <div class="time-stat-label">IRS deduction YTD</div>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="time-tab-bar">
        <div class="time-tabs">
          <button class="time-tab-btn ${_timeTab==='hours'  ?'active':''}" onclick="switchTimeTab('hours')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Hours
          </button>
          <button class="time-tab-btn ${_timeTab==='mileage'?'active':''}" onclick="switchTimeTab('mileage')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            Mileage
          </button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openPanel(_timeTab === 'hours' ? 'time' : 'mileage')">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span id="timeAddLabel">${_timeTab === 'hours' ? 'Log Time' : 'Log Mileage'}</span>
        </button>
      </div>

      <!-- Tab content -->
      <div id="timeTabContent">${_renderTimeTab()}</div>
    </div>`;

  // Sync top bar CTA
  _syncTimeCTA();
}

function _syncTimeCTA() {
  const ctaEl = document.getElementById('ctaBtn');
  if (!ctaEl) return;
  if (_timeTab === 'hours') {
    ctaEl.innerHTML = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Time';
    ctaEl.onclick = () => openPanel('time');
  } else {
    ctaEl.innerHTML = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Mileage';
    ctaEl.onclick = () => openPanel('mileage');
  }
  ctaEl.style.display = '';
}

function switchTimeTab(tab) {
  _timeTab = tab;
  // Re-render tab content
  const el = document.getElementById('timeTabContent');
  if (el) el.innerHTML = _renderTimeTab();
  // Update tab buttons
  document.querySelectorAll('.time-tab-btn').forEach(b =>
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === tab)
  );
  // Update inline add button label
  const lbl = document.getElementById('timeAddLabel');
  if (lbl) lbl.textContent = tab === 'hours' ? 'Log Time' : 'Log Mileage';
  // Sync top bar
  _syncTimeCTA();
}

function _renderTimeTab() {
  if (_timeTab === 'hours') {
    const entries = (State.timeEntries || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    if (!entries.length) return `
      <div class="time-empty-state">
        <div class="time-empty-icon">⏱</div>
        <div class="time-empty-title">No time logged yet</div>
        <div class="time-empty-sub">Track hours worked to document owner participation for taxes</div>
        <button class="btn btn-primary" onclick="openPanel('time')">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Log Your First Entry
        </button>
      </div>`;

    const rows = entries.map(e => `
      <tr onclick="openPanel('time','${e.id}')" class="clickable">
        <td>${fmtDate(e.date)}</td>
        <td>${e.description || '—'}</td>
        <td><span class="cat-badge">${e.category || 'Uncategorized'}</span></td>
        <td class="num"><strong>${(e.hours||0).toFixed(1)}</strong> hrs</td>
        <td class="text-muted" style="font-size:12px">${e.notes || ''}</td>
      </tr>`).join('');

    return `
      <div class="table-scroll">
        <table class="txn-table">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Hours</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Mileage tab
  const entries = (State.mileageEntries || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if (!entries.length) return `
    <div class="time-empty-state">
      <div class="time-empty-icon">🚗</div>
      <div class="time-empty-title">No mileage logged yet</div>
      <div class="time-empty-sub">Log business drives to claim the IRS deduction ($0.70/mile in 2026)</div>
      <button class="btn btn-primary" onclick="openPanel('mileage')">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Log Your First Trip
      </button>
    </div>`;

  const rows = entries.map(e => {
    const actualMiles = (e.miles||0) * (e.roundTrip ? 2 : 1);
    const route = (e.fromLocation || e.toLocation)
      ? `${e.fromLocation||'—'} → ${e.toLocation||'—'}`
      : e.purpose || '—';
    return `
      <tr onclick="openPanel('mileage','${e.id}')" class="clickable">
        <td>${fmtDate(e.date)}</td>
        <td>${e.purpose || '—'}</td>
        <td class="text-muted" style="font-size:12px">${route}</td>
        <td class="num"><strong>${actualMiles.toFixed(1)}</strong> mi${e.roundTrip ? ' <span class="badge blue" style="font-size:9px">RT</span>' : ''}</td>
        <td class="num green"><strong>${fmt$(e.deduction)}</strong></td>
      </tr>`;
  }).join('');

  return `
    <div class="table-scroll">
      <table class="txn-table">
        <thead><tr><th>Date</th><th>Purpose</th><th>Route</th><th class="num">Miles</th><th class="num">Deduction</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Reports View
   ──────────────────────────────────────────────────────────────────────────── */
function renderReports() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  if (_currentReport) {
    main.innerHTML = renderReport(_currentReport);
    _postRenderCharts(_currentReport);
  } else {
    main.innerHTML = renderReportLibrary();
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Settings modal
   ──────────────────────────────────────────────────────────────────────────── */
// openSettings() and renderSettingsTab() live in features.js
// Sign-out
function signOut() {
  auth.signOut().then(() => {
    window.location.href = '../../management/index.html';
  }).catch(() => {
    window.location.href = '../../management/index.html';
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Toast notifications
   ──────────────────────────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

/* ────────────────────────────────────────────────────────────────────────────
   Sidebar collapse
   ──────────────────────────────────────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
  document.getElementById('mainArea')?.classList.toggle('sidebar-collapsed');
}

/* ────────────────────────────────────────────────────────────────────────────
   Mobile "More" overlay
   ──────────────────────────────────────────────────────────────────────────── */
function openMore() { openMobileMore(); }
function openMobileMore() {
  document.getElementById('moreOverlay')?.classList.add('open');
}
function closeMobileMore() {
  document.getElementById('moreOverlay')?.classList.remove('open');
}

/* ────────────────────────────────────────────────────────────────────────────
   Overlay click-outside to close
   ──────────────────────────────────────────────────────────────────────────── */
/* Click outside overlay → close it */
function handleOverlayClick(event, overlayId) {
  if (event.target.id === overlayId) closePanel(overlayId);
}

function closePreview() {
  document.getElementById('previewOverlay')?.classList.remove('open');
}

document.addEventListener('click', (e) => {
  // Close export menu on outside click
  const menu = document.getElementById('exportMenu');
  const wrap = document.querySelector('.export-menu-wrap');
  if (menu && !wrap?.contains(e.target)) menu.style.display = 'none';
});

/* ────────────────────────────────────────────────────────────────────────────
   Keyboard shortcuts
   ──────────────────────────────────────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  // Escape closes open panels
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(o => {
      if (!o.id.includes('settings') && !o.id.includes('help')) {
        o.classList.remove('open');
      }
    });
  }
});
