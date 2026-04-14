import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Billing API",
  description: "Check balance, account settings, and transaction history via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Billing API

## Check Balance
GET /v1/billing/accounts/balance
Returns: balance_cents, depleted

## Get Account
GET /v1/billing/accounts

## List Transactions
GET /v1/billing/accounts/transactions

## TypeScript Client
const balance = await client.getBillingBalance();
const account = await client.getBillingAccount();
const { transactions } = await client.listBillingTransactions();`;

export default function BillingApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Billing</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Balance, account settings, and transaction history.
      </p>

      <div className="prose">
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
