// Loads the retail dataset and manages transaction logs added in the browser.
//
// The dataset comes from data/transactions.json, a packed copy of
// server/data/retailTransaction.csv (see server/lib/dataset.js). The Express
// server serves it at the same path, and the static build writes it as a file,
// so the app works the same with or without the server.
//
// New logs are saved to localStorage using the CSV's own field names and
// formats, so they can be exported next to the original rows unchanged.

import { parseCsvDate, stateOf, toCsvDate } from './format.js';

const DATA_URL = 'data/transactions.json';
const LOGS_KEY = 'retail-webapp.transaction-logs.v1';

export const COLUMNS = [
  'no', 'customerID', 'productID', 'quantity', 'price', 'transactionDate',
  'paymentMethod', 'storeLocation', 'productCategory',
  'discountAppliedInPercentage', 'totalAmount',
];

/** Fetches and unpacks the dataset into one plain object per transaction. */
export async function loadDataset() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${res.status})`);
  const packed = await res.json();
  if (packed.format !== 'retail-columnar/1') throw new Error('Unexpected dataset format');

  const { cols, dict, scale, count } = packed;
  const epoch = Date.parse(`${packed.epoch}Z`);
  const records = new Array(count);
  for (let i = 0; i < count; i++) {
    const date = epoch + cols.transactionDate[i] * 60000;
    records[i] = {
      no: cols.no[i],
      customerID: cols.customerID[i],
      productID: dict.productID[cols.productID[i]],
      quantity: cols.quantity[i],
      price: cols.price[i] / scale.price,
      transactionDate: toCsvDate(date),
      paymentMethod: dict.paymentMethod[cols.paymentMethod[i]],
      storeLocation: cols.storeLocation[i],
      productCategory: dict.productCategory[cols.productCategory[i]],
      discountAppliedInPercentage: cols.discountAppliedInPercentage[i] / scale.discountAppliedInPercentage,
      totalAmount: cols.totalAmount[i] / scale.totalAmount,
      date,
      state: stateOf(cols.storeLocation[i]),
      source: 'dataset',
    };
  }
  return records;
}

// ---- Transaction logs (localStorage) --------------------------------------

function readStoredLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredLogs(logs) {
  try {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    return true;
  } catch {
    return false;
  }
}

/** Adds the derived fields the views use to a stored (CSV-shaped) log. */
function hydrate(log) {
  return {
    ...log,
    date: parseCsvDate(log.transactionDate),
    state: stateOf(log.storeLocation),
    source: 'local',
  };
}

/** Strips derived fields so only the dataset's columns are stored or exported. */
export function toSchema(record) {
  const out = {};
  for (const column of COLUMNS) out[column] = record[column];
  return out;
}

export function loadLogs() {
  return readStoredLogs()
    .map(hydrate)
    .filter((log) => Number.isFinite(log.date) && Number.isFinite(log.totalAmount));
}

/**
 * Saves a new log. `entry` holds every column except `no` and `totalAmount`,
 * which are assigned here. Returns the hydrated record, or null if storage failed.
 */
export function addLog(entry, nextNo) {
  const totalAmount = entry.quantity * entry.price * (1 - entry.discountAppliedInPercentage / 100);
  const log = toSchema({ ...entry, no: nextNo, totalAmount: Math.round(totalAmount * 100) / 100 });
  const logs = readStoredLogs();
  logs.push(log);
  return writeStoredLogs(logs) ? hydrate(log) : null;
}

export function removeLog(no) {
  writeStoredLogs(readStoredLogs().filter((log) => log.no !== no));
}

export function clearLogs() {
  writeStoredLogs([]);
}
