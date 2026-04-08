import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Database, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

export default function GroundingSummary({ clientId, isCollapsed, onToggle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGrounding = async () => {
      try {
        setLoading(true);
        const client = await base44.entities.Client.filter({ id: clientId }, null, 1);
        if (client.length) {
          const c = client[0];
          
          // Load counts for related records
          const [docs, assessments, jobs, recommendations] = await Promise.all([
            base44.entities.Document.filter({ client_id: clientId }, null, 1000),
            base44.entities.Assessment.filter({ client_id: clientId }, null, 1000),
            base44.entities.JobRecommendation.filter({ client_id: clientId }, null, 1000),
            base44.entities.JobRecommendationBatch.filter({ client_id: clientId }, null, 1000)
          ]);

          const missing = [];
          if (!c.first_name || !c.last_name) missing.push("Client name incomplete");
          if (!c.vocational_facts_profile) missing.push("Vocational profile not extracted");
          if (assessments.length === 0) missing.push("No assessments on file");
          if (docs.length === 0) missing.push("No documents uploaded");
          if (jobs.length === 0) missing.push("No job history recorded");

          setData({
            clientLoaded: true,
            vocationalProfileLoaded: !!c.vocational_facts_profile,
            vocationalProfileVersion: c.vocational_facts_profile?.version || 0,
            vocationalProfileExtractedAt: c.vocational_facts_extracted_at,
            assessmentCount: assessments.length,
            assessmentTypes: assessments.map(a => a.assessment_type),
            documentCount: docs.length,
            jobRecommendationCount: jobs.length,
            jobRecommendationBatchCount: recommendations.length,
            missingData: missing,
            dataQualityScore: c.vocational_facts_profile?.quality_score || 0
          });
        }
      } catch (e) {
        console.error("Failed to load grounding data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadGrounding();
  }, [clientId]);

  if (loading) {
    return (
      <div className="text-xs text-slate-500 px-4 py-2">
        Loading data sources...
      </div>
    );
  }

  if (!data) return null;

  const hasWarnings = data.missingData.length > 0;

  return (
    <div className="border-t border-slate-100 bg-slate-50/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Grounding</span>
          {hasWarnings && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        )}
      </button>

      {!isCollapsed && (
        <div className="px-4 py-3 space-y-3 text-xs">
          {/* Client Profile */}
          <div className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-100">
            <div>
              <p className="font-medium text-slate-700">Client Profile</p>
              <p className="text-slate-500 mt-0.5">Basic info loaded</p>
            </div>
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          </div>

          {/* Vocational Profile */}
          <div className={cn(
            "flex items-start justify-between gap-2 p-2 rounded border",
            data.vocationalProfileLoaded
              ? "bg-white border-green-100"
              : "bg-amber-50 border-amber-100"
          )}>
            <div>
              <p className="font-medium text-slate-700">Vocational Profile</p>
              {data.vocationalProfileLoaded ? (
                <p className="text-slate-500 mt-0.5">
                  v{data.vocationalProfileVersion} • Quality: {data.dataQualityScore}%
                </p>
              ) : (
                <p className="text-amber-700 mt-0.5">Not yet extracted</p>
              )}
            </div>
            {data.vocationalProfileLoaded ? (
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
          </div>

          {/* Assessments */}
          <div className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-100">
            <div>
              <p className="font-medium text-slate-700">Assessments</p>
              {data.assessmentCount > 0 ? (
                <p className="text-slate-500 mt-0.5">{data.assessmentCount} on file</p>
              ) : (
                <p className="text-amber-700 mt-0.5">None found</p>
              )}
            </div>
            {data.assessmentCount > 0 ? (
              <Badge variant="outline" className="text-[10px] h-fit shrink-0">
                {data.assessmentCount}
              </Badge>
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
          </div>

          {/* Documents */}
          <div className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-100">
            <div>
              <p className="font-medium text-slate-700">Documents</p>
              {data.documentCount > 0 ? (
                <p className="text-slate-500 mt-0.5">{data.documentCount} uploaded</p>
              ) : (
                <p className="text-amber-700 mt-0.5">No documents</p>
              )}
            </div>
            {data.documentCount > 0 ? (
              <Badge variant="outline" className="text-[10px] h-fit shrink-0">
                {data.documentCount}
              </Badge>
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
          </div>

          {/* Job Recommendations */}
          {data.jobRecommendationCount > 0 && (
            <div className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-slate-100">
              <div>
                <p className="font-medium text-slate-700">Job Recommendations</p>
                <p className="text-slate-500 mt-0.5">{data.jobRecommendationCount} total</p>
              </div>
              <Badge variant="outline" className="text-[10px] h-fit shrink-0">
                {data.jobRecommendationBatchCount} batches
              </Badge>
            </div>
          )}

          {/* Missing Data Warnings */}
          {hasWarnings && (
            <div className="border-t border-slate-100 pt-2 mt-2">
              <p className="font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Missing Data
              </p>
              <ul className="space-y-1">
                {data.missingData.map((msg, i) => (
                  <li key={i} className="text-slate-600 flex gap-1.5">
                    <span className="text-amber-600 shrink-0">•</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-slate-400 pt-1 italic">
            More complete data = better AI insights
          </p>
        </div>
      )}
    </div>
  );
}