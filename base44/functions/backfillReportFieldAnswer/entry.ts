import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backfill ReportFieldAnswer records
 * - Infer entry_type_id and entry_type_code from linked TimeEntry
 * - Set field_schema_version = 1 if missing
 * - Save field_schema_snapshot from current templates
 * - Set required_fields_complete conservatively
 * - Set report_ready conservatively
 * - Do NOT overwrite existing answers
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only check
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    console.log('Starting ReportFieldAnswer backfill...');

    // Fetch all answer records
    const answers = await base44.asServiceRole.entities.ReportFieldAnswer.list();
    console.log(`Found ${answers.length} ReportFieldAnswer records`);

    // Fetch all time entries for lookup
    const timeEntries = await base44.asServiceRole.entities.TimeEntry.list();
    const timeEntryMap = {};
    timeEntries.forEach(te => {
      timeEntryMap[te.id] = te;
    });
    console.log(`Loaded ${timeEntries.length} TimeEntry records`);

    // Fetch all entry types
    const entryTypes = await base44.asServiceRole.entities.EntryType.list();
    console.log(`Loaded ${entryTypes.length} EntryType records`);

    // Fetch all templates
    const templates = await base44.asServiceRole.entities.ReportFieldTemplate.list();
    console.log(`Loaded ${templates.length} ReportFieldTemplate records`);

    const results = {
      updated: [],
      skipped: [],
      errors: []
    };

    // Process each answer record
    for (const answer of answers) {
      try {
        const updates = {};
        let hasChanges = false;

        // Step 1: Infer entry_type_id and entry_type_code from TimeEntry
        const timeEntry = timeEntryMap[answer.time_entry_id];
        if (!timeEntry) {
          results.skipped.push({
            id: answer.id,
            reason: 'TimeEntry not found'
          });
          continue;
        }

        if (!answer.entry_type_id && timeEntry.entry_type_id) {
          updates.entry_type_id = timeEntry.entry_type_id;
          hasChanges = true;
        }

        if (!answer.entry_type_code && timeEntry.entry_type_code) {
          updates.entry_type_code = timeEntry.entry_type_code;
          hasChanges = true;
        }

        // Step 2: Set field_schema_version = 1 if missing
        if (!answer.field_schema_version) {
          updates.field_schema_version = 1;
          hasChanges = true;
        }

        // Step 3: Build field_schema_snapshot from current templates
        const entryTypeCode = updates.entry_type_code || answer.entry_type_code;
        if (!answer.field_schema_snapshot && entryTypeCode) {
          const relevantTemplates = templates.filter(
            t => t.entry_type_code === entryTypeCode && t.is_active
          );

          if (relevantTemplates.length > 0) {
            const snapshot = {};
            relevantTemplates.forEach(template => {
              snapshot[template.field_key] = {
                label: template.label,
                field_type: template.field_type,
                is_required: template.is_required,
                options: template.options || [],
                section: template.section,
                field_group: template.field_group
              };
            });
            updates.field_schema_snapshot = snapshot;
            hasChanges = true;
          }
        }

        // Step 4 & 5: Set required_fields_complete and report_ready conservatively
        const snapshot = updates.field_schema_snapshot || answer.field_schema_snapshot;
        const answerData = answer.answers || {};

        if (snapshot && typeof snapshot === 'object') {
          const requiredFields = Object.entries(snapshot)
            .filter(([_, field]) => field.is_required)
            .map(([key, _]) => key);

          const completedRequired = requiredFields.filter(
            fieldKey => answerData[fieldKey] !== undefined && 
                         answerData[fieldKey] !== null && 
                         answerData[fieldKey] !== ''
          );

          const completionPercent = requiredFields.length > 0 
            ? Math.round((completedRequired.length / requiredFields.length) * 100)
            : 0;

          // Set conservatively: true only if ALL required fields are complete
          const isComplete = completionPercent === 100;

          if (answer.required_fields_complete !== isComplete) {
            updates.required_fields_complete = isComplete;
            hasChanges = true;
          }

          if (!answer.completion_percent || answer.completion_percent === 0) {
            updates.completion_percent = completionPercent;
            hasChanges = true;
          }

          // Set report_ready conservatively: true only if required_fields_complete AND entry is approved
          const shouldBeReportReady = isComplete && timeEntry.status === 'approved';
          if (answer.report_ready !== shouldBeReportReady) {
            updates.report_ready = shouldBeReportReady;
            hasChanges = true;
          }
        }

        // Update if there are changes
        if (hasChanges) {
          await base44.asServiceRole.entities.ReportFieldAnswer.update(answer.id, updates);
          results.updated.push({
            id: answer.id,
            changes: Object.keys(updates)
          });
          console.log(`Updated ${answer.id}: ${Object.keys(updates).join(', ')}`);
        } else {
          results.skipped.push({
            id: answer.id,
            reason: 'Already complete'
          });
        }
      } catch (error) {
        results.errors.push({
          id: answer.id,
          error: error.message
        });
        console.error(`Error processing ${answer.id}: ${error.message}`);
      }
    }

    console.log('Backfill complete:', results);

    return Response.json({
      success: true,
      summary: {
        total_processed: answers.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('backfillReportFieldAnswer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});