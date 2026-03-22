import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query, location, page = 1 } = await req.json();
    if (!query) return Response.json({ error: 'query is required' }, { status: 400 });

    const params = new URLSearchParams({
      query: location ? `${query} in ${location}` : query,
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
      console.error('JSearch error:', response.status, text);
      return Response.json({ error: 'JSearch API error', detail: text }, { status: response.status });
    }

    const data = await response.json();

    const jobs = (data.data || []).map(job => ({
      id: job.job_id,
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country}` : (job.job_country || 'Remote'),
      work_type: job.job_is_remote ? 'remote' : 'onsite',
      description: job.job_description?.slice(0, 400) + (job.job_description?.length > 400 ? '...' : ''),
      url: job.job_apply_link || job.job_google_link,
      posted: job.job_posted_at_datetime_utc,
      salary_min: job.job_min_salary,
      salary_max: job.job_max_salary,
      salary_period: job.job_salary_period,
      source: job.job_publisher,
      logo: job.employer_logo
    }));

    return Response.json({ jobs, total: data.status === 'OK' ? jobs.length : 0 });
  } catch (error) {
    console.error('searchJobs error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});