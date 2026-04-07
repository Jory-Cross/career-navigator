/**
 * TimeEntry Factory
 * Ensures TimeEntry records are created with proper entry_type_id and entry_type_code
 * Validates against EntryType definitions
 */

/**
 * Create a TimeEntry with validated entry type
 * Requires either entry_type_id (will fetch code) or entry_type_code (will fetch id)
 */
export async function createTimeEntry(base44, data) {
  try {
    // Must have at least one entry type identifier
    if (!data.entry_type_id && !data.entry_type_code) {
      return {
        success: false,
        error: 'Either entry_type_id or entry_type_code is required'
      };
    }

    // Get EntryType to validate and get both id and code
    let entryType = null;

    if (data.entry_type_id) {
      const allTypes = await base44.entities.EntryType.list();
      entryType = allTypes.find(t => t.id === data.entry_type_id);

      if (!entryType) {
        return {
          success: false,
          error: `EntryType with id ${data.entry_type_id} not found`
        };
      }
    } else if (data.entry_type_code) {
      const allTypes = await base44.entities.EntryType.list();
      entryType = allTypes.find(t => t.code === data.entry_type_code);

      if (!entryType) {
        return {
          success: false,
          error: `EntryType with code ${data.entry_type_code} not found`
        };
      }
    }

    // Validate entryType is active
    if (!entryType.is_active) {
      return {
        success: false,
        error: `EntryType ${entryType.code} is not active`
      };
    }

    // Create entry with both id and code
    const timeEntry = await base44.asServiceRole.entities.TimeEntry.create({
      ...data,
      entry_type_id: entryType.id,
      entry_type_code: entryType.code
    });

    return {
      success: true,
      entry: timeEntry
    };
  } catch (error) {
    console.error('Error creating time entry:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate TimeEntry data before creation
 */
export async function validateTimeEntryData(base44, data) {
  const errors = [];

  // Required fields
  if (!data.client_id) errors.push('client_id is required');
  if (!data.date) errors.push('date is required');
  if (!data.duration_minutes) errors.push('duration_minutes is required');
  if (data.duration_minutes && data.duration_minutes <= 0) errors.push('duration_minutes must be > 0');

  // Entry type
  if (!data.entry_type_id && !data.entry_type_code) {
    errors.push('Either entry_type_id or entry_type_code is required');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  // Validate EntryType exists and is active
  try {
    const allTypes = await base44.entities.EntryType.list();
    let entryType = null;

    if (data.entry_type_id) {
      entryType = allTypes.find(t => t.id === data.entry_type_id);
    } else if (data.entry_type_code) {
      entryType = allTypes.find(t => t.code === data.entry_type_code);
    }

    if (!entryType) {
      return {
        valid: false,
        errors: ['Specified EntryType not found']
      };
    }

    if (!entryType.is_active) {
      return {
        valid: false,
        errors: [`EntryType ${entryType.code} is not active`]
      };
    }

    return {
      valid: true,
      entryType: {
        id: entryType.id,
        code: entryType.code
      }
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message]
    };
  }
}

/**
 * Get all active entry types
 */
export async function getActiveEntryTypes(base44) {
  try {
    const allTypes = await base44.entities.EntryType.list();
    return allTypes.filter(t => t.is_active).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching entry types:', error);
    return [];
  }
}

/**
 * Get entry type by ID or code
 */
export async function getEntryType(base44, idOrCode) {
  try {
    const allTypes = await base44.entities.EntryType.list();
    return allTypes.find(t => t.id === idOrCode || t.code === idOrCode) || null;
  } catch (error) {
    console.error('Error fetching entry type:', error);
    return null;
  }
}

/**
 * Bulk create time entries with validation
 */
export async function bulkCreateTimeEntries(base44, dataArray) {
  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < dataArray.length; i++) {
    const data = dataArray[i];
    const validation = await validateTimeEntryData(base44, data);

    if (!validation.valid) {
      results.failed.push({
        index: i,
        data,
        errors: validation.errors
      });
      continue;
    }

    const result = await createTimeEntry(base44, data);

    if (result.success) {
      results.success.push(result.entry);
    } else {
      results.failed.push({
        index: i,
        data,
        errors: [result.error]
      });
    }
  }

  return results;
}

/**
 * Update TimeEntry (preserves entry_type_id/code, prevents accidental category-based changes)
 */
export async function updateTimeEntry(base44, timeEntryId, data) {
  try {
    // Fetch existing entry to preserve entry_type
    const allEntries = await base44.entities.TimeEntry.list();
    const existing = allEntries.find(e => e.id === timeEntryId);

    if (!existing) {
      return {
        success: false,
        error: 'TimeEntry not found'
      };
    }

    // Allow changing entry_type_id/code, but both must stay in sync
    if (data.entry_type_id || data.entry_type_code) {
      const validation = await validateTimeEntryData(base44, {
        ...data,
        entry_type_id: data.entry_type_id || existing.entry_type_id,
        entry_type_code: data.entry_type_code || existing.entry_type_code,
        client_id: data.client_id || existing.client_id,
        date: data.date || existing.date,
        duration_minutes: data.duration_minutes || existing.duration_minutes
      });

      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      data.entry_type_id = validation.entryType.id;
      data.entry_type_code = validation.entryType.code;
    } else {
      // Preserve existing entry type
      data.entry_type_id = existing.entry_type_id;
      data.entry_type_code = existing.entry_type_code;
    }

    // Remove legacy category from update (don't propagate it)
    delete data.category;

    const updated = await base44.asServiceRole.entities.TimeEntry.update(timeEntryId, data);

    return {
      success: true,
      entry: updated
    };
  } catch (error) {
    console.error('Error updating time entry:', error);
    return {
      success: false,
      error: error.message
    };
  }
}