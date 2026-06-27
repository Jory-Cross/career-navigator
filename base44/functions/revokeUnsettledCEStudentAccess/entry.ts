import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const PLATFORM_OWNER_ROLE = "platform_owner";

const SETTLED_EVENT_STATUSES = new Set(["paid", "waived"]);

const CE_REGISTRATION_FEE_KINDS = new Set([
  "training_registration",
  "training_reactivation",
]);

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getCanonicalUser(users: any[]) {
  const activeUsers = users.filter(
    (candidate) => candidate?.is_active !== false
  );

  const candidates = activeUsers.length > 0 ? activeUsers : users;

  return [...candidates].sort((a, b) => {
    const aTime = new Date(a?.created_date || 0).getTime();
    const bTime = new Date(b?.created_date || 0).getTime();

    return aTime - bTime;
  })[0];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();

    if (!actor) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const platformOwnerRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: actor.id,
        platform_role: PLATFORM_OWNER_ROLE,
        is_active: true,
      });

    const isPlatformOwner = (
      Array.isArray(platformOwnerRows) ? platformOwnerRows : []
    ).some((row) => row?.is_active !== false);

    if (!isPlatformOwner) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may revoke unsettled CE student access.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const requestedEmails = Array.isArray(body?.emails)
      ? body.emails
      : body?.email
        ? [body.email]
        : [];

    const emails = [
      ...new Set(
        requestedEmails
          .map(normalizeEmail)
          .filter(Boolean)
      ),
    ];

    if (emails.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Provide email or emails.",
        },
        { status: 400 }
      );
    }

    if (emails.length > 25) {
      return Response.json(
        {
          ok: false,
          error: "A maximum of 25 email addresses may be cleaned at one time.",
        },
        { status: 400 }
      );
    }

    const [allUsers, allBillingEvents, allMemberships] =
      await Promise.all([
        base44.asServiceRole.entities.User.list(),
        base44.asServiceRole.entities.OrganizationBillingEvent.list(),
        base44.asServiceRole.entities.CETrainingCohortMember.list(),
      ]);

    const users = Array.isArray(allUsers) ? allUsers : [];
    const billingEvents = Array.isArray(allBillingEvents)
      ? allBillingEvents
      : [];
    const memberships = Array.isArray(allMemberships)
      ? allMemberships
      : [];

    const results = [];

    for (const email of emails) {
      const matchingUsers = users.filter(
        (candidate) => normalizeEmail(candidate?.email) === email
      );

      const targetUser = getCanonicalUser(matchingUsers);

      if (!targetUser?.id) {
        results.push({
          email,
          status: "skipped",
          reason: "user_not_found",
        });
        continue;
      }

      if (targetUser.role !== "ce_student") {
        results.push({
          email,
          user_id: targetUser.id,
          status: "skipped",
          reason: "not_a_ce_student",
        });
        continue;
      }

      const hasSettledRegistration = billingEvents.some((billingEvent) => {
        const isStudentRegistration =
          billingEvent?.billing_subject_type === "student" &&
          CE_REGISTRATION_FEE_KINDS.has(billingEvent?.fee_kind);

        const isSettled =
          SETTLED_EVENT_STATUSES.has(billingEvent?.event_status);

        const matchesUser =
          String(billingEvent?.subject_user_id || "").trim() ===
          String(targetUser.id);

        const matchesEmail =
          normalizeEmail(billingEvent?.subject_verified_email) === email;

        return isStudentRegistration && isSettled && (matchesUser || matchesEmail);
      });

      if (hasSettledRegistration) {
        results.push({
          email,
          user_id: targetUser.id,
          status: "skipped",
          reason: "settled_registration_exists",
        });
        continue;
      }

      const activeMemberRows = memberships.filter(
        (membership) =>
          membership?.user_id === targetUser.id &&
          membership?.cohort_role === "member" &&
          membership?.is_active !== false
      );

      if (activeMemberRows.length > 0) {
        results.push({
          email,
          user_id: targetUser.id,
          status: "skipped",
          reason: "active_cohort_membership_exists",
        });
        continue;
      }

      await base44.asServiceRole.entities.User.update(targetUser.id, {
        role: "employee",
        access_level: null,
        org_id: null,
        manager_id: null,
        cohort_id: null,
        cohort_role: null,
      });

      try {
        await base44.asServiceRole.entities.PlatformAuditLog.create({
          platform_admin_user_id: actor.id,
          event_key: "ce_student_access_revoked_unsettled_cleanup",
          event_summary:
            "Unsettled CE student access was removed during enrollment-flow cleanup.",
          actor_type: "platform_admin",
          target_entity: "User",
          target_record_id: targetUser.id,
          tenant_visible: false,
          occurred_at: new Date().toISOString(),
          details: {
            email,
            prior_role: "ce_student",
            reason:
              "No settled CE registration event and no active cohort membership.",
          },
        });
      } catch (auditError) {
        console.error(
          "revokeUnsettledCEStudentAccess audit error:",
          auditError?.message || auditError
        );
      }

      results.push({
        email,
        user_id: targetUser.id,
        status: "revoked",
      });
    }

    return Response.json({
      ok: true,
      revoked_count: results.filter((row) => row.status === "revoked").length,
      results,
    });
  } catch (error) {
    console.error(
      "revokeUnsettledCEStudentAccess error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to revoke unsettled CE student access.",
      },
      { status: 500 }
    );
  }
});
