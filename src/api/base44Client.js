import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getOrgId } from "@/lib/orgContext"; // create next step
export const base44 = createClient({
  appId: appParams.appId,
  token: appParams.token,
  functionsVersion: appParams.functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: appParams.appBaseUrl,
});

export default base44;
export function withOrgFilter(filters = {}) {
  const orgId = getOrgId();
  if (!orgId) return filters;
  return { ...filters, org_id: orgId };
}
