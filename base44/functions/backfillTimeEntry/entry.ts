import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backfill TimeEntry records into new schema structure
 * - populate entry_type_code from legacy category
 * - assign entry_type_id from normalized EntryType records
 * - populate duration_minutes from existing duration/hour fields
 * - populate reporting_period_key from date as YYYY-MM
 * - copy old category into legacy_category if present
 */

const CATEGORY_TO_ENTRY_TYPE_CODE = {
  'job_coaching': 'job_coaching',
  'life_skills': 'life_skills',
  'cbh': 'csb_hours',
  'admin': 'admin_time',
  'other': 'misc',
  'consultation': 'misc',
  'resume_work': 'misc',
  'job_search': 'misc',
  'interview_prep': 'misc',
  'follow_up': 'misc'
};

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

    console.log('Starting TimeEntry backfill...');

    // Fetch all TimeEntry records
    const timeEntries = await base44.asServiceRole.entities.TimeEntry.list();
    console.log(`Found ${timeEntries.length} TimeEntry records`);

    // Fetch all active EntryType records for lookup
    const entryTypes = await base44.asServiceRole.entities.EntryType.list();
    const entryTypeMap = {};
    entryTypes.forEach(et => {
      entryTypeMap[et.code] = et.id;
    });
    console.log(`Loaded ${entryTypes.length} EntryType records`);

    const results = {
      updated: [],
      skipped: [],
      errors: []
    };

    // Process each TimeEntry
    for (const entry of timeEntries) {
      try {
        const updates = {};
        let hasChanges = false;

        // Step 1: Map category to entry_type_code
        if (!entry.entry_type_code && entry.category) {
          const mappedCode = CATEGORY_TO_ENTRY_TYPE_CODE[entry.category];
          if (mappedCode) {
            updates.entry_type_code = mappedCode;
            hasChanges = true;
          } else {
            results.skipped.push({
              id: entry.id,
              reason: `Unknown legacy category: ${entry.category}`
            });
            continue;
          }
        } else if (!entry.entry_type_code) {
          results.skipped.push({
            id: entry.id,
            reason: 'No category or entry_type_code found'
          });
          continue;
        }

        // Step 2: Assign entry_type_id
        const codeToUse = updates.entry_type_code || entry.entry_type_code;
        if (!entry.entry_type_id && codeToUse) {
          const typeId = entryTypeMap[codeToUse];
          if (typeId) {
            updates.entry_type_id = typeId;
            hasChanges = true;
          } else {
            results.skipped.push({
              id: entry.id,
              reason: `No EntryType found for code: ${codeToUse}`
            });
            continue;
          }
        }

        // Step 3: Populate duration_minutes if missing
        if (!entry.duration_minutes && entry.duration_hours) {
          updates.duration_minutes = Math.round(entry.duration_hours * 60);
          hasChanges = true;
        }

        // Step 4: Populate reporting_period_key from date
        if (!entry.reporting_period_key && entry.date) {
          updates.reporting_period_key = entry.date.slice(0, 7); // YYYY-MM
          hasChanges = true;
        }

        // Step 5: Copy category into legacy_category if present
        if (!entry.legacy_category && entry.category) {
          updates.legacy_category = entry.category;
          hasChanges = true;
        }

        // Update if there are changes
        if (hasChanges) {
          await base44.asServiceRole.entities.TimeEntry.update(entry.id, updates);
          results.updated.push({
            id: entry.id,
            changes: Object.keys(updates)
          });
          console.log(`Updated ${entry.id}: ${Object.keys(updates).join(', ')}`);
        } else {
          results.skipped.push({
            id: entry.id,
            reason: 'Already has all required fields'
          });
        }
      } catch (error) {
        results.errors.push({
          id: entry.id,
          error: error.message
        });
        console.error(`Error processing ${entry.id}: ${error.message}`);
      }
    }

    console.log('Backfill complete:', results);

    return Response.json({
      success: true,
      summary: {
        total_processed: timeEntries.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('backfillTimeEntry error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});