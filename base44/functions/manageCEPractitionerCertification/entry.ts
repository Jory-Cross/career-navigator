import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_VERIFIER_ROLES = new Set(["platform_owner"]);

const VALID_CERTIFICATION_SOURCES = new Set([
  "trainer_business",
  "external_provider",
  "legacy_migration",
  "manual_verification",
]);

function getRequiredString(value: unknown, fieldName: string) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function getOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function getOptionalIsoTimestamp(value: unknown, fieldName: string) {
  const normalized = getOptionalString(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }

  return parsed.toISOString();
}

async function getPlatformRoles(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.PlatformAdmin.filter({
    user_id: userId,
    is_active: true,
  });

  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.is_active !== false)
        .map((row) => row?.platform_role)
        .filter(Boolean)
    )
  );
}

async function getSingleCertificationForUser(base44: any, userId: string) {
  const rows =
    await base44.asServiceRole.entities.CEPractitionerCertification.filter({
      user_id: userId,
    });

  const certifications = Array.isArray(rows) ? rows : [];

  if (certifications.length > 1) {
    throw new Error(
      "More than one CE practitioner certification record exists for this user. No change was made."
    );
  }

  return certifications[0] || null;
}

async function writeAuditLog(
  base44: any,
  userId: string,
  eventKey: string,
  eventSummary: string,
  certificationRecordId: string,
  details: Record<string, unknown>
) {
  try {
    await base44.asServiceRole.entities.PlatformAuditLog.create({
      platform_admin_user_id: userId,
      event_key: eventKey,
      event_summary: eventSummary,
      actor_type: "platform_admin",
      target_entity: "CEPractitionerCertification",
      target_record_id: certificationRecordId,
      tenant_visible: false,
      occurred_at: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error(
      "manageCEPractitionerCertification audit error:",
      error?.message || error
    );
  }
}

/**
 * manageCEPractitionerCertification
 *
 * Supported actions:
 * - list_all
 * - read_user
 * - create_pending
 * - verify
 * - revoke
 *
 * Current authority:
 * - Platform Owner only.
 *
 * Important:
 * - This function records certification status only.
 * - It does not grant CE Practitioner Workspace access.
 * - Future workspace eligibility must still require:
 *   1. Organization CE Practitioner Workspace entitlement
 *   2. Verified certification
 *   3. Explicit organization-scoped practitioner role assignment
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const platformRoles = await getPlatformRoles(base44, user.id);

    const canManageCertification = platformRoles.some((role) =>
      ALLOWED_VERIFIER_ROLES.has(role)
    );

    if (!canManageCertification) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may manage CE practitioner certification records.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (
      ![
        "list_all",
        "read_user",
        "create_pending",
        "verify",
        "revoke",
      ].includes(action)
    ) {
      return Response.json(
        {
          ok: false,
          error: "A valid certification-management action is required.",
        },
        { status: 400 }
      );
    }

    if (action === "list_all") {
      const rows =
        await base44.asServiceRole.entities.CEPractitionerCertification.list();

      const certifications = (Array.isArray(rows) ? rows : [])
        .map((record) => ({
          id: record.id,
          user_id: record.user_id,
          certification_status: record.certification_status,
          completed_at: record.completed_at || null,
          verified_at: record.verified_at || null,
          verified_by_user_id: record.verified_by_user_id || null,
          revoked_at: record.revoked_at || null,
          revoked_by_user_id: record.revoked_by_user_id || null,
          certification_source: record.certification_source,
          source_cohort_id: record.source_cohort_id || null,
          notes: record.notes || "",
        }))
        .sort((a, b) =>
          String(a.user_id).localeCompare(String(b.user_id))
        );

      return Response.json({
        ok: true,
        action,
        certifications,
      });
    }

    const targetUserId = getRequiredString(body?.user_id, "user_id");

    if (action === "read_user") {
      const certification = await getSingleCertificationForUser(
        base44,
        targetUserId
      );

      return Response.json({
        ok: true,
        action,
        certification,
      });
    }

    const certificationSource = String(
      body?.certification_source || ""
    ).trim();

    if (
      (action === "create_pending" || action === "verify") &&
      !VALID_CERTIFICATION_SOURCES.has(certificationSource)
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "A valid certification_source is required for pending or verified certification records.",
        },
        { status: 400 }
      );
    }

    const existingCertification = await getSingleCertificationForUser(
      base44,
      targetUserId
    );

    if (action === "create_pending") {
      if (existingCertification) {
        return Response.json(
          {
            ok: false,
            error:
              "A CE practitioner certification record already exists for this user. No duplicate record was created.",
            existing_certification_status:
              existingCertification.certification_status,
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      const createdCertification =
        await base44.asServiceRole.entities.CEPractitionerCertification.create(
          {
            user_id: targetUserId,
            certification_status: "pending_verification",
            completed_at: getOptionalIsoTimestamp(
              body?.completed_at,
              "completed_at"
            ),
            certification_source: certificationSource,
            source_cohort_id: getOptionalString(body?.source_cohort_id),
            notes: getOptionalString(body?.notes),
          }
        );

      await writeAuditLog(
        base44,
        user.id,
        "ce_practitioner_certification_pending_created",
        "A CE practitioner certification record was created pending verification.",
        createdCertification.id,
        {
          user_id: targetUserId,
          certification_source: certificationSource,
          source_cohort_id:
            getOptionalString(body?.source_cohort_id) || null,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification: createdCertification,
      });
    }

    if (action === "verify") {
      if (existingCertification?.certification_status === "verified") {
        return Response.json(
          {
            ok: false,
            error:
              "This user already has a verified CE practitioner certification record. No change was made.",
          },
          { status: 409 }
        );
      }

      if (existingCertification?.certification_status === "revoked") {
        return Response.json(
          {
            ok: false,
            error:
              "This certification record was revoked. Create a future re-verification workflow rather than overwriting revocation history.",
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      const certificationData = {
        user_id: targetUserId,
        certification_status: "verified",
        completed_at:
          getOptionalIsoTimestamp(body?.completed_at, "completed_at") ||
          existingCertification?.completed_at ||
          undefined,
        verified_at: now,
        verified_by_user_id: user.id,
        certification_source: certificationSource,
        source_cohort_id:
          getOptionalString(body?.source_cohort_id) ||
          existingCertification?.source_cohort_id ||
          undefined,
        notes:
          getOptionalString(body?.notes) ||
          existingCertification?.notes ||
          undefined,
      };

      let certificationRecordId = existingCertification?.id || null;
      let created = false;

      if (existingCertification) {
        await base44.asServiceRole.entities.CEPractitionerCertification.update(
          existingCertification.id,
          certificationData
        );
      } else {
        const createdCertification =
          await base44.asServiceRole.entities.CEPractitionerCertification.create(
            certificationData
          );

        certificationRecordId = createdCertification.id;
        created = true;
      }

      await writeAuditLog(
        base44,
        user.id,
        created
          ? "ce_practitioner_certification_verified_created"
          : "ce_practitioner_certification_verified",
        created
          ? "A verified CE practitioner certification record was created."
          : "A pending CE practitioner certification record was verified.",
        certificationRecordId,
        {
          user_id: targetUserId,
          certification_source: certificationSource,
          source_cohort_id:
            certificationData.source_cohort_id || null,
        }
      );

      return Response.json({
        ok: true,
        action,
        created,
        certification_record_id: certificationRecordId,
        certification_status: "verified",
      });
    }

    if (action === "revoke") {
      if (!existingCertification) {
        return Response.json(
          {
            ok: false,
            error:
              "No CE practitioner certification record exists for this user.",
          },
          { status: 404 }
        );
      }

      if (existingCertification.certification_status !== "verified") {
        return Response.json(
          {
            ok: false,
            error:
              "Only a verified CE practitioner certification record may be revoked.",
          },
          { status: 409 }
        );
      }

      const revocationNotes = getRequiredString(
        body?.notes,
        "notes explaining the revocation"
      );

      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CEPractitionerCertification.update(
        existingCertification.id,
        {
          certification_status: "revoked",
          revoked_at: now,
          revoked_by_user_id: user.id,
          notes: revocationNotes,
        }
      );

      await writeAuditLog(
        base44,
        user.id,
        "ce_practitioner_certification_revoked",
        "A verified CE practitioner certification record was revoked.",
        existingCertification.id,
        {
          user_id: targetUserId,
          certification_source: existingCertification.certification_source,
        }
      );

      return Response.json({
        ok: true,
        action,
        certification_record_id: existingCertification.id,
        certification_status: "revoked",
      });
    }

    return Response.json(
      { ok: false, error: "Unsupported certification-management action." },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "manageCEPractitionerCertification error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to manage CE practitioner certification records.",
      },
      { status: 500 }
    );
  }
});
