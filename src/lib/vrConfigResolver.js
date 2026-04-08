import { base44 } from '@/api/base44Client';

/**
 * VR Config Resolver
 *
 * Prioritizes database as source of truth, falls back to vrFormConfig as reference.
 * This allows gradual migration: database records override seed config once created.
 */

// Cache for performance
let _entryTypesCache = null;
let _fieldTemplatesCache = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Seed fallback data (imported from vrFormConfig)
const DEFAULT_ENTRY_TYPES = {
  job_development: { name: "Job Development", code: "job_development" },
  job_coaching: { name: "Job Coaching", code: "job_coaching" },
  life_skills: { name: "Life Skills", code: "life_skills" },
  csb_hours: { name: "CSB Hours", code: "csb_hours" },
  pre_ets: { name: "Pre-ETS", code: "pre_ets" },
  wsa: { name: "WSA", code: "wsa" },
  admin_time: { name: "Admin Time", code: "admin_time" },
  misc: { name: "Misc", code: "misc" }
};

/**
 * Get all entry types from database, fall back to seed config
 */
export async function getAllEntryTypes() {
  const cacheKey = 'entry_types';
  if (_entryTypesCache && Date.now() - _cacheTimestamp < CACHE_TTL) {
    return _entryTypesCache;
  }

  try {
    const dbEntryTypes = await base44.entities.EntryType.list();
    _entryTypesCache = dbEntryTypes && dbEntryTypes.length > 0 ? dbEntryTypes : Object.values(DEFAULT_ENTRY_TYPES);
  } catch (e) {
    console.warn('Failed to load EntryTypes from database, using fallback:', e.message);
    _entryTypesCache = Object.values(DEFAULT_ENTRY_TYPES);
  }

  _cacheTimestamp = Date.now();
  return _entryTypesCache;
}

/**
 * Get entry type by code
 */
export async function getEntryType(code) {
  const entryTypes = await getAllEntryTypes();
  return entryTypes.find(et => et.code === code) || DEFAULT_ENTRY_TYPES[code] || null;
}

/**
 * Get all field templates for an entry type
 */
export async function getFieldTemplatesForEntryType(entryTypeCode) {
  try {
    const templates = await base44.entities.ReportFieldTemplate.filter({
      entry_type_code: entryTypeCode
    }, 'order');
    return templates || [];
  } catch (e) {
    console.warn(`Failed to load templates for ${entryTypeCode}:`, e.message);
    return [];
  }
}

/**
 * Get field template by key
 */
export async function getFieldTemplate(entryTypeCode, fieldKey) {
  const templates = await getFieldTemplatesForEntryType(entryTypeCode);
  return templates.find(t => t.field_key === fieldKey) || null;
}

/**
 * Check if entry types exist in database
 * Returns true if database has been seeded with VR config
 */
export async function isVRConfigSeeded() {
  try {
    const entryTypes = await base44.entities.EntryType.list();
    // Check if at least one VR entry type exists
    const vrCodes = Object.keys(DEFAULT_ENTRY_TYPES);
    return entryTypes.some(et => vrCodes.includes(et.code));
  } catch (e) {
    return false;
  }
}

/**
 * Invalidate cache (call after seeding or updates)
 */
export function invalidateCache() {
  _entryTypesCache = null;
  _fieldTemplatesCache = null;
  _cacheTimestamp = 0;
}

/**
 * Get field templates sorted by order
 */
export async function getFieldTemplatesSorted(entryTypeCode) {
  const templates = await getFieldTemplatesForEntryType(entryTypeCode);
  return templates.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get required fields only
 */
export async function getRequiredFields(entryTypeCode) {
  const templates = await getFieldTemplatesSorted(entryTypeCode);
  return templates.filter(t => t.is_required === true);
}

/**
 * Get reportable fields (fields that appear on PDF)
 */
export async function getReportableFields(entryTypeCode) {
  const templates = await getFieldTemplatesSorted(entryTypeCode);
  return templates.filter(t => t.is_reportable === true && t.pdf_context !== 'none');
}

/**
 * Get fields by section
 */
export async function getFieldsBySection(entryTypeCode) {
  const templates = await getFieldTemplatesSorted(entryTypeCode);
  const grouped = {};

  templates.forEach(t => {
    const section = t.section || 'Other';
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(t);
  });

  return grouped;
}

/**
 * Validate field answers against required fields
 */
export async function validateFieldAnswers(entryTypeCode, answers = {}) {
  const required = await getRequiredFields(entryTypeCode);
  const missing = required.filter(f => !answers[f.field_key] || answers[f.field_key] === '');

  return {
    isValid: missing.length === 0,
    missing: missing.map(f => ({ key: f.field_key, label: f.label })),
    completed: required.length - missing.length,
    total: required.length
  };
}