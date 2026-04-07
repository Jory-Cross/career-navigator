/**
 * PDF Field Mapper
 * Handles advanced field mapping with scopes, row groups, and aggregations
 * Works with assembled report objects (Step 2 of VR reporting architecture)
 */

/**
 * Build field fill instructions from mappings and assembled report
 * @param {Array} mappings - PDFFieldMap records
 * @param {Object} report - Assembled report { header, rows, summary, metadata }
 * @param {Object} options - { maxRowsPerGroup, pageBreakRows, customAggFns }
 * @returns {Object} { fields: {...}, errors: [...], warnings: [...] }
 */
export function buildFieldInstructions(mappings, report, options = {}) {
  const fields = {};
  const errors = [];
  const warnings = [];

  // Filter active mappings
  const activeMappings = mappings.filter(m => m.is_active !== false);

  // Organize by scope
  const byScope = {
    static: activeMappings.filter(m => m.mapping_scope === 'static'),
    header: activeMappings.filter(m => m.mapping_scope === 'header'),
    row: activeMappings.filter(m => m.mapping_scope === 'row'),
    summary: activeMappings.filter(m => m.mapping_scope === 'summary')
  };

  // Fill static values
  byScope.static.forEach(mapping => {
    const value = mapping.default_value || '';
    fields[mapping.pdf_field_name] = {
      value: String(value),
      scope: 'static',
      mapping_id: mapping.id
    };
  });

  // Fill header fields
  byScope.header.forEach(mapping => {
    const value = resolveHeaderField(mapping, report);
    if (value === null && mapping.is_required) {
      errors.push(`Required header field missing: ${mapping.source_field}`);
    }
    if (shouldSkipField(value, mapping)) {
      return;
    }
    const transformed = applyTransform(value, mapping);
    fields[mapping.pdf_field_name] = {
      value: String(transformed || mapping.default_value || ''),
      scope: 'header',
      mapping_id: mapping.id,
      source: mapping.source_field
    };
  });

  // Fill summary fields
  byScope.summary.forEach(mapping => {
    const value = resolveSummaryField(mapping, report);
    if (value === null && mapping.is_required) {
      errors.push(`Required summary field missing: ${mapping.source_field}`);
    }
    if (shouldSkipField(value, mapping)) {
      return;
    }
    const transformed = applyTransform(value, mapping);
    fields[mapping.pdf_field_name] = {
      value: String(transformed || mapping.default_value || ''),
      scope: 'summary',
      mapping_id: mapping.id,
      source: mapping.source_field
    };
  });

  // Fill repeating row fields (organized by row_group)
  const rowsByGroup = {};
  byScope.row.forEach(mapping => {
    const group = mapping.row_group || 'default';
    if (!rowsByGroup[group]) {
      rowsByGroup[group] = [];
    }
    rowsByGroup[group].push(mapping);
  });

  Object.entries(rowsByGroup).forEach(([rowGroup, groupMappings]) => {
    const rowInstructions = fillRowGroup(
      rowGroup,
      groupMappings,
      report,
      errors,
      warnings,
      options
    );
    Object.assign(fields, rowInstructions);
  });

  return {
    fields,
    errors,
    warnings,
    summary: {
      total_fields: Object.keys(fields).length,
      by_scope: {
        static: byScope.static.length,
        header: byScope.header.length,
        row: byScope.row.length,
        summary: byScope.summary.length
      },
      error_count: errors.length,
      warning_count: warnings.length
    }
  };
}

/**
 * Resolve a header field from report object
 */
function resolveHeaderField(mapping, report) {
  const { source_field } = mapping;

  // Direct header path
  if (report.header && report.header[source_field]) {
    return report.header[source_field];
  }

  // Nested path (e.g. 'client.first_name')
  const parts = source_field.split('.');
  let value = report.header || {};
  for (const part of parts) {
    value = value?.[part];
    if (value === null || value === undefined) return null;
  }
  return value;
}

/**
 * Resolve a summary field (may aggregate multiple rows)
 */
function resolveSummaryField(mapping, report) {
  const { source_field, aggregation_mode } = mapping;

  // Direct summary path
  if (report.summary && report.summary[source_field] !== undefined) {
    return report.summary[source_field];
  }

  // Nested path (e.g. 'by_entry_type.job_coaching.count')
  const parts = source_field.split('.');
  let value = report.summary || {};
  for (const part of parts) {
    value = value?.[part];
    if (value === null || value === undefined) return null;
  }

  return value;
}

/**
 * Fill repeating row group
 * Groups rows and applies aggregations
 */
function fillRowGroup(rowGroup, mappings, report, errors, warnings, options = {}) {
  const fields = {};
  const rows = report.rows || [];

  if (rows.length === 0) {
    warnings.push(`Row group "${rowGroup}" has no data`);
    return fields;
  }

  // Sort mappings by row_sort_order
  mappings.sort((a, b) => (a.row_sort_order || 0) - (b.row_sort_order || 0));

  const maxRows = mappings[0]?.max_rows || options.maxRowsPerGroup || rows.length;

  // For each row (up to maxRows)
  rows.slice(0, maxRows).forEach((row, rowIdx) => {
    mappings.forEach(mapping => {
      const { source_field, row_field_key, pdf_field_name, aggregation_mode, default_value } = mapping;

      // Get value from row
      let value = row[source_field];

      // Apply conditional display
      if (mapping.conditional_display) {
        if (!meetsCondition(row, mapping.conditional_display)) {
          return;
        }
      }

      if (value === null || value === undefined) {
        value = default_value || '';
      }

      // Apply transform
      const transformed = applyTransform(value, mapping);

      // Substitute row index in PDF field name
      const pdfFieldName = substituteRowIndex(pdf_field_name, rowIdx);

      fields[pdfFieldName] = {
        value: String(transformed || ''),
        scope: 'row',
        row_group: rowGroup,
        row_index: rowIdx,
        row_field_key,
        mapping_id: mapping.id,
        source: source_field
      };
    });
  });

  return fields;
}

/**
 * Substitute row index placeholder in PDF field name
 * Supports {{row}}, {row}, {{rowNum}}, {rowNum}
 */
function substituteRowIndex(template, rowIdx) {
  const rowNum = rowIdx + 1;  // 1-indexed for PDF
  let result = template
    .replace(/\{\{row(Num)?\}\}/gi, String(rowNum))
    .replace(/\{row(Num)?\}/gi, String(rowNum));
  return result;
}

/**
 * Apply transformation to value
 */
function applyTransform(value, mapping) {
  if (!mapping.transform || mapping.transform === 'none' || value === null || value === undefined) {
    return value;
  }

  const { transform, transform_options = {} } = mapping;

  switch (transform) {
    case 'date_format': {
      try {
        const date = new Date(value);
        const format = transform_options.format || 'MM/DD/YYYY';
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const y = date.getFullYear();
        if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
        if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
        if (format === 'MMM DD, YYYY') {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[date.getMonth()]} ${d}, ${y}`;
        }
        return value;
      } catch (e) {
        return value;
      }
    }

    case 'time_format': {
      const totalMin = parseInt(value);
      if (isNaN(totalMin)) return value;
      const hrs = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return `${hrs}:${mins.toString().padStart(2, '0')}`;
    }

    case 'hours_from_minutes':
    case 'duration_hours': {
      const totalMin = parseInt(value);
      if (isNaN(totalMin)) return value;
      return (totalMin / 60).toFixed(2);
    }

    case 'uppercase':
      return String(value).toUpperCase();

    case 'full_name':
      return value?.full_name || String(value);

    case 'currency': {
      const currency = transform_options.currency || 'USD';
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
      return fmt;
    }

    case 'phone_format': {
      const digits = String(value).replace(/\D/g, '');
      if (digits.length !== 10) return value;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    default:
      return value;
  }
}

/**
 * Check if field should be skipped based on conditional_display
 */
function shouldSkipField(value, mapping) {
  if (!mapping.conditional_display) return false;
  // If value is null and no default, skip
  return value === null && !mapping.default_value;
}

/**
 * Check if row meets conditional display criteria
 */
function meetsCondition(row, condition) {
  const { field, operator, value } = condition;
  const rowValue = row[field];

  switch (operator) {
    case 'equals':
      return rowValue === value;
    case 'not_equals':
      return rowValue !== value;
    case 'contains':
      return String(rowValue).includes(String(value));
    case 'in_list':
      return Array.isArray(value) && value.includes(rowValue);
    case 'exists':
      return rowValue !== null && rowValue !== undefined;
    case 'gt':
      return parseFloat(rowValue) > parseFloat(value);
    case 'gte':
      return parseFloat(rowValue) >= parseFloat(value);
    default:
      return true;
  }
}

/**
 * Create standard mappings for Utah VR forms (job development, coaching, CRP)
 */
export function createUtahVRMappings(pdfTemplateId, entryTypeCode, templateVersion = '2024-Q1') {
  const baseMappings = [];

  // Header mappings (always included)
  baseMappings.push(
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'client.first_name',
      pdf_field_name: 'ClientFirstName',
      transform: 'none'
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'client.last_name',
      pdf_field_name: 'ClientLastName',
      transform: 'none'
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'authorization.vr_counselor_name',
      pdf_field_name: 'VRCounselorName',
      transform: 'uppercase'
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'authorization.job_goal',
      pdf_field_name: 'JobGoal',
      transform: 'none'
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'reporting_period_start',
      pdf_field_name: 'PeriodStart',
      transform: 'date_format',
      transform_options: { format: 'MM/DD/YYYY' }
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'header',
      source_field: 'reporting_period_end',
      pdf_field_name: 'PeriodEnd',
      transform: 'date_format',
      transform_options: { format: 'MM/DD/YYYY' }
    }
  );

  // Summary mappings (totals)
  baseMappings.push(
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'summary',
      source_field: 'total_hours',
      pdf_field_name: 'TotalHours',
      transform: 'none'
    },
    {
      pdf_template_id: pdfTemplateId,
      template_version: templateVersion,
      mapping_scope: 'summary',
      source_field: 'total_entries',
      pdf_field_name: 'TotalEntries',
      transform: 'none'
    }
  );

  // Row mappings (vary by entry type)
  if (entryTypeCode === 'job_development') {
    baseMappings.push(
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'date',
        pdf_field_name: 'JobDev_Date_{row}',
        row_group: 'job_development_entries',
        row_field_key: 'date',
        row_sort_order: 0,
        transform: 'date_format',
        transform_options: { format: 'MM/DD/YYYY' },
        max_rows: 20
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'duration_hours',
        pdf_field_name: 'JobDev_Hours_{row}',
        row_group: 'job_development_entries',
        row_field_key: 'duration_hours',
        row_sort_order: 1,
        transform: 'none'
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'employer_name',
        pdf_field_name: 'JobDev_Employer_{row}',
        row_group: 'job_development_entries',
        row_field_key: 'employer_name',
        row_sort_order: 2,
        transform: 'none'
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'description',
        pdf_field_name: 'JobDev_Activity_{row}',
        row_group: 'job_development_entries',
        row_field_key: 'description',
        row_sort_order: 3,
        transform: 'none'
      }
    );
  }

  if (entryTypeCode === 'job_coaching') {
    baseMappings.push(
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'date',
        pdf_field_name: 'Coaching_Date_{row}',
        row_group: 'coaching_sessions',
        row_field_key: 'date',
        row_sort_order: 0,
        transform: 'date_format',
        transform_options: { format: 'MM/DD/YYYY' },
        max_rows: 30
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'duration_hours',
        pdf_field_name: 'Coaching_Hours_{row}',
        row_group: 'coaching_sessions',
        row_field_key: 'duration_hours',
        row_sort_order: 1,
        transform: 'none'
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'employer_name',
        pdf_field_name: 'Coaching_Employer_{row}',
        row_group: 'coaching_sessions',
        row_field_key: 'employer_name',
        row_sort_order: 2,
        transform: 'none'
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'goal_addressed',
        pdf_field_name: 'Coaching_Goal_{row}',
        row_group: 'coaching_sessions',
        row_field_key: 'goal_addressed',
        row_sort_order: 3,
        transform: 'none'
      }
    );
  }

  if (entryTypeCode === 'crp_billable') {
    baseMappings.push(
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'date',
        pdf_field_name: 'CRP_Date_{row}',
        row_group: 'crp_billable_hours',
        row_field_key: 'date',
        row_sort_order: 0,
        transform: 'date_format',
        transform_options: { format: 'MM/DD/YYYY' },
        max_rows: 25
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'duration_hours',
        pdf_field_name: 'CRP_Hours_{row}',
        row_group: 'crp_billable_hours',
        row_field_key: 'duration_hours',
        row_sort_order: 1,
        transform: 'none'
      },
      {
        pdf_template_id: pdfTemplateId,
        template_version: templateVersion,
        mapping_scope: 'row',
        source_field: 'activity_type',
        pdf_field_name: 'CRP_Activity_{row}',
        row_group: 'crp_billable_hours',
        row_field_key: 'activity_type',
        row_sort_order: 2,
        transform: 'none'
      }
    );
  }

  return baseMappings;
}