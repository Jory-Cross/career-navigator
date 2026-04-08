import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Briefcase, TrendingUp, AlertCircle, HeartHandshake, Clock, MapPin, 
  Target, Sparkles, RefreshCw, Loader2, Eye, ArrowRight, CheckCircle,
  AlertTriangle, Calendar, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const readinessLevels = {
  "job_ready": { color: "bg-green-100 text-green-800", icon: "✅", label: "Job Ready" },
  "needs_support": { color: "bg-amber-100 text-amber-800", icon: "🤝", label: "Needs Support" },
  "exploring": { color: "bg-blue-100 text-blue-800", icon: "🔍", label: "Exploring" },
  "early_stage": { color: "bg-purple-100 text-purple-800", icon: "📅", label: "Early Stage" },
};

function SourcesModal({ open, onOpenChange, client }) {
  if (!client?.vocational_facts_profile) return null;
  
  const profile = client.vocational_facts_profile;
  const docTypes = profile.document_types_found || [];
  const docCount = client.vocational_facts_document_count || 0;
  const assessCount = client.vocational_facts_assessment_count || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Data Sources</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{docCount}</div>
              <div className="text-xs text-slate-600 mt-1">Documents Analyzed</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{assessCount}</div>
              <div className="text-xs text-slate-600 mt-1">Assessments Used</div>
            </div>
          </div>

          {docTypes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-800 mb-2">Document Types:</p>
              <div className="flex flex-wrap gap-1.5">
                {docTypes.map((type, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {profile.missing_critical_data?.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Missing Critical Data
              </p>
              <div className="space-y-1">
                {profile.missing_critical_data.map((item, i) => (
                  <p key={i} className="text-xs text-amber-700">• {item}</p>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 pt-2">
            <p>Last extracted: {client.vocational_facts_extracted_at ? format(new Date(client.vocational_facts_extracted_at), 'MMM d, yyyy') : 'Never'}</p>
            {client.vocational_facts_extracted_by && <p>By: {client.vocational_facts_extracted_by}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VocationalProfileCard({ client, onRefresh, onOpenAssistant, onOpenJobSearch }) {
  const [extracting, setExtracting] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const profile = client?.vocational_facts_profile;
  const readinessKey = profile?.job_readiness_level;
  const readinessConfig = readinessLevels[readinessKey] || readinessLevels.exploring;

  const handleRefresh = async () => {
    setExtracting(true);
    try {
      await base44.functions.invoke('processAssessmentDocuments', {
        action: 'extract_from_documents',
        clientId: client.id,
      });
      toast.success('Profile refreshed from assessments');
      if (onRefresh) await onRefresh();
    } catch (e) {
      toast.error('Refresh failed: ' + (e?.response?.data?.error || e.message));
    } finally {
      setExtracting(false);
    }
  };

  if (!profile) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center">
          <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">No Vocational Profile</p>
          <p className="text-xs text-slate-500 mt-1">Extract facts from assessments to ground job recommendations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="w-4 h-4 text-slate-600" />
                Vocational Profile
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">Grounding for job recommendations</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={handleRefresh}
              disabled={extracting}
            >
              {extracting ? (
                <><Loader2 className="w-3 h-3 animate-spin mr-1" /></>
              ) : (
                <><RefreshCw className="w-3 h-3 mr-1" /></>
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Readiness Level - Prominent */}
          {readinessKey && (
            <div className={cn("rounded-lg p-3", readinessConfig.color)}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{readinessConfig.icon}</span>
                <div>
                  <p className="text-xs font-semibold">Job Readiness</p>
                  <p className="text-sm font-bold">{readinessConfig.label}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Employment Goals */}
            {profile.goals?.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">Goals</span>
                </div>
                <p className="text-xs text-blue-800 line-clamp-2">
                  {profile.goals[0].fact || profile.goals[0]}
                </p>
              </div>
            )}

            {/* Strengths */}
            {profile.skills?.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-semibold text-green-900">Strengths</span>
                </div>
                <p className="text-xs text-green-800 line-clamp-2">
                  {profile.skills[0].fact || profile.skills[0]}
                </p>
              </div>
            )}

            {/* Barriers */}
            {profile.barriers?.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-semibold text-red-900">Barriers</span>
                </div>
                <p className="text-xs text-red-800 line-clamp-2">
                  {profile.barriers[0].fact || profile.barriers[0]}
                </p>
              </div>
            )}

            {/* Support Needs */}
            {profile.support_needs?.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-900">Support</span>
                </div>
                <p className="text-xs text-amber-800 line-clamp-2">
                  {profile.support_needs[0].fact || profile.support_needs[0]}
                </p>
              </div>
            )}

            {/* Preferences */}
            {profile.preferred_tasks?.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-900">Preferences</span>
                </div>
                <p className="text-xs text-purple-800 line-clamp-2">
                  {profile.preferred_tasks[0].fact || profile.preferred_tasks[0]}
                </p>
              </div>
            )}

            {/* Transportation */}
            {profile.transportation?.length > 0 && (
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-900">Transport</span>
                </div>
                <p className="text-xs text-indigo-800 line-clamp-2">
                  {profile.transportation[0].fact || profile.transportation[0]}
                </p>
              </div>
            )}

            {/* Schedule */}
            {profile.schedule_availability?.length > 0 && (
              <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs font-semibold text-teal-900">Schedule</span>
                </div>
                <p className="text-xs text-teal-800 line-clamp-2">
                  {profile.schedule_availability[0].fact || profile.schedule_availability[0]}
                </p>
              </div>
            )}
          </div>

          {/* Data Quality & Sourcing */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-slate-600">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {client.vocational_facts_extracted_at 
                      ? format(new Date(client.vocational_facts_extracted_at), 'MMM d, yyyy')
                      : 'Never extracted'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <User className="w-3 h-3" />
                  <span>{(client.vocational_facts_assessment_count || 0)} assessments</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px] text-slate-500"
                onClick={() => setShowSources(true)}
              >
                <Eye className="w-3 h-3 mr-1" /> View Sources
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={onOpenJobSearch}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Job Search
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8"
              onClick={onOpenAssistant}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Assistant
            </Button>
          </div>
        </CardContent>
      </Card>

      <SourcesModal open={showSources} onOpenChange={setShowSources} client={client} />
    </>
  );
}