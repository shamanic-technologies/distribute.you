import { ClerkProvider } from "@clerk/nextjs";

/**
 * The public share tree.
 *
 * It sits OUTSIDE `(authed)` because nobody here is signed in — the credential in
 * the URL is the entire authority, and every read goes through a proxy that
 * derives its org from that credential and ignores any session.
 *
 * `ClerkProvider` is mounted all the same, and that is deliberate rather than an
 * oversight: these routes render the SAME page components as the dashboard, and
 * a handful of them (the brand status control, via the beta allowlist) call Clerk
 * hooks. Outside a provider those hooks throw, and the alternative — teaching
 * every one of them a second, session-less code path — is how one Audiences page
 * becomes two that drift apart. Signed out, the hooks simply answer null, which
 * is the honest answer here.
 *
 * It grants nothing. A visitor who happens to be signed in to their own account
 * gets exactly the same view as one who is not: the share proxy never reads a
 * session, and `apiCall` sends no Authorization header on a share path.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider dynamic>{children}</ClerkProvider>;
}
