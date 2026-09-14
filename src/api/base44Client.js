import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getOrgId } from "@/lib/orgContext"; // create next step
import { applyViewAs, getViewAsUser } from "@/lib/viewAsState";
export const base44 = createClient({
  appId: appParams.appId,
  token: appParams.token,
  functionsVersion: appParams.functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: appParams.appBaseUrl,
});

// ─── View As (admin impersonation) ─────────────────────────────────────────
// While an admin uses "View As", base44.auth.me() returns the impersonated
// user so every page that resolves the current user reflects that perspective.
const _realMe = base44.auth.me.bind(base44.auth);
base44.auth.me = async () => {
  const user = await _realMe();
  return user ? applyViewAs(user) : user;
};

// Prevent accidental writes to the real account while impersonating.
const _realUpdateMe = base44.auth.updateMe.bind(base44.auth);
base44.auth.updateMe = async (data) => {
  if (getViewAsUser()) {
    throw new Error("Profile changes are unavailable while viewing as another user.");
  }
  return _realUpdateMe(data);
};

export default base44;
export function withOrgFilter(filters = {}) {
  const orgId = getOrgId();
  if (!orgId) return filters;
  return { ...filters, org_id: orgId };
}