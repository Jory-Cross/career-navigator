import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Search, Loader2, Building2, MapPin, ExternalLink, Plus, Briefcase, DollarSign, ChevronRight } from "lucide-react";

export default function LiveJobSearch({ client, onAddApplication }) {
  const [query, setQuery] = useState(client?.target_role || "");
  const [location, setLocation] = useState(client?.location || "");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [addedIds, setAddedIds] = useState(new Set());

  const search = async (pageNum = 1) => {
    if (!query.trim()) {
      toast.error("Please enter a job title or keyword");
      return;
    }
    setLoading(true);
    if (pageNum === 1) setJobs([]);
    try {
      const res = await base44.functions.invoke('searchJobs', {
        query: query.trim(),
        location: location.trim() || undefined,
        page: pageNum
      });
      const newJobs = res.data?.jobs || [];
      if (pageNum === 1) {
        setJobs(newJobs);
      } else {
        setJobs(prev => [...prev, ...newJobs]);
      }
      setPage(pageNum);
      if (newJobs.length === 0 && pageNum === 1) {
        toast.info("No jobs found. Try different keywords.");
      }
    } catch (err) {
      toast.error("Search failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addJob = async (job) => {
    try {
      await base44.entities.JobApplication.create({
        client_id: client.id,
        company: job.company,
        position: job.title,
        location: job.location,
        job_url: job.url,
        work_type: job.work_type,
        salary_range: job.salary_min ? `$${job.salary_min?.toLocaleString()} - $${job.salary_max?.toLocaleString()} / ${job.salary_period || 'yr'}` : "",
        notes: job.description,
        status: 'saved'
      });
      setAddedIds(prev => new Set([...prev, job.id]));
      toast.success("Added to applications");
      if (onAddApplication) onAddApplication();
    } catch {
      toast.error("Failed to add");
    }
  };

  const formatSalary = (job) => {
    if (!job.salary_min && !job.salary_max) return null;
    const period = job.salary_period === 'HOUR' ? '/hr' : job.salary_period === 'MONTH' ? '/mo' : '/yr';
    if (job.salary_min && job.salary_max) return `$${Math.round(job.salary_min / 1000)}k–$${Math.round(job.salary_max / 1000)}k${period}`;
    if (job.salary_min) return `From $${Math.round(job.salary_min / 1000)}k${period}`;
    return `Up to $${Math.round(job.salary_max / 1000)}k${period}`;
  };

  const workTypeBadge = {
    remote: "bg-emerald-100 text-emerald-700",
    onsite: "bg-slate-100 text-slate-600",
    hybrid: "bg-blue-100 text-blue-700"
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2 flex-wrap">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Job title, keywords..."
          className="flex-1 min-w-40"
          onKeyDown={e => e.key === 'Enter' && search(1)}
        />
        <Input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="City, State or Remote"
          className="flex-1 min-w-40"
          onKeyDown={e => e.key === 'Enter' && search(1)}
        />
        <Button onClick={() => search(1)} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {/* Results */}
      {jobs.length === 0 && !loading && (
        <div className="text-center py-10">
          <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Search for live job listings from Indeed, LinkedIn, Glassdoor & more</p>
          <p className="text-xs text-slate-400 mt-1">Results are pulled in real-time via JSearch</p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map(job => {
          const salary = formatSalary(job);
          const isAdded = addedIds.has(job.id);
          return (
            <div key={job.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                {job.logo ? (
                  <img src={job.logo} alt={job.company} className="w-10 h-10 rounded-lg object-contain border border-slate-100 shrink-0 bg-white" onError={e => e.target.style.display='none'} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm leading-tight">{job.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                        {salary && <span className="flex items-center gap-1 text-emerald-600 font-medium"><DollarSign className="w-3 h-3" />{salary}</span>}
                        {job.source && <span className="text-slate-400">via {job.source}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {job.work_type && (
                        <Badge className={`text-[10px] border-0 ${workTypeBadge[job.work_type] || workTypeBadge.onsite}`}>
                          {job.work_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {job.description && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{job.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View Posting
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant={isAdded ? "secondary" : "outline"}
                      onClick={() => !isAdded && addJob(job)}
                      disabled={isAdded}
                      className="h-7 text-xs ml-auto"
                    >
                      {isAdded ? "✓ Added" : <><Plus className="w-3 h-3 mr-1" />Add to Applications</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {jobs.length >= 10 && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => search(page + 1)} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}