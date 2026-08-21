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
