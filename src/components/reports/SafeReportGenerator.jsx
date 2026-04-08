import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  FileText, AlertCircle, CheckCircle2, Loader2, Eye, Zap, Download,
  ArrowRight, Users, Calendar, Database
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";

export default function SafeReportGenerator() {
  const [step, setStep] = useState("template"); // template → period → preview → result
  const [templates, setTemplates] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");
  const [selectedClients, setSelectedClients] = useState([]);
  const [periodType, setPeriodType] = useState("month"); // month, range, service_period
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Validation & result state
  const [validationData, setValidationData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    Promise.all([
      base44.entities.PDFTemplate.filter({ is_active: true }),
      base44.entities.EntryType.filter({ is_active: true }),
      base44.entities.Client.filter({ is_archived: false }),
      base44.entities.TimeEntry.list()
    ]).then(([tmpl, types, cls, entries]) => {
      setTemplates(tmpl);
      setEntryTypes(types);
      setClients(cls);
      setTimeEntries(entries);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Calculate report period dates
  const getPeriodDates = () => {
    if (periodType === "month") {
      const start = startOfMonth(new Date(selectedMonth + "-01"));
      const end = endOfMonth(start);
      return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
    } else if (periodType === "range") {
      return { start: startDate, end: endDate };
    }
    return { start: null, end: null };
  };

  // Get entries for selected clients and period
  const getEntriesForPeriod = () => {
    const { start, end } = getPeriodDates();
    let filtered = timeEntries;

    if (selectedClients.length > 0) {
      filtered = filtered.filter(e => selectedClients.includes(e.client_id));
    }

    if (start && end) {
      filtered = filtered.filter(e => e.date >= start && e.date <= end);
    }

    return filtered;
  };

  // Get mappings for selected template
  const getTemplateValidation = async () => {
    if (!selectedTemplate) return null;

    const mappings = await base44.entities.PDFFieldMap.filter({
      pdf_template_id: selectedTemplate.id
    });

    const entries = getEntriesForPeriod();
    const entryTypeCounts = {};
    entries.forEach(e => {
      entryTypeCounts[e.entry_type_code] = (entryTypeCounts[e.entry_type_code] || 0) + 1;
    });

    const headerMaps = mappings.filter(m => m.mapping_scope === "header");
    const rowMaps = mappings.filter(m => m.mapping_scope === "row");
    const unmappedFields = (selectedTemplate.field_names || []).filter(
      f => !mappings.some(m => m.pdf_field_name === f)
    );

    return {
      template: selectedTemplate,
      clients: selectedClients.length > 0 
        ? clients.filter(c => selectedClients.includes(c.id))
        : [],
      entries,
      entryTypeCounts,
      mappingStats: {
        total: mappings.length,
        header: headerMaps.length,
        row: rowMaps.length,
        unmapped: unmappedFields.length,
        unmappedFields
      },
      warnings: {
        noEntries: entries.length === 0,
        unmappedFields: unmappedFields.length > 0,
        missingAuth: entries.some(e => !e.service_authorization_id)
      }
    };
  };

  const handlePreview = async () => {
    const validation = await getTemplateValidation();
    setValidationData(validation);
    setStep("preview");
  };

  const handleGenerate = async () => {
    const validation = validationData || await getTemplateValidation();
    
    if (!selectedTemplate || selectedClients.length === 0) {
      toast.error("Please select template and at least one client");
      return;
    }

    setGenerating(true);
    const newResults = [];

    try {
      for (const clientId of selectedClients) {
        try {
          const { start, end } = getPeriodDates();
          const res = await base44.functions.invoke("generateVRBatchReports", {
            pdf_template_id: selectedTemplate.id,
            entry_type_code: selectedEntryTypeCode || null,
            date_range_start: start,
            date_range_end: end,
            client_ids: [clientId]
          });

          const result = res.data?.results?.[0];
          newResults.push({
            client_id: clientId,
            client_name: clients.find(c => c.id === clientId)?.first_name + " " + clients.find(c => c.id === clientId)?.last_name,
            status: result?.status === "success" ? "success" : "failed",
            pdf_url: result?.document?.file_url,
            error: result?.message
          });
        } catch (err) {
          newResults.push({
            client_id: clientId,
            client_name: clients.find(c => c.id === clientId)?.first_name + " " + clients.find(c => c.id === clientId)?.last_name,
            status: "failed",
            error: err.message
          });
        }
      }

      setResults(newResults);
      setStep("result");
      toast.success(`Generated ${newResults.filter(r => r.status === "success").length}/${newResults.length} reports`);
    } catch (err) {
      toast.error("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  // STEP 1: Template Selection
  if (step === "template") {
    return (
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Generate VR Reports</h3>
          <p className="text-sm text-slate-500">Step 1: Select Template & Clients</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Template */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">📄 PDF Template</Label>
              <Select value={selectedTemplate?.id || ""} onValueChange={id => {
                setSelectedTemplate(templates.find(t => t.id === id));
                setSelectedEntryTypeCode("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        {t.name}
                        {t.template_version && <Badge variant="outline" className="text-[10px]">v{t.template_version}</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900">Template Details</p>
                <div className="space-y-1 text-xs text-blue-800">
                  <p>Report Mode: <span className="font-mono">{selectedTemplate.report_mode}</span></p>
                  <p>Entry Type: <span className="font-mono">{selectedTemplate.entry_type_code}</span></p>
                  <p>Fields: <span className="font-mono">{selectedTemplate.field_names?.length || 0}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Clients */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">👥 Clients ({selectedClients.length} selected)</Label>
              <div className="space-y-1 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-white">
                {clients.map(client => (
                  <label key={client.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <Checkbox
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedClients(p => [...p, client.id]);
                        } else {
                          setSelectedClients(p => p.filter(id => id !== client.id));
                        }
                      }}
                    />
                    <span className="text-sm text-slate-700">{client.first_name} {client.last_name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Each client will receive one individualized PDF</p>
            </div>
          </div>
        </div>

        {/* Entry Type filter (optional) */}
        {selectedTemplate && selectedTemplate.entry_type_code && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-900 mb-2">
              This template is configured for: <span className="font-mono">{selectedTemplate.entry_type_code}</span>
            </p>
            <p className="text-xs text-amber-700">Only time entries of this type will be included in the report.</p>
          </div>
        )}

        {/* Next button */}
        <Button
          onClick={() => setStep("period")}
          disabled={!selectedTemplate || selectedClients.length === 0}
          className="w-full"
          size="lg"
        >
          Continue to Period Selection
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    );
  }

  // STEP 2: Period Selection
  if (step === "period") {
    return (
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Select Report Period</h3>
          <p className="text-sm text-slate-500">Step 2: Choose Date Range</p>
        </div>

        {/* Period Type Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Period Type</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "month", label: "📅 Month", desc: "Single calendar month" },
              { value: "range", label: "📊 Date Range", desc: "Custom start/end dates" },
              { value: "service_period", label: "📋 Service Period", desc: "Billing period" }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriodType(opt.value)}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-all",
                  periodType === opt.value
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <p className="font-medium text-sm text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Month Picker */}
        {periodType === "month" && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Select Month</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm"
            />
            {selectedMonth && (
              <div className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                Reporting period: {format(startOfMonth(new Date(selectedMonth + "-01")), "MMMM d, yyyy")} to {format(endOfMonth(new Date(selectedMonth + "-01")), "MMMM d, yyyy")}
              </div>
            )}
          </div>
        )}

        {/* Date Range Picker */}
        {periodType === "range" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("template")} className="flex-1">
            Back
          </Button>
          <Button onClick={handlePreview} className="flex-1">
            Preview Data
            <Eye className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  // STEP 3: Validation Preview
  if (step === "preview" && validationData) {
    const { clients: selectedClientObjects, entries, warnings, mappingStats } = validationData;

    return (
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Validation Preview</h3>
          <p className="text-sm text-slate-500">Step 3: Review Before Generating</p>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-semibold">Clients</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{selectedClientObjects.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs text-emerald-600 font-semibold">Entries</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{entries.length}</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs text-purple-600 font-semibold">Mappings</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{mappingStats.total}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg border",
            warnings.unmappedFields
              ? "bg-amber-50 border-amber-200"
              : "bg-slate-50 border-slate-200"
          )}>
            <p className={cn(
              "text-xs font-semibold",
              warnings.unmappedFields ? "text-amber-600" : "text-slate-600"
            )}>Unmapped Fields</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              warnings.unmappedFields ? "text-amber-900" : "text-slate-900"
            )}>{mappingStats.unmapped}</p>
          </div>
        </div>

        {/* Clients Included */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4" /> Clients Included ({selectedClientObjects.length})
          </p>
          <div className="space-y-1">
            {selectedClientObjects.map(c => (
              <p key={c.id} className="text-xs text-slate-600 px-3 py-1.5 bg-slate-50 rounded">
                {c.first_name} {c.last_name}
              </p>
            ))}
          </div>
        </div>

        {/* Entry Type Breakdown */}
        {Object.keys(validationData.entryTypeCounts).length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Database className="w-4 h-4" /> Entry Type Distribution
            </p>
            <div className="space-y-1">
              {Object.entries(validationData.entryTypeCounts).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-xs px-3 py-1.5 bg-slate-50 rounded">
                  <span className="text-slate-600">{type}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {(warnings.noEntries || warnings.unmappedFields || warnings.missingAuth) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">⚠️ Warnings</p>
            {warnings.noEntries && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                No time entries found for selected period
              </div>
            )}
            {warnings.unmappedFields && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs space-y-1">
                <p className="font-semibold">Unmapped PDF fields ({mappingStats.unmapped}):</p>
                <div className="space-y-0.5">
                  {mappingStats.unmappedFields.slice(0, 5).map(f => (
                    <p key={f} className="text-amber-700 font-mono">{f}</p>
                  ))}
                  {mappingStats.unmappedFields.length > 5 && (
                    <p className="text-amber-600">...and {mappingStats.unmappedFields.length - 5} more</p>
                  )}
                </div>
              </div>
            )}
            {warnings.missingAuth && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                Some entries missing service authorization linkage
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("period")} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || warnings.noEntries}
            className="flex-1"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate Reports
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // STEP 4: Results
  if (step === "result") {
    const successCount = results.filter(r => r.status === "success").length;
    const failureCount = results.filter(r => r.status === "failed").length;

    return (
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900">Generation Complete</h3>
          <p className="text-sm text-slate-500">
            {successCount}/{results.length} reports generated successfully
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs text-emerald-600 font-semibold">Successful</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{successCount}</p>
          </div>
          <div className={cn(
            "p-3 rounded-lg border",
            failureCount > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
          )}>
            <p className={cn(
              "text-xs font-semibold",
              failureCount > 0 ? "text-red-600" : "text-slate-600"
            )}>Failed</p>
            <p className={cn(
              "text-2xl font-bold mt-1",
              failureCount > 0 ? "text-red-900" : "text-slate-900"
            )}>{failureCount}</p>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-2">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-lg border flex items-center justify-between",
                result.status === "success"
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-center gap-2">
                {result.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <div className="text-sm">
                  <p className={cn(
                    "font-medium",
                    result.status === "success" ? "text-emerald-900" : "text-red-900"
                  )}>{result.client_name}</p>
                  {result.error && (
                    <p className={cn(
                      "text-xs",
                      result.status === "success" ? "text-emerald-700" : "text-red-700"
                    )}>{result.error}</p>
                  )}
                </div>
              </div>
              {result.pdf_url && (
                <a href={result.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Reset Button */}
        <Button onClick={() => {
          setStep("template");
          setSelectedClients([]);
          setResults([]);
          setValidationData(null);
        }} className="w-full">
          Generate More Reports
        </Button>
      </Card>
    );
  }
}