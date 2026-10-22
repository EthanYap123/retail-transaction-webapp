// CSV / JSON export. Rows are written with the dataset's own columns and
// formats, so an exported CSV has the same layout as retailTransaction.csv.

import { COLUMNS, toSchema } from './data.js';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(records) {
  const lines = [COLUMNS.join(',')];
  for (const record of records) {
    lines.push(COLUMNS.map((column) => csvCell(record[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function toJson(records) {
  return JSON.stringify(records.map(toSchema), null, 2);
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads `records` as "<name>-YYYY-MM-DD.csv" or ".json". */
export function exportRecords(records, format, name = 'retail-transactions') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    download(`${name}-${stamp}.json`, toJson(records), 'application/json');
  } else {
    download(`${name}-${stamp}.csv`, toCsv(records), 'text/csv;charset=utf-8');
  }
}
