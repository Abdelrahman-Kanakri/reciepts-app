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
