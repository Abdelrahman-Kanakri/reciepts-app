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

test('formatCurrency supports other currencies, including 3-decimal JOD', () => {
  assert.equal(ReceiptCalc.formatCurrency(9, 'JOD'), 'JD 9.000');
  assert.equal(ReceiptCalc.formatCurrency(9, 'AED'), 'AED 9.00');
  assert.equal(ReceiptCalc.formatCurrency(9, 'EUR'), '€9.00');
});

test('formatCurrency falls back to USD for an unknown currency code', () => {
  assert.equal(ReceiptCalc.formatCurrency(9, 'XYZ'), '$9.00');
});

test('lineTotal and computeTotal round to the currency\'s own decimal places', () => {
  assert.equal(ReceiptCalc.lineTotal(3, 0.1234, 'JOD'), 0.37);
  assert.equal(ReceiptCalc.computeTotal([{ qty: 2, unitPrice: 1.2345 }], 'JOD'), 2.469);
});
