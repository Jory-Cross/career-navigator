import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOURCE_TYPES = [
  { value: "time_entry", label: "Time Entry" },
  { value: "report_answer", label: "Report Answer (dynamic field)" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
];

const TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "date_format", label: "Date (MM/DD/YYYY)" },
  { value: "hours_from_minutes", label: "Minutes → Hours" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "full_name", label: "Full Name" },
];

function MapRow({ map, onUpdate, onDelete, saving }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b border-slate-100 last:border-0">
      <div className="col-span-3">
        <Select value={map.source_type || "time_entry"} onValueChange={v => onUpdate("source_type", v)}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCE_TYPES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-3">
        <Input
          className="text-xs h-8"
          placeholder="source_field"
          value={map.source_field || ""}
          onChange={e => onUpdate("source_field", e.target.value)}
        />
      </div>
      <div className="col-span-3">
        <Input
          className="text-xs h-8"
          placeholder="PDF field name"
          value={map.pdf_field_name || ""}
          onChange={e => onUpdate("pdf_field_name", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Select value={map.transform || "none"} onValueChange={v => onUpdate("transform", v)}>
          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRANSFORMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1 flex items-center pt-0.5">
        <button
          onClick={onDelete}
          className="text-slate-300 hover:text-red-500 transition-colors p-1"
          disabled={saving}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function PDFFieldMapEditor({ templateId, templateName }) {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }, "source_type")
      .then(data => { setMaps(data); setDirty(false); })
      .catch(() => setMaps([]))
      .finally(() => setLoading(false));
  }, [templateId]);

  const updateRow = (idx, field, value) => {
    setMaps(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
    setDirty(true);
  };

  const addRow = () => {
    setMaps(prev => [...prev, {
      _isNew: true,
      pdf_template_id: templateId,
      source_type: "time_entry",
      source_field: "",
      pdf_field_name: "",
      transform: "none",
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
      const fresh = await base44.entities.PDFFieldMap.filter({ pdf_template_id: templateId }, "source_type");
      setMaps(fresh);
      setDirty(false);
      toast.success("Field mappings saved");
    } catch (e) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading mappings...
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Field Mappings — <span className="text-slate-500 font-normal">{templateName}</span></p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow} disabled={saving}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {saving ? "Saving..." : "Save Mappings"}
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0">
        <div className="col-span-3">Source Type</div>
        <div className="col-span-3">Source Field</div>
        <div className="col-span-3">PDF Field Name</div>
        <div className="col-span-2">Transform</div>
        <div className="col-span-1"></div>
      </div>

      {maps.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">No mappings yet. Add rows to map data fields to PDF fields.</p>
      ) : (
        maps.map((map, idx) => (
          <MapRow
            key={map.id || `new-${idx}`}
            map={map}
            saving={saving}
            onUpdate={(field, value) => updateRow(idx, field, value)}
            onDelete={() => deleteRow(idx)}
          />
        ))
      )}

      <div className="pt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-3 space-y-1">
        <p className="font-medium text-slate-500">Source field examples:</p>
        <p><span className="text-slate-600">time_entry:</span> date, duration_minutes, start_time, end_time, description, category</p>
        <p><span className="text-slate-600">report_answer:</span> any field_key from your ReportFieldTemplate (e.g. goal_addressed)</p>
        <p><span className="text-slate-600">client:</span> first_name, last_name, full_name, email, phone, address, client_type</p>
        <p><span className="text-slate-600">employee:</span> full_name, email, title, phone</p>
      </div>
    </div>
  );
}