"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join waitlist");
      }

      setStatus("success");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
        <p className="text-green-400 font-medium">You&apos;re on the list!</p>
        <p className="text-green-400/70 text-sm mt-1">We&apos;ll notify you when we launch.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 outline-none transition"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition disabled:opacity-50"
        >
          {status === "loading" ? "Joining..." : "Get Access"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-red-400 text-sm mt-2 text-center">{errorMessage}</p>
      )}
    </div>
  );
}
