import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, AlertCircle, Upload } from "lucide-react";
import { toast } from "sonner";

const ENTRY_TYPES = [
  { code: "job_development", label: "Job Development (USOR 96)", usor: true },
  { code: "job_coaching", label: "Job Coaching (USOR 95)", usor: true },
  { code: "life_skills", label: "Life Skills (USOR 148)", usor: true },
  { code: "csb_hours", label: "CSB Hours (USOR 148)", usor: true },
  { code: "pre_ets", label: "Pre-ETS", usor: false },
  { code: "wsa", label: "Work Study Assessment", usor: false },
  { code: "admin_time", label: "Admin Time", usor: false },
  { code: "eom_reporting", label: "EOM Reporting", usor: false },
  { code: "misc", label: "Miscellaneous", usor: false },
];

export default function VRBatchReportGenerator() {
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [entryType, setEntryType] = useState("job_development");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedClients, setSelectedClients] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, clientsData] = await Promise.all([
        base44.entities.PDFTemplate.filter({ is_active: true }),
        base44.entities.Client.filter({ status: "active" }),
      ]);

      // Filter templates by entry type
      setTemplates(templatesData);
      setClients(clientsData);

      // Auto-select first template of current entry type
      const firstTemplate = templatesData.find(t => t.entry_type_code === entryType);
      if (firstTemplate) setSelectedTemplate(firstTemplate.id);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleClientToggle = (clientId) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleEntryTypeChange = (newType) => {
    setEntryType(newType);
    // Auto-select template for new type
    const firstTemplate = templates.find(t => t.entry_type_code === newType);
    setSelectedTemplate(firstTemplate?.id || "");
  };

  const generateReports = async () => {
    if (!selectedTemplate || !selectedClients.length || !dateFrom || !dateTo) {
      toast.error("Please fill in all required fields");
      return;
    }

    setGenerating(true);
    try {
      const response = await base44.functions.invoke('generateVRBatchReports', {
        pdf_template_id: selectedTemplate,
        entry_type: entryType,
        client_ids: selectedClients,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (response.data?.status === "completed") {
        const successful = response.data.successful || 0;
        const failed = response.data.failed || 0;

        if (successful > 0) {
          toast.success(`Generated ${successful} report(s) successfully`);
          if (failed > 0) {
            toast.error(`Failed to generate ${failed} report(s)`);
          }
        } else {
          toast.error("No reports were generated");
        }

        // Reset form
        setSelectedClients([]);
        setDateFrom("");
        setDateTo("");
      }
    } catch (err) {
      toast.error("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const applicableTemplates = templates.filter(t => t.entry_type_code === entryType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">VR Batch Report Generator</h2>
        <p className="text-slate-600 mt-1">Generate individual client PDFs from structured time entry data</p>
      </div>

      {/* Entry Type Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Step 1: Select Report Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ENTRY_TYPES.map((type) => (
            <button
              key={type.code}
              onClick={() => handleEntryTypeChange(type.code)}
              className={`p-3 text-left rounded-lg border-2 transition-all ${
                entryType === type.code
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{type.label}</p>
                  {type.usor && <p className="text-xs text-blue-600 mt-0.5">Utah VR Form</p>}
                </div>
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    entryType === type.code ? "border-blue-600 bg-blue-600" : "border-slate-300"
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Template Selection */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Step 2: Select PDF Template</h3>

        {applicableTemplates.length === 0 ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">No templates for this entry type. Upload a fillable PDF first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {applicableTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`p-3 text-left rounded-lg border-2 transition-all ${
                  selectedTemplate === template.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">v{template.version}</p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      selectedTemplate === template.id ? "border-blue-600 bg-blue-600" : "border-slate-300"
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Date Range & Clients */}
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Step 3: Select Date Range & Clients</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">From Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">To Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Select Clients</Label>
          <div className="border border-slate-200 rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
            {clients.length === 0 ? (
              <p className="text-sm text-slate-500">No active clients</p>
            ) : (
              clients.map(client => (
                <label key={client.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                  <Checkbox
                    checked={selectedClients.includes(client.id)}
                    onCheckedChange={() => handleClientToggle(client.id)}
                  />
                  <span className="text-sm">{client.first_name} {client.last_name}</span>
                </label>
              ))
            )}
          </div>
          {selectedClients.length > 0 && (
            <p className="text-xs text-slate-500">{selectedClients.length} client(s) selected</p>
          )}
        </div>

        <Button
          onClick={generateReports}
          disabled={
            generating ||
            !selectedTemplate ||
            !selectedClients.length ||
            !dateFrom ||
            !dateTo
          }
          className="w-full gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating Reports...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" /> Generate & Save Reports to Documents
            </>
          )}
        </Button>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Batch Processing:</strong> Each selected client will receive an individual PDF saved to their Documents tab. Reports are generated from structured time entry data without requiring manual note entry.
        </p>
      </div>
    </div>
  );
}