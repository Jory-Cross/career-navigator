import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Trash2, Save, Loader2, AlertCircle, CheckCircle2, Eye, Copy,
  ChevronDown, Search, ArrowRight, Info, Grid3x3, Eye as EyeIcon
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOURCE_CATEGORIES = {
  client: { label: "Client Data", color: "bg-blue-50 border-blue-200" },
  employee: { label: "Employee Data", color: "bg-purple-50 border-purple-200" },
  authorization: { label: "Service Authorization", color: "bg-emerald-50 border-emerald-200" },
  time_entry: { label: "Time Entry", color: "bg-orange-50 border-orange-200" },
  report_answer: { label: "Dynamic Field Answer", color: "bg-cyan-50 border-cyan-200" },
  assembled_report: { label: "Assembled Report", color: "bg-pink-50 border-pink-200" },
  static: { label: "Static Value", color: "bg-gray-50 border-gray-200" }
};

const SAMPLE_SOURCES = {
  client: [
    { field: "first_name", type: "string", sample: "John" },
    { field: "last_name", type: "string", sample: "Doe" },
    { field: "email", type: "string", sample: "john@example.com" },
    { field: "phone", type: "string", sample: "801-555-1234" },
    { field: "address", type: "string", sample: "123 Main St" }
  ],
  employee: [
    { field: "full_name", type: "string", sample: "Jane Smith" },
    { field: "email", type: "string", sample: "jane@company.com" },
    { field: "title", type: "string", sample: "Employment Specialist" }
  ],
  authorization: [
    { field: "authorization_number", type: "string", sample: "VR-2024-001" },
    { field: "vr_counselor_name", type: "string", sample: "Bob Johnson" },
    { field: "job_goal", type: "string", sample: "Data Entry Clerk" },
    { field: "employer_name", type: "string", sample: "Acme Corp" },
    { field: "service_start_date", type: "date", sample: "2024-01-01" },
    { field: "service_end_date", type: "date", sample: "2024-12-31" },
    { field: "total_authorized_hours", type: "number", sample: "200" }
  ],
  time_entry: [
    { field: "date", type: "date", sample: "2024-04-08" },
    { field: "duration_minutes", type: "number", sample: "60" },
    { field: "start_time", type: "time", sample: "09:00" },
    { field: "end_time", type: "time", sample: "10:00" },
    { field: "description", type: "string", sample: "Job coaching session" },
    { field: "entry_type_code", type: "string", sample: "job_coaching" }
  ],
  report_answer: [
    { field: "answers.employer_name", type: "string", sample: "ABC Industries" },
    { field: "answers.goal_addressed", type: "string", sample: "Customer service skills" }
  ],
  assembled_report: [
    { field: "header.client_name", type: "string", section: "header" },
    { field: "rows[*].date", type: "date", section: "rows" },
    { field: "rows[*].hours", type: "number", section: "rows" },
    { field: "summary.total_hours", type: "number", section: "summary" },
    { field: "summary.entry_count", type: "number", section: "summary" }
  ]
};

const TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "date_format", label: "Date (MM/DD/YYYY)" },
  { value: "time_format", label: "Time (HH:MM)" },
  { value: "hours_from_minutes", label: "Minutes → Hours" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "full_name", label: "Full Name (concat)" },
];

const AGGREGATION_MODES = [
  { value: "none", label: "None (single)" },
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "first", label: "First" },
  { value: "last", label: "Last" },
  { value: "concat", label: "Concatenate" },
];

export default function PDFMappingWorkspace({
  templateId,
  templateName,
  templateVersion,
  reportMode,
  pdfFieldNames = [],
  onPublish
}) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedMap, setSelectedMap] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [searchPdfFields, setSearchPdfFields] = useState("");
  const [searchSources, setSearchSources] = useState("");
  const [filterScope, setFilterScope] = useState("all");
  const [showPreview, setShowPreview] = useState(false);

  // Load mappings
  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }, "mapping_scope")
      .then(data => { setMaps(data); setDirty(false); })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false));
  }, [templateId]);

  const filteredMaps = useMemo(() => {
    let result = maps;
    if (filterScope !== "all") {
      result = result.filter(m => m.mapping_scope === filterScope);
    }
    return result;
  }, [maps, filterScope]);

  const mappedPdfFields = useMemo(() => {
    return new Set(maps.map(m => m.pdf_field_name).filter(Boolean));
  }, [maps]);

  const unmappedFields = useMemo(() => {
    return pdfFieldNames.filter(f => !mappedPdfFields.has(f));
  }, [pdfFieldNames, mappedPdfFields]);

  const scopeCounts = useMemo(() => ({
    all: maps.length,
    header: maps.filter(m => m.mapping_scope === "header").length,
    row: maps.filter(m => m.mapping_scope === "row").length,
    summary: maps.filter(m => m.mapping_scope === "summary").length,
    static: maps.filter(m => m.mapping_scope === "static").length
  }), [maps]);

  const handleCreateMap = (scope, sourceType, pdfField) => {
    const newMap = {
      _isNew: true,
      pdf_template_id: templateId,
      mapping_scope: scope,
      source_type: sourceType,
      source_field: "",
      pdf_field_name: pdfField || "",
      transform: "none",
      aggregation_mode: "none",
      is_active: true,
      row_group: scope === "row" ? `row_${maps.filter(m => m.mapping_scope === "row").length + 1}` : ""
    };
    setSelectedMap(newMap);
    setShowEditor(true);
  };

  const handleSaveMap = async (mapData) => {
    if (!mapData.pdf_field_name) {
      toast.error("PDF field name required");
      return;
    }

    try {
      if (mapData._isNew) {
        const { _isNew, ...data } = mapData;
        const created = await base44.entities.PDFFieldMap.create(data);
        setMaps(prev => [...prev.filter(m => m._isNew !== true && m.id !== mapData.id), created]);
      } else {
        await base44.entities.PDFFieldMap.update(mapData.id, mapData);
        setMaps(prev => prev.map(m => m.id === mapData.id ? mapData : m));
      }
      setDirty(true);
      setShowEditor(false);
      toast.success("Mapping saved");
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    }
  };

  const handleDeleteMap = async (mapId) => {
    if (!confirm("Delete this mapping?")) return;
    try {
      if (!mapId.includes("new-")) {
        await base44.entities.PDFFieldMap.delete(mapId);
      }
      setMaps(prev => prev.filter(m => m.id !== mapId));
      setDirty(true);
      toast.success("Mapping deleted");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      // Save all pending changes
      for (const map of maps) {
        const { _isNew, ...data } = map;
        if (map._isNew) {
          await base44.entities.PDFFieldMap.create(data);
        } else if (map.id) {
          await base44.entities.PDFFieldMap.update(map.id, data);
        }
      }
      setDirty(false);
      toast.success("Mappings published");
      onPublish?.();
    } catch (err) {
      toast.error("Publish failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading workspace...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{templateName}</h2>
          <p className="text-xs text-slate-500 mt-1">v{templateVersion} • {reportMode}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={saving || !dirty}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {dirty ? "Publish Changes" : "Published"}
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-[300px_1fr_320px] gap-4 h-[calc(100vh-320px)]">
        {/* Left Panel: PDF Fields */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <h3 className="text-xs font-bold text-slate-700">📄 PDF Fields</h3>
            <Input
              type="search"
              placeholder="Search fields..."
              value={searchPdfFields}
              onChange={e => setSearchPdfFields(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            {unmappedFields.filter(f =>
              f.toLowerCase().includes(searchPdfFields.toLowerCase())
            ).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-600 px-2 py-1">UNMAPPED ({unmappedFields.length})</p>
                {unmappedFields.filter(f =>
                  f.toLowerCase().includes(searchPdfFields.toLowerCase())
                ).map(field => (
                  <button
                    key={field}
                    onClick={() => handleCreateMap("header", "time_entry", field)}
                    className="w-full text-left px-2 py-1.5 text-[11px] bg-amber-50 border border-amber-200 rounded text-amber-700 hover:bg-amber-100 font-mono truncate transition-colors"
                    title={field}
                  >
                    {field}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 px-2 py-1 uppercase">MAPPED ({mappedPdfFields.size})</p>
              {Array.from(mappedPdfFields)
                .filter(f => f.toLowerCase().includes(searchPdfFields.toLowerCase()))
                .sort()
                .map(field => {
                  const mapping = maps.find(m => m.pdf_field_name === field);
                  return (
                    <div
                      key={field}
                      onClick={() => {
                        setSelectedMap(mapping);
                        setShowEditor(true);
                      }}
                      className="px-2 py-1.5 text-[10px] bg-emerald-50 border border-emerald-200 rounded text-emerald-700 font-mono truncate cursor-pointer hover:bg-emerald-100 transition-colors"
                      title={field}
                    >
                      ✓ {field}
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>

        {/* Center: Mapping List */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">🗺️ Field Mappings</h3>
              <span className="text-[10px] text-slate-500">{filteredMaps.length} maps</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "header", "row", "summary", "static"].map(scope => (
                <button
                  key={scope}
                  onClick={() => setFilterScope(scope)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-medium rounded border transition-all",
                    filterScope === scope
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {scope.toUpperCase()} ({scopeCounts[scope]})
                </button>
              ))}
            </div>
          </div>

          {/* Mappings Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 p-3">
            {filteredMaps.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">
                No mappings in this scope. Click a PDF field to start.
              </div>
            ) : (
              filteredMaps.map(map => (
                <MappingCard
                  key={map.id || map._isNew}
                  mapping={map}
                  onEdit={() => {
                    setSelectedMap(map);
                    setShowEditor(true);
                  }}
                  onDelete={() => handleDeleteMap(map.id || map._isNew)}
                />
              ))
            )}
          </div>
        </Card>

        {/* Right Panel: Data Sources */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <h3 className="text-xs font-bold text-slate-700">📊 Data Sources</h3>
            <Input
              type="search"
              placeholder="Search sources..."
              value={searchSources}
              onChange={e => setSearchSources(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 p-2">
            {Object.entries(SAMPLE_SOURCES).map(([sourceType, fields]) => {
              const filtered = fields.filter(f =>
                f.field.toLowerCase().includes(searchSources.toLowerCase())
              );
              if (filtered.length === 0) return null;
              return (
                <div key={sourceType} className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-600 px-2 uppercase">
                    {SOURCE_CATEGORIES[sourceType].label}
                  </p>
                  {filtered.map(field => (
                    <SourceFieldBadge
                      key={field.field}
                      sourceType={sourceType}
                      field={field}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Unmapped Warning */}
      {unmappedFields.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-amber-800">{unmappedFields.length} unmapped PDF fields</p>
            <p className="text-amber-700 mt-0.5">Click on fields in the left panel to create mappings</p>
          </div>
        </div>
      )}

      {/* Editor Dialog */}
      {showEditor && selectedMap && (
        <MappingEditorDialog
          mapping={selectedMap}
          onSave={handleSaveMap}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Preview Dialog */}
      {showPreview && (
        <PreviewDialog
          maps={maps}
          templateName={templateName}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function MappingCard({ mapping, onEdit, onDelete }) {
  const scopeIcons = { header: "📄", row: "📊", summary: "📈", static: "🔒" };
  const scopeColors = {
    header: "bg-blue-50 border-blue-200",
    row: "bg-green-50 border-green-200",
    summary: "bg-purple-50 border-purple-200",
    static: "bg-gray-50 border-gray-200"
  };

  return (
    <div
      className={cn(
        "p-2 border rounded-lg cursor-pointer hover:shadow-sm transition-all",
        scopeColors[mapping.mapping_scope] || "bg-slate-50 border-slate-200"
      )}
      onClick={onEdit}
    >
      <div className="flex items-start gap-2 text-[11px]">
        <span className="text-xs">{scopeIcons[mapping.mapping_scope]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-mono font-bold text-slate-800 truncate">{mapping.pdf_field_name}</p>
          <p className="text-slate-600 text-[10px]">
            {mapping.source_type} → {mapping.source_field}
          </p>
          {mapping.mapping_scope === "row" && (
            <p className="text-[10px] text-slate-500">Row: {mapping.row_group}</p>
          )}
        </div>
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function SourceFieldBadge({ sourceType, field }) {
  const [copied, setCopied] = React.useState(false);

  const copyField = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(field.field);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copyField}
      className="w-full text-left px-2 py-1 text-[10px] bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors flex items-center justify-between group"
    >
      <span className="font-mono text-slate-700 truncate">{field.field}</span>
      <span className="text-slate-400 text-[9px] group-hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? "✓" : "copy"}
      </span>
    </button>
  );
}

function MappingEditorDialog({ mapping, onSave, onClose }) {
  const [form, setForm] = React.useState(mapping);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const scopeLabel = {
    header: "Header (once per report)",
    row: "Repeating Row (per time entry)",
    summary: "Summary/Footer (aggregated)",
    static: "Static Value"
  }[form.mapping_scope];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Map PDF Field: {form.pdf_field_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mapping Scope</Label>
              <Select
                value={form.mapping_scope}
                onValueChange={v => setForm(p => ({ ...p, mapping_scope: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">📄 Header (once)</SelectItem>
                  <SelectItem value="row">📊 Repeating Row</SelectItem>
                  <SelectItem value="summary">📈 Summary</SelectItem>
                  <SelectItem value="static">🔒 Static Value</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500 mt-1">{scopeLabel}</p>
            </div>

            {form.mapping_scope !== "static" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Source Type</Label>
                <Select
                  value={form.source_type}
                  onValueChange={v => setForm(p => ({ ...p, source_type: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time_entry">Time Entry</SelectItem>
                    <SelectItem value="report_answer">Dynamic Field Answer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="authorization">Service Authorization</SelectItem>
                    <SelectItem value="assembled_report">Assembled Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Source Field */}
          {form.mapping_scope !== "static" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Source Field</Label>
              <Input
                placeholder="e.g., date, duration_minutes, first_name"
                value={form.source_field}
                onChange={e => setForm(p => ({ ...p, source_field: e.target.value }))}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-slate-500">Use dot notation for nested fields (e.g., answers.employer_name)</p>
            </div>
          )}

          {/* Static Value */}
          {form.mapping_scope === "static" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Static Value</Label>
              <Input
                placeholder="e.g., VR Report, USOR96"
                value={form.static_value || ""}
                onChange={e => setForm(p => ({ ...p, static_value: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Transform */}
          {form.mapping_scope !== "static" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Transform</Label>
              <Select
                value={form.transform || "none"}
                onValueChange={v => setForm(p => ({ ...p, transform: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFORMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Row-Specific Fields */}
          {form.mapping_scope === "row" && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-green-50 border border-green-200 rounded">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Row Group</Label>
                <Input
                  placeholder="e.g., row_1, row_2"
                  value={form.row_group || ""}
                  onChange={e => setForm(p => ({ ...p, row_group: e.target.value }))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-slate-600">Groups fields in repeating blocks</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Row Field Key</Label>
                <Input
                  placeholder="e.g., date, hours, activity"
                  value={form.row_field_key || ""}
                  onChange={e => setForm(p => ({ ...p, row_field_key: e.target.value }))}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-slate-600">Semantic meaning within row</p>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-semibold">Row Sort Order</Label>
                <Input
                  type="number"
                  placeholder="1, 2, 3..."
                  value={form.row_sort_order || ""}
                  onChange={e => setForm(p => ({ ...p, row_sort_order: parseInt(e.target.value) || "" }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Summary-Specific Fields */}
          {form.mapping_scope === "summary" && (
            <div className="space-y-1 p-3 bg-purple-50 border border-purple-200 rounded">
              <Label className="text-xs font-semibold">Aggregation Mode</Label>
              <Select
                value={form.aggregation_mode || "none"}
                onValueChange={v => setForm(p => ({ ...p, aggregation_mode: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_MODES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-600 mt-1">How to aggregate multiple entries</p>
            </div>
          )}

          {/* Active & Notes */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_active !== false}
                onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))}
                id="active"
              />
              <Label htmlFor="active" className="text-xs font-medium cursor-pointer">Mapping is active</Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Notes</Label>
              <Input
                placeholder="Internal notes about this mapping"
                value={form.notes || ""}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ maps, templateName, onClose }) {
  const headerMaps = maps.filter(m => m.mapping_scope === "header");
  const rowMaps = maps.filter(m => m.mapping_scope === "row");
  const summaryMaps = maps.filter(m => m.mapping_scope === "summary");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapping Preview: {templateName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Preview */}
          {headerMaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-blue-900">📄 Header Fields ({headerMaps.length})</h3>
              <div className="space-y-1">
                {headerMaps.map((m, i) => (
                  <div key={i} className="flex gap-2 text-xs p-2 bg-blue-50 rounded border border-blue-200">
                    <code className="font-bold text-blue-700 min-w-fit">{m.pdf_field_name}</code>
                    <ArrowRight className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-600">{m.source_type}</span>
                    <span className="text-blue-600">→</span>
                    <code className="font-mono text-blue-700">{m.source_field}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row Preview */}
          {rowMaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-green-900">📊 Repeating Rows ({rowMaps.length})</h3>
              <div className="space-y-2">
                {Array.from(new Set(rowMaps.map(m => m.row_group))).map(group => (
                  <div key={group} className="space-y-1 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-semibold text-green-800">{group}</p>
                    {rowMaps.filter(m => m.row_group === group).map((m, i) => (
                      <div key={i} className="text-xs text-green-700 flex gap-1">
                        <span className="font-mono">{m.pdf_field_name}</span>
                        <span>← {m.source_field} ({m.row_field_key})</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Preview */}
          {summaryMaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-purple-900">📈 Summary ({summaryMaps.length})</h3>
              <div className="space-y-1">
                {summaryMaps.map((m, i) => (
                  <div key={i} className="flex gap-2 text-xs p-2 bg-purple-50 rounded border border-purple-200">
                    <code className="font-bold text-purple-700">{m.pdf_field_name}</code>
                    <ArrowRight className="w-3 h-3 text-purple-600" />
                    <span className="text-purple-600">{m.aggregation_mode}</span>
                    <span className="text-purple-600">of</span>
                    <code className="font-mono text-purple-700">{m.source_field}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maps.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No mappings defined yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}