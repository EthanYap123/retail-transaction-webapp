// Dashboard view: KPI cards, revenue trend, breakdown charts, a day/hour
// heatmap and the top transactions list (the original <transaction-card> view).

import { createBarChart, createLineChart, setBarData, setLineData } from './charts.js';
import {
  formatCompact, formatDate, formatDateTime, formatInt, formatMoney,
  formatMoneyShort, formatMonth, formatPercent,
} from './format.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const METRICS = {
  revenue: { label: 'Revenue', value: (b) => b.revenue, format: (v, short) => (short ? formatMoneyShort(v) : formatMoney(v)) },
  count: { label: 'Transactions', value: (b) => b.count, format: (v, short) => (short ? formatCompact(v) : formatInt(v)) },
  aov: { label: 'Avg order value', value: (b) => (b.count ? b.revenue / b.count : 0), format: (v) => formatMoney(v) },
};

function monthStart(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function nextMonth(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

function weekStart(ms) {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

const bump = (map, key, amount) => {
  const bucket = map.get(key) || { revenue: 0, count: 0 };
  bucket.revenue += amount;
  bucket.count += 1;
  map.set(key, bucket);
};

/** One pass over the records to collect everything the dashboard shows. */
function summarize(records) {
  const s = {
    revenue: 0, count: records.length, units: 0, discount: 0, customers: new Set(),
    minDate: Infinity, maxDate: -Infinity,
    byMonth: new Map(), byWeek: new Map(), byCategory: new Map(), byPayment: new Map(), byState: new Map(),
    heat: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ revenue: 0, count: 0 }))),
  };
  for (const r of records) {
    s.revenue += r.totalAmount;
    s.units += r.quantity;
    s.discount += r.discountAppliedInPercentage;
    s.customers.add(r.customerID);
    if (r.date < s.minDate) s.minDate = r.date;
    if (r.date > s.maxDate) s.maxDate = r.date;
    bump(s.byMonth, monthStart(r.date), r.totalAmount);
    bump(s.byWeek, weekStart(r.date), r.totalAmount);
    bump(s.byCategory, r.productCategory, r.totalAmount);
    bump(s.byPayment, r.paymentMethod, r.totalAmount);
    if (r.state) bump(s.byState, r.state, r.totalAmount);
    const d = new Date(r.date);
    const cell = s.heat[(d.getUTCDay() + 6) % 7][d.getUTCHours()];
    cell.revenue += r.totalAmount;
    cell.count += 1;
  }
  return s;
}

/** Continuous buckets from the first to the last date, with empty ones filled in. */
function timeSeries(s, interval) {
  const map = interval === 'week' ? s.byWeek : s.byMonth;
  const start = interval === 'week' ? weekStart : monthStart;
  const next = interval === 'week' ? (ms) => ms + 7 * DAY_MS : nextMonth;
  const buckets = [];
  for (let at = start(s.minDate); at <= s.maxDate; at = next(at)) {
    buckets.push({
      at,
      ...(map.get(at) || { revenue: 0, count: 0 }),
      // The data does not cover the whole first/last period
      partial: s.minDate - at > DAY_MS || next(at) - s.maxDate > DAY_MS,
    });
  }
  return buckets;
}

const byRevenue = (map) => [...map].sort((a, b) => b[1].revenue - a[1].revenue);

export function createDashboard(root, { onFilter }) {
  const el = (selector) => root.querySelector(selector);
  const state = { metric: 'revenue', interval: 'month', topMethod: '', records: [], summary: null };

  const trend = createLineChart(el('#trend-chart'));
  const shareOf = (chart) => (i) => {
    const total = chart.data.datasets[0].data.reduce((sum, v) => sum + v, 0);
    return total ? [`${formatPercent((chart.data.datasets[0].data[i] / total) * 100)} of revenue`] : [];
  };
  const revenueFormat = (v, short) => (short ? formatMoneyShort(v) : formatMoney(v));

  const categoryChart = createBarChart(el('#category-chart'), {
    format: revenueFormat,
    tooltipExtra: (i) => shareOf(categoryChart)(i),
    onSelect: (label) => onFilter({ productCategory: label }),
  });
  const paymentChart = createBarChart(el('#payment-chart'), {
    format: revenueFormat,
    tooltipExtra: (i) => shareOf(paymentChart)(i),
    onSelect: (label) => onFilter({ paymentMethod: label }),
  });
  const stateChart = createBarChart(el('#state-chart'), {
    format: revenueFormat,
    onSelect: (label) => onFilter({ state: label }),
  });

  // Segmented controls for the trend chart
  root.querySelectorAll('[data-segment]').forEach((group) => {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-value]');
      if (!button) return;
      state[group.dataset.segment] = button.dataset.value;
      group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      renderTrend();
    });
  });

  el('#top-method').addEventListener('change', (event) => {
    state.topMethod = event.target.value;
    renderTop();
  });

  function renderKpis(s) {
    const tiles = [
      ['Revenue', s.revenue >= 1e6 ? formatMoneyShort(s.revenue) : formatMoney(s.revenue), formatMoney(s.revenue)],
      ['Transactions', formatInt(s.count), 'Rows matching the filters'],
      ['Customers', formatInt(s.customers.size), `${(s.customers.size ? s.count / s.customers.size : 0).toFixed(2)} transactions each`],
      ['Avg order value', formatMoney(s.count ? s.revenue / s.count : 0), 'Revenue ÷ transactions'],
      ['Units sold', formatInt(s.units), `${(s.count ? s.units / s.count : 0).toFixed(1)} per transaction`],
      ['Avg discount', formatPercent(s.count ? s.discount / s.count : 0), 'Mean discount applied'],
    ];
    el('#kpis').innerHTML = tiles.map(([label, value, hint]) => `
      <article class="kpi">
        <h3 class="kpi-label">${label}</h3>
        <p class="kpi-value">${value}</p>
        <p class="kpi-hint">${hint}</p>
      </article>`).join('');
  }

  function renderTrend() {
    const s = state.summary;
    if (!s || !s.count) return;
    const metric = METRICS[state.metric];
    const buckets = timeSeries(s, state.interval);
    setLineData(trend, {
      labels: buckets.map((b) => (state.interval === 'week' ? formatDate(b.at) : formatMonth(b.at))),
      values: buckets.map(metric.value),
      partial: buckets.map((b) => b.partial),
      format: metric.format,
      note: '(partial period)',
    });
    el('#trend-title').textContent = `${metric.label} by ${state.interval}`;
    el('#trend-range').textContent = `${formatDateTime(s.minDate)} – ${formatDateTime(s.maxDate)}`;
  }

  function renderBreakdowns(s) {
    const categories = byRevenue(s.byCategory);
    setBarData(categoryChart, categories.map(([k]) => k), categories.map(([, b]) => b.revenue));
    const payments = byRevenue(s.byPayment);
    setBarData(paymentChart, payments.map(([k]) => k), payments.map(([, b]) => b.revenue));
    const states = byRevenue(s.byState).slice(0, 10);
    setBarData(stateChart, states.map(([k]) => k), states.map(([, b]) => b.revenue));
  }

  function renderHeatmap(s) {
    // Scale from the quietest to the busiest hour so small differences show
    let min = Infinity;
    let max = 0;
    for (const row of s.heat) {
      for (const cell of row) {
        min = Math.min(min, cell.count);
        max = Math.max(max, cell.count);
      }
    }
    const span = max - min;
    el('#heat-min').textContent = formatInt(min);
    el('#heat-max').textContent = formatInt(max);
    const hours = Array.from({ length: 24 }, (_, h) => `<span class="heat-hour">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>`);
    const rows = s.heat.map((row, day) => `
      <span class="heat-day">${WEEKDAYS[day]}</span>
      ${row.map((cell, hour) => {
        // 8%–100% of the series colour, mixed over the surface (lighter = fewer)
        const level = span ? 8 + Math.round(((cell.count - min) / span) * 92) : 54;
        return `<button type="button" class="heat-cell" style="--level:${level}%"
          data-day="${day}" data-hour="${hour}"
          aria-label="${WEEKDAYS[day]} ${String(hour).padStart(2, '0')}:00, ${cell.count} transactions"></button>`;
      }).join('')}`).join('');
    el('#heatmap').innerHTML = `<span></span>${hours.join('')}${rows}`;
    el('#heatmap-readout').textContent = 'Hover a cell to see the numbers.';
  }

  el('#heatmap').addEventListener('pointerover', showHeatCell);
  el('#heatmap').addEventListener('focusin', showHeatCell);
  function showHeatCell(event) {
    const cell = event.target.closest('.heat-cell');
    if (!cell || !state.summary) return;
    const day = Number(cell.dataset.day);
    const hour = Number(cell.dataset.hour);
    const data = state.summary.heat[day][hour];
    const hh = String(hour).padStart(2, '0');
    el('#heatmap-readout').innerHTML =
      `<strong>${WEEKDAYS[day]} ${hh}:00–${hh}:59</strong> · ${formatInt(data.count)} transactions · ${formatMoney(data.revenue)}`;
  }

  function renderTop() {
    const pool = state.topMethod
      ? state.records.filter((r) => r.paymentMethod === state.topMethod)
      : state.records;
    // Partial selection of the 5 largest, without sorting the whole array
    const top = [];
    for (const r of pool) {
      if (top.length < 5 || r.totalAmount > top[top.length - 1].totalAmount) {
        top.push(r);
        top.sort((a, b) => b.totalAmount - a.totalAmount);
        if (top.length > 5) top.pop();
      }
    }
    const list = el('#top-list');
    list.replaceChildren(...top.map((r, i) => {
      const card = document.createElement('transaction-card');
      card.setAttribute('rank', i + 1);
      card.setAttribute('no', r.no);
      card.setAttribute('customerid', r.customerID);
      card.setAttribute('date', formatDate(r.date));
      card.setAttribute('category', r.productCategory);
      card.setAttribute('paymentmethod', r.paymentMethod);
      card.setAttribute('quantity', r.quantity);
      card.setAttribute('price', r.price);
      card.setAttribute('totalamount', r.totalAmount);
      return card;
    }));
    if (!top.length) list.innerHTML = '<p class="empty-note">No transactions for this payment method.</p>';
  }

  return {
    /** Re-renders everything for the current filtered records. */
    update(records, paymentMethods) {
      state.records = records;
      state.summary = summarize(records);
      const empty = records.length === 0;
      el('#dashboard-empty').hidden = !empty;
      el('#dashboard-content').hidden = empty;
      if (empty) return;

      const select = el('#top-method');
      select.replaceChildren(new Option('All payment methods', ''), ...paymentMethods.map((m) => new Option(m, m)));
      select.value = paymentMethods.includes(state.topMethod) ? state.topMethod : '';
      state.topMethod = select.value;

      renderKpis(state.summary);
      renderTrend();
      renderBreakdowns(state.summary);
      renderHeatmap(state.summary);
      renderTop();
    },
  };
}
