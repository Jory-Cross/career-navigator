import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const ALLOWED_PLATFORM_ROLES = new Set(["platform_owner"]);

function getDisplayName(user: any) {
  const fullName = String(user?.full_name || "").trim();
  const email = String(user?.email || "").trim();

  return fullName || email || "Unnamed user";
}

function normalizeUser(user: any) {
  return {
    id: user.id,
    full_name: String(user.full_name || "").trim(),
    email: String(user.email || "").trim(),
    display_name: getDisplayName(user),
    role: user.role || null,
    access_level: user.access_level || null,
    is_active: user.is_active !== false,
    cohort_id: user.cohort_id || null,
    cohort_role: user.cohort_role || null,
  };
}

function normalizeCertification(record: any, userById: Map<string, any>) {
  const practitioner = userById.get(record.user_id);

  return {
    id: record.id,
    user_id: record.user_id,
    practitioner_name: practitioner?.display_name || "Unknown user",
    practitioner_email: practitioner?.email || "",
    practitioner_is_active:
      practitioner?.is_active === false ? false : practitioner ? true : null,
    certification_status: record.certification_status,
    completed_at: record.completed_at || null,
    verified_at: record.verified_at || null,
    verified_by_user_id: record.verified_by_user_id || null,
    revoked_at: record.revoked_at || null,
    revoked_by_user_id: record.revoked_by_user_id || null,
    certification_source: record.certification_source,
    source_cohort_id: record.source_cohort_id || null,
    notes: record.notes || "",
  };
}

/**
 * getCEPractitionerCertificationManagerData
 *
 * Read-only platform-owner source for the future CE Practitioner
 * Certification Manager.
 *
 * Important:
 * - Returns safe display information for platform users plus certification
 *   records and integrity warnings.
 * - Does not create, verify, revoke, grant workspace access, alter billing,
 *   change organization roles, or modify any records.
 * - Certification alone never grants CE Practitioner Workspace access.
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

    const platformAdminRows =
      await base44.asServiceRole.entities.PlatformAdmin.filter({
        user_id: user.id,
        is_active: true,
      });

    const platformRoles = Array.from(
      new Set(
        (Array.isArray(platformAdminRows) ? platformAdminRows : [])
          .filter((row) => row?.is_active !== false)
          .map((row) => row?.platform_role)
          .filter(Boolean)
      )
    );

    const canViewCertificationManager = platformRoles.some((role) =>
      ALLOWED_PLATFORM_ROLES.has(role)
    );

    if (!canViewCertificationManager) {
      return Response.json(
        {
          ok: false,
          error:
            "Only an active Platform Owner may view CE practitioner certification administration.",
        },
        { status: 403 }
      );
    }

    const [userRows, certificationRows] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.CEPractitionerCertification.list(),
    ]);

    const people = (Array.isArray(userRows) ? userRows : [])
      .filter((person) => person?.id)
      .map(normalizeUser)
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, {
          sensitivity: "base",
        })
      );

    const userById = new Map(people.map((person) => [person.id, person]));

    const certifications = Array.isArray(certificationRows)
      ? certificationRows
      : [];

    const certificationCountByUserId = new Map<string, number>();

    for (const certification of certifications) {
      if (!certification?.user_id) {
        continue;
      }

      certificationCountByUserId.set(
        certification.user_id,
        (certificationCountByUserId.get(certification.user_id) || 0) + 1
      );
    }

    const duplicateCertificationUserIds = Array.from(
      certificationCountByUserId.entries()
    )
      .filter(([, count]) => count > 1)
      .map(([userId]) => userId);

    const normalizedCertifications = certifications
      .filter((record) => record?.id && record?.user_id)
      .map((record) => normalizeCertification(record, userById))
      .sort((a, b) => {
        const nameCompare = a.practitioner_name.localeCompare(
          b.practitioner_name,
          undefined,
          { sensitivity: "base" }
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return String(a.id).localeCompare(String(b.id));
      });

    const certificationByUserId = new Map<string, any>();

    for (const certification of normalizedCertifications) {
      if (!certificationByUserId.has(certification.user_id)) {
        certificationByUserId.set(certification.user_id, certification);
      }
    }

    const peopleWithCertificationStatus = people.map((person) => {
      const certification = certificationByUserId.get(person.id);

      return {
        ...person,
        certification_record_id: certification?.id || null,
        certification_status: certification?.certification_status || "none",
        certification_source: certification?.certification_source || null,
        certification_completed_at: certification?.completed_at || null,
        certification_verified_at: certification?.verified_at || null,
      };
    });

    return Response.json({
      ok: true,
      viewer: {
        user_id: user.id,
        platform_roles: platformRoles,
        can_manage_certifications: true,
      },
      people: peopleWithCertificationStatus,
      certifications: normalizedCertifications,
      integrity: {
        duplicate_certification_user_ids: duplicateCertificationUserIds,
        duplicate_certification_count: duplicateCertificationUserIds.length,
      },
      counts: {
        people_count: people.length,
        certification_count: normalizedCertifications.length,
        pending_verification_count: normalizedCertifications.filter(
          (record) =>
            record.certification_status === "pending_verification"
        ).length,
        verified_count: normalizedCertifications.filter(
          (record) => record.certification_status === "verified"
        ).length,
        revoked_count: normalizedCertifications.filter(
          (record) => record.certification_status === "revoked"
        ).length,
      },
    });
  } catch (error) {
    console.error(
      "getCEPractitionerCertificationManagerData error:",
      error?.message || error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to load CE practitioner certification administration data.",
      },
      { status: 500 }
    );
  }
});
