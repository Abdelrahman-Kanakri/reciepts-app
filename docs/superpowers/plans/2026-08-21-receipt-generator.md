# Receipt Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable, offline-capable static web app (HTML/CSS/vanilla JS) that generates professional, print-ready receipts themed after abdk.me, with a local history of past receipts.

**Architecture:** Three plain HTML pages (History, New Receipt, Receipt View) share two dependency-free pure-logic modules (`storage.js` for localStorage persistence, `calc.js` for money math) loaded via ordinary `<script>` tags — no bundler, no framework, no ES modules (so it still works opened straight from disk over `file://`). A manifest + service worker make it installable; the receipt page uses the browser's native print-to-PDF instead of a bundled PDF library.

**Tech Stack:** HTML5, CSS3, vanilla JS (ES2020), Web App Manifest, Service Worker API. Dev-only: Node's built-in test runner (`node:test`) for the two pure-logic modules, Playwright CLI (via `npx`, not installed as a dependency) for one-time icon generation and end-to-end verification.

---

## File Structure

```
/index.html          History page (list of saved receipts)
/new.html             Receipt form
/receipt.html         Receipt view / print page
/style.css            Dark app-shell theme (index.html, new.html) — abdk.me tokens
/receipt.css          Light, print-safe theme (receipt.html only)
/storage.js           Pure localStorage CRUD + id/receipt-number generation (UMD: browser global + Node module.exports)
/calc.js              Pure money math (UMD: browser global + Node module.exports)
/storage.test.js       node:test suite for storage.js
/calc.test.js          node:test suite for calc.js
/history.js            index.html page controller (DOM wiring, depends on storage.js + calc.js)
/form.js               new.html page controller (depends on storage.js + calc.js)
/receipt-view.js       receipt.html page controller (depends on storage.js + calc.js)
/pwa.js                Shared service-worker registration snippet (all 3 pages)
/sw.js                 Service worker (cache-first, precaches all app files)
/manifest.json         Web App Manifest
/icons/icon-192.png    Generated app icon
/icons/icon-512.png    Generated app icon
/icons/icon-180.png    Generated apple-touch-icon
/tools/icon-source.html  Source page screenshotted to produce the icons
/README.md              Usage + hosting/install + regenerating icons + running tests
```

`storage.js` and `calc.js` never touch the DOM — they're the only files with automated tests. The three page-controller files (`history.js`, `form.js`, `receipt-view.js`) are thin DOM glue, verified manually in a browser plus one end-to-end Playwright pass at the end, matching how much test weight thin wiring code actually needs.

---

## Task 1: `storage.js` — persistence layer

**Files:**
- Create: `storage.js`
- Create: `storage.test.js`

- [ ] **Step 1: Write the failing test suite**

Create `storage.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const ReceiptStorage = require('./storage.js');

function makeFakeStore() {
  const data = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

test('getReceipts returns an empty array by default', () => {
  const store = makeFakeStore();
  assert.deepEqual(ReceiptStorage.getReceipts(store), []);
});

test('saveReceipt adds a new receipt', () => {
  const store = makeFakeStore();
  ReceiptStorage.saveReceipt({ id: 'a1', total: 10 }, store);
  assert.equal(ReceiptStorage.getReceipts(store).length, 1);
  assert.equal(ReceiptStorage.getReceipt('a1', store).total, 10);
});

test('saveReceipt updates an existing receipt by id', () => {
  const store = makeFakeStore();
  ReceiptStorage.saveReceipt({ id: 'a1', total: 10 }, store);
  ReceiptStorage.saveReceipt({ id: 'a1', total: 25 }, store);
  const receipts = ReceiptStorage.getReceipts(store);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].total, 25);
});

test('deleteReceipt removes the matching receipt', () => {
  const store = makeFakeStore();
  ReceiptStorage.saveReceipt({ id: 'a1' }, store);
  ReceiptStorage.saveReceipt({ id: 'a2' }, store);
  ReceiptStorage.deleteReceipt('a1', store);
  const receipts = ReceiptStorage.getReceipts(store);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].id, 'a2');
});

test('getReceipt returns undefined when not found', () => {
  const store = makeFakeStore();
  assert.equal(ReceiptStorage.getReceipt('missing', store), undefined);
});

test('getLastIssuer defaults to null, setLastIssuer round-trips', () => {
  const store = makeFakeStore();
  assert.equal(ReceiptStorage.getLastIssuer(store), null);
  ReceiptStorage.setLastIssuer({ name: 'Abdelrahman', email: 'a@example.com' }, store);
  assert.deepEqual(ReceiptStorage.getLastIssuer(store), { name: 'Abdelrahman', email: 'a@example.com' });
});

test('nextReceiptNumber increments and formats with the current year', () => {
  const store = makeFakeStore();
  const year = new Date().getFullYear();
  assert.equal(ReceiptStorage.nextReceiptNumber(store), `R-${year}-0001`);
  assert.equal(ReceiptStorage.nextReceiptNumber(store), `R-${year}-0002`);
});

test('generateId returns a non-empty, unique string', () => {
  const first = ReceiptStorage.generateId();
  const second = ReceiptStorage.generateId();
  assert.equal(typeof first, 'string');
  assert.ok(first.length > 0);
  assert.notEqual(first, second);
});
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `node --test storage.test.js`
Expected: fails immediately with `Cannot find module './storage.js'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `storage.js`:

```js
(function (global) {
  'use strict';

  var RECEIPTS_KEY = 'receipts';
  var LAST_ISSUER_KEY = 'lastIssuer';
  var COUNTER_KEY = 'receiptCounter';

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function readJSON(store, key, fallback) {
    var raw = store.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(store, key, value) {
    store.setItem(key, JSON.stringify(value));
  }

  function getReceipts(store) {
    store = store || global.localStorage;
    return readJSON(store, RECEIPTS_KEY, []);
  }

  function getReceipt(id, store) {
    store = store || global.localStorage;
    var receipts = getReceipts(store);
    for (var i = 0; i < receipts.length; i++) {
      if (receipts[i].id === id) return receipts[i];
    }
    return undefined;
  }

  function saveReceipt(receipt, store) {
    store = store || global.localStorage;
    var receipts = getReceipts(store);
    var index = -1;
    for (var i = 0; i < receipts.length; i++) {
      if (receipts[i].id === receipt.id) { index = i; break; }
    }
    if (index === -1) {
      receipts.push(receipt);
    } else {
      receipts[index] = receipt;
    }
    writeJSON(store, RECEIPTS_KEY, receipts);
  }

  function deleteReceipt(id, store) {
    store = store || global.localStorage;
    var receipts = getReceipts(store).filter(function (r) { return r.id !== id; });
    writeJSON(store, RECEIPTS_KEY, receipts);
  }

  function getLastIssuer(store) {
    store = store || global.localStorage;
    return readJSON(store, LAST_ISSUER_KEY, null);
  }

  function setLastIssuer(issuer, store) {
    store = store || global.localStorage;
    writeJSON(store, LAST_ISSUER_KEY, issuer);
  }

  function nextReceiptNumber(store) {
    store = store || global.localStorage;
    var counter = readJSON(store, COUNTER_KEY, 0) + 1;
    writeJSON(store, COUNTER_KEY, counter);
    var year = new Date().getFullYear();
    var padded = String(counter).padStart(4, '0');
    return 'R-' + year + '-' + padded;
  }

  var ReceiptStorage = {
    generateId: generateId,
    getReceipts: getReceipts,
    getReceipt: getReceipt,
    saveReceipt: saveReceipt,
    deleteReceipt: deleteReceipt,
    getLastIssuer: getLastIssuer,
    setLastIssuer: setLastIssuer,
    nextReceiptNumber: nextReceiptNumber
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptStorage;
  } else {
    global.ReceiptStorage = ReceiptStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `node --test storage.test.js`
Expected: `# pass 8`, `# fail 0`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add storage.js storage.test.js
git commit -m "feat: add receipt storage (localStorage CRUD)"
```

---

## Task 2: `calc.js` — money math

**Files:**
- Create: `calc.js`
- Create: `calc.test.js`

- [ ] **Step 1: Write the failing test suite**

Create `calc.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const ReceiptCalc = require('./calc.js');

test('lineTotal multiplies qty by unit price', () => {
  assert.equal(ReceiptCalc.lineTotal(3, 9.5), 28.5);
});

test('lineTotal rounds to 2 decimal places', () => {
  assert.equal(ReceiptCalc.lineTotal(3, 0.1), 0.3);
});

test('computeTotal sums line totals across items', () => {
  const items = [
    { qty: 2, unitPrice: 10 },
    { qty: 1, unitPrice: 5.5 }
  ];
  assert.equal(ReceiptCalc.computeTotal(items), 25.5);
});

test('computeTotal returns 0 for an empty item list', () => {
  assert.equal(ReceiptCalc.computeTotal([]), 0);
});

test('formatCurrency prefixes the symbol and pads to 2 decimals', () => {
  assert.equal(ReceiptCalc.formatCurrency(9), '$9.00');
  assert.equal(ReceiptCalc.formatCurrency(12.5), '$12.50');
});
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `node --test calc.test.js`
Expected: fails with `Cannot find module './calc.js'`.

- [ ] **Step 3: Write the implementation**

Create `calc.js`:

```js
(function (global) {
  'use strict';

  var CURRENCY_SYMBOL = '$';

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function lineTotal(qty, unitPrice) {
    return round2(Number(qty) * Number(unitPrice));
  }

  function computeTotal(items) {
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      sum += lineTotal(items[i].qty, items[i].unitPrice);
    }
    return round2(sum);
  }

  function formatCurrency(amount) {
    return CURRENCY_SYMBOL + Number(amount).toFixed(2);
  }

  var ReceiptCalc = {
    CURRENCY_SYMBOL: CURRENCY_SYMBOL,
    lineTotal: lineTotal,
    computeTotal: computeTotal,
    formatCurrency: formatCurrency
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptCalc;
  } else {
    global.ReceiptCalc = ReceiptCalc;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

`CURRENCY_SYMBOL` is the one place to change if `$` isn't the right currency later.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `node --test calc.test.js`
Expected: `# pass 5`, `# fail 0`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add calc.js calc.test.js
git commit -m "feat: add receipt money math"
```

---

## Task 3: History page (`index.html`, `style.css`, `history.js`)

**Files:**
- Create: `style.css`
- Create: `index.html`
- Create: `history.js`

- [ ] **Step 1: Write the shared dark app-shell stylesheet**

Create `style.css`:

```css
:root {
  --bg-primary: hsl(228, 25%, 4%);
  --bg-secondary: hsl(228, 20%, 7%);
  --bg-tertiary: hsl(228, 18%, 10%);
  --bg-glass: hsla(228, 20%, 13%, 0.5);
  --accent: hsl(217, 95%, 60%);
  --accent-dim: hsl(225, 80%, 40%);
  --accent-glow: hsla(217, 95%, 60%, 0.15);
  --accent-warm: hsl(195, 90%, 60%);
  --text-primary: hsl(220, 25%, 96%);
  --text-muted: hsl(225, 12%, 52%);
  --border: hsla(217, 50%, 50%, 0.1);
  --border-hover: hsla(217, 70%, 60%, 0.25);
  --danger: hsl(4, 80%, 60%);

  --font-display: "Syne", sans-serif;
  --font-body: "Outfit", sans-serif;

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  --space-xl: 4rem;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;

  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.4);
  --blur-glass: blur(16px);
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.5;
  min-height: 100vh;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 700;
  margin: 0 0 var(--space-sm);
}

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md) var(--space-xl);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.3rem;
  color: var(--text-primary);
  text-decoration: none;
}
.brand span { color: var(--accent); }

.glass-card {
  background: var(--bg-glass);
  backdrop-filter: var(--blur-glass);
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  transition: var(--transition);
}
.glass-card:hover { border-color: var(--border-hover); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.6rem;
  border-radius: 999px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-dim));
  color: var(--bg-primary);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px var(--accent-glow);
}
.btn-outline {
  background: transparent;
  color: var(--accent);
  border: 2px solid var(--accent);
  padding: 0.65rem 1.55rem;
}
.btn-outline:hover {
  background: var(--accent);
  color: var(--bg-primary);
}
.btn-danger {
  background: transparent;
  color: var(--danger);
  border: 2px solid var(--danger);
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
}
.btn-danger:hover {
  background: var(--danger);
  color: var(--bg-primary);
}
.btn-sm { padding: 0.4rem 1rem; font-size: 0.8rem; }

label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: var(--space-xs);
  margin-top: var(--space-md);
}
input, select, textarea {
  width: 100%;
  padding: 0.7rem 0.9rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.95rem;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}
fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin: 0 0 var(--space-md);
}
legend {
  font-family: var(--font-display);
  font-weight: 600;
  padding: 0 var(--space-sm);
  color: var(--accent);
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}
.history-item .who { font-weight: 600; }
.history-item .meta { color: var(--text-muted); font-size: 0.85rem; }
.history-item .amount { font-family: var(--font-display); font-weight: 700; color: var(--accent-warm); }
.history-actions { display: flex; gap: var(--space-sm); }

.empty-state { text-align: center; color: var(--text-muted); padding: var(--space-xl) var(--space-md); }

.items-table { width: 100%; border-collapse: collapse; margin-top: var(--space-sm); }
.items-table th { text-align: left; font-size: 0.8rem; color: var(--text-muted); font-weight: 500; padding-bottom: var(--space-xs); }
.items-table td { padding: var(--space-xs) var(--space-xs) var(--space-xs) 0; vertical-align: top; }
.items-table input { padding: 0.5rem 0.6rem; }
.col-desc { width: 45%; }
.col-qty { width: 12%; }
.col-price { width: 18%; }
.col-total { width: 18%; text-align: right; padding-right: var(--space-sm); color: var(--text-muted); }
.col-remove { width: 7%; }

.remove-row {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}
.remove-row:hover { color: var(--danger); }

.totals-row {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  align-items: baseline;
  margin-top: var(--space-md);
  font-family: var(--font-display);
}
.totals-row .grand { font-size: 1.4rem; font-weight: 700; color: var(--accent); }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

@media (max-width: 480px) {
  .container { padding: var(--space-md); }
  .col-desc { width: 40%; }
}
```

- [ ] **Step 2: Write `index.html`**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipts</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="hsl(217, 95%, 60%)" />
<link rel="apple-touch-icon" href="icons/icon-180.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="container">
  <div class="topbar">
    <span class="brand">Receipt<span>s</span></span>
    <a class="btn btn-primary" href="new.html">+ New Receipt</a>
  </div>

  <div id="historyList"></div>
  <div id="emptyState" class="empty-state glass-card" hidden>
    <p>No receipts yet.</p>
    <a class="btn btn-outline" href="new.html">Create your first receipt</a>
  </div>
</div>

<script src="storage.js"></script>
<script src="calc.js"></script>
<script src="pwa.js"></script>
<script src="history.js"></script>
</body>
</html>
```

Note: `pwa.js` doesn't exist yet (Task 7) — the `<script>` tag pointing at it is harmless until then; the browser just gets a 404 for that one file with no effect on the rest of the page.

- [ ] **Step 3: Write `history.js`**

Create `history.js`:

```js
(function () {
  'use strict';

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    var list = document.getElementById('historyList');
    var empty = document.getElementById('emptyState');
    var receipts = ReceiptStorage.getReceipts().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    list.innerHTML = '';

    if (receipts.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    receipts.forEach(function (receipt) {
      var card = el('div', 'glass-card history-item');

      var info = el('div');
      info.appendChild(el('div', 'who', receipt.counterparty.name || 'Unnamed client'));
      info.appendChild(el('div', 'meta', receipt.receiptNumber + ' · ' + receipt.date));
      card.appendChild(info);

      card.appendChild(el('div', 'amount', ReceiptCalc.formatCurrency(receipt.total)));

      var actions = el('div', 'history-actions');

      var openLink = el('a', 'btn btn-outline btn-sm', 'Open');
      openLink.href = 'receipt.html?id=' + encodeURIComponent(receipt.id);
      actions.appendChild(openLink);

      var dupLink = el('a', 'btn btn-outline btn-sm', 'Duplicate');
      dupLink.href = 'new.html?duplicate=' + encodeURIComponent(receipt.id);
      actions.appendChild(dupLink);

      var delBtn = el('button', 'btn btn-danger btn-sm', 'Delete');
      delBtn.addEventListener('click', function () {
        if (confirm('Delete receipt ' + receipt.receiptNumber + '? This cannot be undone.')) {
          ReceiptStorage.deleteReceipt(receipt.id);
          render();
        }
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
```

- [ ] **Step 4: Manually verify in a browser**

Run: `python -m http.server 8080` from the project root, then open `http://localhost:8080/`.
Expected: dark themed page, "Receipts" brand top-left, "+ New Receipt" button top-right, empty-state card reading "No receipts yet." (since `localStorage` is empty). Open devtools console — no errors (the `pwa.js` 404 is expected and harmless at this point).

- [ ] **Step 5: Commit**

```bash
git add style.css index.html history.js
git commit -m "feat: add history page"
```

---

## Task 4: New Receipt form (`new.html`, `form.js`)

**Files:**
- Create: `new.html`
- Create: `form.js`

- [ ] **Step 1: Write `new.html`**

Create `new.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>New Receipt · Receipts</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="hsl(217, 95%, 60%)" />
<link rel="apple-touch-icon" href="icons/icon-180.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="container">
  <div class="topbar">
    <a class="brand" href="index.html">Receipt<span>s</span></a>
  </div>

  <form id="receiptForm">
    <fieldset class="glass-card">
      <legend>Your info</legend>
      <label for="myRole">I am the</label>
      <select id="myRole">
        <option value="Provider">Provider (I'm selling / providing)</option>
        <option value="Client">Client (I'm buying)</option>
      </select>
      <label for="issuerName">Your name</label>
      <input id="issuerName" required />
      <label for="issuerEmail">Your email</label>
      <input id="issuerEmail" type="email" required />
    </fieldset>

    <fieldset class="glass-card">
      <legend>Other party</legend>
      <label for="counterName">Their name</label>
      <input id="counterName" required />
      <label for="counterEmail">Their email</label>
      <input id="counterEmail" type="email" />
    </fieldset>

    <div class="glass-card">
      <h3>Items</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-desc">Description</th>
            <th class="col-qty">Qty</th>
            <th class="col-price">Unit price</th>
            <th class="col-total">Line total</th>
            <th class="col-remove"></th>
          </tr>
        </thead>
        <tbody id="itemRows"></tbody>
      </table>
      <button type="button" id="addItemBtn" class="btn btn-outline btn-sm">+ Add item</button>

      <div class="totals-row">
        <span>Total</span>
        <span class="grand" id="grandTotal">$0.00</span>
      </div>
    </div>

    <fieldset class="glass-card">
      <legend>Notes</legend>
      <textarea id="notes" rows="3" placeholder="Optional"></textarea>
    </fieldset>

    <div class="form-actions">
      <a class="btn btn-outline" href="index.html">Cancel</a>
      <button type="submit" class="btn btn-primary">Generate Receipt</button>
    </div>
  </form>
</div>

<template id="itemRowTemplate">
  <tr class="item-row">
    <td class="col-desc"><input class="item-desc" required /></td>
    <td class="col-qty"><input class="item-qty" type="number" min="0" step="1" value="1" required /></td>
    <td class="col-price"><input class="item-price" type="number" min="0" step="0.01" value="0" required /></td>
    <td class="col-total item-line-total">$0.00</td>
    <td class="col-remove"><button type="button" class="remove-row" title="Remove item">&times;</button></td>
  </tr>
</template>

<script src="storage.js"></script>
<script src="calc.js"></script>
<script src="pwa.js"></script>
<script src="form.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `form.js`**

Create `form.js`:

```js
(function () {
  'use strict';

  var itemRowsEl, grandTotalEl, addItemBtn, form, myRoleSelect;

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function addItemRow(item) {
    var template = document.getElementById('itemRowTemplate');
    var row = template.content.firstElementChild.cloneNode(true);

    var descInput = row.querySelector('.item-desc');
    var qtyInput = row.querySelector('.item-qty');
    var priceInput = row.querySelector('.item-price');

    if (item) {
      descInput.value = item.description || '';
      qtyInput.value = item.qty;
      priceInput.value = item.unitPrice;
    }

    row.querySelector('.remove-row').addEventListener('click', function () {
      row.remove();
      recalcTotal();
    });
    [qtyInput, priceInput].forEach(function (input) {
      input.addEventListener('input', function () {
        updateLineTotal(row);
        recalcTotal();
      });
    });

    itemRowsEl.appendChild(row);
    updateLineTotal(row);
  }

  function updateLineTotal(row) {
    var qty = Number(row.querySelector('.item-qty').value) || 0;
    var price = Number(row.querySelector('.item-price').value) || 0;
    row.querySelector('.item-line-total').textContent = ReceiptCalc.formatCurrency(ReceiptCalc.lineTotal(qty, price));
  }

  function recalcTotal() {
    grandTotalEl.textContent = ReceiptCalc.formatCurrency(ReceiptCalc.computeTotal(collectItems()));
  }

  function collectItems() {
    var rows = itemRowsEl.querySelectorAll('.item-row');
    var items = [];
    rows.forEach(function (row) {
      items.push({
        description: row.querySelector('.item-desc').value,
        qty: Number(row.querySelector('.item-qty').value) || 0,
        unitPrice: Number(row.querySelector('.item-price').value) || 0
      });
    });
    return items;
  }

  function prefillFromLastIssuer() {
    var lastIssuer = ReceiptStorage.getLastIssuer();
    if (lastIssuer) {
      document.getElementById('issuerName').value = lastIssuer.name || '';
      document.getElementById('issuerEmail').value = lastIssuer.email || '';
    }
  }

  function prefillFromDuplicate(id) {
    var receipt = ReceiptStorage.getReceipt(id);
    if (!receipt) return;
    myRoleSelect.value = receipt.issuer.role;
    document.getElementById('issuerName').value = receipt.issuer.name;
    document.getElementById('issuerEmail').value = receipt.issuer.email;
    document.getElementById('counterName').value = receipt.counterparty.name;
    document.getElementById('counterEmail').value = receipt.counterparty.email;
    document.getElementById('notes').value = receipt.notes || '';
    itemRowsEl.innerHTML = '';
    receipt.items.forEach(addItemRow);
    recalcTotal();
  }

  function handleSubmit(event) {
    event.preventDefault();
    var items = collectItems();
    if (items.length === 0) {
      alert('Add at least one item.');
      return;
    }

    var myRole = myRoleSelect.value;
    var counterRole = myRole === 'Provider' ? 'Client' : 'Provider';

    var issuer = {
      name: document.getElementById('issuerName').value,
      email: document.getElementById('issuerEmail').value,
      role: myRole
    };
    var counterparty = {
      name: document.getElementById('counterName').value,
      email: document.getElementById('counterEmail').value,
      role: counterRole
    };

    var receipt = {
      id: ReceiptStorage.generateId(),
      receiptNumber: ReceiptStorage.nextReceiptNumber(),
      date: new Date().toISOString().slice(0, 10),
      issuer: issuer,
      counterparty: counterparty,
      items: items,
      notes: document.getElementById('notes').value,
      total: ReceiptCalc.computeTotal(items)
    };

    ReceiptStorage.saveReceipt(receipt);
    ReceiptStorage.setLastIssuer({ name: issuer.name, email: issuer.email });

    window.location.href = 'receipt.html?id=' + encodeURIComponent(receipt.id);
  }

  document.addEventListener('DOMContentLoaded', function () {
    itemRowsEl = document.getElementById('itemRows');
    grandTotalEl = document.getElementById('grandTotal');
    addItemBtn = document.getElementById('addItemBtn');
    form = document.getElementById('receiptForm');
    myRoleSelect = document.getElementById('myRole');

    addItemBtn.addEventListener('click', function () { addItemRow(); recalcTotal(); });
    form.addEventListener('submit', handleSubmit);

    prefillFromLastIssuer();

    var duplicateId = getQueryParam('duplicate');
    if (duplicateId) {
      prefillFromDuplicate(duplicateId);
    } else {
      addItemRow();
      recalcTotal();
    }
  });
})();
```

- [ ] **Step 3: Manually verify in a browser**

With `python -m http.server 8080` still running, open `http://localhost:8080/new.html`.
Expected: form renders with one empty item row pre-added, "Total $0.00". Fill in your name/email, their name, a description/qty/price — the line total and grand total update live as you type. Click "+ Add item" — a second row appears. Click the row's "×" — it's removed and the total recalculates. Submitting with all required fields filled redirects to `receipt.html?id=...` (expect a 404-ish blank page at this point — `receipt.html` doesn't exist until Task 5, that's expected).

- [ ] **Step 4: Commit**

```bash
git add new.html form.js
git commit -m "feat: add receipt form"
```

---

## Task 5: Receipt view / print page (`receipt.css`, `receipt.html`, `receipt-view.js`)

**Files:**
- Create: `receipt.css`
- Create: `receipt.html`
- Create: `receipt-view.js`

- [ ] **Step 1: Write `receipt.css`**

Create `receipt.css`:

```css
:root {
  --paper: #ffffff;
  --ink: #1a1a1a;
  --ink-muted: #6b6b76;
  --accent: hsl(217, 95%, 45%);
  --line: #e1e3ea;
  --font-display: "Syne", sans-serif;
  --font-body: "Outfit", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: #eef0f5;
  color: var(--ink);
  font-family: var(--font-body);
  line-height: 1.5;
}

.receipt-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.actions .btn {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-outline { background: transparent; color: var(--accent); border: 2px solid var(--accent); padding: 0.5rem 1.3rem; }

.receipt-paper {
  background: var(--paper);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(20, 30, 60, 0.12);
  overflow: hidden;
}

.receipt-header {
  background: linear-gradient(135deg, hsl(217, 95%, 55%), hsl(225, 80%, 40%));
  color: #fff;
  padding: 1.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.receipt-header h1 {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.5rem;
  margin: 0;
  letter-spacing: 0.02em;
}
.receipt-header .meta { text-align: right; font-size: 0.85rem; opacity: 0.9; }

.receipt-body { padding: 2rem; }

.parties {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}
.party { flex: 1 1 200px; }
.party h3 {
  font-family: var(--font-display);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  margin: 0 0 0.4rem;
}
.party .name { font-weight: 600; }
.party .email { color: var(--ink-muted); font-size: 0.9rem; }

table.items { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
table.items th {
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
  border-bottom: 2px solid var(--line);
  padding: 0.5rem 0.5rem;
}
table.items td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--line); }
table.items td.num, table.items th.num { text-align: right; }

.totals { display: flex; justify-content: flex-end; margin-bottom: 1.5rem; }
.totals .grand { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; color: var(--accent); }

.notes { margin-bottom: 2rem; color: var(--ink-muted); font-size: 0.9rem; white-space: pre-wrap; }

.signatures { display: flex; gap: 3rem; margin-top: 3rem; }
.signature { flex: 1; }
.signature .line { border-bottom: 1px solid var(--ink); height: 2.5rem; }
.signature .label { margin-top: 0.4rem; font-size: 0.8rem; color: var(--ink-muted); }

.not-found { text-align: center; padding: 4rem 1rem; color: var(--ink-muted); }

@media print {
  body { background: #fff; }
  .actions { display: none; }
  .receipt-shell { padding: 0; max-width: none; }
  .receipt-paper { box-shadow: none; border-radius: 0; }
}
```

- [ ] **Step 2: Write `receipt.html`**

Create `receipt.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt · Receipts</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="hsl(217, 95%, 60%)" />
<link rel="apple-touch-icon" href="icons/icon-180.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="receipt.css" />
</head>
<body>
<div class="receipt-shell">
  <div class="actions">
    <a class="btn btn-outline" href="index.html">&larr; Back to History</a>
    <div style="display:flex; gap:0.75rem;">
      <a class="btn btn-outline" id="editLink" href="#">Edit / Duplicate</a>
      <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>

  <div id="receiptContainer"></div>
</div>

<template id="receiptTemplate">
  <div class="receipt-paper">
    <div class="receipt-header">
      <h1>Receipt</h1>
      <div class="meta">
        <div class="r-number"></div>
        <div class="r-date"></div>
      </div>
    </div>
    <div class="receipt-body">
      <div class="parties">
        <div class="party">
          <h3 class="issuer-role-label"></h3>
          <div class="name issuer-name"></div>
          <div class="email issuer-email"></div>
        </div>
        <div class="party">
          <h3 class="counter-role-label"></h3>
          <div class="name counter-name"></div>
          <div class="email counter-email"></div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Total</th></tr>
        </thead>
        <tbody class="items-body"></tbody>
      </table>

      <div class="totals"><span class="grand r-total"></span></div>

      <div class="notes r-notes"></div>

      <div class="signatures">
        <div class="signature">
          <div class="line"></div>
          <div class="label issuer-sig-label"></div>
        </div>
        <div class="signature">
          <div class="line"></div>
          <div class="label counter-sig-label"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="storage.js"></script>
<script src="calc.js"></script>
<script src="pwa.js"></script>
<script src="receipt-view.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `receipt-view.js`**

Create `receipt-view.js`:

```js
(function () {
  'use strict';

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function render() {
    var container = document.getElementById('receiptContainer');
    var editLink = document.getElementById('editLink');
    var id = getQueryParam('id');
    var receipt = id ? ReceiptStorage.getReceipt(id) : undefined;

    if (!receipt) {
      container.innerHTML = '<div class="not-found"><p>Receipt not found.</p><a class="btn btn-outline" href="index.html">Back to History</a></div>';
      editLink.style.display = 'none';
      return;
    }

    editLink.href = 'new.html?duplicate=' + encodeURIComponent(receipt.id);

    var template = document.getElementById('receiptTemplate');
    var node = template.content.firstElementChild.cloneNode(true);

    node.querySelector('.r-number').textContent = receipt.receiptNumber;
    node.querySelector('.r-date').textContent = receipt.date;

    node.querySelector('.issuer-role-label').textContent = receipt.issuer.role;
    node.querySelector('.issuer-name').textContent = receipt.issuer.name;
    node.querySelector('.issuer-email').textContent = receipt.issuer.email;

    node.querySelector('.counter-role-label').textContent = receipt.counterparty.role;
    node.querySelector('.counter-name').textContent = receipt.counterparty.name;
    node.querySelector('.counter-email').textContent = receipt.counterparty.email;

    var itemsBody = node.querySelector('.items-body');
    receipt.items.forEach(function (item) {
      var row = document.createElement('tr');
      row.innerHTML = '<td></td><td class="num"></td><td class="num"></td><td class="num"></td>';
      row.children[0].textContent = item.description;
      row.children[1].textContent = item.qty;
      row.children[2].textContent = ReceiptCalc.formatCurrency(item.unitPrice);
      row.children[3].textContent = ReceiptCalc.formatCurrency(ReceiptCalc.lineTotal(item.qty, item.unitPrice));
      itemsBody.appendChild(row);
    });

    node.querySelector('.r-total').textContent = 'Total ' + ReceiptCalc.formatCurrency(receipt.total);

    var notesEl = node.querySelector('.r-notes');
    if (receipt.notes) {
      notesEl.textContent = receipt.notes;
    } else {
      notesEl.remove();
    }

    node.querySelector('.issuer-sig-label').textContent = receipt.issuer.role + ' signature (' + receipt.issuer.name + ')';
    node.querySelector('.counter-sig-label').textContent = receipt.counterparty.role + ' signature (' + receipt.counterparty.name + ')';

    container.innerHTML = '';
    container.appendChild(node);
  }

  document.addEventListener('DOMContentLoaded', render);
})();
```

Note the `row.innerHTML = '<td></td>...'` above is a static, hard-coded template with no interpolated data — every value that comes from the receipt (`item.description`, names, notes, etc.) is assigned via `.textContent`, never concatenated into an HTML string. That's deliberate: it keeps user-typed text (which could contain `<`, `>`, `&`) from ever being parsed as markup.

- [ ] **Step 4: Manually verify the full create → view → print flow**

With the server still running: go to `http://localhost:8080/new.html`, fill in a full receipt (your info, their info, 2 items), submit.
Expected: lands on `receipt.html?id=...` showing a white card — header with "Receipt", receipt number and date top-right, your info and their info side-by-side, an items table with correct line totals, a total line, two signature blanks at the bottom labeled with the correct role/name. Click "Print / Save as PDF" — the browser print preview shows only the white receipt card (no dark chrome, no action buttons). Click "← Back to History" — the new receipt now appears in the history list from Task 3.

- [ ] **Step 5: Commit**

```bash
git add receipt.css receipt.html receipt-view.js
git commit -m "feat: add receipt view/print page"
```

---

## Task 6: PWA — manifest, service worker, icons

**Files:**
- Create: `pwa.js`
- Create: `sw.js`
- Create: `manifest.json`
- Create: `tools/icon-source.html`
- Create: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-180.png` (generated, not hand-written)

- [ ] **Step 1: Write `pwa.js`**

Create `pwa.js`:

```js
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
})();
```

- [ ] **Step 2: Write `sw.js`**

Create `sw.js`:

```js
'use strict';

var CACHE_NAME = 'receipts-cache-v1';
var ASSETS = [
  './',
  'index.html',
  'new.html',
  'receipt.html',
  'style.css',
  'receipt.css',
  'storage.js',
  'calc.js',
  'pwa.js',
  'history.js',
  'form.js',
  'receipt-view.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        });
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
```

- [ ] **Step 3: Write `manifest.json`**

Create `manifest.json`:

```json
{
  "name": "Receipts",
  "short_name": "Receipts",
  "description": "Generate and print professional receipts.",
  "start_url": "index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "hsl(228, 25%, 4%)",
  "theme_color": "hsl(217, 95%, 60%)",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Write the icon source page**

Create `tools/icon-source.html`:

```html
<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; padding: 0; }
  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, hsl(217, 95%, 55%), hsl(225, 80%, 35%));
    font-family: "Syne", sans-serif;
    font-weight: 800;
    color: #ffffff;
  }
</style>
</head>
<body>
  <div class="icon" id="icon">R</div>
  <script>
    var params = new URLSearchParams(window.location.search);
    var size = Number(params.get('size')) || 512;
    var icon = document.getElementById('icon');
    icon.style.width = size + 'px';
    icon.style.height = size + 'px';
    icon.style.fontSize = Math.round(size * 0.51) + 'px';
  </script>
</body>
</html>
```

- [ ] **Step 5: Generate the three icon PNGs with Playwright's CLI**

This is a one-time step (rerun only if the icon design changes later — the exact commands are also in the README from Task 8). It needs internet access once, to install a Chromium build and to load the Google Font.

Run, from the project root:

```bash
npx --yes playwright install chromium
```
Expected: downloads a Chromium build (first run only), ends without error.

```bash
mkdir -p icons
npx --yes playwright screenshot --viewport-size=512,512 --wait-for-timeout=400 "file://$(pwd)/tools/icon-source.html?size=512" icons/icon-512.png
npx --yes playwright screenshot --viewport-size=192,192 --wait-for-timeout=400 "file://$(pwd)/tools/icon-source.html?size=192" icons/icon-192.png
npx --yes playwright screenshot --viewport-size=180,180 --wait-for-timeout=400 "file://$(pwd)/tools/icon-source.html?size=180" icons/icon-180.png
```
Expected: three PNG files created under `icons/`, each a solid blue-gradient square with a white "R", each matching its viewport size exactly (Playwright's `screenshot` CLI captures the viewport, and the `.icon` div is set to fill it with no margin).

- [ ] **Step 6: Add the manifest link, theme-color, and apple-touch-icon to all three pages**

These tags are already present in `index.html`, `new.html`, and `receipt.html` from Tasks 3–5 (`<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`). Confirm all three files have all three tags — no edit needed if Tasks 3–5 were followed as written.

- [ ] **Step 7: Manually verify PWA wiring in a browser**

With `python -m http.server 8080` running, open `http://localhost:8080/` in Chrome, open DevTools → Application tab.
Expected: "Manifest" panel shows name "Receipts", correct icons, no errors. "Service Workers" panel shows `sw.js` registered and activated. Reload the page — Network tab shows assets served `(ServiceWorker)` on the second load. Turn on DevTools' "Offline" checkbox and reload — the page still loads.

- [ ] **Step 8: Commit**

```bash
git add pwa.js sw.js manifest.json tools/icon-source.html icons/
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

## Task 7: End-to-end verification with Playwright

**Files:** none created — this task drives the app through the `webapp-testing` skill to catch anything the manual passes above might have missed, and to confirm the golden path works as a whole.

- [ ] **Step 1: Start the local server**

Run: `python -m http.server 8080` from the project root (background/long-running).

- [ ] **Step 2: Invoke the `webapp-testing` skill and drive the golden path**

Use the `webapp-testing` skill against `http://localhost:8080/` to:
1. Load `index.html` — confirm the empty state renders (or clear `localStorage` first if earlier manual testing left data behind).
2. Go to `new.html`, fill in issuer name/email, counterparty name/email, two item rows with distinct qty/price, a notes string, submit.
3. Confirm navigation to `receipt.html?id=...` and that the rendered total equals the sum computed from the two item rows.
4. Confirm two signature blocks are present with the expected role labels (matching whichever role was selected on the form).
5. Go back to `index.html` and confirm the new receipt appears in the list with the correct name/date/total.
6. Click "Duplicate" on that entry, confirm `new.html` opens pre-filled with the same counterparty and items.
7. Delete the receipt from history, confirm the list returns to the empty state.
8. Take a screenshot of `receipt.html` for a final visual check of the print layout.

Expected: every step above matches; no console errors during the flow.

- [ ] **Step 3: Fix anything the walkthrough surfaces**

If any step fails, fix the relevant file (most likely `form.js`, `history.js`, or `receipt-view.js`) and re-run the affected part of the walkthrough. Do not proceed to Task 8 until the full flow passes cleanly.

---

## Task 8: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Create `README.md`:

```markdown
# Receipts

A personal, installable receipt generator. Fill in a form, get a clean
printable receipt with two signature lines, saved to a local history on
your device.

No account, no server, no backend — everything lives in your browser's
`localStorage`.

## Use it locally

Open `index.html` directly in a browser, or serve the folder:

    python -m http.server 8080

Then visit http://localhost:8080/. Opening the file directly works for
filling out and printing a receipt; installing it as an app (below)
needs it served over HTTPS.

## Install it on your phone / desktop

"Add to Home Screen" / "Install app" only appears once these files are
served over HTTPS from a real host — e.g. add this folder to your
existing Cloudflare Pages project, GitHub Pages, or any static host.

Once it's live at an https:// URL:
- **Android (Chrome):** menu → "Install app"
- **iPhone (Safari):** Share → "Add to Home Screen"
- **Desktop (Chrome/Edge):** install icon in the address bar

## Making a receipt

1. "+ New Receipt" → fill in your info, their info, and item rows.
2. The "I am the Provider/Client" dropdown decides which signature line
   is labeled which way — use it whichever direction the transaction
   goes.
3. "Generate Receipt" saves it to your local history and opens the
   printable view.
4. "Print / Save as PDF" uses your browser's native print dialog — pick
   "Save as PDF" as the destination to get a PDF file, or pick an
   actual printer.

## Regenerating the icon

Icons live in `icons/`, generated from `tools/icon-source.html` via
Playwright's screenshot CLI:

    npx --yes playwright install chromium
    npx --yes playwright screenshot --viewport-size=512,512 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=512" icons/icon-512.png
    npx --yes playwright screenshot --viewport-size=192,192 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=192" icons/icon-192.png
    npx --yes playwright screenshot --viewport-size=180,180 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=180" icons/icon-180.png

Edit the letter/colors in `tools/icon-source.html` and re-run to change it.

## Running the logic tests

    node --test storage.test.js calc.test.js
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review Notes

**Spec coverage:**
- Items/name/email/professional receipt fields — Task 4 (form) / Task 5 (view). ✓
- Theme matched to abdk.me — Task 3 (`style.css` tokens copied verbatim). ✓
- PDF export via print — Task 5 (`window.print()`), no bundled library. ✓
- Two signature blanks (giver/buyer) — Task 5, flexible role labels. ✓
- Installable on phone — Task 6 (manifest, service worker, icons). ✓
- History of past receipts — Task 3 (list) + storage layer (Task 1). ✓

**Type/name consistency check:** `ReceiptStorage.*` and `ReceiptCalc.*` method names are identical everywhere they're called (`history.js`, `form.js`, `receipt-view.js`) and match what's defined in Tasks 1–2. Receipt object shape (`issuer`, `counterparty`, `items`, `notes`, `total`, `receiptNumber`, `date`, `id`) is the same across `storage.js`, `form.js`, `receipt-view.js`, and `history.js`.

**No placeholders:** every step above has complete file contents or exact commands — nothing marked TBD.
