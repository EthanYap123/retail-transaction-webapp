// Name: Yap Kai Jun Ethan
// Class: DIT/1B/07
// Admin Number: P2523752

// Shared dataset helpers: reading the CSV and packing it for the browser.
// Used by server.js and by scripts/build-data.js (the static build).

const fs    = require('fs');
const path  = require('path');
const parse = require('csv-parse').parse;

const CSV_PATH = path.join(__dirname, '..', 'data', 'retailTransaction.csv');

// Column order of retailTransaction.csv. Exports in the webapp use the same order.
const COLUMNS = [
   'no', 'customerID', 'productID', 'quantity', 'price', 'transactionDate',
   'paymentMethod', 'storeLocation', 'productCategory',
   'discountAppliedInPercentage', 'totalAmount',
];

function toSlug(str) {
   return str
      .toLowerCase()                    // 1. Lowercase
      .trim()                           // 2. Remove leading/trailing spaces
      .replace(/[^a-z0-9\s-]/g, '')     // 3. Remove special chars
      .replace(/\s+/g, '-')             // 4. Replace spaces with hyphens
      .replace(/-+/g, '-');             // 5. Collapse multiple hyphens
}

function toRecord(csvrow) {
   return {
      no               : parseInt(csvrow[0], 10),
      customerID       : parseInt(csvrow[1], 10),
      productID        : csvrow[2],
      quantity         : parseInt(csvrow[3], 10),
      price            : parseFloat(csvrow[4]),
      transactionDate  : csvrow[5],
      paymentMethod    : csvrow[6],
      storeLocation    : csvrow[7],
      productCategory  : csvrow[8],
      discountAppliedInPercentage : parseFloat(csvrow[9]),
      totalAmount      : parseFloat(csvrow[10]),
   };
}

function readAllRetailTransaction(csvPath = CSV_PATH) {
   return new Promise((resolve, reject) => {
      const records = [];
      fs.createReadStream(csvPath)
         .on('error', reject)
         .pipe(parse({ delimiter: ',', from_line: 2 }))
         .on('data', (csvrow) => records.push(toRecord(csvrow)))
         .on('end', () => resolve(records))
         .on('error', reject);
   });
}

// Groups records by the slug of one field, e.g. "credit-card" -> [records].
// Returns the label -> slug map (sorted by label) and the slug -> records map.
function groupBySlug(records, field) {
   const labels = new Map();
   const groups = new Map();
   for (const record of records) {
      const label = record[field];
      if (!labels.has(label)) {
         labels.set(label, toSlug(label));
         groups.set(toSlug(label), []);
      }
      groups.get(labels.get(label)).push(record);
   }
   const sortedLabels = new Map([...labels].sort((a, b) => a[0].localeCompare(b[0])));
   return { labels: sortedLabels, groups };
}

// "12/26/2023 12:32" -> minutes since 2000-01-01 00:00 (no timezone, as in the CSV)
const EPOCH_MS = Date.UTC(2000, 0, 1);
function dateToMinutes(text) {
   const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/.exec(text.trim());
   if (!m) throw new Error(`Unrecognised transactionDate "${text}"`);
   const ms = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]);
   return Math.round((ms - EPOCH_MS) / 60000);
}

// Packs records column by column so the browser can download all 100k rows
// as one small JSON file. Repeated strings become indexes into `dict`,
// money is stored in cents and dates as minutes since `epoch`.
function toColumnar(records) {
   const dict = { productID: [], paymentMethod: [], productCategory: [] };
   const index = (field, value) => {
      let i = dict[field].indexOf(value);
      if (i === -1) i = dict[field].push(value) - 1;
      return i;
   };

   const cols = {
      no: [], customerID: [], productID: [], quantity: [], price: [], transactionDate: [],
      paymentMethod: [], storeLocation: [], productCategory: [],
      discountAppliedInPercentage: [], totalAmount: [],
   };
   for (const r of records) {
      cols.no.push(r.no);
      cols.customerID.push(r.customerID);
      cols.productID.push(index('productID', r.productID));
      cols.quantity.push(r.quantity);
      cols.price.push(Math.round(r.price * 100));
      cols.transactionDate.push(dateToMinutes(r.transactionDate));
      cols.paymentMethod.push(index('paymentMethod', r.paymentMethod));
      cols.storeLocation.push(r.storeLocation);
      cols.productCategory.push(index('productCategory', r.productCategory));
      cols.discountAppliedInPercentage.push(Math.round(r.discountAppliedInPercentage * 100));
      cols.totalAmount.push(Math.round(r.totalAmount * 100));
   }

   return {
      format: 'retail-columnar/1',
      columns: COLUMNS,
      count: records.length,
      epoch: '2000-01-01T00:00',
      scale: { price: 100, discountAppliedInPercentage: 100, totalAmount: 100 },
      dict,
      cols,
   };
}

module.exports = { CSV_PATH, COLUMNS, toSlug, readAllRetailTransaction, groupBySlug, toColumnar };
