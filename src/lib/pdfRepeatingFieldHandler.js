/**
 * PDF Repeating Field Handler
 * Maps row data to PDF repeating fields dynamically
 */

/**
 * Group mappings by row_group and row_index
 */
export function groupRepeatingMappings(mappings) {
  const grouped = {};

  mappings.forEach(mapping => {
    if (!mapping.is_repeating_field) return;

    const rowGroup = mapping.row_group || 'default';
    if (!grouped[rowGroup]) {
      grouped[rowGroup] = [];
    }

    grouped[rowGroup].push(mapping);
  });

  // Sort each group by sort_order
  Object.values(grouped).forEach(group => {
    group.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  return grouped;
}

/**
 * Separate mappings into header/summary and repeating fields
 */
export function separateMappingTypes(mappings) {
  const headerSummary = [];
  const repeating = [];

  mappings.forEach(mapping => {
    if (mapping.is_repeating_field) {
      repeating.push(mapping);
    } else {
      headerSummary.push(mapping);
    }
  });

  return { headerSummary, repeating };
}

/**
 * Build PDF field filling instructions for repeating rows
 * Returns map of pdf_field_name -> value for each row
 */
export function buildRepeatingFieldInstructions(rows = [], repeatingMappings = []) {
  const instructions = {};
  const grouped = groupRepeatingMappings(repeatingMappings);

  // For each row_group
  Object.entries(grouped).forEach(([rowGroup, mappings]) => {
    // For each row
    rows.forEach((row, rowIndex) => {
      // For each field mapping in the group
      mappings.forEach(mapping => {
        if (mapping.row_index !== undefined && mapping.row_index !== rowIndex) {
          return; // Skip if row_index is specified and doesn't match
        }

        const value = resolveRowFieldValue(row, mapping.source_field);
        const transformed = applyTransform(value, mapping.transform, mapping.transform_options);
        const finalValue = transformed !== undefined ? transformed : (mapping.default_value || '');

        // Generate PDF field name with row number
        // Example: "Day_1", "Hours_1" for row 0
        // If pdf_field_name already has number, use as-is
        const pdfFieldName = substitutePDFFieldName(mapping.pdf_field_name, rowIndex);

        instructions[pdfFieldName] = finalValue;
      });
    });
  });

  return instructions;
}

/**
 * Resolve value from a row object
 */
export function resolveRowFieldValue(row, sourceField) {
  if (!row || !sourceField) return undefined;

  // Support nested paths like "data.employer_name"
  const parts = sourceField.split('.');
  let value = row;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Substitute row index into PDF field name
 * Examples:
 *   "Day_{{row}}" with row=0 → "Day_1"
 *   "Hours_1" (static) → "Hours_1"
 *   "Activity_{rowNum}" with row=2 → "Activity_3"
 */
export function substitutePDFFieldName(template, rowIndex) {
  // If already has a number at the end, assume it's 1-indexed
  // Replace {{row}} or {row} or similar patterns
  let result = template;

  // Replace {{row}}, {row}, {{rowNum}}, {rowNum} (0-indexed) → 1-indexed
  result = result.replace(/\{\{row(Num)?\}\}/gi, (rowIndex + 1).toString());
  result = result.replace(/\{row(Num)?\}/gi, (rowIndex + 1).toString());

  // If no substitution occurred and field ends with _1, _2, etc., keep as-is
  // (assume field is already numbered)
  return result;
}

/**
 * Apply transformation to a value
 */
export function applyTransform(value, transform, options = {}) {
  if (!transform || transform === 'none' || value === undefined || value === null) {
    return value;
  }

  switch (transform) {
    case 'date_format':
      return formatDate(value, options.format || 'MM/DD/YYYY');

    case 'time_format':
      return formatTime(value, options.format || 'HH:mm');

    case 'duration_hours':
      // Convert minutes to hours
      if (typeof value === 'number') {
        return (value / 60).toFixed(2);
      }
      return value;

    case 'hours_from_minutes':
      // Same as duration_hours for backward compatibility
      if (typeof value === 'number') {
        return (value / 60).toFixed(2);
      }
      return value;

    case 'uppercase':
      return String(value).toUpperCase();

    case 'full_name':
      return String(value).trim();

    default:
      return value;
  }
}

/**
 * Format date to specified format
 */
function formatDate(dateStr, format) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();

    if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
    if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
    if (format === 'DD/MM/YYYY') return `${d}/${m}/${y}`;

    // Default
    return `${m}/${d}/${y}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Format time to specified format
 */
function formatTime(timeStr, format) {
  if (!timeStr) return '';

  // Assume timeStr is in HH:mm or HH:mm:ss format
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;

  const hours = parts[0].padStart(2, '0');
  const mins = parts[1].padStart(2, '0');

  if (format === 'HH:mm') return `${hours}:${mins}`;
  if (format === 'h:mm A') {
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = (h % 12 || 12).toString().padStart(2, '0');
    return `${displayH}:${mins} ${period}`;
  }

  return `${hours}:${mins}`;
}

/**
 * Validate repeating field mappings before PDF filling
 */
export function validateRepeatingMappings(mappings, rowCount) {
  const errors = [];
  const grouped = groupRepeatingMappings(mappings);

  Object.entries(grouped).forEach(([rowGroup, groupMappings]) => {
    // Check that max_rows is respected
    groupMappings.forEach(mapping => {
      if (mapping.max_rows && rowCount > mapping.max_rows) {
        errors.push(
          `Row group '${rowGroup}': ${rowCount} rows exceed max_rows limit of ${mapping.max_rows}`
        );
      }
    });

    // Check for missing required mappings
    if (groupMappings.length === 0) {
      errors.push(`Row group '${rowGroup}' has no field mappings`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract row data for display/debugging
 */
export function extractRowFieldData(row, mappings) {
  const data = {};

  mappings.forEach(mapping => {
    if (!mapping.is_repeating_field) return;
    const value = resolveRowFieldValue(row, mapping.source_field);
    data[mapping.source_field] = value;
  });

  return data;
}

/**
 * Get max rows needed for a row_group
 */
export function getMaxRowsForGroup(rowGroup, mappings) {
  const groupMappings = mappings.filter(
    m => m.is_repeating_field && m.row_group === rowGroup
  );

  // Get max from explicit row_index specifications or from max_rows constraint
  let maxRowIndex = -1;
  let maxRowsLimit = Infinity;

  groupMappings.forEach(m => {
    if (m.row_index !== undefined) {
      maxRowIndex = Math.max(maxRowIndex, m.row_index);
    }
    if (m.max_rows) {
      maxRowsLimit = Math.min(maxRowsLimit, m.max_rows);
    }
  });

  return maxRowIndex >= 0 ? maxRowIndex + 1 : maxRowsLimit;
}

/**
 * Compile all PDF field fill instructions (header, summary, repeating)
 */
export function compilePDFFieldInstructions(transformed, mappings) {
  const { headerSummary, repeating } = separateMappingTypes(mappings);
  const instructions = {};

  // Header and summary fields
  headerSummary.forEach(mapping => {
    const value = resolveTransformedValue(transformed, mapping);
    const transformed_val = applyTransform(value, mapping.transform, mapping.transform_options);
    instructions[mapping.pdf_field_name] = transformed_val !== undefined ? transformed_val : (mapping.default_value || '');
  });

  // Repeating row fields
  const rowInstructions = buildRepeatingFieldInstructions(transformed.rows || [], repeating);
  Object.assign(instructions, rowInstructions);

  return instructions;
}

/**
 * Resolve value from transformed data structure (header, rows, summary)
 */
export function resolveTransformedValue(transformed, mapping) {
  const { source_type, source_field } = mapping;

  if (source_type === 'header') {
    return resolveRowFieldValue(transformed.header, source_field);
  }
  if (source_type === 'summary') {
    return resolveRowFieldValue(transformed.summary, source_field);
  }
  if (source_type === 'row') {
    // For row type, use first row as context
    return resolveRowFieldValue(transformed.rows?.[0], source_field);
  }

  // Fallback for legacy source types
  return undefined;
}