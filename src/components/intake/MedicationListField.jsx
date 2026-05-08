import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

const EMPTY_MED = () => ({
  _id: Math.random().toString(36).slice(2),
  name: "",
  dosage: "",
  frequency: "",
  purpose: "",
  side_effects: "",
  work_impact: "",
  notes: "",
});

export default function MedicationListField({ value = [], onChange, readOnly }) {
  const medications = Array.isArray(value) ? value : [];

  const addMed = () => {
    onChange([...medications, EMPTY_MED()]);
  };

  const removeMed = (idx) => {
    onChange(medications.filter((_, i) => i !== idx));
  };

  const updateMed = (idx, field, val) => {
    const updated = medications.map((med, i) =>
      i === idx ? { ...med, [field]: val } : med
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {medications.length === 0 && (
        <p className="text-sm text-slate-400 italic">No medications added yet.</p>
      )}

      {medications.map((med, idx) => (
        <div
          key={med._id || idx}
          className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Medication {idx + 1}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeMed(idx)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                title="Remove medication"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Medication Name</Label>
              <Input
                value={med.name}
                onChange={(e) => updateMed(idx, "name", e.target.value)}
                placeholder="e.g. Sertraline"
                readOnly={readOnly}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dosage</Label>
              <Input
                value={med.dosage}
                onChange={(e) => updateMed(idx, "dosage", e.target.value)}
                placeholder="e.g. 50mg"
                readOnly={readOnly}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frequency / Time Taken</Label>
              <Input
                value={med.frequency}
                onChange={(e) => updateMed(idx, "frequency", e.target.value)}
                placeholder="e.g. Once daily, mornings"
                readOnly={readOnly}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Used For / Purpose</Label>
              <Input
                value={med.purpose}
                onChange={(e) => updateMed(idx, "purpose", e.target.value)}
                placeholder="e.g. Anxiety, Depression"
                readOnly={readOnly}
                className="bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Possible Side Effects</Label>
            <Textarea
              value={med.side_effects}
              onChange={(e) => updateMed(idx, "side_effects", e.target.value)}
              placeholder="e.g. Drowsiness, dry mouth"
              className="min-h-[60px] bg-white"
              readOnly={readOnly}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Work-related Impact or Concerns</Label>
            <Textarea
              value={med.work_impact}
              onChange={(e) => updateMed(idx, "work_impact", e.target.value)}
              placeholder="e.g. May cause fatigue in early mornings"
              className="min-h-[60px] bg-white"
              readOnly={readOnly}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Additional Notes</Label>
            <Textarea
              value={med.notes}
              onChange={(e) => updateMed(idx, "notes", e.target.value)}
              placeholder="Any other relevant details..."
              className="min-h-[50px] bg-white"
              readOnly={readOnly}
            />
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addMed}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Medication
        </Button>
      )}
    </div>
  );
}