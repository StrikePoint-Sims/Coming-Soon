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
    lender:'M&T Bank',
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
  await dbDelete('transactions', id);
}

/* ────────────────────────────────────────────────────────────────────────────
   Receipt storage — images processed client-side and stored in Firestore
   ──────────────────────────────────────────────────────────────────────────── */

const MAX_RECEIPT_BYTES = 700000; // ~700 KB base64 leaves headroom for other transaction fields under 1 MB Firestore limit

// Returns { data: base64DataURI, mime: string }
function processReceiptFile(file) {
  if (file.type === 'application/pdf') {
    return _processPDF(file);
  } else if (file.type.startsWith('image/')) {
    return _processImage(file);
  }
  return Promise.reject(new Error('Only JPG, PNG, or PDF files are supported.'));
}

async function _processPDF(file) {
  // Small PDFs (≤ 524 KB raw → ≤ ~700 KB base64): store as native PDF for full fidelity
  if (file.size <= 524000) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read PDF'));
      reader.readAsDataURL(file);
    });
    if (data.length <= MAX_RECEIPT_BYTES) return { data, mime: 'application/pdf' };
  }
  // Oversized: render pages to a compressed grayscale image automatically
  return _renderPDFToImage(file);
}

async function _loadPDFJS() {
  if (window.pdfjsLib) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load PDF renderer. Check your connection and try again.'));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

async function _renderPDFToImage(file) {
  await _loadPDFJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Render each page at 1.5× scale (~150 DPI for letter size, readable text)
  const pageCanvases = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    pageCanvases.push(canvas);
  }

  // Stitch pages vertically with an 8 px white gap
  const GAP = 8;
  const rawW = Math.max(...pageCanvases.map(c => c.width));
  const rawH = pageCanvases.reduce((s, c) => s + c.height, 0) + GAP * (pageCanvases.length - 1);

  // Scale down so longest side ≤ 1200 px
  const scale = Math.min(1, 1200 / Math.max(rawW, rawH));
  const finalW = Math.round(rawW * scale);
  const finalH = Math.round(rawH * scale);

  const combined = document.createElement('canvas');
  combined.width = finalW; combined.height = finalH;
  const ctx = combined.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, finalW, finalH);

  let y = 0;
  for (const pc of pageCanvases) {
    const h = Math.round(pc.height * scale);
    ctx.drawImage(pc, 0, y, Math.round(pc.width * scale), h);
    y += h + Math.round(GAP * scale);
  }

  // Grayscale pass
  const id = ctx.getImageData(0, 0, finalW, finalH);
  for (let i = 0; i < id.data.length; i += 4) {
    const g = id.data[i] * 0.299 + id.data[i + 1] * 0.587 + id.data[i + 2] * 0.114;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = g;
  }
  ctx.putImageData(id, 0, 0);

  // Progressive quality reduction until it fits
  for (const q of [0.72, 0.55, 0.40, 0.25]) {
    const data = combined.toDataURL('image/jpeg', q);
    if (data.length <= MAX_RECEIPT_BYTES) return { data, mime: 'image/jpeg' };
  }
  throw new Error(`PDF rendered to ${pdf.numPages} page(s) but is still too large. Try fewer pages or a smaller source file.`);
}

function _processImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1200;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else       { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const g = d.data[i] * 0.299 + d.data[i + 1] * 0.587 + d.data[i + 2] * 0.114;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = g;
      }
      ctx.putImageData(d, 0, 0);
      // Try progressively lower quality until under the size limit
      for (const q of [0.72, 0.55, 0.40, 0.25]) {
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length <= MAX_RECEIPT_BYTES) { resolve({ data, mime: 'image/jpeg' }); return; }
      }
      reject(new Error('Receipt image is too large to store even after compression. Try a lower-resolution photo.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

async function uploadReceipt(txnId, receiptData, receiptMime, filename) {
  if (receiptData.length > MAX_RECEIPT_BYTES) {
    throw new Error('File is too large to store. Try a compressed version or a photo.');
  }
  await dbSet('transactions', txnId, { receiptData, receiptMime, receiptFilename: filename, receiptUrl: '' });
  return { receiptData, receiptMime, receiptFilename: filename };
}

async function deleteReceipt(txnId) {
  await dbSet('transactions', txnId, { receiptData: '', receiptFilename: '', receiptUrl: '' });
}

/* ────────────────────────────────────────────────────────────────────────────
   Document vault storage
   ──────────────────────────────────────────────────────────────────────────── */

async function uploadDocument(file, name, category) {
  throw new Error('Document vault uploads are not available without Firebase Storage.');
}

async function deleteDocument(docId, filename) {
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
