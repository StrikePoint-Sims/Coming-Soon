/* ═══════════════════════════════════════════════════════════════════════════
   compute.js — All aggregation, filtering, and business logic
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Utility formatters ── */
function fmt$(n) {
  const abs = Math.abs(n || 0);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  return (n < 0 ? '-' : '') + '$' + str;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function fmtMonth(s) {
  if (!s) return '';
  const [y, m] = s.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('en-US', { month:'short', year:'numeric' });
}

function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - now) / 86400000);
}

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0,7) : '';
}

function groupAndSum(items, keyFn, valFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) || 0) + (valFn(item) || 0));
  }
  return map;
}

/* ── Category metadata lookup ── */
function categoryMeta(name) {
  const cat = State.categories.find(c => c.name === name);
  return cat || { irsLine:'', ded:'full', type:'expense' };
}

/* ── Date range resolution ── */
function resolveDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const firstOfMonth = (yr, mo) => new Date(yr, mo, 1);
  const lastOfMonth  = (yr, mo) => new Date(yr, mo+1, 0);
  const iso = d => d.toISOString().slice(0,10);

  switch (preset) {
    case 'this_month':
      return { from: iso(firstOfMonth(y,m)), to: iso(lastOfMonth(y,m)) };
    case 'last_month':
      return { from: iso(firstOfMonth(y,m-1)), to: iso(lastOfMonth(y,m-1)) };
    case 'this_quarter': {
      const q = Math.floor(m/3);
      return { from: iso(firstOfMonth(y, q*3)), to: iso(lastOfMonth(y, q*3+2)) };
    }
    case 'last_quarter': {
      const q = Math.floor(m/3) - 1;
      const yr = q < 0 ? y-1 : y;
      const qn = ((q % 4) + 4) % 4;
      return { from: iso(firstOfMonth(yr, qn*3)), to: iso(lastOfMonth(yr, qn*3+2)) };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year':
      return { from: `${y-1}-01-01`, to: `${y-1}-12-31` };
    case 'all':
      return { from: '2000-01-01', to: '2099-12-31' };
    case 'tax_year':
      return { from: `${State.currentTaxYear}-01-01`, to: `${State.currentTaxYear}-12-31` };
    case 'custom':
      return { from: customFrom || '2000-01-01', to: customTo || '2099-12-31' };
    default:
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/* ── Transaction filtering ── */
function filteredTransactions() {
  const f = State.filters;
  const { from, to } = resolveDateRange(f.preset, f.dateFrom, f.dateTo);

  return State.txns
    .filter(t => {
      if (t.status === 'draft') return false;
      if (t.date < from || t.date > to) return false;
      if (f.type && f.type !== 'all' && t.type !== f.type) return false;
      if (f.category && t.category !== f.category) return false;
      if (f.paymentMethod && t.paymentMethod !== f.paymentMethod) return false;
      if (f.reimbursement && t.reimbursementStatus !== f.reimbursement) return false;
      if (f.vendorId && t.vendorId !== f.vendorId) return false;
      if (f.customerId && t.customerId !== f.customerId) return false;
      if (f.status && t.status !== f.status) return false;
      return true;
    })
    .sort((a,b) => b.date.localeCompare(a.date));
}

/* ── KPI summary ── */
function computeSummary(txns) {
  let income = 0, expenses = 0, pendingReimbursement = 0;
  for (const t of txns) {
    if (t.status === 'review') continue;
    if (t.type === 'income') income += t.amount || 0;
    else expenses += t.amount || 0;
    if (t.reimbursementStatus === 'pending') pendingReimbursement += t.amount || 0;
  }
  return { income, expenses, net: income - expenses, pendingReimbursement };
}

/* ── Category breakdown ── */
function computeByCategory(txns) {
  const expenseTxns = txns.filter(t => t.type === 'expense');
  const totalExp = expenseTxns.reduce((s,t) => s + (t.amount||0), 0);
  const map = groupAndSum(expenseTxns, t => t.category, t => t.amount);

  return Array.from(map.entries())
    .map(([category, total]) => ({
      category,
      irsLine: categoryMeta(category).irsLine,
      total,
      count: expenseTxns.filter(t => t.category === category).length,
      pct: totalExp > 0 ? total / totalExp : 0,
    }))
    .sort((a,b) => b.total - a.total);
}

/* ── Monthly P&L ── */
function computeMonthlyPL(txns, months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const monthTxns = txns.filter(t => t.date && t.date.startsWith(key));
    const income = monthTxns.filter(t=>t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
    const expenses = monthTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+(t.amount||0),0);
    result.push({ month: key, label: fmtMonth(key+'-01'), income, expenses, net: income-expenses });
  }
  return result;
}

/* ── Running balance ── */
function computeRunningBalance(txns) {
  const sorted = [...txns]
    .filter(t => t.status !== 'review')
    .sort((a,b) => a.date.localeCompare(b.date));
  let balance = 0;
  return sorted.map(t => {
    balance += t.type === 'income' ? (t.amount||0) : -(t.amount||0);
    return { ...t, balance };
  });
}

/* ── Reimbursements ── */
function computeReimbursements(txns) {
  const personal = txns.filter(t => t.paymentMethod === 'personal');
  const pending = personal.filter(t => t.reimbursementStatus === 'pending');
  const reimbursed = personal.filter(t => t.reimbursementStatus === 'reimbursed');
  return {
    pendingItems: pending.sort((a,b) => b.date.localeCompare(a.date)),
    reimbursedItems: reimbursed.sort((a,b) => b.date.localeCompare(a.date)),
    totalPending: pending.reduce((s,t) => s+(t.amount||0), 0),
    totalReimbursed: reimbursed.reduce((s,t) => s+(t.amount||0), 0),
    totalPersonal: personal.reduce((s,t) => s+(t.amount||0), 0),
  };
}

/* ── 1099 vendor analysis ── */
function compute1099Vendors(vendors, txns, taxYear) {
  const yr = taxYear || State.taxYear;
  return vendors
    .filter(v => v.is1099Eligible)
    .map(v => {
      const ytd = txns
        .filter(t => t.vendorId === v.id && t.taxYear === yr && t.type === 'expense')
        .reduce((s,t) => s+(t.amount||0), 0);
      return { ...v, ytdPayments: ytd, needsEIN: !v.ein, threshold: 600, required: ytd >= 600 };
    })
    .sort((a,b) => b.ytdPayments - a.ytdPayments);
}

/* ── Tax deductibility summary ── */
function computeDeductibility(txns) {
  const fullItems = [], fiftyItems = [], noneItems = [];
  let fullTotal = 0, fiftyTotal = 0, noneTotal = 0;
  const expTxns = txns.filter(t => t.type === 'expense');
  for (const t of expTxns) {
    const ded = t.deductibility || (categoryMeta(t.category)||{}).ded || 'full';
    const item = { ...t, ded, deductibleAmount: ded === 'fifty_pct' ? (t.amount||0)*0.5 : ded === 'none' ? 0 : (t.amount||0) };
    if (ded === 'full') { fullItems.push(item); fullTotal += t.amount || 0; }
    else if (ded === 'fifty_pct') { fiftyItems.push(item); fiftyTotal += t.amount || 0; }
    else { noneItems.push(item); noneTotal += t.amount || 0; }
  }
  return {
    full: fullItems,
    fullTotal,
    fifty: fiftyItems,
    fiftyTotal,
    fiftyAllowed: fiftyTotal * 0.5,
    none: noneItems,
    noneTotal,
    totalAllowed: fullTotal + fiftyTotal * 0.5,
  };
}

/* ── Loan balance from payments ── */
function computeLoanBalance(loan, txns) {
  if (!loan) return 0;
  const payments = txns.filter(t => t.loanId === loan.id && t.type === 'expense');
  const principalPaid = payments.reduce((s,t) => s+(t.principalAmount||0), 0);
  return Math.max(0, (loan.originalAmount||0) - principalPaid);
}

/* ── Full loan amortization ── */
function computeLoanAmortization(loan, txns) {
  if (!loan) return { schedule:[], remainingBalance:0, totalInterestPaid:0, totalPrincipalPaid:0 };
  const payments = txns.filter(t => t.loanId === loan.id && t.type === 'expense');
  const totalInterestPaid   = payments.reduce((s,t) => s+(t.interestAmount||0), 0);
  const totalPrincipalPaid  = payments.reduce((s,t) => s+(t.principalAmount||0), 0);
  const remainingBalance    = Math.max(0, (loan.originalAmount||0) - totalPrincipalPaid);

  // Build projected schedule from start date
  const rate = (loan.interestRate||0) / 12;
  const pmt  = loan.monthlyPayment || 0;
  let balance = loan.originalAmount || 0;
  const schedule = [];
  const start = new Date(loan.startDate || new Date());
  for (let i = 0; i < (loan.termMonths || 120); i++) {
    if (balance <= 0) break;
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const month = d.toISOString().slice(0,7);
    const interest = rate > 0 ? balance * rate : 0;
    const principal = Math.min(balance, pmt - interest);
    balance = Math.max(0, balance - principal);
    schedule.push({ month, payment: pmt, interest, principal, balance });
  }
  return { schedule, remainingBalance, totalInterestPaid, totalPrincipalPaid };
}

/* ── Asset book value ── */
function computeAssetBookValue(asset) {
  if (!asset) return 0;
  if (asset.depreciationMethod === 'section179') {
    return Math.max(0, (asset.cost||0) - (asset.section179Amount||0));
  }
  if (asset.depreciationMethod === 'straight_line' && asset.usefulLifeYears > 0) {
    const annualDep = asset.cost / asset.usefulLifeYears;
    const years = (new Date().getFullYear()) - parseInt((asset.purchaseDate||'2026').slice(0,4));
    return Math.max(0, (asset.cost||0) - annualDep * years);
  }
  return asset.cost || 0;
}

function computeDepreciationSchedule(asset) {
  if (!asset || asset.depreciationMethod === 'none') return [];
  const startYear = parseInt((asset.purchaseDate||'2026').slice(0,4));
  const rows = [];
  if (asset.depreciationMethod === 'section179') {
    rows.push({ year: startYear, deduction: asset.section179Amount||0, bookValue: Math.max(0,(asset.cost||0)-(asset.section179Amount||0)) });
  } else if (asset.depreciationMethod === 'straight_line') {
    const annual = (asset.cost||0) / (asset.usefulLifeYears||1);
    let book = asset.cost || 0;
    for (let i = 0; i < (asset.usefulLifeYears||1); i++) {
      book -= annual;
      rows.push({ year: startYear + i, deduction: annual, bookValue: Math.max(0, book) });
    }
  }
  return rows;
}

/* ── Time summary ── */
function computeTimeSummary(entries) {
  const byCategory = {};
  const byWeek = {};
  const byMonth = {};
  let totalHours = 0;

  for (const e of entries) {
    const h = e.hours || 0;
    totalHours += h;

    byCategory[e.category || 'Other'] = (byCategory[e.category || 'Other'] || 0) + h;

    const weekKey = getWeekKey(e.date);
    byWeek[weekKey] = (byWeek[weekKey] || 0) + h;

    const mk = monthKey(e.date);
    byMonth[mk] = (byMonth[mk] || 0) + h;
  }

  const byCategoryArr = Object.entries(byCategory)
    .map(([cat,hrs]) => ({ category:cat, hours:hrs, pct: totalHours ? hrs/totalHours : 0 }))
    .sort((a,b) => b.hours - a.hours);

  // Last 8 weeks
  const weeks = [];
  const now = new Date();
  for (let i=7; i>=0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i*7);
    const k = getWeekKey(d.toISOString().slice(0,10));
    weeks.push({ week: k, label: 'W' + (8-i), hours: byWeek[k] || 0 });
  }

  const monthArr = Object.entries(byMonth)
    .map(([m,h]) => ({ month:m, label:fmtMonth(m+'-01'), hours:h }))
    .sort((a,b) => a.month.localeCompare(b.month));

  return { totalHours, byCategory: byCategoryArr, byWeek: weeks, byMonth: monthArr };
}

function computeMileageSummary(entries) {
  let totalMiles = 0, totalDeduction = 0;
  const byMonth = {};
  for (const e of entries) {
    totalMiles += e.miles || 0;
    totalDeduction += e.deduction || 0;
    const mk = monthKey(e.date);
    byMonth[mk] = (byMonth[mk] || { miles:0, deduction:0 });
    byMonth[mk].miles += e.miles || 0;
    byMonth[mk].deduction += e.deduction || 0;
  }
  const monthArr = Object.entries(byMonth)
    .map(([m,v]) => ({ month:m, label:fmtMonth(m+'-01'), ...v }))
    .sort((a,b) => a.month.localeCompare(b.month));
  return { totalMiles, totalDeduction, byMonth: monthArr };
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0,10);
}

/* ── Budget status ── */
function computeBudgetStatus(budgets, txns) {
  const now = new Date();
  const mk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthTxns = txns.filter(t => t.date && t.date.startsWith(mk) && t.type === 'expense');

  return budgets.map(b => {
    const actual = monthTxns
      .filter(t => t.category === b.category)
      .reduce((s,t) => s+(t.amount||0), 0);
    const pct = b.amount > 0 ? actual / b.amount : 0;
    const status = pct >= 1 ? 'over' : pct >= 0.75 ? 'warn' : 'ok';
    return { ...b, actual, pct, status };
  }).filter(b => b.amount > 0);
}

/* ── Burn rate / runway ── */
function computeBurnRate(txns, months = 3) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString().slice(0,10);
  const recent = txns.filter(t => t.type === 'expense' && t.date >= cutoff && t.status !== 'review');
  const monthlyBurn = recent.reduce((s,t) => s+(t.amount||0), 0) / Math.max(1, months);

  const FIXED_CATEGORIES = ['Rent / Lease','Insurance','Tech / Software / SaaS','Interest — Loan','Taxes & Licenses'];
  const fixedBurn = recent
    .filter(t => FIXED_CATEGORIES.includes(t.category))
    .reduce((s,t) => s+(t.amount||0), 0) / Math.max(1, months);

  return { monthlyBurn, fixedBurn, variableBurn: monthlyBurn - fixedBurn };
}

function computeRunway(burnRate, txns) {
  const inflows = txns.filter(t => t.type === 'income' || t.paymentMethod === 'owner_capital' || t.paymentMethod === 'sba');
  const outflows = txns.filter(t => t.type === 'expense');
  const currentCash = inflows.reduce((s,t) => s+(t.amount||0), 0) - outflows.reduce((s,t) => s+(t.amount||0), 0);
  const runwayMonths = burnRate.monthlyBurn > 0 ? currentCash / burnRate.monthlyBurn : Infinity;
  let runwayDate = null;
  if (isFinite(runwayMonths) && runwayMonths < 120) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.floor(runwayMonths));
    runwayDate = d.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  }
  return {
    currentCash,
    runwayMonths: Math.max(0, isFinite(runwayMonths) ? runwayMonths : Infinity),
    runwayDate,
  };
}

/* ── Quarterly tax estimate ── */
function computeQuarterlyEstimate(txns) {
  const yr = State.currentTaxYear;
  const ytdIncome = txns.filter(t => t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
  const ytdExpenses = txns.filter(t => t.type==='expense' && (t.deductibility||'full')!=='none').reduce((s,t)=>{
    const ded = t.deductibility || (categoryMeta(t.category)||{}).ded || 'full';
    return s + (ded === 'fifty_pct' ? (t.amount||0)*0.5 : (t.amount||0));
  }, 0);
  const ytdNetProfit = Math.max(0, ytdIncome - ytdExpenses);
  const seBase = ytdNetProfit * 0.9235;
  const seEstimate = seBase * 0.153;
  const federalEstimate = ytdNetProfit * 0.22;
  const quarterlyPayment = (seEstimate + federalEstimate) / 4;
  const m = new Date().getMonth() + 1;
  const currentQuarter = m <= 3 ? 1 : m <= 5 ? 2 : m <= 8 ? 3 : 4;
  return { ytdNetProfit, seEstimate, federalEstimate, quarterlyPayment, currentQuarter };
}

/* ── Balance Sheet ── */
function computeBalanceSheet(taxYear, allTxns, assets, loans) {
  // ── Current Assets ──────────────────────────────────────────
  // Estimated cash: capital in + income - expenses - draws (cumulative through year)
  const totalIncome = allTxns.filter(t=>t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
  const totalExpenses = allTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+(t.amount||0),0);
  const capitalIn    = allTxns.filter(t=>t.category==='Owner Capital Contribution').reduce((s,t)=>s+(t.amount||0),0);
  const ownerDraws   = allTxns.filter(t=>t.category==='Owner Draw').reduce((s,t)=>s+(t.amount||0),0);
  const sbaDraws     = allTxns.filter(t=>t.paymentMethod==='sba'&&t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
  const loanPrincipalPaid = allTxns.filter(t=>t.principalAmount>0).reduce((s,t)=>s+(t.principalAmount||0),0);

  // Net cash position: start with inflows, subtract outflows
  const estimatedCash = totalIncome + capitalIn + sbaDraws - totalExpenses - ownerDraws;

  // Pending reimbursements (owed back from personal card)
  const pendingReimburse = allTxns
    .filter(t=>t.paymentMethod==='personal'&&t.reimbursementStatus==='pending')
    .reduce((s,t)=>s+(t.amount||0),0);

  const currentAssets = [
    { label: 'Cash & Bank (estimated)',    value: Math.max(0, estimatedCash) },
  ];
  if (pendingReimburse > 0) {
    currentAssets.push({ label: 'Personal Card Reimbursable', value: pendingReimburse });
  }
  const totalCurrentAssets = currentAssets.reduce((s,a)=>s+a.value, 0);

  // ── Non-Current Assets ──────────────────────────────────────
  const nonCurrentAssets = assets.map(a => {
    const bv = computeAssetBookValue(a);
    return { label: a.name + ' (net book value)', value: bv.bookValue };
  });
  const totalNonCurrentAssets = nonCurrentAssets.reduce((s,a)=>s+a.value, 0);

  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  // ── Current Liabilities ──────────────────────────────────────
  // Accounts payable not formally tracked — omit (note in report)
  const currentLiabilities = [];
  const totalCurrentLiabilities = 0;

  // ── Long-Term Liabilities ────────────────────────────────────
  const longTermLiabilities = loans.map(loan => {
    const bal = computeLoanAmortization(loan, allTxns);
    return { label: loan.name, value: bal.remainingBalance };
  }).filter(l => l.value > 0);
  const totalLongTermLiabilities = longTermLiabilities.reduce((s,l)=>s+l.value, 0);

  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  // ── Owner's Equity ───────────────────────────────────────────
  const netIncome  = totalIncome - totalExpenses;
  const totalEquity = capitalIn + netIncome - ownerDraws;

  const equityItems = [
    { label: 'Owner Capital Contributions',                    value: capitalIn,  indent: true },
    { label: `Net Income / (Loss) — ${taxYear}`,              value: netIncome,   indent: true },
    { label: 'Less: Owner Draws',                              value: -ownerDraws, indent: true },
    { label: "Total Owner's Equity", value: totalEquity, isTotal: true },
  ];

  const totalLiabEquity = totalLiabilities + totalEquity;

  return {
    currentAssets, totalCurrentAssets,
    nonCurrentAssets, totalNonCurrentAssets,
    totalAssets,
    currentLiabilities, totalCurrentLiabilities,
    longTermLiabilities, totalLongTermLiabilities,
    totalLiabilities,
    equityItems, totalEquity,
    totalLiabEquity,
    // convenience
    estimatedCash, capitalIn, netIncome, ownerDraws,
  };
}

/* ── CT Sales tax ── */
function computeSalesTax(txns, rate = 0.0635) {
  const taxable = txns.filter(t => t.type === 'income' && t.isTaxable);
  const byMonth = groupAndSum(taxable, t => monthKey(t.date), t => t.amount);
  const monthly = Array.from(byMonth.entries())
    .map(([month, revenue]) => ({
      month, label: fmtMonth(month+'-01'),
      taxableRevenue: revenue,
      taxCollected: revenue * rate,
    }))
    .sort((a,b) => a.month.localeCompare(b.month));
  const totalTaxable = monthly.reduce((s,m) => s + m.taxableRevenue, 0);
  const totalTax     = monthly.reduce((s,m) => s + m.taxCollected, 0);
  return { monthly, totalTaxable, totalTax };
}

/* ── Missing receipts ── */
function computeMissingReceipts(txns, threshold = 75) {
  return txns
    .filter(t => t.type === 'expense' && (t.amount||0) >= threshold && !t.receiptData && !t.receiptUrl)
    .sort((a,b) => b.amount - a.amount);
}

/* ── Cash flow statement ── */
function computeCashFlowStatement(txns) {
  const OPERATING_CATS = ['Advertising & Marketing','Office & Admin Supplies','Utilities','Insurance',
    'Tech / Software / SaaS','Repairs & Maintenance','Contract Labor','Taxes & Licenses',
    'Meals — Business','Travel','Vehicle / Mileage','Professional Fees'];
  const INVESTING_CATS = ['Equipment (Capital)','Buildout / Improvements'];
  const FINANCING_CATS = ['Interest — Loan','Owner Draw','Owner Capital Contribution'];

  const operating = [], investing = [], financing = [];
  let opTotal = 0, invTotal = 0, finTotal = 0;

  for (const t of txns) {
    const sign = t.type === 'income' ? 1 : -1;
    const amt = sign * (t.amount || 0);
    if (INVESTING_CATS.includes(t.category)) {
      investing.push(t); invTotal += amt;
    } else if (FINANCING_CATS.includes(t.category) || t.paymentMethod === 'owner_capital' || t.paymentMethod === 'sba') {
      financing.push(t); finTotal += amt;
    } else {
      operating.push(t); opTotal += amt;
    }
  }
  return { operating, investing, financing, opTotal, invTotal, finTotal, netChange: opTotal+invTotal+finTotal };
}

/* ── Period comparison ── */
// Accepts either (txnsA, txnsB) or (allTxns, periodA, periodB) where periods have {from, to}
function computePeriodComparison(txnsA, txnsB, periodC) {
  let arrA = txnsA, arrB = txnsB;
  if (periodC !== undefined) {
    // Called as computePeriodComparison(allTxns, periodA, periodB)
    const allTxns = txnsA;
    const pA = txnsB;
    const pB = periodC;
    arrA = allTxns.filter(t => t.date >= pA.from && t.date <= pA.to);
    arrB = allTxns.filter(t => t.date >= pB.from && t.date <= pB.to);
  }
  const cats = new Set([...arrA, ...arrB].map(t => t.category));
  return Array.from(cats).map(cat => {
    const amtA = arrA.filter(t=>t.category===cat).reduce((s,t)=>s+(t.amount||0),0);
    const amtB = arrB.filter(t=>t.category===cat).reduce((s,t)=>s+(t.amount||0),0);
    const type = [...arrA,...arrB].find(t=>t.category===cat)?.type || 'expense';
    return { category:cat, amtA, amtB, a:amtA, b:amtB, type, change:amtA-amtB, changePct: amtB > 0 ? (amtA-amtB)/amtB : 0 };
  }).sort((a,b) => b.amtA - a.amtA);
}

/* ── Smart category suggestion ── */
const KEYWORD_MAP = {
  'comcast':'Utilities', 'verizon':'Utilities', 'att ':'Utilities', 'spectrum':'Utilities',
  'eversource':'Utilities', 'ui ':'Utilities', 'united illuminating':'Utilities',
  'trackman':'Tech / Software / SaaS', 'golf genius':'Tech / Software / SaaS',
  'google':'Tech / Software / SaaS', 'microsoft':'Tech / Software / SaaS',
  'zoom':'Tech / Software / SaaS', 'dropbox':'Tech / Software / SaaS',
  'carmody':'Professional Fees', 'attorney':'Professional Fees', 'law':'Professional Fees',
  'cpa':'Professional Fees', 'accountant':'Professional Fees',
  'sba':'Interest — Loan', 'liberty bank':'Interest — Loan', 'loan':'Interest — Loan',
  'usps':'Office & Admin Supplies', 'staples':'Office & Admin Supplies',
  'amazon':'Office & Admin Supplies', 'office depot':'Office & Admin Supplies',
  'insurance':'Insurance', 'travelers':'Insurance', 'hartford':'Insurance',
  'restaurant':'Meals — Business', 'dining':'Meals — Business',
  'hotel':'Travel', 'airbnb':'Travel', 'uber':'Travel', 'lyft':'Travel',
  'home depot':'Repairs & Maintenance', 'lowes':'Repairs & Maintenance',
  'advertising':'Advertising & Marketing', 'facebook ads':'Advertising & Marketing',
  'google ads':'Advertising & Marketing',
};

function suggestCategory(description) {
  const lower = (description || '').toLowerCase();
  const learned = State.settings.learnedKeywords || {};
  for (const [kw, cat] of Object.entries(learned)) {
    if (lower.includes(kw)) return cat;
  }
  for (const [kw, cat] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return null;
}

/* ── Duplicate detection ── */
function isDuplicate(candidate, existingTxns) {
  return existingTxns.some(t =>
    t.date === candidate.date &&
    Math.abs((t.amount||0) - (candidate.amount||0)) < 0.01 &&
    t.description && candidate.description &&
    t.description.toLowerCase() === candidate.description.toLowerCase() &&
    t.status !== 'draft' && t.status !== 'review'
  );
}

/* ── QuickBooks IIF export ── */
function buildIIFContent(txns, categories) {
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c.qbAccountName || c.name; });

  let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
  iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
  iif += '!ENDTRNS\n';

  txns.forEach((t, i) => {
    const date = t.date ? t.date.replace(/-/g,'/').replace(/(\d{4})\/(\d{2})\/(\d{2})/,'$2/$3/$1') : '';
    const type = t.type === 'income' ? 'INVOICE' : 'CHECK';
    const mainAcct = t.type === 'income' ? 'Undeposited Funds' : 'Business Checking';
    const splitAcct = catMap[t.category] || t.category || 'Uncategorized';
    const mainAmt = t.type === 'income' ? (t.amount||0) : -(t.amount||0);
    const splitAmt = -mainAmt;
    iif += `TRNS\t${i+1}\t${type}\t${date}\t${mainAcct}\t${t.description||''}\t${mainAmt.toFixed(2)}\t${t.notes||''}\n`;
    iif += `SPL\t${i+1}\t${type}\t${date}\t${splitAcct}\t${t.description||''}\t${splitAmt.toFixed(2)}\t${t.notes||''}\n`;
    iif += 'ENDTRNS\n';
  });
  return iif;
}

/* ── CSV export ── */
function exportCSV(headers, rows, filename) {
  const escape = v => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTransactionsCSV(txns) {
  const headers = ['Date','Type','Description','Category','IRS Line','Amount','Payment Method',
    'Deductibility','Reimbursement Status','Vendor','Customer','Interest','Principal','Notes','Has Receipt'];
  const vendorMap = {};
  State.vendors.forEach(v => vendorMap[v.id] = v.name);
  const custMap = {};
  State.customers.forEach(c => custMap[c.id] = c.name);

  const rows = txns.map(t => [
    t.date, t.type, t.description, t.category,
    categoryMeta(t.category).irsLine,
    (t.amount||0).toFixed(2),
    t.paymentMethod, t.deductibility || categoryMeta(t.category).ded,
    t.reimbursementStatus,
    vendorMap[t.vendorId] || '',
    custMap[t.customerId] || '',
    t.interestAmount || '', t.principalAmount || '',
    t.notes || '',
    (t.receiptData || t.receiptUrl) ? 'Yes' : 'No',
  ]);
  exportCSV(headers, rows, `sp-transactions-${todayStr()}.csv`);
}
