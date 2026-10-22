// The shared filter bar. Its filters apply to both the dashboard and the
// transactions table, so the charts always describe the rows you can see.

import { parseInputDate, toInputDate } from './format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const EMPTY_FILTERS = Object.freeze({
  search: '',
  from: '',
  to: '',
  paymentMethod: '',
  productCategory: '',
  productID: '',
  state: '',
  minTotal: '',
  maxTotal: '',
});

/** Returns the records that match every active filter. */
export function applyFilters(records, filters) {
  const from = parseInputDate(filters.from);
  const to = parseInputDate(filters.to) + DAY_MS; // "to" includes the whole day
  const minTotal = filters.minTotal === '' ? NaN : Number(filters.minTotal);
  const maxTotal = filters.maxTotal === '' ? NaN : Number(filters.maxTotal);
  const search = filters.search.trim().toLowerCase();
  const searchNumber = /^\d+$/.test(search) ? Number(search) : NaN;

  return records.filter((r) => {
    if (filters.paymentMethod && r.paymentMethod !== filters.paymentMethod) return false;
    if (filters.productCategory && r.productCategory !== filters.productCategory) return false;
    if (filters.productID && r.productID !== filters.productID) return false;
    if (filters.state && r.state !== filters.state) return false;
    if (r.date < from || r.date >= to) return false; // comparisons with NaN are false
    if (r.totalAmount < minTotal || r.totalAmount > maxTotal) return false;
    if (search) {
      // A number matches a customer ID or transaction no. exactly;
      // anything else is looked up in the store address.
      if (searchNumber) return r.customerID === searchNumber || r.no === searchNumber;
      return r.storeLocation.toLowerCase().includes(search);
    }
    return true;
  });
}

export function countActive(filters) {
  return Object.keys(EMPTY_FILTERS).filter((key) => filters[key] !== '').length;
}

const uniqueSorted = (records, field) =>
  [...new Set(records.map((r) => r[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.replaceChildren(new Option(allLabel, ''), ...values.map((v) => new Option(v, v)));
  select.value = values.includes(current) ? current : '';
}

/**
 * Wires the filter form. Calls `onChange(filters)` whenever a value changes
 * (search is debounced). Returns helpers to refresh options and reset.
 */
export function initFilterBar(form, onChange) {
  const fields = form.elements;
  let timer;

  const read = () => {
    const filters = {};
    for (const key of Object.keys(EMPTY_FILTERS)) filters[key] = fields[key].value;
    return filters;
  };

  const emit = () => {
    const filters = read();
    const active = countActive(filters);
    form.querySelector('[data-active-count]').textContent = active ? `${active} active` : '';
    form.querySelector('[type="reset"]').disabled = active === 0;
    onChange(filters);
  };

  form.addEventListener('input', (event) => {
    clearTimeout(timer);
    if (event.target.name === 'search' || event.target.type === 'number') {
      timer = setTimeout(emit, 200);
    } else {
      emit();
    }
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  // On phones the filter fields are collapsed behind this toggle
  const toggle = form.querySelector('.filters-toggle');
  toggle.addEventListener('click', () => {
    const open = form.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide' : 'Show';
  });
  form.addEventListener('reset', () => setTimeout(emit)); // after the browser clears the fields

  return {
    /** Fills the dropdowns and date limits from the loaded records. */
    setOptions(records) {
      fillSelect(fields.paymentMethod, uniqueSorted(records, 'paymentMethod'), 'All payment methods');
      fillSelect(fields.productCategory, uniqueSorted(records, 'productCategory'), 'All categories');
      fillSelect(fields.productID, uniqueSorted(records, 'productID'), 'All products');
      fillSelect(fields.state, uniqueSorted(records, 'state'), 'All states');
      let min = Infinity;
      let max = -Infinity;
      for (const r of records) {
        if (r.date < min) min = r.date;
        if (r.date > max) max = r.date;
      }
      for (const input of [fields.from, fields.to]) {
        input.min = toInputDate(min);
        input.max = toInputDate(max);
      }
    },
    /** Sets some filters from code (e.g. a chart click) and re-applies. */
    set(partial) {
      for (const [key, value] of Object.entries(partial)) fields[key].value = value;
      emit();
    },
    read,
    emit,
  };
}
