// Name: Yap Kai Jun Ethan
// Class: DIT/1B/07
// Admin Number: P2523752

// <transaction-card> shows one transaction as a compact card.
// Attributes: rank, no, customerid, date, category, paymentmethod,
//             quantity, price, totalamount
// Colours come from the page's CSS variables, which pass into the shadow DOM,
// so the card follows light and dark mode.

import { escapeHtml, formatMoney } from '../format.js';

const ATTRIBUTES = ['rank', 'no', 'customerid', 'date', 'category', 'paymentmethod', 'quantity', 'price', 'totalamount'];

const money = (value) => (value === '' || isNaN(value) ? 'N/A' : formatMoney(parseFloat(value)));

class TransactionCard extends HTMLElement {
  static observedAttributes = ATTRIBUTES;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  render() {
    const a = Object.fromEntries(ATTRIBUTES.map((name) => [name, escapeHtml(this.getAttribute(name) ?? '')]));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 4px 14px;
          align-items: center;
          padding: 14px 16px;
          border: 1px solid var(--border, #e4e7ec);
          border-radius: 12px;
          background: var(--surface, #fff);
          color: var(--text, #0f172a);
          font: inherit;
        }
        .rank {
          grid-row: span 2;
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent-soft, #e8f1fc);
          color: var(--accent-text, #1c5cab);
          font-weight: 600;
          font-size: 13px;
        }
        .title { font-weight: 600; font-size: 14px; }
        .meta { color: var(--text-muted, #5b6472); font-size: 12.5px; }
        .total {
          grid-row: span 2;
          text-align: right;
          font-weight: 600;
          font-size: 15px;
          font-variant-numeric: tabular-nums;
        }
        .total small {
          display: block;
          font-weight: 400;
          font-size: 12px;
          color: var(--text-muted, #5b6472);
        }
      </style>
      <article class="card">
        <span class="rank" aria-label="Rank">${a.rank || '#'}</span>
        <span class="title">Customer ${a.customerid || 'N/A'}</span>
        <span class="total">${money(a.totalamount)}
          <small>${a.quantity || '?'} × ${money(a.price)}</small>
        </span>
        <span class="meta">${[a.category, a.paymentmethod, a.date].filter(Boolean).join(' · ')}${a.no ? ` · No. ${a.no}` : ''}</span>
      </article>
    `;
  }
}

customElements.define('transaction-card', TransactionCard);
