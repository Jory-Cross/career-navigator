import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const ValidationResultsPanel = ({
  clientId,
  entryTypeCode,
  timeEntries = [],
  reportFieldAnswers = {},
  serviceAuthorization = null,
  client = null,
  pdfTemplate = null,
  onValidationChange = null
}) => {
  const [results, setResults] = useState([]);
  const [overallStatus, setOverallStatus] = useState("loading");
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateAll();
  }, [clientId, entryTypeCode, timeEntries, reportFieldAnswers, serviceAuthorization, client, pdfTemplate]);

  const validateAll = async () => {
    setLoading(true);
    const issues = [];
    let hasBlocking = false;
    let hasWarning = false;

    // 1. Check required dynamic fields
    try {
      const requiredFields = await base44.entities.ReportFieldTemplate.filter({
        entry_type_code: entryTypeCode,
        is_required: true,
        is_active: true
      });

      for (const entry of timeEntries) {
        const answers = reportFieldAnswers[entry.id] || {};
        const missingFields = requiredFields.filter(f => !answers[f.field_key]);

        if (missingFields.length > 0) {
          issues.push({
            type: "missing_fields",
            severity: "blocking",
            title: `Entry ${entry.date}: Missing required fields`,
            details: missingFields.map(f => f.label).join(", "),
            entryId: entry.id
          });
          hasBlocking = true;
        }
      }
    } catch (err) {
      issues.push({
        type: "field_check_error",
        severity: "warning",
        title: "Could not validate required fields",
        details: err.message
      });
      hasWarning = true;
    }

    // 2. Check service authorization
    if (serviceAuthorization) {
      const issues_auth = [];
      if (!serviceAuthorization.authorization_number) {
        issues_auth.push("Missing authorization number");
        hasWarning = true;
      }
      if (!serviceAuthorization.vr_counselor_name) {
        issues_auth.push("Missing VR counselor name");
        hasWarning = true;
      }
      if (!serviceAuthorization.job_goal) {
        issues_auth.push("Missing job goal");
        hasWarning = true;
      }

      if (issues_auth.length > 0) {
        issues.push({
          type: "incomplete_authorization",
          severity: "warning",
          title: "Service Authorization incomplete",
          details: issues_auth.join("; ")
        });
      }
    }

    // 3. Check client header info
    if (client) {
      const missing_client = [];
      if (!client.first_name || !client.last_name) {
        missing_client.push("Client name");
      }
      if (!client.case_number) {
        missing_client.push("Case number");
      }

      if (missing_client.length > 0) {
        issues.push({
          type: "incomplete_client",
          severity: "warning",
          title: "Client information incomplete",
          details: missing_client.join(", ")
        });
        hasWarning = true;
      }
    }

    // 4. Check PDF mappings
    if (pdfTemplate && entryTypeCode) {
      try {
        const mappings = await base44.entities.PDFFieldMap.filter({
          pdf_template_id: pdfTemplate.id,
          is_active: true
        });

        if (mappings.length === 0) {
          issues.push({
            type: "no_pdf_mappings",
            severity: "blocking",
            title: "No PDF field mappings configured",
            details: "This template cannot be used for report generation"
          });
          hasBlocking = true;
        }
      } catch {
        // Template may not have mappings yet
      }
    }

    // 5. Check entry dates vs authorization
    if (serviceAuthorization && timeEntries.length > 0) {
      const start = new Date(serviceAuthorization.service_start_date);
      const end = new Date(serviceAuthorization.service_end_date);
      const outside = [];

      timeEntries.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate < start || entryDate > end) {
          outside.push(entry.date);
        }
      });

      if (outside.length > 0) {
        issues.push({
          type: "entries_outside_dates",
          severity: "warning",
          title: `${outside.length} entries outside authorization period`,
          details: `Authorization: ${serviceAuthorization.service_start_date} to ${serviceAuthorization.service_end_date}`
        });
        hasWarning = true;
      }
    }

    // 6. Check for duplicate billable/reportable conflicts
    if (timeEntries.length > 1) {
      const groupedByDate = {};
      timeEntries.forEach(entry => {
        if (!groupedByDate[entry.date]) groupedByDate[entry.date] = [];
        groupedByDate[entry.date].push(entry);
      });

      const duplicates = [];
      Object.entries(groupedByDate).forEach(([date, entries]) => {
        const billable = entries.filter(e => e.is_billable);
        if (billable.length > 1) {
          duplicates.push(`${date}: ${billable.length} billable entries`);
        }
      });

      if (duplicates.length > 0) {
        issues.push({
          type: "duplicate_billable",
          severity: "warning",
          title: "Potential duplicate billable entries",
          details: duplicates.join("; ")
        });
        hasWarning = true;
      }
    }

    // Calculate overall status
    if (hasBlocking) {
      setOverallStatus("blocked");
    } else if (hasWarning) {
      setOverallStatus("warning");
    } else if (timeEntries.length > 0) {
      setOverallStatus("ready");
    } else {
      setOverallStatus("empty");
    }

    setResults(issues);
    setLoading(false);

    if (onValidationChange) {
      onValidationChange({
        status: hasBlocking ? "blocked" : hasWarning ? "warning" : "ready",
        issueCount: issues.length,
        blockingCount: issues.filter(i => i.severity === "blocking").length
      });
    }
  };

  const statusConfig = {
    ready: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: CheckCircle2,
      color: "text-emerald-600",
      label: "Report Ready"
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: AlertTriangle,
      color: "text-amber-600",
      label: "Review Issues"
    },
    blocked: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: AlertCircle,
      color: "text-red-600",
      label: "Cannot Proceed"
    },
    empty: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: CheckCircle2,
      color: "text-slate-400",
      label: "No entries"
    },
    loading: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: AlertTriangle,
      color: "text-slate-500",
      label: "Validating..."
    }
  };

  const config = statusConfig[overallStatus];
  const StatusIcon = config.icon;

  const severityStyles = {
    blocking: {
      bg: "bg-red-100",
      border: "border-red-300",
      text: "text-red-800",
      badge: "bg-red-600"
    },
    warning: {
      bg: "bg-amber-100",
      border: "border-amber-300",
      text: "text-amber-800",
      badge: "bg-amber-600"
    },
    info: {
      bg: "bg-blue-100",
      border: "border-blue-300",
      text: "text-blue-800",
      badge: "bg-blue-600"
    }
  };

  return (
    <Card className={cn("border-2", config.border, config.bg)}>
      <div className="p-4">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <StatusIcon className={cn("w-5 h-5", config.color)} />
            <div className="text-left">
              <p className={cn("font-semibold text-sm", config.color)}>
                {loading ? "Validating..." : config.label}
              </p>
              {!loading && results.length > 0 && (
                <p className={cn("text-xs", config.color)}>
                  {results.filter(r => r.severity === "blocking").length > 0
                    ? `${results.filter(r => r.severity === "blocking").length} blocking issue(s)`
                    : `${results.length} issue(s) to review`
                  }
                </p>
              )}
            </div>
          </div>
          {results.length > 0 && (
            expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Issues List */}
        {expanded && results.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-current opacity-20 pt-4">
            {results.map((issue, idx) => {
              const sev = severityStyles[issue.severity];
              return (
                <div key={idx} className={cn("p-3 rounded-lg border", sev.bg, sev.border)}>
                  <div className="flex items-start gap-2">
                    <Badge className={cn("mt-0.5 text-white text-xs shrink-0", sev.badge)}>
                      {issue.severity === "blocking" ? "ERROR" : "WARNING"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium text-sm", sev.text)}>{issue.title}</p>
                      <p className={cn("text-xs mt-1", sev.text)}>
                        {issue.details}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Success state */}
        {expanded && results.length === 0 && !loading && timeEntries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-current opacity-20">
            <p className={cn("text-sm font-medium", config.color)}>
              ✓ All validation checks passed
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ValidationResultsPanel;