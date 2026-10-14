import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata = docsMetadata("/api/billing");

const LLM_INSTRUCTIONS = `# Billing API

How money works: the organization prepays a balance (see /authentication for prepaid_checkout). Each action is billed at the public prices on https://distribute.you/catalog. Each campaign spends only up to its caps (a max budget and/or a max volume, each with a period), set on the campaign's sales funnel: see the Campaigns API. Method skill: GET /v1/skills/budget-and-billing.

## Check Balance
GET /v1/billing/accounts/balance
Returns: balance_cents, depleted

## Get Account
GET /v1/billing/accounts`;

export default function BillingApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/api/billing")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Balance and account settings.
      </p>

      <div className="prose">
        <h2>How money works</h2>
        <p>
          Your organization prepays a balance (see <a href="/authentication">Authentication</a>).
          Each action is billed at the public prices on{" "}
          <a href="https://distribute.you/catalog">distribute.you/catalog</a>. Each campaign
          spends only up to its caps, a max budget and/or a max volume with a period, set on the{" "}
          <a href="/api/campaigns">Campaigns API</a>. The <code>budget-and-billing</code> method
          skill (<code>GET /v1/skills/budget-and-billing</code>) has the rest.
        </p>

        <h2>Check Balance</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/billing/accounts/balance
Authorization: Bearer distrib.usr_YOUR_KEY`}</code>
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
Authorization: Bearer distrib.usr_YOUR_KEY`}</code>
        </pre>
        <p>Returns credit balance, auto-topup settings, and payment method status.</p>
      </div>
    </div>
  );
}
