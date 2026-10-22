// Formatting helpers shared by every view.
// Dates are kept as "naive" UTC milliseconds: the CSV has no timezone,
// so we read and print them with the UTC getters and never shift them.

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyShort = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatMoney = (value) => money.format(value);
export const formatMoneyShort = (value) => moneyShort.format(value);
export const formatInt = (value) => integer.format(value);
export const formatCompact = (value) => compact.format(value);
export const formatPercent = (value, digits = 1) => `${value.toFixed(digits)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "12 Mar 2024, 18:51" */
export function formatDateTime(ms) {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "12 Mar 2024" */
export function formatDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Mar 2024" */
export function formatMonth(ms) {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Date in the dataset's own format: "12/26/2023 12:32" */
export function toCsvDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
}

/** Parses the dataset's date format back to naive UTC milliseconds, or NaN. */
export function parseCsvDate(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/.exec(String(text).trim());
  return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) : NaN;
}

/** "YYYY-MM-DD" (value of <input type="date">) for a naive UTC timestamp. */
export function toInputDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "YYYY-MM-DDTHH:MM" (value of <input type="datetime-local">). */
export function toInputDateTime(ms) {
  const d = new Date(ms);
  return `${toInputDate(ms)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Parses an <input type="date"> or "datetime-local" value as naive UTC, or NaN. */
export function parseInputDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : NaN;
}

/** Two-letter state/territory code at the end of a US address, or "". */
export function stateOf(address) {
  const m = /\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/.exec(address || '');
  return m ? m[1] : '';
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
