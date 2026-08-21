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

test('getLastCurrency defaults to null, setLastCurrency round-trips', () => {
  const store = makeFakeStore();
  assert.equal(ReceiptStorage.getLastCurrency(store), null);
  ReceiptStorage.setLastCurrency('JOD', store);
  assert.equal(ReceiptStorage.getLastCurrency(store), 'JOD');
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
