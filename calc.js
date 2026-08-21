(function (global) {
  'use strict';

  var DEFAULT_CURRENCY = 'USD';

  // JOD is priced to 3 decimal places (fils), unlike most currencies' 2.
  var CURRENCIES = {
    USD: { symbol: '$', decimals: 2 },
    JOD: { symbol: 'JD ', decimals: 3 },
    AED: { symbol: 'AED ', decimals: 2 },
    EUR: { symbol: '€', decimals: 2 },
    GBP: { symbol: '£', decimals: 2 },
    SAR: { symbol: 'SAR ', decimals: 2 }
  };

  function getCurrency(code) {
    return CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];
  }

  function roundTo(n, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  function lineTotal(qty, unitPrice, currencyCode) {
    return roundTo(Number(qty) * Number(unitPrice), getCurrency(currencyCode).decimals);
  }

  function computeTotal(items, currencyCode) {
    var sum = 0;
    for (var i = 0; i < items.length; i++) {
      sum += lineTotal(items[i].qty, items[i].unitPrice, currencyCode);
    }
    return roundTo(sum, getCurrency(currencyCode).decimals);
  }

  function formatCurrency(amount, currencyCode) {
    var currency = getCurrency(currencyCode);
    return currency.symbol + Number(amount).toFixed(currency.decimals);
  }

  var ReceiptCalc = {
    CURRENCIES: CURRENCIES,
    DEFAULT_CURRENCY: DEFAULT_CURRENCY,
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
