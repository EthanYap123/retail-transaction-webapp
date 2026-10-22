// Transactions view: sortable, paginated table of the filtered records,
// with CSV / JSON export of exactly what is shown (all pages, current sort).

import { exportRecords } from './export.js';
import { escapeHtml, formatDateTime, formatInt, formatMoney, formatPercent } from './format.js';

const COLUMNS = [
  { key: 'no', label: 'No.', numeric: true, render: (r) => `${r.no}${r.source === 'local' ? ' <span class="badge">New</span>' : ''}` },
  { key: 'date', label: 'Date', render: (r) => formatDateTime(r.date) },
  { key: 'customerID', label: 'Customer', numeric: true, render: (r) => r.customerID },
  { key: 'productID', label: 'Product', render: (r) => escapeHtml(r.productID) },
  { key: 'productCategory', label: 'Category', render: (r) => escapeHtml(r.productCategory) },
  { key: 'paymentMethod', label: 'Payment', render: (r) => escapeHtml(r.paymentMethod) },
  { key: 'state', label: 'State', render: (r) => escapeHtml(r.state || '—') },
  { key: 'quantity', label: 'Qty', numeric: true, render: (r) => r.quantity },
  { key: 'price', label: 'Price', numeric: true, render: (r) => formatMoney(r.price) },
  { key: 'discountAppliedInPercentage', label: 'Discount', numeric: true, render: (r) => formatPercent(r.discountAppliedInPercentage) },
  { key: 'totalAmount', label: 'Total', numeric: true, render: (r) => `<strong>${formatMoney(r.totalAmount)}</strong>` },
];

export function createTable(root, { onOpen }) {
  const el = (selector) => root.querySelector(selector);
  const state = { records: [], sorted: [], sortKey: 'date', sortDir: 'desc', page: 0, pageSize: 25 };

  el('#table-head').innerHTML = `<tr>${COLUMNS.map((c) => `
    <th scope="col" class="${c.numeric ? 'num' : ''}" data-key="${c.key}">
      <button type="button" class="sort">${c.label}<span class="sort-icon" aria-hidden="true"></span></button>
    </th>`).join('')}</tr>`;

  el('#table-head').addEventListener('click', (event) => {
    const th = event.target.closest('th[data-key]');
    if (!th) return;
    const key = th.dataset.key;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = COLUMNS.find((c) => c.key === key).numeric || key === 'date' ? 'desc' : 'asc';
    }
    state.page = 0;
    sort();
    render();
  });

  el('#table-body').addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-index]');
    if (row) onOpen(state.sorted[Number(row.dataset.index)]);
  });
  el('#table-body').addEventListener('keydown', (event) => {
    const row = event.target.closest('tr[data-index]');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onOpen(state.sorted[Number(row.dataset.index)]);
    }
  });

  el('#page-size').addEventListener('change', (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 0;
    render();
  });
  el('#page-prev').addEventListener('click', () => { state.page -= 1; render(); });
  el('#page-next').addEventListener('click', () => { state.page += 1; render(); });

  root.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => exportRecords(state.sorted, button.dataset.export));
  });

  function sort() {
    const { sortKey: key } = state;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    // Plain comparison: every text column is simple ASCII, and localeCompare
    // is too slow for 100k rows.
    state.sorted = [...state.records].sort((a, b) => {
      const diff = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      return diff * dir || (a.no - b.no) * dir;
    });
  }

  function render() {
    const total = state.sorted.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(Math.max(state.page, 0), pages - 1);
    const start = state.page * state.pageSize;
    const rows = state.sorted.slice(start, start + state.pageSize);

    root.querySelectorAll('#table-head th').forEach((th) => {
      const active = th.dataset.key === state.sortKey;
      th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    el('#table-body').innerHTML = rows.map((r, i) => `
      <tr data-index="${start + i}" tabindex="0" class="${r.source === 'local' ? 'is-local' : ''}">
        ${COLUMNS.map((c) => `<td class="${c.numeric ? 'num' : ''}">${c.render(r)}</td>`).join('')}
      </tr>`).join('');

    el('#table-empty').hidden = total > 0;
    el('#table-count').textContent = total
      ? `${formatInt(start + 1)}–${formatInt(start + rows.length)} of ${formatInt(total)}`
      : '0 transactions';
    el('#page-label').textContent = `Page ${formatInt(state.page + 1)} of ${formatInt(pages)}`;
    el('#page-prev').disabled = state.page === 0;
    el('#page-next').disabled = state.page >= pages - 1;
    root.querySelectorAll('[data-export]').forEach((b) => { b.disabled = total === 0; });
  }

  return {
    update(records) {
      state.records = records;
      state.page = 0;
      sort();
      render();
    },
  };
}
