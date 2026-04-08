import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Loader2, Save, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOURCE_TYPES = [
  { value: "time_entry", label: "Time Entry" },
  { value: "report_answer", label: "Report Answer (dynamic field)" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
  { value: "authorization", label: "Service Authorization" },
  { value: "assembled_report", label: "Assembled Report Data" },
  { value: "static", label: "Static Value" },
];

const MAPPING_SCOPES = [
  { value: "header", label: "📄 Header (once per report)", color: "bg-blue-50 border-blue-200" },
  { value: "row", label: "📊 Repeating Row", color: "bg-green-50 border-green-200" },
  { value: "summary", label: "📈 Summary/Footer", color: "bg-purple-50 border-purple-200" },
  { value: "static", label: "🔒 Static Value", color: "bg-gray-50 border-gray-200" },
];

const TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "date_format", label: "Date (MM/DD/YYYY)" },
  { value: "time_format", label: "Time (HH:MM)" },
  { value: "hours_from_minutes", label: "Minutes → Hours" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "full_name", label: "Full Name" },
];

const AGGREGATION_MODES = [
  { value: "none", label: "None (single value)" },
  { value: "sum", label: "Sum (total)" },
  { value: "count", label: "Count (entries)" },
  { value: "first", label: "First value" },
  { value: "last", label: "Last value" },
  { value: "concat", label: "Concatenate (comma-sep)" },
];

function MapRow({ map, onUpdate, onDelete, saving }) {
  const [expanded, setExpanded] = useState(false);
  const scopeConfig = MAPPING_SCOPES.find(s => s.value === (map.mapping_scope || 'header'));
  const isRowScope = map.mapping_scope === 'row';
  const isSummaryScope = map.mapping_scope === 'summary';
  const isStaticScope = map.mapping_scope === 'static';

  return (
    <div className={`border rounded-lg p-3 mb-2 transition-colors ${scopeConfig?.color || 'bg-slate-50 border-slate-200'}`}>
      {/* Compact View */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
        </button>

        <div className="flex-1 grid grid-cols-10 gap-2 items-center text-xs">
          <div className="col-span-2">
            <div className="font-medium text-slate-700">{scopeConfig?.label}</div>
          </div>
          <div className="col-span-2">
            <div className="text-slate-600 truncate">{map.source_type || 'time_entry'}</div>
          </div>
          <div className="col-span-3">
            <div className="text-slate-600 truncate">{map.source_field || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-slate-700 font-mono text-[11px] bg-white/50 px-2 py-1 rounded truncate">
              {map.pdf_field_name || '—'}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <button
              onClick={() => onDelete()}
              className="text-slate-300 hover:text-red-500 transition-colors p-1"
              disabled={saving}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/60 space-y-3">
          {/* Scope Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Mapping Scope</Label>
              <Select value={map.mapping_scope || "header"} onValueChange={v => onUpdate("mapping_scope", v)}>
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAPPING_SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Source Type</Label>
              <Select value={map.source_type || "time_entry"} onValueChange={v => onUpdate("source_type", v)}>
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Source & PDF Field */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Source Field</Label>
              <Input
                className="text-xs h-8"
                placeholder="e.g., date, duration_minutes, employer_name"
                value={map.source_field || ""}
                onChange={e => onUpdate("source_field", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">PDF Field Name</Label>
              <Input
                className="text-xs h-8 font-mono"
                placeholder="e.g., Row1_Date, Header_GoalAddress"
                value={map.pdf_field_name || ""}
                onChange={e => onUpdate("pdf_field_name", e.target.value)}
              />
            </div>
          </div>

          {/* Transform */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">Transform</Label>
            <Select value={map.transform || "none"} onValueChange={v => onUpdate("transform", v)}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSFORMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Row-Specific Options */}
          {isRowScope && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/60">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Row Group</Label>
                <Input
                  className="text-xs h-8"
                  placeholder="e.g., row_1, row_2"
                  value={map.row_group || ""}
                  onChange={e => onUpdate("row_group", e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Groups repeating fields together</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Row Field Key</Label>
                <Input
                  className="text-xs h-8"
                  placeholder="e.g., date, hours, activity"
                  value={map.row_field_key || ""}
                  onChange={e => onUpdate("row_field_key", e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Semantic key within row</p>
              </div>
            </div>
          )}

          {/* Summary-Specific Options */}
          {isSummaryScope && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/60">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Aggregation Mode</Label>
                <Select value={map.aggregation_mode || "none"} onValueChange={v => onUpdate("aggregation_mode", v)}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_MODES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Static Value */}
          {isStaticScope && (
            <div className="pt-2 border-t border-white/60">
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Static Value</Label>
              <Input
                className="text-xs h-8"
                placeholder="e.g., VR Report, USOR96"
                value={map.static_value || ""}
                onChange={e => onUpdate("static_value", e.target.value)}
              />
            </div>
          )}

          {/* Default/Active Checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/60">
            <Checkbox
              checked={map.is_active !== false}
              onCheckedChange={v => onUpdate("is_active", v)}
              id={`active-${map.id}`}
            />
            <Label htmlFor={`active-${map.id}`} className="text-xs font-medium text-slate-600 cursor-pointer">
              Mapping is active
            </Label>
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-white/60">
            <Label className="text-xs font-semibold text-slate-700 mb-1 block">Notes</Label>
            <Input
              className="text-xs h-8"
              placeholder="Internal notes about this mapping"
              value={map.notes || ""}
              onChange={e => onUpdate("notes", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PDFFieldMapEditor({ templateId, templateName, reportMode }) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [filterScope, setFilterScope] = useState(null);

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }, "mapping_scope")
      .then(data => { setMaps(data); setDirty(false); })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false));
  }, [templateId]);

  const updateRow = (idx, field, value) => {
    setMaps(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
    setDirty(true);
  };

  const addRow = (scope = 'header') => {
    setMaps(prev => [...prev, {
      _isNew: true,
      pdf_template_id: templateId,
      mapping_scope: scope,
      source_type: "time_entry",
      source_field: "",
      pdf_field_name: "",
      transform: "none",
      aggregation_mode: "none",
      is_active: true,
    }]);
    setDirty(true);
  };

  const deleteRow = async (idx) => {
    const row = maps[idx];
    if (row.id) {
      await base44.entities.PDFFieldMap.delete(row.id);
      toast.success("Mapping deleted");
    }
    setMaps(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const map of maps) {
        const { _isNew, ...data } = map;
        if (_isNew) {
          await base44.entities.PDFFieldMap.create({ ...data, pdf_template_id: templateId });
        } else if (map.id) {
          await base44.entities.PDFFieldMap.update(map.id, data);
        }
      }
      // Reload fresh
      const fresh = await base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }, "mapping_scope");
      setMaps(fresh);
      setDirty(false);
      toast.success("Field mappings saved");
    } catch (e) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const grouped = {};
  maps.forEach(m => {
    const scope = m.mapping_scope || 'header';
    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push(m);
  });

  const filtered = filterScope ? grouped[filterScope] || [] : maps;

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading mappings...
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Field Mappings — <span className="text-slate-500 font-normal">{templateName}</span></p>
            {reportMode && <p className="text-xs text-slate-500 mt-0.5">Report Mode: <span className="font-mono font-medium">{reportMode}</span></p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addRow('header')} disabled={saving} title="Add header field">
              <Plus className="w-3.5 h-3.5 mr-1" /> Header
            </Button>
            <Button size="sm" variant="outline" onClick={() => addRow('row')} disabled={saving} title="Add repeating row field">
              <Plus className="w-3.5 h-3.5 mr-1" /> Row
            </Button>
            <Button size="sm" variant="outline" onClick={() => addRow('summary')} disabled={saving} title="Add summary field">
              <Plus className="w-3.5 h-3.5 mr-1" /> Summary
            </Button>
            <Button size="sm" onClick={saveAll} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Scope Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="xs"
            variant={filterScope === null ? "default" : "outline"}
            onClick={() => setFilterScope(null)}
            className="text-xs"
          >
            All ({maps.length})
          </Button>
          {MAPPING_SCOPES.map(scope => {
            const count = grouped[scope.value]?.length || 0;
            return (
              <Button
                key={scope.value}
                size="xs"
                variant={filterScope === scope.value ? "default" : "outline"}
                onClick={() => setFilterScope(scope.value)}
                className="text-xs"
              >
                {scope.label.split(' ')[0]} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Mappings List */}
      {filtered.length === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">
          {maps.length === 0 ? 'No mappings yet. Use the buttons above to add fields.' : 'No mappings in this scope.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((map, originalIdx) => {
            const idx = maps.findIndex(m => m.id === map.id || (m._isNew && maps.indexOf(m) === maps.length - 1));
            return (
              <MapRow
                key={map.id || `new-${originalIdx}`}
                map={map}
                saving={saving}
                onUpdate={(field, value) => updateRow(idx, field, value)}
                onDelete={() => deleteRow(idx)}
              />
            );
          })}
        </div>
      )}

      {/* Help */}
      <div className="pt-3 border-t border-slate-200 space-y-2">
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-blue-900">Row-Aware Mapping Tips:</p>
            <p className="text-blue-800"><span className="font-mono">USOR96</span>: Simple monthly rows. Map row fields with row_group (e.g., row_1, row_2).</p>
            <p className="text-blue-800"><span className="font-mono">USOR95</span>: Group by employer. Include employer_name in answers.</p>
            <p className="text-blue-800"><span className="font-mono">USOR148</span>: Group by entry type. Use aggregation mode to summarize entry types.</p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
          <p className="font-medium text-slate-600">Source field examples:</p>
          <p><span className="text-slate-700 font-mono">time_entry</span>: date, duration_minutes, start_time, end_time, description, entry_type_code</p>
          <p><span className="text-slate-700 font-mono">report_answer</span>: answers.employer_name, answers.goal_addressed (dynamic fields)</p>
          <p><span className="text-slate-700 font-mono">authorization</span>: authorization_number, vr_counselor_name, job_goal, employer_name</p>
          <p><span className="text-slate-700 font-mono">client</span>: first_name, last_name, email, phone, address</p>
        </div>
      </div>
    </div>
  );
}