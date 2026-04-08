import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LegacyDataWarning({ 
  type = "banner", // "banner" or "inline"
  recordCount = 0,
  issues = [],
  onNormalize = null,
  recordIds = []
}) {
  if (recordCount === 0 && issues.length === 0) return null;

  const issueMap = {
    legacy_category: "Using legacy category field (pre-EntryType)",
    incomplete_fields: "Missing required field values",
    outdated_authorization: "Authorization mapping may be outdated",
    unstructured_entry: "Entry not using structured field templates"
  };

  const mappedIssues = issues.map(issue => issueMap[issue] || issue);

  if (type === "inline") {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-900">Legacy Data Format</p>
          {mappedIssues.length > 0 && (
            <ul className="text-xs text-amber-800 mt-1 space-y-1">
              {mappedIssues.map((issue, idx) => (
                <li key={idx}>• {issue}</li>
              ))}
            </ul>
          )}
          {onNormalize && (
            <button
              onClick={onNormalize}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium mt-2 underline"
            >
              Normalize data →
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50 shadow-none">
      <div className="p-4 flex gap-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm text-amber-900">Legacy Data Detected</h3>
              <p className="text-xs text-amber-800 mt-1">
                {recordCount} record{recordCount !== 1 ? 's' : ''} using older data format or incomplete mapping
              </p>
            </div>
            <Badge className="bg-amber-200 text-amber-800 text-xs whitespace-nowrap">
              {recordCount} affected
            </Badge>
          </div>

          {mappedIssues.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-amber-900 mb-2">Issues:</p>
              <ul className="text-xs text-amber-800 space-y-1 ml-3">
                {mappedIssues.map((issue, idx) => (
                  <li key={idx} className="list-disc">{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-amber-700 mt-3 leading-relaxed">
            These records are readable but not using the current data structure. To ensure accurate reporting and maintain compliance, 
            review and normalize these records when time permits.
          </p>

          {onNormalize && (
            <button
              onClick={onNormalize}
              className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded transition-colors"
            >
              Review & Normalize ({recordCount})
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}