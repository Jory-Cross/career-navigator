import { base44 } from '@/api/base44Client';

/**
 * Service Code Cache Manager
 * 
 * Ensures dropdown options always reflect current database state
 * without stale cache issues.
 * 
 * Strategy:
 * - Fetch fresh on mount (no initial caching)
 * - Use query invalidation on mutations
 * - Store in React state (memory), not localStorage
 */

class ServiceCodeCacheManager {
  constructor() {
    this.serviceCodes = null;
    this.lastFetch = null;
    this.fetchPromise = null;
    this.maxAge = 5 * 60 * 1000; // 5 minutes before refetch
  }

  /**
   * Fetch service codes fresh from database
   * Prevents multiple concurrent requests
   */
  async fetchServiceCodes(forceRefresh = false) {
    const now = Date.now();
    const isStale = !this.lastFetch || (now - this.lastFetch) > this.maxAge;

    // If cache is fresh and not forcing, return cached data
    if (!forceRefresh && this.serviceCodes && !isStale) {
      console.log('[ServiceCodeCache] Returning cached codes');
      return this.serviceCodes;
    }

    // If already fetching, wait for that promise
    if (this.fetchPromise && !forceRefresh) {
      console.log('[ServiceCodeCache] Waiting for in-flight request');
      return this.fetchPromise;
    }

    // Start fresh fetch
    this.fetchPromise = this._performFetch();
    const codes = await this.fetchPromise;
    this.fetchPromise = null;

    return codes;
  }

  async _performFetch() {
    try {
      console.log('[ServiceCodeCache] Fetching fresh codes from database');
      const codes = await base44.entities.ServiceCode.filter({
        service_type: "job_coaching",
        is_active: true
      });

      codes.sort((a, b) => {
  const getNumber = (code) => {
    const match = String(code || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  return getNumber(a.code) - getNumber(b.code);
});
      
      this.serviceCodes = codes;
      this.lastFetch = Date.now();

      console.log(`[ServiceCodeCache] Fetched ${codes.length} codes`);
      return codes;
    } catch (error) {
      console.error('[ServiceCodeCache] Fetch failed:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate cache when service codes are created/updated/deleted
   * Frontend will call this after mutations
   */
  invalidate() {
    console.log('[ServiceCodeCache] Cache invalidated by mutation');
    this.serviceCodes = null;
    this.lastFetch = null;
    this.fetchPromise = null;
  }

  /**
   * Get primary codes only
   */
  async getPrimaryCodes() {
    const codes = await this.fetchServiceCodes();
    return codes.filter(c => c.is_primary);
  }

  /**
   * Get secondary codes only
   */
  async getSecondaryCodes() {
    const codes = await this.fetchServiceCodes();
    return codes.filter(c => c.is_secondary);
  }

  /**
   * Get formatted options for dropdowns
   */
  async getDropdownOptions() {
    const codes = await this.fetchServiceCodes();
    return codes.map(c => ({
      value: c.code,
      label: c.display_label,
      fullDescription: c.full_description
    }));
  }

  /**
   * Validate that all codes are present in dropdown
   */
  async validateConsistency(fieldOptions = []) {
    const codes = await this.fetchServiceCodes();
    const expectedCount = codes.length;
    const actualCount = fieldOptions.length;

    if (expectedCount !== actualCount) {
      console.warn(
        `[ServiceCodeCache] Consistency check FAILED: ` +
        `Expected ${expectedCount} options, found ${actualCount}`
      );
      return {
        consistent: false,
        message: `Dropdown has ${actualCount} options but database has ${expectedCount} codes`
      };
    }

    console.log('[ServiceCodeCache] Consistency check PASSED');
    return { consistent: true };
  }
}

// Singleton instance
export const serviceCodeCache = new ServiceCodeCacheManager();
