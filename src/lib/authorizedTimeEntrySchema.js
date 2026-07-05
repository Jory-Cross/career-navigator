import { base44 } from "@/api/base44Client";
import { normalizeEntryTypeCode } from "@/lib/entryTypeRegistry";

const CONTEXT_DERIVED_FIELD_KEYS = new Set([
  "client_name",
  "client_first_name",
  "client_last_name",
  "authorization_number",
  "auth_number",
  "service_authorization_number",
  "vr_counselor_name",
  "vr_counselor",
  "crp_company_name",
  "crp_name",
  "crp_contact_phone",
  "crp_phone",
  "counselor_name",
  "case_number",
  "vr_case_number",
]);

function toOptionObjects(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === "string") {
      return { value: item, label: item };
    }

    return {
      value: item?.value ?? item?.code ?? item?.id ?? item?.label,
      label:
        item?.label ??
        item?.display_label ??
        item?.name ??
        item?.value ??
        item?.code ??
        "",
    };
  });
}

function projectSchema(template, primaryCodes, secondaryCodes) {
  const fieldKey = String(template?.field_key || "");
  const fieldKeyLower = fieldKey.toLowerCase();
  let options = toOptionObjects(template?.options);

  if (fieldKeyLower.includes("primary_service_code") && primaryCodes.length > 0) {
    options = primaryCodes;
  } else if (
    fieldKeyLower.includes("secondary_service_code") &&
    secondaryCodes.length > 0
  ) {
    options = secondaryCodes;
  }

  return {
    key: fieldKey,
    label: template?.label || fieldKey,
    type: template?.field_type || "text",
    required: template?.is_required === true,
    placeholder: template?.placeholder || "",
    help_text: template?.help_text || "",
    options,
  };
}

/**
 * Loads a vocational-rehabilitation schema through the authenticated
 * server-side TimeEntry configuration route. The browser never reads EntryType,
 * ReportFieldTemplate, or ServiceCode entities directly.
 */
export async function loadAuthorizedVocRehabSchema(entryTypeCode) {
  const normalizedCode = normalizeEntryTypeCode(entryTypeCode);

  if (!normalizedCode) {
    return [];
  }

  const response = await base44.functions.invoke(
    "getAuthorizedTimeEntryConfig",
    {
      action: "get_entry_type_configuration",
      entry_type_code: normalizedCode,
    }
  );
  const payload = response?.data ?? response ?? {};

  if (!payload?.ok) {
    throw new Error(payload?.error || "Unable to load the TimeEntry schema.");
  }

  const serviceCodes = Array.isArray(payload?.service_codes)
    ? payload.service_codes
    : [];
  const primaryCodes = toOptionObjects(
    serviceCodes.filter((serviceCode) => serviceCode?.is_primary !== false)
  );
  const secondaryCodes = toOptionObjects(
    serviceCodes.filter((serviceCode) => serviceCode?.is_secondary !== false)
  );

  return (Array.isArray(payload?.templates) ? payload.templates : [])
    .filter((template) => template?.is_internal_only !== true)
    .filter(
      (template) =>
        !CONTEXT_DERIVED_FIELD_KEYS.has(
          String(template?.field_key || "").toLowerCase()
        )
    )
    .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0))
    .map((template) => projectSchema(template, primaryCodes, secondaryCodes));
}
