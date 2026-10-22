// Writes webapp/data/transactions.json from server/data/retailTransaction.csv,
// so the webapp can run as a static site (e.g. GitHub Pages) without the server.
// Run with: npm run build:data   (from the server folder)

const fs   = require('fs');
const path = require('path');
const { readAllRetailTransaction, toColumnar } = require('../lib/dataset');

const OUT_PATH = path.join(__dirname, '..', '..', 'webapp', 'data', 'transactions.json');

readAllRetailTransaction()
   .then((records) => {
      fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
      fs.writeFileSync(OUT_PATH, JSON.stringify(toColumnar(records)));
      const sizeMb = (fs.statSync(OUT_PATH).size / 1e6).toFixed(1);
      console.log(`Wrote ${records.length} records to ${OUT_PATH} (${sizeMb} MB)`);
   })
   .catch((error) => {
      console.error('Could not build the dataset:', error);
      process.exit(1);
   });
