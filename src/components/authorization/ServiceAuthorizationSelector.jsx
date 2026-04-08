import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * ServiceAuthorizationSelector
 * 
 * Reusable component for selecting a ServiceAuthorization with:
 * - Filtering by client, entry type, status, date range
 * - Detailed summary display
 * - Smart warnings for dates and hours
 * 
 * Props:
 *   clientId (required) - filters to this client
 *   entryTypeCode - filters to this entry type (if required)
 *   selectedDate - validates against service date range
 *   value - current selected authorization ID
 *   onChange(authId) - callback when selected
 *   isRequired - if true, shows "required" indicator
 *   onValidationChange(warnings) - callback with validation warnings
 */
const ServiceAuthorizationSelector = ({
  clientId,
  entryTypeCode,
  selectedDate,
  value,
  onChange,
  isRequired = false,
  onValidationChange
}) => {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAuth, setSelectedAuth] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Load authorizations on mount or when dependencies change
  useEffect(() => {
    loadAuthorizations();
  }, [clientId, entryTypeCode]);

  // Set selected auth when value prop changes
  useEffect(() => {
    if (value && authorizations.length > 0) {
      const auth = authorizations.find(a => a.id === value);
      setSelectedAuth(auth || null);
    }
  }, [value, authorizations]);

  // Validate date range and hours when selectedDate or selectedAuth changes
  useEffect(() => {
    validateWarnings();
  }, [selectedDate, selectedAuth]);

  const loadAuthorizations = async () => {
    setLoading(true);
    try {
      const filters = {
        client_id: clientId,
        status: "active"
      };

      if (entryTypeCode) {
        filters.entry_type_code = entryTypeCode;
      }

      const result = await base44.entities.ServiceAuthorization.filter(filters);
      setAuthorizations(result);
    } catch (err) {
      toast.error("Failed to load authorizations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateWarnings = () => {
    const newWarnings = [];

    if (!selectedAuth) {
      setWarnings([]);
      if (onValidationChange) onValidationChange([]);
      return;
    }

    // Check date range
    if (selectedDate) {
      const entryDate = new Date(selectedDate);
      const startDate = new Date(selectedAuth.service_start_date);
      const endDate = new Date(selectedAuth.service_end_date);

      if (entryDate < startDate || entryDate > endDate) {
        newWarnings.push({
          type: "date_out_of_range",
          severity: "warning",
          message: `Entry date ${selectedDate} is outside authorization period (${selectedAuth.service_start_date} to ${selectedAuth.service_end_date})`
        });
      }
    }

    // Check remaining hours
    const remaining = selectedAuth.remaining_hours || 0;
    if (remaining <= 0) {
      newWarnings.push({
        type: "no_hours_remaining",
        severity: "error",
        message: "No hours remaining in this authorization"
      });
    } else if (remaining <= 5) {
      newWarnings.push({
        type: "low_hours",
        severity: "warning",
        message: `Only ${remaining} hours remaining in this authorization`
      });
    }

    setWarnings(newWarnings);
    if (onValidationChange) onValidationChange(newWarnings);
  };

  // Filter authorizations by search term
  const filtered = authorizations.filter(auth =>
    auth.authorization_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auth.job_goal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auth.vr_counselor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-700">
          Service Authorization
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {/* Selected Authorization Display */}
      {selectedAuth ? (
        <div className="space-y-2.5">
          {/* Summary Card */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-blue-900">{selectedAuth.authorization_number}</p>
                <p className="text-xs text-blue-700 mt-0.5">{selectedAuth.job_goal}</p>
              </div>
              <button
                onClick={() => { setSelectedAuth(null); onChange(null); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
              >
                Change
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs text-blue-800">
              {selectedAuth.vr_counselor_name && (
                <div>
                  <p className="text-blue-600 font-medium">Counselor</p>
                  <p className="text-blue-800">{selectedAuth.vr_counselor_name}</p>
                </div>
              )}
              {selectedAuth.employer_name && (
                <div>
                  <p className="text-blue-600 font-medium">Employer</p>
                  <p className="text-blue-800">{selectedAuth.employer_name}</p>
                </div>
              )}
              <div>
                <p className="text-blue-600 font-medium">Total Hours</p>
                <p className="text-blue-800">{selectedAuth.total_authorized_hours || 0}</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">Used Hours</p>
                <p className="text-blue-800">{selectedAuth.used_hours || 0}</p>
              </div>
              <div className="col-span-2">
                <p className="text-blue-600 font-medium">Remaining Hours</p>
                <p className={cn(
                  "font-semibold",
                  selectedAuth.remaining_hours <= 0 ? "text-red-600" : "text-blue-800"
                )}>
                  {selectedAuth.remaining_hours || 0}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-blue-600 font-medium">Valid Period</p>
                <p className="text-blue-800">
                  {selectedAuth.service_start_date} to {selectedAuth.service_end_date}
                </p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warn, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-2.5 rounded-lg border flex items-start gap-2",
                    warn.severity === "error"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  )}
                >
                  <AlertTriangle className={cn(
                    "w-3.5 h-3.5 shrink-0 mt-0.5",
                    warn.severity === "error" ? "text-red-600" : "text-amber-600"
                  )} />
                  <p className={cn(
                    "text-xs",
                    warn.severity === "error" ? "text-red-700" : "text-amber-700"
                  )}>
                    {warn.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Picker Button */
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "w-full p-2.5 text-left border-2 rounded-lg transition-colors",
            isRequired ? "border-red-300 bg-red-50 hover:bg-red-100" : "border-slate-200 hover:bg-slate-50"
          )}
        >
          <p className={cn("text-sm font-medium", isRequired ? "text-red-700" : "text-slate-600")}>
            Select authorization...
          </p>
          {isRequired && <p className="text-xs text-red-600 mt-0.5">Required for this entry type</p>}
        </button>
      )}

      {/* Modal Picker */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
          <Card className="w-full sm:max-w-lg sm:rounded-lg rounded-t-lg space-y-3 p-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div>
              <h3 className="font-semibold text-sm">Select Service Authorization</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {filtered.length} active authorization{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search by number, goal, or counselor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 text-sm"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {loading ? (
                <p className="text-xs text-slate-500 text-center py-4">Loading authorizations...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  {authorizations.length === 0 ? "No active authorizations" : "No results"}
                </p>
              ) : (
                filtered.map(auth => (
                  <button
                    key={auth.id}
                    onClick={() => {
                      setSelectedAuth(auth);
                      onChange(auth.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors space-y-2.5"
                  >
                    {/* Auth Number + Remaining */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-xs text-slate-900">{auth.authorization_number}</p>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{auth.job_goal}</p>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded text-xs font-medium shrink-0",
                        auth.remaining_hours <= 0
                          ? "bg-red-100 text-red-700"
                          : auth.remaining_hours <= 5
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      )}>
                        {auth.remaining_hours || 0}h left
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      {auth.vr_counselor_name && (
                        <div className="line-clamp-1">
                          <span className="font-medium">Counselor:</span> {auth.vr_counselor_name}
                        </div>
                      )}
                      {auth.employer_name && (
                        <div className="line-clamp-1">
                          <span className="font-medium">Employer:</span> {auth.employer_name}
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="font-medium">Valid:</span> {auth.service_start_date} to {auth.service_end_date}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> {auth.total_authorized_hours || 0}h
                      </div>
                      <div>
                        <span className="font-medium">Used:</span> {auth.used_hours || 0}h
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ServiceAuthorizationSelector;