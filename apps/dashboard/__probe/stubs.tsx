// Probe-only stubs for Clerk, next/navigation and posthog.
export const ORG = "b645207b-d8e9-40b0-9391-072b777cd9a9";
const w = globalThis as any;
export function useOrganization() { return { organization: w.__signedOut ? null : { id: ORG, name: "Doc Dinners", publicMetadata: {} }, isLoaded: true }; }
export function useUser() { return w.__signedOut ? { user: null, isLoaded: true } : { user: { id: "u1", primaryEmailAddress: { emailAddress: "kevin@docdinners.com" }, firstName: "Kevin" }, isLoaded: true }; }
export function useSession() { return { session: { getToken: async () => null }, isLoaded: true }; }
export function useOrganizationList() { return { createOrganization: async () => ({ id: ORG }), setActive: async () => {}, isLoaded: true, userMemberships: { data: [] } }; }
export function useAuth() { return { isLoaded: true, isSignedIn: !w.__signedOut, orgId: ORG, getToken: async () => null }; }
export function useClerk() { return { signOut: async () => {} }; }
export function usePathname() { return w.__pathname ?? "/"; }
export function useRouter() { return { push: (h: string) => console.log("PUSH", h), replace: () => {}, prefetch: () => {}, refresh: () => {}, back: () => {} }; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
export function useParams() { return w.__params ?? {}; }
export function redirect() {}
export function notFound() {}
export function useSelectedLayoutSegments() { return []; }
export function useSelectedLayoutSegment() { return null; }
const posthog = { capture: () => {}, identify: () => {}, reset: () => {} };
export default posthog;
