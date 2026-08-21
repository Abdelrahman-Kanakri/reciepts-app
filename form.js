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
