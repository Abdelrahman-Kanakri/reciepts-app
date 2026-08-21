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
    var isWellFormed = receipt && receipt.issuer && receipt.counterparty && Array.isArray(receipt.items);

    if (!isWellFormed) {
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
