import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing API",
  description: "Check balance, account settings, and transaction history via the distribute API.",
};

export default function BillingApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Billing</h1>
      <p className="text-xl text-gray-500 mb-10">
        Balance, account settings, and transaction history.
      </p>

      <div className="prose prose-lg">
        <h2>Check Balance</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/billing/accounts/balance
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "balance_cents": 4523,
  "depleted": false
}`}</code>
        </pre>

        <h2>Get Account</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/billing/accounts
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns credit balance, auto-reload settings, and payment method status.</p>

        <h2>List Transactions</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/billing/accounts/transactions
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "transactions": [
    {
      "id": "tx_abc",
      "amount_cents": -42,
      "description": "Campaign: Q2 Sales Outreach",
      "type": "deduction",
      "created_at": "2026-04-01T12:00:00Z"
    },
    {
      "id": "tx_def",
      "amount_cents": 5000,
      "description": "Credit purchase",
      "type": "credit",
      "created_at": "2026-03-28T00:00:00Z"
    }
  ],
  "has_more": false
}`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const balance = await client.getBillingBalance();
const account = await client.getBillingAccount();
const { transactions } = await client.listBillingTransactions();`}</code>
        </pre>
      </div>
    </div>
  );
}
