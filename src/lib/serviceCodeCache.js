import { base44 } from "@/api/base44Client";

/**
 * Job Coaching service-code cache.
 *
 * Codes are loaded through the authorized TimeEntry configuration route rather
 * than directly from the browser entity client.
 */
class ServiceCodeCacheManager {
  constructor() {
    this.serviceCodes = null;
    this.lastFetch = null;
    this.fetchPromise = null;
    this.maxAge = 5 * 60 * 1000;
  }

  async fetchServiceCodes(forceRefresh = false) {
    const now = Date.now();
    const isStale = !this.lastFetch || now - this.lastFetch > this.maxAge;

    if (!forceRefresh && this.serviceCodes && !isStale) {
      return this.serviceCodes;
    }

    if (this.fetchPromise && !forceRefresh) {
      return this.fetchPromise;
    }

    this.fetchPromise = this._performFetch();

    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  async _performFetch() {
    const response = await base44.functions.invoke(
      "getAuthorizedTimeEntryConfig",
      {
        action: "get_entry_type_configuration",
        entry_type_code: "job_coaching",
      }
    );
    const payload = response?.data ?? response ?? {};

    if (!payload?.ok || !Array.isArray(payload?.service_codes)) {
      throw new Error(
        payload?.error || "Authorized Job Coaching service codes could not be loaded."
      );
    }

    const codes = [...payload.service_codes].sort((left, right) => {
      const getNumber = (code) => {
        const match = String(code || "").match(/\d+/);
        return match ? Number(match[0]) : 0;
      };

      return getNumber(left.code) - getNumber(right.code);
    });

    this.serviceCodes = codes;
    this.lastFetch = Date.now();

    return codes;
  }

  invalidate() {
    this.serviceCodes = null;
    this.lastFetch = null;
    this.fetchPromise = null;
  }

  async getPrimaryCodes() {
    const codes = await this.fetchServiceCodes();
    return codes.filter((code) => code.is_primary !== false);
  }

  async getSecondaryCodes() {
    const codes = await this.fetchServiceCodes();
    return codes.filter((code) => code.is_secondary !== false);
  }

  async getDropdownOptions() {
    const codes = await this.fetchServiceCodes();

    return codes.map((code) => ({
      value: code.code,
      label: code.display_label,
      fullDescription: code.full_description,
    }));
  }

  async validateConsistency(fieldOptions = []) {
    const codes = await this.fetchServiceCodes();
    const expectedCount = codes.length;
    const actualCount = fieldOptions.length;

    if (expectedCount !== actualCount) {
      return {
        consistent: false,
        message: `Dropdown has ${actualCount} options but authorized configuration has ${expectedCount} codes.`,
      };
    }

    return { consistent: true };
  }
}

export const serviceCodeCache = new ServiceCodeCacheManager();
