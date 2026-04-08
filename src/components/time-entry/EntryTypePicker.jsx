import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Clock, DollarSign, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * EntryTypePicker - Reusable entry type selection UI
 * 
 * Features:
 * - Dynamic loading from EntryType entity
 * - Groups by program_type (VR, Pre-ETS, DSPD, Internal, Other)
 * - Visual indicators: billable, payroll-eligible, authorization-required
 * - Shows descriptions and reporting mode hints
 * - Compact or expanded display modes
 * 
 * Props:
 *   value                - selected entry_type_id or code
 *   onChange(type)       - called with full EntryType object
 *   onSelectionChange()   - alternative callback with just the object
 *   mode                 - "grid" (default) | "compact" | "select"
 *   disabled             - boolean
 *   showDescriptions     - show descriptions (default true)
 *   groupByProgram       - group by program_type (default true)
 */
export default function EntryTypePicker({
  value,
  onChange,
  onSelectionChange,
  mode = "grid",
  disabled = false,
  showDescriptions = true,
  groupByProgram = true,
  className
}) {
  const [entryTypes, setEntryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    base44.entities.EntryType.filter({ is_active: true })
      .then(types => {
        // Sort by name within each program type
        const sorted = types.sort((a, b) => a.name.localeCompare(b.name));
        setEntryTypes(sorted);
      })
      .catch(err => {
        console.error("Failed to load entry types:", err);
        setError("Failed to load entry types");
        toast.error("Failed to load entry types");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
        <span className="text-sm text-slate-400">Loading entry types...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3", className)}>
        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const handleSelect = (type) => {
    if (onChange) onChange(type);
    if (onSelectionChange) onSelectionChange(type);
  };

  // Group by program_type if requested
  const grouped = groupByProgram
    ? entryTypes.reduce((acc, type) => {
        const prog = type.program_type || "other";
        if (!acc[prog]) acc[prog] = [];
        acc[prog].push(type);
        return acc;
      }, {})
    : { all: entryTypes };

  const programLabels = {
    vr: "VR Services",
    pre_ets: "Pre-ETS Services",
    dspd: "DSPD Services",
    internal: "Internal",
    other: "Other"
  };

  // ── Grid mode (default) ──
  if (mode === "grid") {
    return (
      <div className={cn("space-y-6", className)}>
        {Object.entries(grouped).map(([prog, types]) => (
          <div key={prog} className="space-y-3">
            {groupByProgram && (
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {programLabels[prog] || prog}
              </h3>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {types.map(type => (
                <EntryTypeCard
                  key={type.id}
                  type={type}
                  selected={value === type.id || value === type.code}
                  onSelect={handleSelect}
                  showDescription={showDescriptions}
                  disabled={disabled}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Compact mode (inline cards, smaller) ──
  if (mode === "compact") {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2", className)}>
        {entryTypes.map(type => (
          <button
            key={type.id}
            onClick={() => !disabled && handleSelect(type)}
            disabled={disabled}
            className={cn(
              "p-2 rounded-lg border transition-all text-left text-xs font-medium",
              value === type.id || value === type.code
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700"
            )}
            title={type.description}
          >
            <div className="truncate">{type.name}</div>
            {type.color && (
              <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: type.color }} />
            )}
          </button>
        ))}
      </div>
    );
  }

  // ── Select mode (placeholder for future native select UI) ──
  // For now, render grid as fallback
  return (
    <div className={cn("space-y-3", className)}>
      {entryTypes.map(type => (
        <EntryTypeCard
          key={type.id}
          type={type}
          selected={value === type.id || value === type.code}
          onSelect={handleSelect}
          showDescription={showDescriptions}
          disabled={disabled}
          compact
        />
      ))}
    </div>
  );
}

/**
 * EntryTypeCard - Visual card for a single entry type
 */
function EntryTypeCard({ type, selected, onSelect, showDescription, disabled, compact }) {
  const reportingModeHints = {
    none: "Internal use only",
    usor95_monthly: "Monthly VR report (USOR-95)",
    usor96_monthly: "Monthly tracker (USOR-96)",
    usor148_service_period: "Service period report (USOR-148)",
    custom: "Custom report format"
  };

  return (
    <button
      onClick={() => !disabled && onSelect(type)}
      disabled={disabled}
      className={cn(
        "p-4 rounded-lg border-2 transition-all text-left",
        "hover:shadow-md active:scale-[0.99]",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className={cn("font-semibold", selected ? "text-blue-900" : "text-slate-900")}>
            {type.name}
          </p>
          {type.color && (
            <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: type.color }} />
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Description */}
      {showDescription && type.description && (
        <p className="text-xs text-slate-600 mb-2 line-clamp-2">{type.description}</p>
      )}

      {/* Reporting mode hint */}
      {type.report_mode !== "none" && (
        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {reportingModeHints[type.report_mode] || "Report-eligible"}
        </p>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {type.is_billable && (
          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Billable
          </Badge>
        )}
        {type.is_payroll_eligible && (
          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
            Payroll
          </Badge>
        )}
        {type.requires_authorization && (
          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs flex items-center gap-1">
            <Lock className="w-3 h-3" /> Auth Required
          </Badge>
        )}
      </div>
    </button>
  );
}