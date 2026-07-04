import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Clock,
  DollarSign,
  Loader2,
  Lock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PROGRAM_LABELS = {
  vr: "VR Services",
  pre_ets: "Pre-ETS Services",
  dspd: "DSPD Services",
  internal: "Internal",
  other: "Other",
};

const REPORTING_MODE_HINTS = {
  none: "Internal use only",
  usor95_monthly: "Monthly VR report (USOR-95)",
  usor96_monthly: "Monthly tracker (USOR-96)",
  usor148_service_period: "Service period report (USOR-148)",
  custom: "Custom report format",
};

function choosePreferredEntryTypes(types) {
  const byCode = new Map();

  for (const type of types) {
    const code = String(type?.code || "");
    const current = byCode.get(code);

    if (!current || (!current.org_id && type?.org_id)) {
      byCode.set(code, type);
    }
  }

  return Array.from(byCode.values()).sort((left, right) =>
    String(left?.name || "").localeCompare(String(right?.name || ""))
  );
}

/**
 * Server-scoped EntryType selection UI.
 *
 * EntryType discovery is intentionally loaded from getAuthorizedTimeEntryConfig
 * rather than directly from the browser entity client.
 */
export default function EntryTypePicker({
  value,
  onChange,
  onSelectionChange,
  mode = "grid",
  disabled = false,
  showDescriptions = true,
  groupByProgram = true,
  className,
}) {
  const [entryTypes, setEntryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEntryTypes() {
      setLoading(true);
      setError("");

      try {
        const response = await base44.functions.invoke(
          "getAuthorizedTimeEntryConfig",
          { action: "list_entry_types" }
        );
        const payload = response?.data ?? response ?? {};

        if (!payload?.ok || !Array.isArray(payload?.entry_types)) {
          throw new Error(
            payload?.error || "Unable to load authorized service types."
          );
        }

        if (!cancelled) {
          setEntryTypes(choosePreferredEntryTypes(payload.entry_types));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.message || "Unable to load authorized service types."
          );
          setEntryTypes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEntryTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType = useMemo(
    () =>
      entryTypes.find(
        (type) => String(value) === String(type.id) || value === type.code
      ) || null,
    [entryTypes, value]
  );

  const groupedEntryTypes = useMemo(() => {
    if (!groupByProgram) {
      return { all: entryTypes };
    }

    return entryTypes.reduce((groups, type) => {
      const program = type?.program_type || "other";
      groups[program] = groups[program] || [];
      groups[program].push(type);
      return groups;
    }, {});
  }, [entryTypes, groupByProgram]);

  const selectEntryType = (entryType) => {
    if (disabled) {
      return;
    }

    onChange?.(entryType);
    onSelectionChange?.(entryType);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-400">Loading service types…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4",
          className
        )}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (mode === "select") {
    return (
      <div className={cn("space-y-2", className)}>
        <Select
          value={selectedType ? String(selectedType.id) : ""}
          onValueChange={(selectedValue) => {
            const entryType = entryTypes.find(
              (type) => String(type.id) === String(selectedValue)
            );
            if (entryType) {
              selectEntryType(entryType);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="border-slate-200 text-sm">
            <SelectValue placeholder="Select service type…" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(groupedEntryTypes).map(([program, types]) => (
              <div key={program}>
                {groupByProgram && (
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {PROGRAM_LABELS[program] || program}
                  </div>
                )}
                {types.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        {showDescriptions && selectedType && (
          <EntryTypeSummary entryType={selectedType} />
        )}
      </div>
    );
  }

  if (mode === "compact") {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4",
          className
        )}
      >
        {entryTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => selectEntryType(type)}
            disabled={disabled}
            className={cn(
              "rounded-lg border p-2 text-left text-xs font-medium transition-all",
              value === type.id || value === type.code
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50",
              disabled && "cursor-not-allowed opacity-50"
            )}
            title={type.description || type.name}
          >
            <div className="truncate">{type.name}</div>
            {type.color && (
              <div
                className="mt-1 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: type.color }}
              />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("max-h-[60vh] space-y-6 overflow-y-auto pr-1", className)}>
      {Object.entries(groupedEntryTypes).map(([program, types]) => (
        <section key={program} className="space-y-3">
          {groupByProgram && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {PROGRAM_LABELS[program] || program}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {types.map((type) => (
              <EntryTypeCard
                key={type.id}
                entryType={type}
                selected={value === type.id || value === type.code}
                disabled={disabled}
                showDescription={showDescriptions}
                onSelect={selectEntryType}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EntryTypeSummary({ entryType }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{entryType.name}</span>
        {entryType.color && (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entryType.color }}
          />
        )}
      </div>
      {entryType.description && (
        <p className="mb-2 text-xs text-slate-600">{entryType.description}</p>
      )}
      <EntryTypeBadges entryType={entryType} />
    </div>
  );
}

function EntryTypeBadges({ entryType }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {entryType.is_billable && (
        <Badge className="flex items-center gap-1 border-0 bg-blue-100 text-xs text-blue-700">
          <DollarSign className="h-3 w-3" />
          Billable
        </Badge>
      )}
      {entryType.is_payroll_eligible && (
        <Badge className="border-0 bg-emerald-100 text-xs text-emerald-700">
          Payroll
        </Badge>
      )}
      {entryType.requires_authorization && (
        <Badge className="flex items-center gap-1 border-0 bg-amber-100 text-xs text-amber-700">
          <Lock className="h-3 w-3" />
          Authorization required
        </Badge>
      )}
    </div>
  );
}

function EntryTypeCard({
  entryType,
  selected,
  disabled,
  showDescription,
  onSelect,
}) {
  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect(entryType)}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(entryType);
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border-2 p-4 text-left transition-all hover:shadow-md",
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className={cn("font-semibold", selected ? "text-blue-900" : "text-slate-900")}>
            {entryType.name}
          </p>
          {entryType.color && (
            <div
              className="mt-1 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entryType.color }}
            />
          )}
        </div>
        {selected && (
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
            ✓
          </div>
        )}
      </div>

      {showDescription && entryType.description && (
        <p className="mb-2 line-clamp-2 text-xs text-slate-600">
          {entryType.description}
        </p>
      )}

      {entryType.report_mode !== "none" && (
        <p className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          {REPORTING_MODE_HINTS[entryType.report_mode] || "Report-eligible"}
        </p>
      )}

      <EntryTypeBadges entryType={entryType} />
    </Card>
  );
}
