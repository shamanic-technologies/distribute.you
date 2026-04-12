import { URLS } from "@distribute/content";

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || URLS.dashboard;
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || URLS.docs;
const API_URL = process.env.NEXT_PUBLIC_API_URL || URLS.api;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || URLS.landing;

export const ENV_URLS = {
  landing: SITE_URL,
  signUp: `${DASHBOARD_URL}/sign-up`,
  signIn: `${DASHBOARD_URL}/sign-in`,
  apiKeys: `${DASHBOARD_URL}/api-keys`,
  docs: DOCS_URL,
  apiDocs: `${API_URL}/docs`,
  performance: "/performance",
  github: URLS.github,
  twitter: URLS.twitter,
} as const;
