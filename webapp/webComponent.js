// Name: Yap Kai Jun Ethan
// Class: DIT/1B/07
// Admin Number: P2523752

class TransactionCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    // Read attributes passed from index.html
    const customerID = this.getAttribute("customerid") || "N/A";
    const price = this.getAttribute("price") || "N/A";
    const paymentMethod = this.getAttribute("paymentmethod") || "N/A";
    const totalAmount = this.getAttribute("totalamount") || "N/A";

    // Render card layout inside Shadow DOM
    this.shadowRoot.innerHTML = `
      <style>
        .card {
          border: 1px solid #ccc;
          border-radius: 8px;
          padding: 14px;
          margin: 10px 0;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-family: Arial, sans-serif;
        }
        .card h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #2c3e50;
        }
        .card p {
          margin: 4px 0;
          font-size: 14px;
          color: #555;
        }
        .highlight {
          font-weight: bold;
          color: #4a90e2;
        }
      </style>
      <div class="card">
        <h3>Customer ID: <span class="highlight">${customerID}</span></h3>
        <p>Price: $${isNaN(price) ? price : parseFloat(price).toFixed(2)}</p>
        <p>Payment Method: ${paymentMethod}</p>
        <p>Total Amount: $${isNaN(totalAmount) ? totalAmount : parseFloat(totalAmount).toFixed(2)}</p>
      </div>
    `;
  }
}

// Register the custom element
customElements.define("transaction-card", TransactionCard);