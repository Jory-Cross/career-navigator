import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const cohort_id = String(body?.cohort_id || '').trim();
    const user_id = String(body?.user_id || '').trim();

    if (!cohort_id || !user_id) {
      return Response.json(
        { ok: false, error: 'cohort_id and user_id are required' },
        { status: 400 }
      );
    }

    const matchingCohorts =
      await base44.asServiceRole.entities.CETrainingCohort.filter({
        id: cohort_id,
      });

    const cohort = Array.isArray(matchingCohorts)
      ? matchingCohorts[0]
      : null;

    if (!cohort) {
      return Response.json(
        { ok: false, error: 'Cohort not found' },
        { status: 404 }
      );
    }

    if (!cohort.org_id) {
      return Response.json(
        { ok: false, error: 'Cohort organization is missing' },
        { status: 400 }
      );
    }

    const isAdminOrManagement =
      caller.role === 'admin' || caller.role === 'management';

    let isCohortManager = false;

    if (!isAdminOrManagement) {
      const managerRows =
        await base44.asServiceRole.entities.CETrainingCohortMember.filter({
          cohort_id,
          user_id: caller.id,
          cohort_role: 'manager',
          is_active: true,
        });

      isCohortManager =
        Array.isArray(managerRows) && managerRows.length > 0;
    }

    if (!isAdminOrManagement && !isCohortManager) {
      return Response.json(
        { ok: false, error: 'Only this cohort’s manager may assign students' },
        { status: 403 }
      );
    }

    const allUsers = await base44.asServiceRole.entities.User.list();

    const student = (Array.isArray(allUsers) ? allUsers : []).find(
      (candidate) => candidate.id === user_id
    );

    if (!student) {
      return Response.json(
        { ok: false, error: 'Selected user was not found' },
        { status: 404 }
      );
    }

    if (student.is_active === false || student.role !== 'ce_student') {
      return Response.json(
        { ok: false, error: 'Only active registered CE students may be assigned' },
        { status: 400 }
      );
    }

    if (student.org_id && student.org_id !== cohort.org_id) {
      return Response.json(
        { ok: false, error: 'Student belongs to a different organization' },
        { status: 403 }
      );
    }

    const existingRows =
      await base44.asServiceRole.entities.CETrainingCohortMember.filter({
        cohort_id,
        user_id,
        cohort_role: 'member',
      });

    const existingMembership = Array.isArray(existingRows)
      ? existingRows[0]
      : null;

    if (existingMembership?.is_active) {
      return Response.json({
        ok: true,
        message: 'Student is already assigned to this cohort',
        membership_id: existingMembership.id,
      });
    }

    if (existingMembership) {
      await base44.asServiceRole.entities.CETrainingCohortMember.update(
        existingMembership.id,
        {
          is_active: true,
          joined_at: existingMembership.joined_at || new Date().toISOString(),
          added_by: caller.id,
        }
      );

      return Response.json({
        ok: true,
        message: 'Student reactivated in cohort',
        membership_id: existingMembership.id,
      });
    }

    const created =
      await base44.asServiceRole.entities.CETrainingCohortMember.create({
        org_id: cohort.org_id,
        cohort_id,
        user_id,
        cohort_role: 'member',
        is_active: true,
        joined_at: new Date().toISOString(),
        added_by: caller.id,
      });

    return Response.json({
      ok: true,
      message: 'Student assigned to cohort',
      membership_id: created.id,
    });
  } catch (error) {
    console.error('assignCEStudentToCohort error:', error.message);

    return Response.json(
      {
        ok: false,
        error: error.message || 'Unable to assign student to cohort',
      },
      { status: 500 }
    );
  }
});
