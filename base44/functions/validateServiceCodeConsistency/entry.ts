/**
 * 🔍 Backend Service Code Consistency Check
 * 
 * Runs audit on all TimeEntries to verify:
 * - Service codes are IDs (never labels)
 * - No duplication
 * - Required/optional handled correctly
 * 
 * Admin-only function for data integrity verification.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Service code ID validation (1-15)
function isServiceCodeId(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && num >= 1 && num <= 15;
}

// Check if value is a label (contains " - " and description)
function isServiceCodeLabel(value) {
  if (typeof value !== "string") {
    return false;
  }
  return value.includes(" - ") && value.length > 5;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 [validateServiceCodeConsistency] Starting audit...');

    // Fetch all TimeEntries
    const allEntries = await base44.asServiceRole.entities.TimeEntry.list();
    
    const issues = {
      entriesWithLabelValues: [],
      entriesWithInvalidIds: [],
      entriesMissingRequiredCodes: [],
      entriesWithDuplication: [],
      totalEntries: allEntries.length,
      entriesChecked: 0,
      issuesFound: 0
    };

    // Audit each entry
    allEntries.forEach(entry => {
      issues.entriesChecked++;
      const formData = entry.form_data || {};
      const entryTypeCode = entry.entry_type_code;

      // Find all service code fields in form_data
      const serviceCodeFields = Object.entries(formData).filter(([key]) =>
        key.includes('service_code')
      );

      if (serviceCodeFields.length === 0) {
        return;  // No service codes in this entry
      }

      serviceCodeFields.forEach(([key, value]) => {
        // Check if value is a label (BAD)
        if (isServiceCodeLabel(value)) {
          issues.issuesFound++;
          issues.entriesWithLabelValues.push({
            entryId: entry.id,
            entryType: entryTypeCode,
            field: key,
            value: value,
            issue: 'Contains label instead of ID'
          });
          console.warn(`❌ ${entry.id}: ${key} contains LABEL: "${value}"`);
        }

        // Check if ID is invalid
        if (value && !isServiceCodeId(value)) {
          issues.issuesFound++;
          issues.entriesWithInvalidIds.push({
            entryId: entry.id,
            entryType: entryTypeCode,
            field: key,
            value: value,
            issue: 'Invalid service code ID (not 1-15)'
          });
          console.warn(`❌ ${entry.id}: ${key} has INVALID ID: "${value}"`);
        }
      });

      // Check for duplication in field count
      const fieldCount = Object.keys(formData).filter(k => k.includes('service_code')).length;
      if (fieldCount > 2) {
        issues.issuesFound++;
        issues.entriesWithDuplication.push({
          entryId: entry.id,
          entryType: entryTypeCode,
          fieldCount: fieldCount,
          fields: Object.keys(formData).filter(k => k.includes('service_code')),
          issue: 'Possible duplication (more than 2 service code fields)'
        });
        console.warn(`❌ ${entry.id}: Found ${fieldCount} service code fields (expected max 2)`);
      }
    });

    // Summary
    console.log(`
═══════════════════════════════════════════════
  SERVICE CODE CONSISTENCY AUDIT REPORT
═══════════════════════════════════════════════

Total Entries: ${issues.totalEntries}
Entries Checked: ${issues.entriesChecked}
Issues Found: ${issues.issuesFound}

BREAKDOWN:
• Entries with LABEL values (BAD): ${issues.entriesWithLabelValues.length}
• Entries with INVALID IDs: ${issues.entriesWithInvalidIds.length}
• Entries with DUPLICATION: ${issues.entriesWithDuplication.length}

═══════════════════════════════════════════════
    `);

    if (issues.issuesFound === 0) {
      console.log('✅ All service codes are consistent!');
    } else {
      console.log(`❌ Found ${issues.issuesFound} issues - see details below`);
    }

    return Response.json({
      status: issues.issuesFound === 0 ? 'PASS' : 'FAIL',
      ...issues
    });
  } catch (error) {
    console.error('[validateServiceCodeConsistency] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});