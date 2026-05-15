import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Billing API",
  description: "Check balance and account settings via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Billing API

## Check Balance
GET /v1/billing/accounts/balance
Returns: balance_cents, depleted

## Get Account
GET /v1/billing/accounts

## TypeScript Client
const balance = await client.getBillingBalance();
const account = await client.getBillingAccount();`;

export default function BillingApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Billing</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Balance and account settings.
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
        <p>Returns credit balance, auto-topup settings, and payment method status.</p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const balance = await client.getBillingBalance();
const account = await client.getBillingAccount();`}</code>
        </pre>
      </div>
    </div>
  );
}
