/* ═══════════════════════════════════════════════════════════════════════════
   charts.js — Chart.js wrapper + all chart builders
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Global Chart.js defaults ── */
function initChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = '#6b7280';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a2744';
  Chart.defaults.plugins.tooltip.titleColor       = '#fff';
  Chart.defaults.plugins.tooltip.bodyColor        = '#d1d5db';
  Chart.defaults.plugins.tooltip.padding          = 10;
  Chart.defaults.plugins.tooltip.cornerRadius     = 6;
  Chart.defaults.plugins.tooltip.callbacks.label  = ctx =>
    ' ' + fmt$(ctx.parsed.y ?? ctx.parsed);
}

/* ── Palette ── */
const CHART_COLORS = {
  blue:       '#2563eb',
  blueDim:    'rgba(37,99,235,0.12)',
  green:      '#16a34a',
  greenDim:   'rgba(22,163,74,0.12)',
  red:        '#dc2626',
  redDim:     'rgba(220,38,38,0.12)',
  amber:      '#d97706',
  amberDim:   'rgba(217,119,6,0.12)',
  navy:       '#1a2744',
  gray:       '#9ca3af',
  grayDim:    'rgba(156,163,175,0.12)',
};

const DONUT_PALETTE = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0891b2','#db2777','#65a30d','#c2410c','#4f46e5',
  '#0369a1','#15803d','#b45309','#991b1b','#6d28d9',
];

/* ────────────────────────────────────────────────────────────────────────────
   Core upsert helper — create once, update in place
   ──────────────────────────────────────────────────────────────────────────── */
function upsertChart(canvasId, type, data, options = {}) {
  if (typeof Chart === 'undefined') return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  if (!State.charts) State.charts = {};

  // Destroy stale instance if its canvas was replaced by a re-render
  if (State.charts[canvasId]) {
    const existing = State.charts[canvasId];
    const existingCanvas = existing.canvas;
    if (existingCanvas === canvas && document.contains(existingCanvas)) {
      // Same canvas still in DOM — update in place
      existing.data = data;
      existing.options = deepMergeChartOptions(existing.options, options);
      existing.update('none');
      return existing;
    } else {
      // Canvas was replaced — destroy old chart
      try { existing.destroy(); } catch(e) {}
      delete State.charts[canvasId];
    }
  }

  // Also destroy any orphaned Chart.js instance on this canvas (safety net)
  const orphan = Chart.getChart(canvas);
  if (orphan) { try { orphan.destroy(); } catch(e) {} }

  const chart = new Chart(canvas, { type, data, options });
  State.charts[canvasId] = chart;
  return chart;
}

function deepMergeChartOptions(base, override) {
  if (!override) return base;
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMergeChartOptions(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function destroyChart(canvasId) {
  if (State.charts && State.charts[canvasId]) {
    State.charts[canvasId].destroy();
    delete State.charts[canvasId];
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared axis options
   ──────────────────────────────────────────────────────────────────────────── */
function yAxisCurrency() {
  return {
    ticks: {
      callback: v => '$' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0)+'k' : v),
      color: '#9ca3af',
    },
    grid: { color: 'rgba(0,0,0,0.05)' },
    border: { display: false },
  };
}

function xAxisMonths() {
  return {
    ticks: { color: '#9ca3af', maxRotation: 0 },
    grid: { display: false },
    border: { display: false },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   1. Monthly Cash Flow — grouped bar (income vs expenses per month)
   ──────────────────────────────────────────────────────────────────────────── */
function renderCashFlowChart(canvasId, months = 6) {
  const monthly = computeMonthlyPL(State.txns, months);
  const labels  = monthly.map(m => fmtMonth(m.month));
  return upsertChart(canvasId, 'bar', {
    labels,
    datasets: [
      {
        label: 'Income',
        data: monthly.map(m => m.income),
        backgroundColor: CHART_COLORS.greenDim,
        borderColor: CHART_COLORS.green,
        borderWidth: 1.5,
        borderRadius: 4,
      },
      {
        label: 'Expenses',
        data: monthly.map(m => m.expenses),
        backgroundColor: CHART_COLORS.redDim,
        borderColor: CHART_COLORS.red,
        borderWidth: 1.5,
        borderRadius: 4,
      },
    ],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      tooltip: {
        callbacks: {
          label: ctx => ' ' + ctx.dataset.label + ': ' + fmt$(ctx.parsed.y),
        },
      },
    },
    scales: { y: yAxisCurrency(), x: xAxisMonths() },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Expenses by Category — doughnut
   ──────────────────────────────────────────────────────────────────────────── */
function renderExpenseCategoryChart(canvasId) {
  const txns   = filteredTransactions().filter(t => t.type === 'expense');
  const byCat  = computeByCategory(txns);
  const top    = byCat.slice(0, 10);
  const labels = top.map(c => c.category);
  const values = top.map(c => c.total);

  return upsertChart(canvasId, 'doughnut', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: DONUT_PALETTE.slice(0, labels.length),
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 4,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ' ' + ctx.label + ': ' + fmt$(ctx.parsed),
        },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   3. Running Balance — line chart
   ──────────────────────────────────────────────────────────────────────────── */
function renderRunningBalanceChart(canvasId) {
  const txns = filteredTransactions();
  const rows  = computeRunningBalance(txns);
  const labels = rows.map(r => fmtDate(r.date));
  const values = rows.map(r => r.balance);

  return upsertChart(canvasId, 'line', {
    labels,
    datasets: [{
      label: 'Balance',
      data: values,
      borderColor: CHART_COLORS.blue,
      backgroundColor: CHART_COLORS.blueDim,
      fill: true,
      tension: 0.3,
      pointRadius: rows.length > 60 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' Balance: ' + fmt$(ctx.parsed.y) } },
    },
    scales: { y: yAxisCurrency(), x: { ticks: { color: '#9ca3af', maxTicksLimit: 8 }, grid: { display: false }, border: { display: false } } },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   4. Hours by Category — doughnut
   ──────────────────────────────────────────────────────────────────────────── */
function renderHoursByCategoryChart(canvasId) {
  const summary = computeTimeSummary(State.timeEntries || []);
  const cats    = summary.byCategory;
  const labels  = cats.map(c => c.category);
  const values  = cats.map(c => c.hours);

  return upsertChart(canvasId, 'doughnut', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: DONUT_PALETTE.slice(0, labels.length),
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 4,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ' ' + ctx.label + ': ' + ctx.parsed.toFixed(1) + ' hrs',
        },
      },
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   5. Weekly Hours — bar chart (last 8 weeks)
   ──────────────────────────────────────────────────────────────────────────── */
function renderWeeklyHoursChart(canvasId) {
  const summary = computeTimeSummary(State.timeEntries || []);
  const weeks   = summary.byWeek;
  const labels  = weeks.map(w => {
    const d = new Date(w.week + 'T12:00:00');
    return (d.getMonth()+1) + '/' + d.getDate();
  });
  const values  = weeks.map(w => w.hours);

  return upsertChart(canvasId, 'bar', {
    labels,
    datasets: [{
      label: 'Hours',
      data: values,
      backgroundColor: CHART_COLORS.blueDim,
      borderColor: CHART_COLORS.blue,
      borderWidth: 1.5,
      borderRadius: 4,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y.toFixed(1) + ' hrs' } },
    },
    scales: {
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(0,0,0,0.05)' },
        border: { display: false },
      },
      x: xAxisMonths(),
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   6. Budget vs. Actual — horizontal grouped bar
   ──────────────────────────────────────────────────────────────────────────── */
function renderBudgetChart(canvasId) {
  const status = computeBudgetStatus(State.budgets || [], filteredTransactions());
  const active = status.filter(s => s.budget > 0).slice(0, 12);
  const labels = active.map(s => s.category);

  return upsertChart(canvasId, 'bar', {
    labels,
    datasets: [
      {
        label: 'Budget',
        data: active.map(s => s.budget),
        backgroundColor: CHART_COLORS.grayDim,
        borderColor: CHART_COLORS.gray,
        borderWidth: 1.5,
        borderRadius: 4,
      },
      {
        label: 'Actual',
        data: active.map(s => s.actual),
        backgroundColor: active.map(s =>
          s.pct > 1 ? CHART_COLORS.redDim :
          s.pct > 0.75 ? CHART_COLORS.amberDim : CHART_COLORS.greenDim
        ),
        borderColor: active.map(s =>
          s.pct > 1 ? CHART_COLORS.red :
          s.pct > 0.75 ? CHART_COLORS.amber : CHART_COLORS.green
        ),
        borderWidth: 1.5,
        borderRadius: 4,
      },
    ],
  }, {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmt$(ctx.parsed.x) } },
    },
    scales: {
      x: {
        ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v), color: '#9ca3af' },
        grid: { color: 'rgba(0,0,0,0.05)' },
        border: { display: false },
      },
      y: { ticks: { color: '#6b7280' }, grid: { display: false }, border: { display: false } },
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   7. Runway Projection — line chart (current cash declining at burn rate)
   ──────────────────────────────────────────────────────────────────────────── */
function renderRunwayChart(canvasId) {
  const txns    = State.txns || [];
  const burnData = computeBurnRate(txns, 3);
  const runway  = computeRunway(burnData, txns);
  const { currentCash, runwayMonths } = runway;
  const monthlyBurn = burnData.monthlyBurn;

  const months = Math.min(Math.ceil(runwayMonths) + 2, 18);
  const labels = [];
  const values = [];
  const now = new Date();
  for (let i = 0; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(fmtMonth(d.toISOString().slice(0,7)));
    values.push(Math.max(0, currentCash - monthlyBurn * i));
  }

  const zeroIdx = values.findIndex(v => v === 0);

  return upsertChart(canvasId, 'line', {
    labels,
    datasets: [{
      label: 'Projected Cash',
      data: values,
      borderColor: monthlyBurn > 0 && runwayMonths < 3 ? CHART_COLORS.red : CHART_COLORS.blue,
      backgroundColor: monthlyBurn > 0 && runwayMonths < 3 ? CHART_COLORS.redDim : CHART_COLORS.blueDim,
      fill: true,
      tension: 0.2,
      pointRadius: 3,
      borderWidth: 2,
    }],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' Projected: ' + fmt$(ctx.parsed.y) } },
      annotation: zeroIdx >= 0 ? {} : {},
    },
    scales: { y: yAxisCurrency(), x: xAxisMonths() },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   8. Period Comparison — grouped bar
   ──────────────────────────────────────────────────────────────────────────── */
function renderPeriodComparisonChart(canvasId, periodA, periodB) {
  const comp   = computePeriodComparison(State.txns || [], periodA, periodB);
  const items  = comp.slice(0, 15);
  const labels = items.map(r => r.category);

  return upsertChart(canvasId, 'bar', {
    labels,
    datasets: [
      {
        label: periodA.label || 'Period A',
        data: items.map(r => r.amtA),
        backgroundColor: CHART_COLORS.blueDim,
        borderColor: CHART_COLORS.blue,
        borderWidth: 1.5,
        borderRadius: 4,
      },
      {
        label: periodB.label || 'Period B',
        data: items.map(r => r.amtB),
        backgroundColor: CHART_COLORS.grayDim,
        borderColor: CHART_COLORS.gray,
        borderWidth: 1.5,
        borderRadius: 4,
      },
    ],
  }, {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmt$(ctx.parsed.y) } },
    },
    scales: { y: yAxisCurrency(), x: xAxisMonths() },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   9. Expense by Category — horizontal bar for Reports view
   ──────────────────────────────────────────────────────────────────────────── */
function renderExpenseByCategoryChart(canvasId, byCat) {
  const top    = (byCat || []).slice(0, 15);
  const labels = top.map(c => c.category);
  const values = top.map(c => c.total);

  return upsertChart(canvasId, 'bar', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: DONUT_PALETTE.slice(0, labels.length).map(c => c + '33'),
      borderColor: DONUT_PALETTE.slice(0, labels.length),
      borderWidth: 1.5,
      borderRadius: 4,
    }],
  }, {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' ' + fmt$(ctx.parsed.x) } },
    },
    scales: {
      x: {
        ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v), color: '#9ca3af' },
        grid: { color: 'rgba(0,0,0,0.05)' },
        border: { display: false },
      },
      y: { ticks: { color: '#6b7280' }, grid: { display: false }, border: { display: false } },
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Donut legend helper (renders below chart in reports)
   ──────────────────────────────────────────────────────────────────────────── */
function renderDonutLegend(containerId, labels, values, total) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = labels.map((lbl, i) => {
    const pct = total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0.0';
    return `<div class="legend-row">
      <span class="legend-dot" style="background:${DONUT_PALETTE[i % DONUT_PALETTE.length]}"></span>
      <span class="legend-label">${lbl}</span>
      <span class="legend-val">${fmt$(values[i])}</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderHoursLegend(containerId, byCategory) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const total = byCategory.reduce((s, c) => s + c.hours, 0);
  el.innerHTML = byCategory.map((c, i) => {
    const pct = total > 0 ? ((c.hours / total) * 100).toFixed(1) : '0.0';
    return `<div class="legend-row">
      <span class="legend-dot" style="background:${DONUT_PALETTE[i % DONUT_PALETTE.length]}"></span>
      <span class="legend-label">${c.category}</span>
      <span class="legend-val">${c.hours.toFixed(1)} hrs</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');
}
