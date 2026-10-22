// "Log transaction" view: a validated form for new transactions and the list
// of logs saved in this browser. Every field maps to a column of the dataset;
// the store address is built in the dataset's "street\nCity, ST 12345" format.

import { exportRecords } from './export.js';
import {
  escapeHtml, formatDate, formatDateTime, formatMoney, parseInputDate, toCsvDate, toInputDateTime,
} from './format.js';

const SAMPLE_STREETS = ['12 Orchard Road', '480 Lorong 6 Toa Payoh', '7 Harbourfront Walk', '221 Baker Street', '95 Market Street'];
const SAMPLE_CITIES = ['Springfield', 'Riverside', 'Fairview', 'Franklin', 'Greenville'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function createLogForm(root, { onSave, onDelete, onClear }) {
  const form = root.querySelector('#log-form');
  const f = form.elements;
  const el = (selector) => root.querySelector(selector);
  let logs = [];
  let dateRange = { min: 0, max: 0 };

  function fillSelect(select, values, placeholder) {
    select.replaceChildren(new Option(placeholder, ''), ...values.map((v) => new Option(v, v)));
  }

  function computeTotal() {
    const quantity = Number(f.quantity.value);
    const price = Number(f.price.value);
    const discount = Number(f.discount.value || 0);
    if (!(quantity > 0 && price > 0) || discount < 0 || discount > 100) return null;
    return quantity * price * (1 - discount / 100);
  }

  function renderPreview() {
    const total = computeTotal();
    el('#log-total').textContent = total == null ? '—' : formatMoney(total);
    const quantity = Number(f.quantity.value);
    const price = Number(f.price.value);
    el('#log-total-detail').textContent = total == null
      ? 'Enter quantity, price and discount'
      : `${quantity} × ${formatMoney(price)} − ${Number(f.discount.value || 0)}% discount`;
  }

  // Field-level messages, shown after the field is touched or on submit
  function showError(input) {
    const message = el(`[data-error-for="${input.name}"]`);
    if (!message) return;
    let text = '';
    if (input.validity.valueMissing) text = 'This field is required.';
    else if (input.validity.patternMismatch) text = input.dataset.patternMessage || 'Invalid format.';
    else if (input.validity.rangeUnderflow || input.validity.rangeOverflow) text = input.dataset.rangeMessage || `Enter a value from ${input.min} to ${input.max}.`;
    else if (input.validity.stepMismatch) text = input.dataset.stepMessage || 'Too many decimal places.';
    else if (input.validity.badInput) text = 'Enter a number.';
    else if (!input.validity.valid) text = input.validationMessage;
    message.textContent = text;
    input.setAttribute('aria-invalid', String(Boolean(text)));
  }

  form.addEventListener('input', (event) => {
    renderPreview();
    if (event.target.getAttribute('aria-invalid') === 'true') showError(event.target);
  });
  form.addEventListener('focusout', (event) => {
    if (event.target.name && event.target.value !== '') showError(event.target);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const invalid = [...f].filter((input) => input.name && !input.checkValidity());
    invalid.forEach(showError);
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const date = parseInputDate(f.transactionDate.value);
    const saved = onSave({
      customerID: Number(f.customerID.value),
      productID: f.productID.value,
      quantity: Number(f.quantity.value),
      price: Number(f.price.value),
      transactionDate: toCsvDate(date),
      paymentMethod: f.paymentMethod.value,
      storeLocation: `${f.street.value.trim()}\n${f.city.value.trim()}, ${f.state.value} ${f.zip.value.trim()}`,
      productCategory: f.productCategory.value,
      discountAppliedInPercentage: Number(f.discount.value || 0),
    });
    if (saved) {
      form.reset();
      f.transactionDate.value = toInputDateTime(dateRange.max);
      form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
      renderPreview();
    }
  });

  form.addEventListener('reset', () => {
    root.querySelectorAll('[data-error-for]').forEach((m) => { m.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    setTimeout(renderPreview);
  });

  el('#log-sample').addEventListener('click', () => {
    const options = (select) => [...select.options].map((o) => o.value).filter(Boolean);
    f.customerID.value = 100000 + Math.floor(Math.random() * 900000);
    f.productID.value = pick(options(f.productID));
    f.quantity.value = 1 + Math.floor(Math.random() * 9);
    f.price.value = (10 + Math.random() * 90).toFixed(2);
    f.discount.value = (Math.random() * 20).toFixed(2);
    const minutes = Math.floor((dateRange.max - dateRange.min) / 60000);
    f.transactionDate.value = toInputDateTime(dateRange.min + Math.floor(Math.random() * minutes) * 60000);
    f.paymentMethod.value = pick(options(f.paymentMethod));
    f.productCategory.value = pick(options(f.productCategory));
    f.street.value = pick(SAMPLE_STREETS);
    f.city.value = pick(SAMPLE_CITIES);
    f.state.value = pick(options(f.state));
    f.zip.value = String(10000 + Math.floor(Math.random() * 89999));
    root.querySelectorAll('[data-error-for]').forEach((m) => { m.textContent = ''; });
    renderPreview();
  });

  el('#logs-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-delete]');
    if (button) onDelete(Number(button.dataset.delete));
  });
  el('#logs-export-csv').addEventListener('click', () => exportRecords(logs, 'csv', 'transaction-logs'));
  el('#logs-export-json').addEventListener('click', () => exportRecords(logs, 'json', 'transaction-logs'));
  el('#logs-clear').addEventListener('click', () => {
    if (confirm(`Delete all ${logs.length} logged transactions from this browser?`)) onClear();
  });

  return {
    /** Fills the dropdowns from the dataset so new logs use existing values. */
    setOptions({ productIDs, paymentMethods, categories, states, minDate, maxDate }) {
      fillSelect(f.productID, productIDs, 'Select product');
      fillSelect(f.paymentMethod, paymentMethods, 'Select payment method');
      fillSelect(f.productCategory, categories, 'Select category');
      fillSelect(f.state, states, 'State');
      // Logs belong to the dataset's trading period, so trends stay comparable
      dateRange = { min: minDate, max: maxDate };
      f.transactionDate.min = toInputDateTime(minDate);
      f.transactionDate.max = toInputDateTime(maxDate);
      f.transactionDate.value = toInputDateTime(maxDate);
      el('#log-date-hint').textContent = `Between ${formatDate(minDate)} and ${formatDate(maxDate)}`;
      f.transactionDate.dataset.rangeMessage = `Pick a date within the dataset period (${formatDateTime(minDate)} – ${formatDateTime(maxDate)}).`;
      renderPreview();
    },

    /** Shows the logs saved in this browser, newest first. */
    setLogs(nextLogs) {
      logs = nextLogs;
      el('#logs-count').textContent = logs.length;
      el('#logs-empty').hidden = logs.length > 0;
      el('#logs-actions').hidden = logs.length === 0;
      el('#logs-list').innerHTML = [...logs].reverse().map((log) => `
        <li class="log-item">
          <div>
            <p class="log-title">No. ${log.no} · Customer ${log.customerID}</p>
            <p class="log-meta">${escapeHtml(log.productCategory)} · ${escapeHtml(log.paymentMethod)} · ${formatDateTime(log.date)}</p>
          </div>
          <p class="log-total">${formatMoney(log.totalAmount)}</p>
          <button type="button" class="icon-button" data-delete="${log.no}" aria-label="Delete log ${log.no}" title="Delete">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
          </button>
        </li>`).join('');
    },
  };
}
