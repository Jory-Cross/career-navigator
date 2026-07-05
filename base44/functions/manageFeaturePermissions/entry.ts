import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const ROLE_ACCESS_LEVELS: Record<string, string> = {
  admin: "admin",
  management: "staff",
  employee: "staff",
  client: "client_portal",
  pre_ets: "client_portal",
  dspd: "client_portal",
  ce_instructor: "ce_training_portal",
  ce_student: "ce_training_portal",
};

const CONFIGURABLE_ROLES = new Set([
  "management",
  "employee",
  "client",
  "pre_ets",
  "dspd",
  "ce_instructor",
  "ce_student",
]);

const FEATURE_CATALOG: Record<string, { label: string; category: string }> = {
  dashboard: { label: "Dashboard", category: "core" },
  clients: { label: "Clients", category: "clients" },
  time_tracking: { label: "Time Tracking", category: "core" },
  calendar: { label: "Calendar", category: "core" },
  reports: { label: "Reports", category: "reporting" },
  tasks: { label: "Tasks", category: "core" },
  email_templates: { label: "Email Templates", category: "reporting" },
  documents: { label: "Documents", category: "clinical" },
  assessments: { label: "Assessments", category: "clinical" },
  recommendations: { label: "Recommendations", category: "clinical" },
  ai_agents: { label: "AI Agents", category: "admin" },
  app_analytics: { label: "App Analytics", category: "admin" },
  org_dashboard: { label: "My Organization", category: "admin" },
  employees: { label: "Employees", category: "admin" },
  pre_ets: { label: "Pre-ETS", category: "client_categories" },
  dspd: { label: "DSPD", category: "client_categories" },
  job_seeker: { label: "Job Seeker", category: "client_categories" },
  employed: { label: "Employed", category: "client_categories" },
  customized_employment: {
    label: "Customized Employment",
    category: "client_categories",
  },
  client_details: { label: "Client Details", category: "client_detail" },
  client_onboarding: { label: "Onboarding", category: "client_detail" },
  client_intake_packet: { label: "Intake Packet", category: "client_detail" },
  client_applications: { label: "Applications", category: "client_detail" },
  client_ai_job_search: { label: "AI Job Search", category: "client_detail" },
  client_interview_prep: { label: "Interview Prep", category: "client_detail" },
  client_assessments: { label: "Assessments", category: "client_detail" },
  client_documents: { label: "Documents", category: "client_detail" },
  client_tasks: { label: "Tasks", category: "client_detail" },
  client_time: { label: "Time / Job Supports", category: "client_detail" },
  client_meetings: { label: "Meetings", category: "client_detail" },
  client_activity: { label: "Activity", category: "client_detail" },
  client_assistant: { label: "Assistant", category: "client_detail" },
  client_portal: { label: "Client Portal", category: "client_detail" },
  client_send_email: { label: "Send Email", category: "client_detail" },
  client_test_onet: { label: "Test O*NET", category: "client_detail" },
  client_add_actions: { label: "Add Actions", category: "client_detail" },
  client_pre_ets_wble_forms: { label: "Pre-ETS WBLE Forms", category: "client_detail" },
  client_pre_ets_program_checklist: { label: "Pre-ETS Program Checklist", category: "client_detail" },
  client_pre_ets_iep_transition: { label: "Pre-ETS IEP & Transition", category: "client_detail" },
  client_pre_ets_skills_exploration: { label: "Pre-ETS Skills Exploration", category: "client_detail" },
  client_pre_ets_meetings: { label: "Pre-ETS Meetings", category: "client_detail" },
  client_portal_intake_forms: { label: "Intake Forms", category: "general_client_portal" },
  client_portal_applications: { label: "Applications", category: "general_client_portal" },
  client_portal_recommendations: { label: "Recommendations", category: "general_client_portal" },
  client_portal_tasks: { label: "Tasks", category: "general_client_portal" },
  client_portal_documents: { label: "Documents", category: "general_client_portal" },
  client_portal_meetings: { label: "Meetings", category: "general_client_portal" },
  client_portal_clock_in_out: { label: "Clock In/Out", category: "pre_ets_portal" },
  client_portal_program_checklist: { label: "Program Checklist", category: "pre_ets_portal" },
  client_portal_iep_transition_plan: { label: "IEP & Transition Plan", category: "pre_ets_portal" },
  client_portal_skills_exploration: { label: "Skills Exploration", category: "pre_ets_portal" },
  client_portal_assessments: { label: "Assessments", category: "pre_ets_portal" },
  client_portal_wble_forms: { label: "WBLE Forms", category: "pre_ets_portal" },
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isActive(record: any) {
  return record?.is_active !== false && record?.is_archived !== true;
}

function getCanonicalRole(user: any) {
  const role = normalizeText(user?.role).toLowerCase();
  const accessLevel = normalizeText(user?.access_level).toLowerCase();

  return ROLE_ACCESS_LEVELS[role] === accessLevel ? role : "";
}

function projectPermission(permission: any) {
  return {
    id: normalizeText(permission?.id),
    role: normalizeText(permission?.role),
    feature_key: normalizeText(permission?.feature_key),
    visible: permission?.visible !== false,
    can_interact: permission?.can_interact !== false,
  };
}

async function resolveCallerContext(base44: any, authenticatedUserId: string) {
  const caller = await base44.asServiceRole.entities.User.get(
    authenticatedUserId
  ).catch(() => null);

  if (!caller || !isActive(caller)) {
    throw new RequestError(403, "Your account is inactive or unavailable.");
  }

  const role = getCanonicalRole(caller);
  const organizationId = normalizeText(caller?.org_id);

  if (!role || !organizationId) {
    throw new RequestError(
      403,
      "Your account is not authorized to access feature permissions."
    );
  }

  const organization = await base44.asServiceRole.entities.Organization.get(
    organizationId
  ).catch(() => null);

  if (!organization || !isActive(organization)) {
    throw new RequestError(403, "Your organization is inactive or unavailable.");
  }

  return { caller, role, organizationId };
}

function requireOrganizationAdmin(context: any) {
  if (context.role !== "admin") {
    throw new RequestError(
      403,
      "Only organization administrators may manage feature permissions."
    );
  }
}

function validatePermissionInput(body: any) {
  const role = normalizeText(body?.role).toLowerCase();
  const featureKey = normalizeText(body?.feature_key);

  if (!CONFIGURABLE_ROLES.has(role)) {
    throw new RequestError(400, "Choose a configurable role.");
  }

  if (!FEATURE_CATALOG[featureKey]) {
    throw new RequestError(400, "Choose a supported feature.");
  }

  if (typeof body?.visible !== "boolean") {
    throw new RequestError(400, "Feature visibility must be true or false.");
  }

  if (
    body?.can_interact !== undefined &&
    typeof body?.can_interact !== "boolean"
  ) {
    throw new RequestError(400, "Feature interaction must be true or false.");
  }

  return {
    role,
    featureKey,
    visible: body.visible,
    canInteract: body.can_interact !== false,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "This route accepts POST requests only." },
        { status: 405 }
      );
    }

    const body: any = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action).toLowerCase();

    if (!new Set(["get_my_permissions", "list_for_admin", "set_for_admin"]).has(action)) {
      throw new RequestError(400, "Choose a valid feature-permission action.");
    }

    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me().catch(() => null);

    if (!authenticatedUser?.id) {
      throw new RequestError(401, "You must be signed in to access feature permissions.");
    }

    const context = await resolveCallerContext(base44, authenticatedUser.id);

    if (action === "get_my_permissions") {
      if (context.role === "admin") {
        return Response.json({
          ok: true,
          is_admin: true,
          role: context.role,
          permissions: [],
        });
      }

      if (!CONFIGURABLE_ROLES.has(context.role)) {
        return Response.json({
          ok: true,
          is_admin: false,
          role: context.role,
          permissions: [],
        });
      }

      const rows = await base44.asServiceRole.entities.FeaturePermission.filter({
        org_id: context.organizationId,
        role: context.role,
      });

      return Response.json({
        ok: true,
        is_admin: false,
        role: context.role,
        permissions: asArray(rows)
          .filter(
            (row: any) =>
              normalizeText(row?.org_id) === context.organizationId &&
              normalizeText(row?.role) === context.role &&
              Boolean(FEATURE_CATALOG[normalizeText(row?.feature_key)])
          )
          .map(projectPermission),
      });
    }

    requireOrganizationAdmin(context);

    if (action === "list_for_admin") {
      const rows = await base44.asServiceRole.entities.FeaturePermission.filter({
        org_id: context.organizationId,
      });

      return Response.json({
        ok: true,
        permissions: asArray(rows)
          .filter(
            (row: any) =>
              normalizeText(row?.org_id) === context.organizationId &&
              CONFIGURABLE_ROLES.has(normalizeText(row?.role)) &&
              Boolean(FEATURE_CATALOG[normalizeText(row?.feature_key)])
          )
          .map(projectPermission),
      });
    }

    const input = validatePermissionInput(body);
    const matches = asArray(
      await base44.asServiceRole.entities.FeaturePermission.filter({
        org_id: context.organizationId,
        role: input.role,
        feature_key: input.featureKey,
      })
    ).filter(
      (row: any) =>
        normalizeText(row?.org_id) === context.organizationId &&
        normalizeText(row?.role) === input.role &&
        normalizeText(row?.feature_key) === input.featureKey
    );

    if (matches.length > 1) {
      throw new RequestError(
        409,
        "Multiple records exist for this role and feature. A platform administrator must repair the duplicate records before it can be changed."
      );
    }

    const catalogEntry = FEATURE_CATALOG[input.featureKey];
    const payload = {
      org_id: context.organizationId,
      role: input.role,
      feature_key: input.featureKey,
      label: catalogEntry.label,
      category: catalogEntry.category,
      visible: input.visible,
      can_interact: input.canInteract,
    };

    const saved = matches[0]?.id
      ? await base44.asServiceRole.entities.FeaturePermission.update(
          matches[0].id,
          payload
        )
      : await base44.asServiceRole.entities.FeaturePermission.create(payload);

    return Response.json({
      ok: true,
      permission: projectPermission(saved),
    });
  } catch (error: any) {
    const status = error instanceof RequestError ? error.status : 500;

    if (!(error instanceof RequestError)) {
      console.error(
        "manageFeaturePermissions error:",
        error?.message || error
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : "Unable to manage feature permissions. Please try again.",
      },
      { status }
    );
  }
});