const express = require('express');
const fs      = require('fs');
const app     = express();
const parse   = require("csv-parse").parse;
const cors    = require('cors');

app.use(cors());
app.use(express.json());

let allRetailData;
let firstFiveRecords;
let paymentMethodMap;
let productCategoryMap;

let paymentMethodDataMap;
let productCategoryDataMap;

function toSlug(str) {
  return str
    .toLowerCase()                    // 1. Lowercase
    .trim()                           // 2. Remove leading/trailing spaces
    .replace(/[^a-z0-9\s-]/g, '')     // 3. Remove special chars
    .replace(/\s+/g, '-')             // 4. Replace spaces with hyphens
    .replace(/-+/g, '-');             // 5. Collapse multiple hyphens
}

async function readAllRetailTransaction() {
   return new Promise((resolve, reject) => {
      const rData                  = [];
      const paymentMethodMap       = new Map();
      const productCategoryMap     = new Map();
      const productCategoryDataMap = new Map();
      const paymentMethodDataMap   = new Map();


      fs.createReadStream("./data/retailTransaction.csv")
         .pipe(parse({ delimiter: ',', from_line: 2 }))
         .on('data', function (csvrow) {
            let newRecord = {
               no               : csvrow[0],
               customerID       : csvrow[1],
               productID        : csvrow[2],
               quantity         : csvrow[3],
               price            : parseFloat(csvrow[4]),
               transactionDate  : csvrow[5],
               paymentMethod    : csvrow[6],
               storeLocation    : csvrow[7],
               productCategory  : csvrow[8],
               discountAppliedInPercentage : parseFloat(csvrow[9]),
               totalAmount      : parseFloat(csvrow[10]),
          };
            
          const paymentSlug = toSlug(newRecord.paymentMethod);
          if (!paymentMethodMap.has(newRecord.paymentMethod)) {
             paymentMethodMap.set(newRecord.paymentMethod, paymentSlug);
             paymentMethodDataMap.set(paymentSlug, []);
          }
          paymentMethodDataMap.get(paymentSlug).push(newRecord);

          const productCategorySlug = toSlug(newRecord.productCategory);
          if (!productCategoryMap.has(newRecord.productCategory)) {
             productCategoryMap.set(newRecord.productCategory, productCategorySlug);
             productCategoryDataMap.set(productCategorySlug, []);
          }
          productCategoryDataMap.get(productCategorySlug).push(newRecord);            

          rData.push(newRecord);
         })
         .on('end', function () {
            resolve({rData, paymentMethodMap, productCategoryMap, paymentMethodDataMap, productCategoryDataMap});
         })
         .on('error', function (err) {
            reject(err);
         });
   });
}

// This responds with " Nothing" on the homepage
app.get('/', function (req, res) {
   console.log("Host data ready");
   res.send('Your Data Host is Ready!');
})

//Endpoint All Data e.g. http://localhost:8081/retailData5
app.get('/retailData5', function (req, res) {
   res.json(firstFiveRecords);
})

// Endpoint Query By paymentMethod format: http://localhost:8081/byPaymentMethod/:paymentMethod
//                                 e.g.  : http://localhost:8081/byPaymentMethod/credit-card
app.get('/byPaymentMethod/:paymentMethod', (req, res) => {
   let paymentMethod = req.params.paymentMethod;
   
   const result = paymentMethodDataMap.get(paymentMethod) || [];
   res.status(200);
   res.type('application/json');
   res.json(result);     
});

// Endpoint Query Product category format: http://localhost:8081/byProductCategory/:productCategory
//                                 e.g.  : http://localhost:8081/byProductCategory/home-decor
app.get('/byProductCategory/:productCategory', (req, res) => {   
   let productCategory = req.params.productCategory ;
 
   const result = productCategoryDataMap.get(productCategory) || [];
   res.status(200);
   res.type('application/json');
   res.json(result);     
});

// Endpoint return unique product category e.g. http://localhost:8081/productCategory
app.get('/productCategory', (req, res) => {   
   res.status(200);
   res.json(Array.from(productCategoryMap).sort((a, b)=> a[0].localeCompare(b[0])));     
});


// Endpoint return unique paymentMethod e.g. http://localhost:8081/paymentMethod
app.get('/paymentMethod', (req, res) => {   
   res.status(200);
   res.json(Array.from(paymentMethodMap).sort((a, b)=> a[0].localeCompare(b[0])));     
});

readAllRetailTransaction().then((alldata) => {
   allRetailData          = alldata.rData;
   firstFiveRecords       = allRetailData.slice(0, 5);
   paymentMethodMap       = alldata.paymentMethodMap;
   productCategoryMap     = alldata.productCategoryMap;
   paymentMethodDataMap   = alldata.paymentMethodDataMap;
   productCategoryDataMap = alldata.productCategoryDataMap;

   //console.log(paymentMethodMap);
   //console.log(productCategoryMap);

   const server = app.listen(8081, 'localhost', () => {
      const host = server.address().address
      const port = server.address().port
      console.log(`Example app listening at http://${host}:${port}`);
   })
}).catch((error) => {
   console.log("Error:", error)
});
// to run the server: node server