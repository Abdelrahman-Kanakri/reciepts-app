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
