/* ═══════════════════════════════════════════════════════════════════════════
   db.js — Firestore CRUD + seeding
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Default categories (IRS Schedule C mapped) ── */
const DEFAULT_CATEGORIES = [
  // EXPENSES
  { name:'Advertising & Marketing',    type:'expense', irsLine:'8',    ded:'full'      },
  { name:'Professional Fees',          type:'expense', irsLine:'17',   ded:'full'      },
  { name:'Rent / Lease',               type:'expense', irsLine:'20',   ded:'full'      },
  { name:'Repairs & Maintenance',      type:'expense', irsLine:'21',   ded:'full'      },
  { name:'Equipment (Capital)',         type:'expense', irsLine:'Cap',  ded:'full'      },
  { name:'Buildout / Improvements',    type:'expense', irsLine:'Cap',  ded:'full'      },
  { name:'Tech / Software / SaaS',     type:'expense', irsLine:'22',   ded:'full'      },
  { name:'Insurance',                  type:'expense', irsLine:'15',   ded:'full'      },
  { name:'Utilities',                  type:'expense', irsLine:'25',   ded:'full'      },
  { name:'Office & Admin Supplies',    type:'expense', irsLine:'22',   ded:'full'      },
  { name:'Meals — Business',           type:'expense', irsLine:'24b',  ded:'fifty_pct' },
  { name:'Travel',                     type:'expense', irsLine:'24a',  ded:'full'      },
  { name:'Vehicle / Mileage',          type:'expense', irsLine:'9',    ded:'full'      },
  { name:'Interest — Loan',            type:'expense', irsLine:'16',   ded:'full'      },
  { name:'Taxes & Licenses',           type:'expense', irsLine:'23',   ded:'full'      },
  { name:'Contract Labor',             type:'expense', irsLine:'11',   ded:'full'      },
  { name:'Owner Draw',                 type:'expense', irsLine:'OD',   ded:'none'      },
  { name:'Owner Capital Contribution', type:'expense', irsLine:'OC',   ded:'none'      },
  // INCOME
  { name:'Membership Revenue',         type:'income',  irsLine:'1',    ded:'na'        },
  { name:'Walk-in / Session Revenue',  type:'income',  irsLine:'1',    ded:'na'        },
  { name:'Simulator Rental',           type:'income',  irsLine:'1',    ded:'na'        },
  { name:'Merchandise / Pro Shop',     type:'income',  irsLine:'1',    ded:'na'        },
  { name:'Other Income',               type:'income',  irsLine:'6',    ded:'na'        },
];

/* ── Default loans (pre-seeded from gantt.html data) ── */
const DEFAULT_LOANS = [
  {
    name:'SBA 7(a) Loan',
    lender:'TBD — Liberty / M&T / Dime / CT Community Bank',
    originalAmount:150000,
    interestRate:0.095,
    termMonths:120,
    startDate:'2026-07-01',
    monthlyPayment:1941,
    notes:'SBA 7(a) $150K gross / ~$147K net after fees. Submitted mid-May, funded ~early July 2026.',
  },
  {
    name:'TrackMan Equipment Financing',
    lender:'TrackMan',
    originalAmount:70485,
    interestRate:0,
    termMonths:24,
    startDate:'2027-02-01',
    monthlyPayment:2937,
    notes:'0% APR, deferred 3 months from delivery. ~$70,485 total. First payment ~Feb 2027.',
  },
];

/* ── Default recurring templates ── */
const DEFAULT_RECURRING = [
  {
    description:'SBA Loan Payment',
    category:'Interest — Loan',
    amount:1941,
    paymentMethod:'business',
    type:'expense',
    frequency:'monthly',
    dayOfMonth:1,
    active:false,
    notes:'Set active when SBA loan funds (~July 2026). Split interest/principal in More Options.',
  },
  {
    description:'Monthly Rent',
    category:'Rent / Lease',
    amount:12474,
    paymentMethod:'business',
    type:'expense',
    frequency:'monthly',
    dayOfMonth:1,
    active:false,
    notes:'Set active after lease execution (~June 2026). Amount may vary with abatement period.',
  },
];

/* ── Default time categories ── */
const DEFAULT_TIME_CATEGORIES = [
  'Business Development','Operations & Management','Marketing & Sales',
  'Finance & Accounting','Legal & Compliance','Buildout & Setup',
  'Customer Relations','Technology & Systems','Admin & Other',
];

/* ────────────────────────────────────────────────────────────────────────────
   localStorage persistence (test / no-Firebase mode)
   ──────────────────────────────────────────────────────────────────────────── */
const _LS_KEY = 'sp_accounting';
const _LS_COLLECTIONS = [
  'txns','customers','vendors','assets','loans','categories',
  'timeEntries','mileageEntries','recurringTemplates','budgets',
  'documents','membershipTiers',
];

function _saveToLS() {
  try {
    const data = { settings: State.settings || {} };
    _LS_COLLECTIONS.forEach(k => { data[k] = State[k] || []; });
    if (State.hourlyRates) data.hourlyRates = State.hourlyRates;
    localStorage.setItem(_LS_KEY, JSON.stringify(data));
  } catch(e) {}
}

function _loadFromLS() {
  try {
    const raw = localStorage.getItem(_LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    _LS_COLLECTIONS.forEach(k => { if (data[k] !== undefined) State[k] = data[k]; });
    if (data.settings) State.settings = data.settings;
    if (data.hourlyRates) State.hourlyRates = data.hourlyRates;
    return _LS_COLLECTIONS.some(k => (State[k] || []).length > 0);
  } catch(e) { return false; }
}

/* ────────────────────────────────────────────────────────────────────────────
   Seeding — runs once on first login
   ──────────────────────────────────────────────────────────────────────────── */
async function seedDefaultData() {
  const settingsRef = userRef().collection('meta').doc('settings');
  const snap = await settingsRef.get();
  if (snap.exists && snap.data().seeded) return;

  const batch = db.batch();

  DEFAULT_CATEGORIES.forEach((cat, i) => {
    const ref = col('categories').doc();
    batch.set(ref, { ...cat, isCustom:false, order:i, qbAccountName:'', createdAt:Date.now() });
  });

  DEFAULT_LOANS.forEach(loan => {
    const ref = col('loans').doc();
    batch.set(ref, { ...loan, createdAt:Date.now() });
  });

  DEFAULT_RECURRING.forEach(tmpl => {
    const ref = col('recurringTemplates').doc();
    const next = nextDueDate(tmpl.dayOfMonth, tmpl.frequency);
    batch.set(ref, { ...tmpl, nextDueDate:next, createdAt:Date.now() });
  });

  batch.set(settingsRef, {
    seeded:true,
    taxYear: new Date().getFullYear(),
    businessName:'StrikePoint Sims LLC',
    csvMapping:{},
    learnedKeywords:{},
    seededAt:Date.now(),
  });

  await batch.commit();
}

function nextDueDate(dayOfMonth, frequency) {
  const d = new Date();
  if (frequency === 'monthly') {
    d.setDate(dayOfMonth);
    if (d <= new Date()) d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'annually') {
    d.setMonth(0); d.setDate(dayOfMonth);
    if (d <= new Date()) d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────────
   Test-mode helpers — operate on in-memory State instead of Firestore
   ──────────────────────────────────────────────────────────────────────────── */

function _isTestMode() {
  return (State.user?.uid || auth.currentUser?.uid) === 'test-user-123';
}

// Map Firestore collection name → State key
const _stateKey = {
  transactions:       'txns',
  customers:          'customers',
  vendors:            'vendors',
  assets:             'assets',
  loans:              'loans',
  categories:         'categories',
  timeEntries:        'timeEntries',
  mileageEntries:     'mileageEntries',
  recurringTemplates: 'recurringTemplates',
  budgets:            'budgets',
  documents:          'documents',
  membershipTiers:    'membershipTiers',
};

function _genId() {
  return 'local_' + Math.random().toString(36).slice(2, 10);
}

function _stateArr(collection) {
  const key = _stateKey[collection] || collection;
  if (!State[key]) State[key] = [];
  return State[key];
}

/* ────────────────────────────────────────────────────────────────────────────
   Generic CRUD helpers
   ──────────────────────────────────────────────────────────────────────────── */

async function dbAdd(collection, data) {
  if (_isTestMode()) {
    const id = _genId();
    _stateArr(collection).unshift({ ...data, id, createdAt: Date.now() });
    _saveToLS();
    renderAll();
    return id;
  }
  const ref = col(collection).doc();
  await ref.set({ ...data, createdAt: Date.now() });
  return ref.id;
}

async function dbSet(collection, id, data) {
  if (_isTestMode()) {
    const arr = _stateArr(collection);
    const idx = arr.findIndex(x => x.id === id);
    if (idx > -1) Object.assign(arr[idx], data);
    _saveToLS();
    renderAll();
    return;
  }
  await col(collection).doc(id).set(data, { merge: true });
}

async function dbDelete(collection, id) {
  if (_isTestMode()) {
    const key = _stateKey[collection] || collection;
    if (State[key]) State[key] = State[key].filter(x => x.id !== id);
    _saveToLS();
    renderAll();
    return;
  }
  await col(collection).doc(id).delete();
}

async function dbGet(collection, id) {
  if (_isTestMode()) {
    return _stateArr(collection).find(x => x.id === id) || null;
  }
  const snap = await col(collection).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Transaction-specific helpers
   ──────────────────────────────────────────────────────────────────────────── */

async function saveTxn(data, id = null) {
  const taxYear = data.date ? parseInt(data.date.slice(0,4)) : new Date().getFullYear();
  const payload = { ...data, taxYear, updatedAt: Date.now() };
  if (!payload.createdAt) payload.createdAt = Date.now();
  if (id) {
    await dbSet('transactions', id, payload);
    return id;
  } else {
    return await dbAdd('transactions', payload);
  }
}

async function deleteTxn(id) {
  const txn = (State.txns || []).find(t => t.id === id);
  if (txn && txn.receiptUrl && txn.receiptFilename && !_isTestMode()) {
    await deleteReceipt(id, txn.receiptFilename).catch(() => {});
  }
  await dbDelete('transactions', id);
}

/* ────────────────────────────────────────────────────────────────────────────
   Receipt storage helpers
   ──────────────────────────────────────────────────────────────────────────── */

async function uploadReceipt(txnId, file) {
  const uid = State.user?.uid || auth.currentUser?.uid;
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const ref = storage.ref(`receipts/${uid}/${txnId}/${filename}`);
  const snap = await ref.put(file);
  const url = await snap.ref.getDownloadURL();
  return { receiptUrl: url, receiptFilename: filename };
}

async function deleteReceipt(txnId, filename) {
  const uid = State.user?.uid || auth.currentUser?.uid;
  const ref = storage.ref(`receipts/${uid}/${txnId}/${filename}`);
  await ref.delete();
}

/* ────────────────────────────────────────────────────────────────────────────
   Document vault storage
   ──────────────────────────────────────────────────────────────────────────── */

async function uploadDocument(file, name, category) {
  const uid = State.user?.uid || auth.currentUser?.uid;
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const ref = storage.ref(`documents/${uid}/${filename}`);
  const snap = await ref.put(file);
  const url = await snap.ref.getDownloadURL();
  const id = await dbAdd('documents', {
    name: name || file.name,
    category: category || 'Other',
    fileUrl: url,
    filename,
    mimeType: file.type,
    size: file.size,
    uploadedAt: Date.now(),
  });
  return id;
}

async function deleteDocument(docId, filename) {
  const uid = State.user?.uid || auth.currentUser?.uid;
  const ref = storage.ref(`documents/${uid}/${filename}`);
  await ref.delete().catch(() => {});
  await dbDelete('documents', docId);
}

/* ────────────────────────────────────────────────────────────────────────────
   Settings helpers
   ──────────────────────────────────────────────────────────────────────────── */

async function getSettings() {
  if (_isTestMode()) return State.settings || {};
  const snap = await userRef().collection('meta').doc('settings').get();
  return snap.exists ? snap.data() : {};
}

async function saveSettings(patch) {
  if (_isTestMode()) {
    if (!State.settings) State.settings = {};
    Object.assign(State.settings, patch);
    _saveToLS();
    return;
  }
  await userRef().collection('meta').doc('settings').set(patch, { merge: true });
}

async function learnKeyword(description, category, vendorName) {
  const key = (vendorName || description || '').toLowerCase().trim().slice(0, 40);
  if (!key) return;
  await saveSettings({ [`learnedKeywords.${key}`]: category });
  // also update in-memory
  if (State.settings.learnedKeywords) {
    State.settings.learnedKeywords[key] = category;
  }
}
