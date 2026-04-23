import { base44 } from "@/api/base44Client";

/**
 * O*NET Adapter
 * All external calls must go through backend functions
 */

export async function searchOnetCareers({ query, limit = 10 }) {
  try {
    const res = await base44.functions.invoke("searchOnetCareers", {
      query,
      limit,
    });

    if (!res || res.error) {
      throw new Error(res?.error || "O*NET function failed");
    }

    return {
      source: "onet",
      items: Array.isArray(res.items) ? res.items : [],
    };
  } catch (error) {
    console.error("searchOnetCareers adapter error:", error);

    // fallback — DO NOT REMOVE (keeps system functional if API fails)
    return {
      source: "fallback",
      items: [],
    };
  }
}
