// Name: Yap Kai Jun Ethan
// Class: DIT/1B/07
// Admin Number: P2523752

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const { readAllRetailTransaction, groupBySlug, toColumnar } = require('./lib/dataset');

const PORT       = process.env.PORT || 8081;
const HOST       = process.env.HOST || 'localhost';
const WEBAPP_DIR = path.join(__dirname, '..', 'webapp');

const app = express();
app.use(cors());
app.use(express.json());

let firstFiveRecords;
let paymentMethods;      // { labels: Map(label -> slug), groups: Map(slug -> records) }
let productCategories;
let columnarJson;        // packed dataset served to the webapp

// Health check e.g. http://localhost:8081/health
app.get('/health', (req, res) => {
   res.send('Your Data Host is Ready!');
});

// Endpoint first 5 records e.g. http://localhost:8081/retailData5
app.get('/retailData5', (req, res) => {
   res.json(firstFiveRecords);
});

// Endpoint Query By paymentMethod format: http://localhost:8081/byPaymentMethod/:paymentMethod
//                                 e.g.  : http://localhost:8081/byPaymentMethod/credit-card
app.get('/byPaymentMethod/:paymentMethod', (req, res) => {
   res.json(paymentMethods.groups.get(req.params.paymentMethod) || []);
});

// Endpoint Query Product category format: http://localhost:8081/byProductCategory/:productCategory
//                                 e.g.  : http://localhost:8081/byProductCategory/home-decor
app.get('/byProductCategory/:productCategory', (req, res) => {
   res.json(productCategories.groups.get(req.params.productCategory) || []);
});

// Endpoint return unique product category e.g. http://localhost:8081/productCategory
app.get('/productCategory', (req, res) => {
   res.json(Array.from(productCategories.labels));
});

// Endpoint return unique paymentMethod e.g. http://localhost:8081/paymentMethod
app.get('/paymentMethod', (req, res) => {
   res.json(Array.from(paymentMethods.labels));
});

// Whole dataset in the packed format the webapp loads (same file the static build writes)
app.get('/data/transactions.json', (req, res) => {
   res.type('application/json').send(columnarJson);
});

// The webapp itself, so http://localhost:8081 opens the dashboard
app.use(express.static(WEBAPP_DIR));

readAllRetailTransaction().then((records) => {
   firstFiveRecords  = records.slice(0, 5);
   paymentMethods    = groupBySlug(records, 'paymentMethod');
   productCategories = groupBySlug(records, 'productCategory');
   columnarJson      = JSON.stringify(toColumnar(records));

   app.listen(PORT, HOST, () => {
      console.log(`Loaded ${records.length} transactions`);
      console.log(`Retail Transaction WebApp running at http://${HOST}:${PORT}`);
   });
}).catch((error) => {
   console.error('Could not load the dataset:', error);
   process.exit(1);
});
// to run the server: npm start
