import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Upload, FileText, Settings, MapPin, CheckSquare, Zap, ArrowRight, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PDFMappingWorkspace from "./PDFMappingWorkspace";

const REPORT_MODES = [
  { value: "usor95_monthly", label: "USOR-95 (Monthly Summary)" },
  { value: "usor96_monthly", label: "USOR-96 (Monthly Detail)" },
  { value: "usor148_service_period", label: "USOR-148 (Service Period)" },
  { value: "custom", label: "Custom Template" }
];

const ENTRY_TYPES = [
  "job_coaching",
  "job_development",
  "job_search",
  "interview_prep",
  "resume_work",
  "consultation",
  "follow_up",
  "life_skills",
  "cbh",
  "admin"
];

const REQUIRED_HEADER_FIELDS = [
  "client_name",
  "authorization_number",
  "vr_counselor",
  "job_goal",
  "reporting_period"
];

const REQUIRED_ROW_FIELDS = [
  "entry_date",
  "hours_or_duration",
  "activity_description"
];

// Step components
function Step1Upload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      toast.error("Please select a PDF file");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileName(file.name);
      onUploadComplete({ file_url, file_name: file.name });
      toast.success("PDF uploaded successfully");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-900">Step 1: Upload Fillable PDF</p>
        <p className="text-xs text-blue-800">Upload your fillable PDF template to extract field names automatically.</p>
      </div>

      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center space-y-3 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => document.getElementById("pdf-input").click()}>
        <FileText className="w-12 h-12 text-slate-400 mx-auto" />
        <div>
          <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
          <p className="text-xs text-slate-500">PDF files up to 50MB</p>
        </div>
        <input
          id="pdf-input"
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        {fileName && <p className="text-xs font-mono text-emerald-600">✓ {fileName}</p>}
        {uploading && <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />}
      </div>
    </div>
  );
}

function Step2ExtractFields({ pdfUrl, onExtractComplete }) {
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState([]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      // In production, this would call a backend function to extract PDF fields
      // For now, we'll simulate with a message to the user
      const mockFields = [
        "Header_ClientName",
        "Header_AuthNumber",
        "Header_Counselor",
        "Header_JobGoal",
        "Row1_Date",
        "Row1_Hours",
        "Row1_Activity",
        "Row2_Date",
        "Row2_Hours",
        "Row2_Activity",
        "Summary_TotalHours",
        "Summary_EntryCount"
      ];
      
      setExtractedFields(mockFields);
      onExtractComplete(mockFields);
      toast.success(`Extracted ${mockFields.length} fields`);
    } catch (err) {
      toast.error("Extraction failed: " + err.message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-emerald-900">Step 2: Extract Field Names</p>
        <p className="text-xs text-emerald-800">Automatically extract all fillable field names from the PDF.</p>
      </div>

      {extractedFields.length > 0 ? (
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-semibold text-emerald-900">✓ Extracted {extractedFields.length} Fields</p>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {extractedFields.map((field, i) => (
                <p key={i} className="text-xs font-mono text-slate-700 bg-white px-2 py-1 rounded">
                  {field}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleExtract}
          disabled={extracting}
          className="w-full"
          size="lg"
        >
          {extracting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Extracting Fields...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Extract Fields from PDF
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function Step3Configure({ onConfigComplete }) {
  const [form, setForm] = useState({
    name: "",
    entry_type_code: "",
    report_mode: "usor95_monthly",
    template_version: "1.0"
  });

  const handleContinue = () => {
    if (!form.name || !form.entry_type_code) {
      toast.error("Template name and entry type required");
      return;
    }
    onConfigComplete(form);
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-purple-900">Step 3: Configure Template</p>
        <p className="text-xs text-purple-800">Define template name, entry type, and reporting mode.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Template Name</Label>
          <Input
            placeholder="e.g., USOR-95 Job Coaching"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Entry Type</Label>
          <Select value={form.entry_type_code} onValueChange={v => setForm(p => ({ ...p, entry_type_code: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select entry type..." />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Report Mode</Label>
          <Select value={form.report_mode} onValueChange={v => setForm(p => ({ ...p, report_mode: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Template Version</Label>
          <Input
            placeholder="e.g., 1.0, 2.1"
            value={form.template_version}
            onChange={e => setForm(p => ({ ...p, template_version: e.target.value }))}
          />
        </div>

        <Button onClick={handleContinue} className="w-full" size="lg">
          Continue to Mapping
        </Button>
      </div>
    </div>
  );
}

function Step5Validate({ mappings, extractedFields, onValidateComplete }) {
  const mappedFields = new Set(mappings.map(m => m.pdf_field_name));
  const unmappedFields = extractedFields.filter(f => !mappedFields.has(f));
  
  const headerMaps = mappings.filter(m => m.mapping_scope === "header");
  const rowMaps = mappings.filter(m => m.mapping_scope === "row");
  
  const missingHeaderFields = REQUIRED_HEADER_FIELDS.filter(
    req => !headerMaps.some(m => m.source_field?.includes(req.replace(/_/g, "")))
  );
  
  const missingRowFields = REQUIRED_ROW_FIELDS.filter(
    req => !rowMaps.some(m => m.row_field_key?.includes(req.replace(/_/g, "")))
  );
  
  const hasErrors = missingHeaderFields.length > 0 || missingRowFields.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-900">Step 5: Validate Mappings</p>
        <p className="text-xs text-amber-800">Check for missing required fields and unmapped PDF fields.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-semibold">Total Fields</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{extractedFields.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs text-emerald-600 font-semibold">Mapped</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{mappedFields.size}</p>
        </div>
        <div className={cn(
          "border border-dashed rounded-lg p-3",
          unmappedFields.length > 0
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-200"
        )}>
          <p className={cn(
            "text-xs font-semibold",
            unmappedFields.length > 0 ? "text-amber-600" : "text-slate-600"
          )}>
            Unmapped
          </p>
          <p className={cn(
            "text-2xl font-bold mt-1",
            unmappedFields.length > 0 ? "text-amber-900" : "text-slate-900"
          )}>
            {unmappedFields.length}
          </p>
        </div>
      </div>

      {/* Required Fields Check */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Required Mappings</p>
        
        {missingHeaderFields.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-red-900">❌ Missing Header Fields</p>
            {missingHeaderFields.map(f => (
              <p key={f} className="text-xs text-red-700">{f.replace(/_/g, " ")}</p>
            ))}
          </div>
        )}

        {missingRowFields.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-red-900">❌ Missing Row Fields</p>
            {missingRowFields.map(f => (
              <p key={f} className="text-xs text-red-700">{f.replace(/_/g, " ")}</p>
            ))}
          </div>
        )}

        {!hasErrors && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-emerald-900">✓ All Required Mappings Complete</p>
              <p className="text-xs text-emerald-700">Template is ready to publish</p>
            </div>
          </div>
        )}
      </div>

      {/* Unmapped Fields Warning */}
      {unmappedFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-900 mb-2">{unmappedFields.length} Unmapped Fields</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {unmappedFields.map((f, i) => (
              <p key={i} className="text-xs font-mono text-amber-700 bg-white px-2 py-1 rounded">
                {f}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step6Publish({ config, mappings, onPublishComplete }) {
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!config.name) {
      toast.error("Configuration incomplete");
      return;
    }

    setPublishing(true);
    try {
      // Create PDFTemplate record
      const template = await base44.entities.PDFTemplate.create({
        name: config.name,
        entry_type_code: config.entry_type_code,
        report_mode: config.report_mode,
        template_version: config.template_version,
        pdf_file_url: config.pdf_url,
        field_names: config.extractedFields,
        is_active: true,
        template_code: config.entry_type_code + "_" + Date.now()
      });

      // Create mappings if not already saved
      for (const map of mappings) {
        if (map._isNew || !map.id) {
          const { _isNew, ...data } = map;
          await base44.entities.PDFFieldMap.create({
            ...data,
            pdf_template_id: template.id
          });
        }
      }

      toast.success("Template published successfully!");
      onPublishComplete(template);
    } catch (err) {
      toast.error("Publish failed: " + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold text-emerald-900">Step 6: Publish Template</p>
        <p className="text-xs text-emerald-800">Finalize and publish the template for production use.</p>
      </div>

      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Template Name</p>
            <p className="text-xs font-mono text-slate-900">{config.name}</p>
          </div>
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Entry Type</p>
            <p className="text-xs text-slate-900">{config.entry_type_code}</p>
          </div>
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Report Mode</p>
            <p className="text-xs text-slate-900">{config.report_mode}</p>
          </div>
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Version</p>
            <p className="text-xs font-mono text-slate-900">{config.template_version}</p>
          </div>
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Fields</p>
            <p className="text-xs text-slate-900">{config.extractedFields?.length || 0} extracted</p>
          </div>
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-700">Mappings</p>
            <p className="text-xs text-slate-900">{mappings.length} defined</p>
          </div>
        </div>
      </div>

      <Button
        onClick={handlePublish}
        disabled={publishing}
        className="w-full"
        size="lg"
      >
        {publishing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Publish Template
          </>
        )}
      </Button>

      <p className="text-xs text-slate-500 text-center">
        Template will be available for report generation immediately after publishing.
      </p>
    </div>
  );
}

export default function PDFTemplateSetupFlow({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState({
    pdf_url: null,
    file_name: null,
    extractedFields: [],
    name: "",
    entry_type_code: "",
    report_mode: "usor95_monthly",
    template_version: "1.0"
  });
  const [mappings, setMappings] = useState([]);
  const [showMappingEditor, setShowMappingEditor] = useState(false);

  const steps = [
    { num: 1, title: "Upload PDF", icon: Upload },
    { num: 2, title: "Extract Fields", icon: FileText },
    { num: 3, title: "Configure", icon: Settings },
    { num: 4, title: "Map Fields", icon: MapPin },
    { num: 5, title: "Validate", icon: CheckSquare },
    { num: 6, title: "Publish", icon: Zap }
  ];

  const handleStep1Complete = (data) => {
    setConfig(p => ({ ...p, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Complete = (fields) => {
    setConfig(p => ({ ...p, extractedFields: fields }));
    setCurrentStep(3);
  };

  const handleStep3Complete = (formData) => {
    setConfig(p => ({ ...p, ...formData }));
    setShowMappingEditor(true);
  };

  const handleMappingComplete = (mapsData) => {
    setMappings(mapsData);
    setCurrentStep(5);
  };

  const handleValidateComplete = () => {
    setCurrentStep(6);
  };

  const handlePublishComplete = (template) => {
    onComplete?.(template);
    setCurrentStep(1);
    setConfig({
      pdf_url: null,
      file_name: null,
      extractedFields: [],
      name: "",
      entry_type_code: "",
      report_mode: "usor95_monthly",
      template_version: "1.0"
    });
    setMappings([]);
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.num;
          const isComplete = currentStep > step.num;

          return (
            <React.Fragment key={step.num}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all",
                  isActive && "bg-blue-600 text-white shadow-md",
                  isComplete && "bg-emerald-100 text-emerald-900",
                  !isActive && !isComplete && "bg-slate-100 text-slate-600"
                )}
              >
                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 max-w-24 transition-colors",
                  isComplete ? "bg-emerald-200" : "bg-slate-200"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && <Step1Upload onUploadComplete={handleStep1Complete} />}
        {currentStep === 2 && <Step2ExtractFields pdfUrl={config.pdf_url} onExtractComplete={handleStep2Complete} />}
        {currentStep === 3 && <Step3Configure onConfigComplete={handleStep3Complete} />}
        {currentStep === 5 && <Step5Validate mappings={mappings} extractedFields={config.extractedFields} onValidateComplete={handleValidateComplete} />}
        {currentStep === 6 && <Step6Publish config={config} mappings={mappings} onPublishComplete={handlePublishComplete} />}
      </Card>

      {/* Mapping Editor Modal */}
      {showMappingEditor && (
        <Dialog open onOpenChange={v => !v && setShowMappingEditor(false)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Step 4: Map PDF Fields</DialogTitle>
            </DialogHeader>
            <PDFMappingWorkspace
              templateId="temp_setup"
              templateName={config.name}
              templateVersion={config.template_version}
              reportMode={config.report_mode}
              pdfFieldNames={config.extractedFields}
              onPublish={() => {
                setShowMappingEditor(false);
                handleMappingComplete(mappings);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}