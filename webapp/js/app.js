// Name: Yap Kai Jun Ethan
// Class: DIT/1B/07
// Admin Number: P2523752

// Entry point: loads the data, wires the views together and handles
// navigation, theme, the record dialog and toasts.

import './components/transaction-card.js';
import { restyleCharts } from './charts.js';
import { createDashboard } from './dashboard.js';
import { addLog, clearLogs, loadDataset, loadLogs, removeLog } from './data.js';
import { applyFilters, initFilterBar } from './filters.js';
import { createLogForm } from './form.js';
import {
  escapeHtml, formatDateTime, formatInt, formatMoney, formatPercent,
} from './format.js';
import { createTable } from './table.js';

const THEME_KEY = 'retail-webapp.theme';
const VIEWS = ['dashboard', 'transactions', 'log'];

const app = {
  dataset: [],
  logs: [],
  all: [],
  filtered: [],
  filters: null,
};

const $ = (selector) => document.querySelector(selector);
const uniqueSorted = (field) =>
  [...new Set(app.all.map((r) => r[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

// ---- Theme ------------------------------------------------------------------

function storedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-toggle').setAttribute('aria-pressed', String(dark));
  $('#theme-toggle').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  restyleCharts();
}

$('#theme-toggle').addEventListener('click', () => {
  const next = $('#theme-toggle').getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch { /* theme just won't be remembered */ }
  applyTheme(next);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
applyTheme(storedTheme());

// ---- Navigation (hash based, so links and the back button work) -------------

function showView() {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  for (const name of VIEWS) $(`#view-${name}`).hidden = name !== view;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('#filters').hidden = view === 'log';
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', showView);
showView();

// ---- Toast ------------------------------------------------------------------

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

// ---- Record details dialog --------------------------------------------------

const dialog = $('#record-dialog');
let openRecord = null;

function openDetails(record) {
  openRecord = record;
  const rows = [
    ['Transaction no.', record.no],
    ['Date', formatDateTime(record.date)],
    ['Customer ID', record.customerID],
    ['Product ID', escapeHtml(record.productID)],
    ['Category', escapeHtml(record.productCategory)],
    ['Payment method', escapeHtml(record.paymentMethod)],
    ['Quantity', formatInt(record.quantity)],
    ['Unit price', formatMoney(record.price)],
    ['Discount', formatPercent(record.discountAppliedInPercentage, 2)],
    ['Total amount', `<strong>${formatMoney(record.totalAmount)}</strong>`],
    ['Store location', escapeHtml(record.storeLocation).replace(/\n/g, '<br>')],
  ];
  $('#dialog-title').textContent = `Transaction ${record.no}`;
  $('#dialog-source').textContent = record.source === 'local' ? 'Logged in this browser' : 'From the dataset';
  $('#dialog-body').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#dialog-delete').hidden = record.source !== 'local';
  dialog.showModal();
}

$('#dialog-delete').addEventListener('click', () => {
  if (openRecord) deleteLog(openRecord.no);
  dialog.close();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close(); // click on the backdrop
});

// ---- Data flow --------------------------------------------------------------

const filterBar = initFilterBar($('#filters'), (filters) => {
  app.filters = filters;
  refresh();
});

const dashboard = createDashboard($('#view-dashboard'), {
  onFilter: (partial) => {
    filterBar.set(partial);
    toast(`Filtered by ${Object.values(partial).join(', ')}`);
  },
});
const table = createTable($('#view-transactions'), { onOpen: openDetails });
const logForm = createLogForm($('#view-log'), {
  onSave: saveLog,
  onDelete: deleteLog,
  onClear: () => {
    clearLogs();
    setLogs(loadLogs());
    toast('All logged transactions deleted');
  },
});

function refresh() {
  app.filtered = applyFilters(app.all, app.filters);
  const total = app.all.length;
  $('#filter-summary').textContent = app.filtered.length === total
    ? `All ${formatInt(total)} transactions`
    : `${formatInt(app.filtered.length)} of ${formatInt(total)} transactions`;
  dashboard.update(app.filtered, uniqueSorted('paymentMethod'));
  table.update(app.filtered);
}

function setLogs(logs) {
  app.logs = logs;
  app.all = app.dataset.concat(logs);
  $('#nav-log-count').textContent = logs.length || '';
  logForm.setLogs(logs);
  filterBar.setOptions(app.all);
  refresh();
}

function saveLog(entry) {
  const nextNo = app.all.reduce((max, r) => Math.max(max, r.no), 0) + 1;
  const saved = addLog(entry, nextNo);
  if (!saved) {
    toast('Could not save: browser storage is full or disabled');
    return null;
  }
  setLogs(loadLogs());
  toast(`Transaction ${saved.no} saved · ${formatMoney(saved.totalAmount)}`);
  return saved;
}

function deleteLog(no) {
  removeLog(no);
  setLogs(loadLogs());
  toast(`Transaction ${no} deleted`);
}

async function start() {
  try {
    app.dataset = await loadDataset();
    app.filters = filterBar.read();
    app.all = app.dataset;
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const r of app.dataset) {
      if (r.date < minDate) minDate = r.date;
      if (r.date > maxDate) maxDate = r.date;
    }
    logForm.setOptions({
      productIDs: uniqueSorted('productID'),
      paymentMethods: uniqueSorted('paymentMethod'),
      categories: uniqueSorted('productCategory'),
      states: uniqueSorted('state'),
      minDate,
      maxDate,
    });
    setLogs(loadLogs());
    document.body.classList.remove('is-loading');
  } catch (error) {
    console.error(error);
    $('#load-error-message').textContent = error.message;
    document.body.classList.replace('is-loading', 'has-error');
  }
}

start();
