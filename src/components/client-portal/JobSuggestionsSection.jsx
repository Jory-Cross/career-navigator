import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Building2, MapPin, ExternalLink, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function JobSuggestionsSection({ client, onAddApplication }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const fetchJobSuggestions = async () => {
    if (!client.target_role) {
      toast.error("Please set a target role in your profile first");
      return;
    }

    setLoading(true);
    try {
      const prompt = `Search for current job openings for: ${client.target_role}${client.industry ? ` in ${client.industry}` : ''}${client.location ? ` located in ${client.location}` : ''}.

Find 5 real, current job postings from company career pages or job boards. For each job, provide:
- Company name
- Position title
- Location
- Job URL (actual link to the posting)
- Brief description (1-2 sentences)
- Work type (remote/hybrid/onsite)

Only include real, active job postings you can find online.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: { type: "string" },
                  position: { type: "string" },
                  location: { type: "string" },
                  job_url: { type: "string" },
                  description: { type: "string" },
                  work_type: { type: "string" }
                }
              }
            }
          }
        }
      });

      setSuggestions(result.jobs || []);
      toast.success(`Found ${result.jobs?.length || 0} job suggestions`);
    } catch (error) {
      toast.error("Failed to fetch job suggestions");
    } finally {
      setLoading(false);
    }
  };

  const addJobToApplications = async (job) => {
    try {
      await base44.entities.JobApplication.create({
        client_id: client.id,
        company: job.company,
        position: job.position,
        location: job.location,
        job_url: job.job_url,
        work_type: job.work_type?.toLowerCase(),
        notes: job.description,
        status: 'saved'
      });
      toast.success("Added to applications");
      if (onAddApplication) onAddApplication();
    } catch (error) {
      toast.error("Failed to add application");
    }
  };

  return (
    <Card className="border-0 shadow-sm mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">AI Job Suggestions</CardTitle>
            <Badge variant="outline" className="text-xs">Powered by Web Search</Badge>
          </div>
          <Button 
            size="sm" 
            onClick={fetchJobSuggestions} 
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Find Jobs
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-1">AI-powered job search</p>
            <p className="text-xs text-slate-400">
              Click "Find Jobs" to discover opportunities matching your profile
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((job, idx) => (
              <div key={idx} className="p-4 bg-gradient-to-br from-blue-50 to-violet-50 rounded-lg border border-blue-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-800">{job.position}</p>
                      {job.work_type && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 capitalize">
                          {job.work_type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {job.company}
                      </span>
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-xs text-slate-600 mb-2">{job.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <a 
                        href={job.job_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Posting
                      </a>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => addJobToApplications(job)}
                    className="shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}