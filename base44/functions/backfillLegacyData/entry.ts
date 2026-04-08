import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * One-time backfill function. Admin-only.
 *
 * Tasks:
 *   1. TimeEntry — infer entry_type_code/id from legacy category, populate new schema fields
 *   2. ReportFieldAnswer — assign entry_type_id/code, set schema version + conservative report_ready
 *   3. Document — detect generated PDFs and mark category=generated_report, is_generated=true
 *
 * Safe: never deletes, never overwrites values already set.
 * Idempotent: skips records that already have the new fields populated.
 */

// ─── Category → canonical code mapping ───────────────────────────────────────
// Maps every legacy category string we've seen to the canonical EntryType.code
const CATEGORY_CODE_MAP = {
  // Direct matches
  job_coaching:     'job_coaching',
  job_development:  'job_development',
  life_skills:      'life_skills',
  admin_time:       'admin_time',
  pre_ets:          'pre_ets',
  wsa:              'wsa',
  csb_hours:        'csb_hours',
  eom_reporting:    'eom_reporting',
  misc:             'misc',
  // Legacy aliases
  consultation:     'job_development',   // consultations were typically JD activities
  job_coaching_session: 'job_coaching',
  cbh:              'csb_hours',
  life_skill:       'life_skills',
  interview_prep:   'job_development',
  strategy:         'job_development',
  follow_up:        'job_coaching',
  other:            'misc',
};

// Detect PDF subtype from filename patterns
function inferPdfSubtype(filename = '', title = '') {
  const text = (filename + ' ' + title).toLowerCase();
  if (text.includes('96') || text.includes('job_development') || text.includes('jobdevelopment') || text.includes('job development')) return 'usor96';
  if (text.includes('95') || text.includes('job_coaching') || text.includes('jobcoaching') || text.includes('job coaching')) return 'usor95';
  if (text.includes('148') || text.includes('life_skills') || text.includes('lifeskills') || text.includes('life skills')) return 'usor148';
  if (text.includes('wsa') || text.includes('work skill')) return 'wsa';
  if (text.includes('progress') || text.includes('ongoing support')) return 'progress_report';
  if (text.includes('csb') || text.includes('community support')) return 'usor148';
  return null;
}

function inferEntryTypeCodeFromDoc(filename = '', title = '') {
  const sub = inferPdfSubtype(filename, title);
  if (sub === 'usor96') return 'job_development';
  if (sub === 'usor95') return 'job_coaching';
  if (sub === 'usor148') return 'life_skills';
  if (sub === 'wsa') return 'wsa';
  if (sub === 'progress_report') return 'job_coaching';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    // ── Load all EntryTypes, prefer newer full-metadata records by picking ones with report_mode set ──
    const allEntryTypes = await base44.asServiceRole.entities.EntryType.list();

    // Build a code→EntryType map, preferring records that have report_mode set (the new seeds)
    const entryTypeByCode = {};
    for (const et of allEntryTypes) {
      const code = et.code;
      if (!code) continue;
      const existing = entryTypeByCode[code];
      // Prefer the record with report_mode defined
      if (!existing || (et.report_mode && !existing.report_mode)) {
        entryTypeByCode[code] = et;
      }
    }

    const results = { timeEntry: { skipped: 0, updated: 0, unresolved: 0 },
                      fieldAnswer: { skipped: 0, updated: 0 },
                      document: { skipped: 0, updated: 0 } };

    // ═══════════════════════════════════════════════════════
    // TASK 1: Backfill TimeEntry
    // ═══════════════════════════════════════════════════════
    const timeEntries = await base44.asServiceRole.entities.TimeEntry.list('-created_date', 500);

    for (const te of timeEntries) {
      // Skip if already fully backfilled
      if (te.entry_type_code && te.entry_type_id && te.reporting_period_key) {
        results.timeEntry.skipped++;
        continue;
      }

      const patch = {};

      // Preserve legacy category → legacy_category (only if not already set)
      if (te.category && !te.legacy_category) {
        patch.legacy_category = te.category;
      }

      // Infer entry_type_code
      if (!te.entry_type_code) {
        const rawCategory = (te.category || '').toLowerCase().trim();
        const resolvedCode = CATEGORY_CODE_MAP[rawCategory] || null;
        if (resolvedCode) {
          patch.entry_type_code = resolvedCode;
        } else {
          console.warn(`TimeEntry ${te.id}: unresolved category "${te.category}" → skipping code inference`);
          results.timeEntry.unresolved++;
        }
      }

      // Resolve entry_type_id from code
      if (!te.entry_type_id) {
        const code = patch.entry_type_code || te.entry_type_code;
        if (code && entryTypeByCode[code]) {
          patch.entry_type_id = entryTypeByCode[code].id;
        }
      }

      // Compute duration_minutes if missing
      if (!te.duration_minutes && te.start_time && te.end_time) {
        const [sh, sm] = te.start_time.split(':').map(Number);
        const [eh, em] = te.end_time.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins > 0) patch.duration_minutes = mins;
      }

      // Populate reporting_period_key (YYYY-MM)
      if (!te.reporting_period_key && te.date) {
        patch.reporting_period_key = te.date.slice(0, 7);
      }

      // Set status to "submitted" if missing
      if (!te.status) {
        patch.status = 'submitted';
      }

      // Set billing/report flags from EntryType if not set
      const code = patch.entry_type_code || te.entry_type_code;
      const et = code ? entryTypeByCode[code] : null;
      if (et) {
        if (te.is_billable === undefined || te.is_billable === null) {
          patch.is_billable = et.is_billable ?? false;
        }
        if (te.is_payroll_eligible === undefined || te.is_payroll_eligible === null) {
          patch.is_payroll_eligible = et.is_payroll_eligible ?? true;
        }
        if (te.is_reportable === undefined || te.is_reportable === null) {
          patch.is_reportable = et.report_mode !== 'none';
        }
      }

      // Conservatively default report_ready = false if not set
      if (te.report_ready === undefined || te.report_ready === null) {
        patch.report_ready = false;
      }

      if (Object.keys(patch).length > 0) {
        const resolvedCode = patch.entry_type_code || te.entry_type_code || 'misc';
        const resolvedId = patch.entry_type_id || te.entry_type_id || (entryTypeByCode[resolvedCode]?.id || null);

        // Merge patch with all required fields to satisfy schema validation on update
        const updatePayload = {
          employee_id: te.employee_id || user.id,
          entry_type_id: resolvedId,
          entry_type_code: resolvedCode,
          date: te.date,
          duration_minutes: te.duration_minutes || patch.duration_minutes || 0,
          ...patch,
        };
        await base44.asServiceRole.entities.TimeEntry.update(te.id, updatePayload);
        results.timeEntry.updated++;
      } else {
        results.timeEntry.skipped++;
      }
    }

    // ═══════════════════════════════════════════════════════
    // TASK 2: Backfill ReportFieldAnswer
    // ═══════════════════════════════════════════════════════
    const fieldAnswers = await base44.asServiceRole.entities.ReportFieldAnswer.list('-created_date', 500);

    for (const fa of fieldAnswers) {
      // Skip if already normalized
      if (fa.entry_type_id && fa.entry_type_code && fa.field_schema_version) {
        results.fieldAnswer.skipped++;
        continue;
      }

      const patch = {};

      // If entry_type_code missing, try to look it up via the linked TimeEntry
      if (!fa.entry_type_code || !fa.entry_type_id) {
        if (fa.time_entry_id) {
          const teList = await base44.asServiceRole.entities.TimeEntry.filter({ id: fa.time_entry_id });
          const te = teList[0];
          if (te) {
            const code = te.entry_type_code || (CATEGORY_CODE_MAP[(te.category || '').toLowerCase()] || null);
            if (code && !fa.entry_type_code) patch.entry_type_code = code;
            if (code && !fa.entry_type_id && entryTypeByCode[code]) patch.entry_type_id = entryTypeByCode[code].id;
          }
        }
      }

      // Set schema version to 1 if missing
      if (!fa.field_schema_version) {
        patch.field_schema_version = 1;
      }

      // Build a minimal schema snapshot if missing and we know the entry type
      if (!fa.field_schema_snapshot) {
        const code = patch.entry_type_code || fa.entry_type_code;
        if (code) {
          const etId = entryTypeByCode[code]?.id;
          if (etId) {
            const fieldTemplates = await base44.asServiceRole.entities.ReportFieldTemplate.filter({ entry_type_id: etId });
            if (fieldTemplates.length > 0) {
              const snapshot = {};
              for (const ft of fieldTemplates) {
                snapshot[ft.field_key] = {
                  field_key: ft.field_key,
                  label: ft.label,
                  field_type: ft.field_type,
                  is_required: ft.is_required || false,
                  options: ft.options || [],
                  section: ft.section || null,
                  order: ft.order || 0,
                  is_active: ft.is_active !== false,
                };
              }
              patch.field_schema_snapshot = snapshot;

              // Evaluate required_fields_complete and report_ready conservatively
              const answers = fa.answers || {};
              const requiredFields = fieldTemplates.filter(f => f.is_required && f.is_active !== false);
              const allFilled = requiredFields.every(f => {
                const v = answers[f.field_key];
                return v !== null && v !== undefined && v !== '';
              });
              patch.required_fields_complete = allFilled;
              patch.report_ready = allFilled; // conservative: only true if all required fields answered
            }
          }
        }
      }

      // If completion_percent missing, calculate it
      if (fa.completion_percent === undefined || fa.completion_percent === null) {
        const snapshot = patch.field_schema_snapshot || fa.field_schema_snapshot;
        if (snapshot) {
          const answers = fa.answers || {};
          const required = Object.values(snapshot).filter(f => f.is_required);
          const completed = required.filter(f => {
            const v = answers[f.field_key];
            return v !== null && v !== undefined && v !== '';
          });
          patch.completion_percent = required.length === 0 ? 100 : Math.round((completed.length / required.length) * 100);
        } else {
          patch.completion_percent = 0;
        }
      }

      if (Object.keys(patch).length > 0) {
        await base44.asServiceRole.entities.ReportFieldAnswer.update(fa.id, patch);
        results.fieldAnswer.updated++;
      } else {
        results.fieldAnswer.skipped++;
      }
    }

    // ═══════════════════════════════════════════════════════
    // TASK 3: Backfill Document
    // ═══════════════════════════════════════════════════════
    const documents = await base44.asServiceRole.entities.Document.list('-created_date', 500);

    for (const doc of documents) {
      // Skip if already categorized correctly
      if (doc.category === 'generated_report' && doc.is_generated === true) {
        results.document.skipped++;
        continue;
      }

      const patch = {};
      const fileName = doc.file_name || '';
      const title = doc.title || '';
      const fileType = doc.file_type || '';
      const fileUrl = doc.file_url || '';

      // Detect generated PDFs: PDF file type + filename matches known report patterns
      const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf') || fileUrl.includes('.pdf');
      const subtype = inferPdfSubtype(fileName, title);
      const etCode = inferEntryTypeCodeFromDoc(fileName, title);

      const looksGenerated = isPdf && (
        subtype !== null ||
        /\d{2,4}/.test(fileName) // has a form number in the filename
      );

      if (looksGenerated) {
        if (doc.category === 'other' || !doc.category) {
          patch.category = 'generated_report';
        }
        if (!doc.is_generated) {
          patch.is_generated = true;
        }
        if (subtype && !doc.document_subtype) {
          patch.document_subtype = subtype;
        }
        if (etCode && !doc.entry_type_code) {
          patch.entry_type_code = etCode;
        }
      }

      if (Object.keys(patch).length > 0) {
        await base44.asServiceRole.entities.Document.update(doc.id, patch);
        results.document.updated++;
      } else {
        results.document.skipped++;
      }
    }

    return Response.json({
      success: true,
      results,
      summary: `TimeEntry: ${results.timeEntry.updated} updated, ${results.timeEntry.skipped} skipped, ${results.timeEntry.unresolved} unresolved. ` +
               `ReportFieldAnswer: ${results.fieldAnswer.updated} updated, ${results.fieldAnswer.skipped} skipped. ` +
               `Document: ${results.document.updated} updated, ${results.document.skipped} skipped.`
    });

  } catch (error) {
    console.error('backfillLegacyData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});