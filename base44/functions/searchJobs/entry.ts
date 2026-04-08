import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * searchJobs - Normalized job search tool for recommendation workflows
 *
 * Accepts normalized search input and returns standardized job results.
 * Focuses on search and data normalization only—no scoring or filtering.
 *
 * Input:
 *   - searchTerms: string[] - job titles, roles, keywords to search
 *   - location: string - city, state, or region
 *   - locationRadius: number - miles radius for location search (default: 50)
 *   - workType: 'remote' | 'hybrid' | 'onsite' | 'any' (default: 'any')
 *   - industries: string[] - preferred industries (optional, for context)
 *   - payMin: number - minimum hourly pay (optional)
 *   - payMax: number - maximum hourly pay (optional)
 *   - schedule: string - part-time | full-time | any (default: 'any')
 *   - page: number - pagination (default: 1)
 *
 * Output: Normalized jobs array with:
 *   - id, title, employer, location, pay, schedule
 *   - source_url, source_platform
 *   - raw_description, posted_date
 *   - (No scoring or filtering applied)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      searchTerms = [],
      location,
      locationRadius = 50,
      workType = 'any',
      industries = [],
      payMin,
      payMax,
      schedule = 'any',
      page = 1
    } = body;

    // Validate inputs
    if (!searchTerms || searchTerms.length === 0) {
      return Response.json({ error: 'searchTerms array is required' }, { status: 400 });
    }

    if (!location) {
      return Response.json({ error: 'location is required' }, { status: 400 });
    }

    // Build search query
    const searchQuery = buildSearchQuery(searchTerms, location, locationRadius, workType, schedule);
    
    // Fetch jobs from JSearch
    const jobs = await searchJobsApi(searchQuery, page);

    // Normalize results
    const normalized = jobs.map(job => normalizeJobResult(job, {
      location,
      workType,
      payMin,
      payMax
    }));

    return Response.json({
      success: true,
      search_params: {
        terms: searchTerms,
        location,
        location_radius: locationRadius,
        work_type: workType,
        industries: industries.length > 0 ? industries : null,
        schedule,
        pay_range: payMin || payMax ? { min: payMin, max: payMax } : null
      },
      results: normalized,
      total: normalized.length,
      page
    });

  } catch (error) {
    console.error('searchJobs error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Search Query Builder ──────────────────────────────────────────────────

function buildSearchQuery(searchTerms, location, locationRadius, workType, schedule) {
  let query = searchTerms.join(' OR ');

  // Add location context
  if (location) {
    query += ` in ${location}`;
  }

  // Add work type preference to query if not 'any'
  if (workType === 'remote') {
    query += ' remote';
  } else if (workType === 'onsite') {
    query += ' on-site';
  }

  // Add schedule preference to query if not 'any'
  if (schedule === 'part-time') {
    query += ' part-time';
  } else if (schedule === 'full-time') {
    query += ' full-time';
  }

  return query;
}

// ─── JSearch API Call ─────────────────────────────────────────────────────

async function searchJobsApi(query, page = 1) {
  const params = new URLSearchParams({
    query,
    page: String(page),
    num_pages: '1',
    date_posted: 'month'
  });

  const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': Deno.env.get('RAPIDAPI_KEY'),
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('JSearch API error:', response.status, text);
    throw new Error(`JSearch API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

// ─── Result Normalization ─────────────────────────────────────────────────

function normalizeJobResult(job, context) {
  // Parse pay info
  const payInfo = normalizePay(
    job.job_min_salary,
    job.job_max_salary,
    job.job_salary_period,
    context.payMin,
    context.payMax
  );

  // Determine work type
  const workType = job.job_is_remote ? 'remote' : 'onsite';

  // Determine schedule
  let schedule = null;
  const description = (job.job_description || '').toLowerCase();
  if (description.includes('full-time') || description.includes('fulltime')) {
    schedule = 'full-time';
  } else if (description.includes('part-time') || description.includes('parttime')) {
    schedule = 'part-time';
  }

  // Build location string
  const location = formatLocation(job);

  return {
    // Core fields required for recommendation workflow
    id: job.job_id,
    title: job.job_title,
    employer: job.employer_name,
    location: location,
    work_type: workType,
    schedule: schedule,

    // Pay information
    pay: payInfo.pay_string,
    pay_min: payInfo.min,
    pay_max: payInfo.max,
    pay_period: payInfo.period,

    // Source information
    source_url: job.job_apply_link || job.job_google_link,
    source_platform: normalizeSourcePlatform(job.job_publisher),
    posted_date: job.job_posted_at_datetime_utc,

    // Context for recommendation analysis
    raw_description: job.job_description ? job.job_description.slice(0, 500) : null,
    employer_logo: job.employer_logo || null,
    job_type: job.job_type || null
  };
}

// ─── Helper Functions ──────────────────────────────────────────────────────

function normalizePay(minSalary, maxSalary, period, contextMin, contextMax) {
  // Handle missing salary data
  if (!minSalary && !maxSalary) {
    return {
      pay_string: null,
      min: null,
      max: null,
      period: null
    };
  }

  // Normalize period (convert to hourly if needed for comparison)
  const normalizedPeriod = period ? period.toLowerCase() : 'YEAR';
  let hourlyMin = minSalary;
  let hourlyMax = maxSalary;

  // Convert to hourly for consistency (assuming 2080 hours/year)
  if (normalizedPeriod === 'YEAR' || normalizedPeriod === 'SALARY') {
    hourlyMin = minSalary ? Math.round(minSalary / 2080) : null;
    hourlyMax = maxSalary ? Math.round(maxSalary / 2080) : null;
  }

  // Build readable pay string
  let payString = null;
  if (hourlyMin && hourlyMax) {
    payString = `$${hourlyMin}-$${hourlyMax}/hr`;
  } else if (hourlyMin) {
    payString = `$${hourlyMin}+/hr`;
  } else if (hourlyMax) {
    payString = `up to $${hourlyMax}/hr`;
  }

  return {
    pay_string: payString,
    min: hourlyMin,
    max: hourlyMax,
    period: 'hourly'
  };
}

function formatLocation(job) {
  if (job.job_city) {
    const state = job.job_state || job.job_country || '';
    return state ? `${job.job_city}, ${state}` : job.job_city;
  }
  if (job.job_country) {
    return job.job_country;
  }
  return 'Remote';
}

function normalizeSourcePlatform(publisher) {
  if (!publisher) return 'Unknown';
  
  const name = publisher.toLowerCase();
  if (name.includes('indeed')) return 'Indeed';
  if (name.includes('linkedin')) return 'LinkedIn';
  if (name.includes('glassdoor')) return 'Glassdoor';
  if (name.includes('ziprecruiter')) return 'ZipRecruiter';
  if (name.includes('monster')) return 'Monster';
  if (name.includes('careerbuilder')) return 'CareerBuilder';
  
  // Return original if no match
  return publisher.charAt(0).toUpperCase() + publisher.slice(1);
}