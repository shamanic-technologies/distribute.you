"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

type AccountType = "agency" | "company";
type Step = "value-prop" | "type-selection" | "name-input" | "success";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.mcpfactory.org";

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>("value-prop");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setStep("name-input");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !accountType) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${API_URL}/v1/apps/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim().toLowerCase().replace(/\s+/g, "-"), type: accountType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(data.error || "Registration failed");
      }
      const data = await res.json();
      setApiKey(data.apiKey || null);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Step 1: Value Proposition
  if (step === "value-prop") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12 text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-4">
          Welcome to Distribute
        </h1>
        <p className="text-lg text-gray-600 mb-3">
          The done-for-you distribution automation platform.
        </p>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Full control over your distribution strategy. Crowdsourced best practices from the industry — always the best available strategy, at API prices.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Done for you</h3>
            <p className="text-xs text-gray-500">Automated lead finding, outreach, emails & reporting</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Full control</h3>
            <p className="text-xs text-gray-500">Choose strategies, set budgets, monitor results in real time</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Crowdsourced</h3>
            <p className="text-xs text-gray-500">Best strategies from the community, at API-level prices</p>
          </div>
        </div>
        <button
          onClick={() => setStep("type-selection")}
          className="px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium text-lg"
        >
          Get Started
        </button>
      </div>
    );
  }

  // Step 2: Type Selection
  if (step === "type-selection") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
        <button
          onClick={() => setStep("value-prop")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
          How will you use Distribute?
        </h2>
        <p className="text-gray-500 mb-8">
          This helps us set up your workspace correctly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleTypeSelect("agency")}
            className="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-primary-400 hover:shadow-md transition group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Agency</h3>
            <p className="text-sm text-gray-500">
              Manage distribution for multiple client brands from one dashboard
            </p>
          </button>
          <button
            onClick={() => handleTypeSelect("company")}
            className="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-primary-400 hover:shadow-md transition group"
          >
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-200 transition">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Company</h3>
            <p className="text-sm text-gray-500">
              Automate distribution for your own brand
            </p>
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Name Input
  if (step === "name-input") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
        <button
          onClick={() => setStep("type-selection")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
          {accountType === "agency" ? "What's your agency name?" : "What's your company name?"}
        </h2>
        <p className="text-gray-500 mb-6">
          This will be used to set up your workspace.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={accountType === "agency" ? "e.g. Growth Partners" : "e.g. Acme Inc"}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) handleSubmit();
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Setting up..." : "Create Workspace"}
          </button>
        </div>
      </div>
    );
  }

  // Step 4: Success
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
        You&apos;re all set!
      </h2>
      <p className="text-gray-500 mb-6">
        Your workspace has been created successfully.
      </p>
      {apiKey && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-gray-500 font-medium mb-2">Your API Key (save it — shown only once)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-gray-200 truncate">
              {apiKey}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => router.push("/")}
        className="px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
