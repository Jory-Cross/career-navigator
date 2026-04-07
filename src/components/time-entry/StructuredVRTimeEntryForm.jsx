import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { VR_ENTRY_TYPES } from "@/lib/vrFormConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validateTimeEntrySubmission } from "@/lib/timeEntryValidation";
import { submitFieldAnswers } from "@/lib/fieldAnswerSubmission";

export default function StructuredVRTimeEntryForm({ clientId, onSuccess }) {
  const [step, setStep] = useState("select_type");
  const [selectedType, setSelectedType] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingEntryTypes, setLoadingEntryTypes] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [entryTypes, setEntryTypes] = useState([]);
  const [fields, setFields] = useState([]);

  // Load entry types on mount
  useEffect(() => {
    loadEntryTypes();
  }, []);

  // Load field templates when entry type selected
  useEffect(() => {
    if (selectedTypeId) {
      loadFieldTemplates(selectedTypeId);
    }
  }, [selectedTypeId]);

  const loadEntryTypes = async () => {
    try {
      setLoadingEntryTypes(true);
      const dbTypes = await base44.entities.EntryType.filter({ is_active: true });
      
      if (dbTypes.length > 0) {
        // Use database entry types
        setEntryTypes(dbTypes);
      } else {
        // Fallback to vrFormConfig
        setEntryTypes(Object.values(VR_ENTRY_TYPES));
      }
    } catch (e) {
      console.error('Failed to load entry types:', e);
      // Fallback to vrFormConfig
      setEntryTypes(Object.values(VR_ENTRY_TYPES));
    } finally {
      setLoadingEntryTypes(false);
    }
  };

  const loadFieldTemplates = async (entryTypeId) => {
    try {
      setLoadingFields(true);
      const dbFields = await base44.entities.ReportFieldTemplate.filter({
        entry_type_id: entryTypeId,
        is_active: true
      });

      if (dbFields.length > 0) {
        // Use database field templates - convert to form field format
        setFields(dbFields.map(f => ({
          key: f.field_key,
          label: f.label,
          type: f.field_type || 'text',
          required: f.is_required || false,
          section: f.section || 'Other',
          placeholder: f.placeholder,
          options: f.options || [],
          help_text: f.help_text,
          order: f.order || 0
        })).sort((a, b) => (a.order || 0) - (b.order || 0)));
      } else {
        // Fallback to vrFormConfig
        const fallbackConfig = Object.values(VR_ENTRY_TYPES).find(t => t.code === selectedType);
        setFields(fallbackConfig?.fields || []);
      }
    } catch (e) {
      console.error('Failed to load field templates:', e);
      // Fallback to vrFormConfig
      const fallbackConfig = Object.values(VR_ENTRY_TYPES).find(t => t.code === selectedType);
      setFields(fallbackConfig?.fields || []);
    } finally {
      setLoadingFields(false);
    }
  };

  const selectedTypeObj = entryTypes.find(t => t.id === selectedTypeId || t.code === selectedType);
  const config = selectedTypeObj ? { ...selectedTypeObj, fields } : null;

  const validateStep = () => {
    const newErrors = {};
    if (!fields || fields.length === 0) return true;

    fields.forEach((field) => {
      if (field.required && !formData[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSubmission = () => {
    const dateField = fields.find(f => f.type === 'date');
    const hoursField = fields.find(f => f.key.includes('hours'));
    
    const entryData = {
      client_id: clientId,
      date: formData[dateField?.key],
      duration_minutes: Math.round(
        (formData[hoursField?.key] || 0) * 60
      ),
      entry_type_id: selectedTypeId,
      entry_type_code: selectedType,
      category: selectedType
    };

    // Build field answers
    const fieldAnswers = {};
    fields.forEach((field) => {
      if (formData[field.key] !== undefined && formData[field.key] !== "") {
        fieldAnswers[field.key] = formData[field.key];
      }
    });

    // Run full validation
    const validation = validateTimeEntrySubmission(entryData, fieldAnswers);
    
    if (!validation.isValid) {
      setErrors({});
      validation.errors.forEach(err => {
        toast.error(err);
      });
    }

    return validation.isValid;
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) return;

    setSubmitting(true);
    try {
      const dateField = fields.find(f => f.type === 'date');
      const hoursField = fields.find(f => f.key.includes('hours'));
      const descriptionField = fields.find(f => f.type === 'textarea' && !f.key.includes('internal'));

      // Create TimeEntry
      const timeEntry = await base44.entities.TimeEntry.create({
        client_id: clientId,
        date: formData[dateField?.key],
        duration_minutes: Math.round(
          (formData[hoursField?.key] || 0) * 60
        ),
        category: selectedType,
        entry_type_id: selectedTypeId,
        entry_type_code: selectedType,
        description: formData[descriptionField?.key] || "",
      });

      // Build field answers
      const fieldValues = {};
      fields.forEach((field) => {
        if (formData[field.key] !== undefined && formData[field.key] !== "") {
          fieldValues[field.key] = formData[field.key];
        }
      });

      // Submit field answers with schema snapshot
      const submitResult = await submitFieldAnswers(
        base44,
        timeEntry.id,
        selectedTypeId,
        selectedType,
        fieldValues,
        { userId: null }
      );

      if (!submitResult.success) {
        throw new Error(submitResult.errors?.[0] || 'Failed to save field answers');
      }

      toast.success(`Entry saved successfully${submitResult.data.required_fields_complete ? ' (ready for report)' : ' (incomplete)'}`);
      if (onSuccess) onSuccess(timeEntry);

      // Reset
      setStep("select_type");
      setSelectedType(null);
      setSelectedTypeId(null);
      setFormData({});
      setErrors({});
      setFields([]);
    } catch (e) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // STEP 1: SELECT ENTRY TYPE
  if (step === "select_type") {
    if (loadingEntryTypes) {
      return (
        <Card className="p-6 flex items-center justify-center min-h-48">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading entry types...</p>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Step 1: Select Entry Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entryTypes.map((type) => (
            <button
              key={type.id || type.code}
              onClick={() => {
                setSelectedType(type.code);
                setSelectedTypeId(type.id || type.code);
                setStep("enter_data");
              }}
              className={cn(
                "p-4 text-left rounded-lg border-2 transition-all",
                "hover:border-blue-500 hover:bg-blue-50"
              )}
              style={{
                borderColor: selectedType === type.code ? (type.color || "#3B82F6") : "rgb(226, 232, 240)"
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{type.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                  {type.usor_form && (
                    <p className="text-xs text-blue-600 mt-1 font-medium">{type.usor_form} Report</p>
                  )}
                </div>
                <div
                  className="w-3 h-3 rounded-full border-2 shrink-0 mt-1"
                  style={{
                    borderColor: type.color || "#3B82F6",
                    backgroundColor: selectedType === type.code ? (type.color || "#3B82F6") : "transparent",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // STEP 2: ENTER DATA
  if (step === "enter_data" && config) {
    if (loadingFields) {
      return (
        <Card className="p-6 flex items-center justify-center min-h-48">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading form fields...</p>
          </div>
        </Card>
      );
    }

    const groupedFields = {};
    fields.forEach((field) => {
      const section = field.section || "Other";
      if (!groupedFields[section]) groupedFields[section] = [];
      groupedFields[section].push(field);
    });

    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{config.name} Entry</h3>
          <button
            onClick={() => {
              setStep("select_type");
              setFields([]);
            }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Change Type
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedFields).map(([section, sectionFields]) => (
            <div key={section} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{section}</h4>
              <div className="space-y-3">
                {sectionFields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={formData[field.key] || ""}
                    error={errors[field.key]}
                    onChange={(val) => handleFieldChange(field.key, val)}
                    showCondition={!field.conditional_key || formData[field.conditional_key]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => {
            setStep("select_type");
            setFields([]);
          }} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() => {
              if (validateStep()) setStep("review");
            }}
            className="flex-1"
          >
            Review <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  // STEP 3: REVIEW
  if (step === "review" && config) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Review & Submit</h3>

        <div className="space-y-3 bg-slate-50 rounded-lg p-4">
          <p className="font-semibold text-sm">{config.name}</p>
          {fields.map((field) => {
            const value = formData[field.key];
            if (!value) return null;

            return (
              <div key={field.key} className="flex items-start justify-between text-sm">
                <span className="text-slate-600">{field.label}</span>
                <span className="font-medium text-slate-900 text-right max-w-xs">
                  {Array.isArray(value) ? value.join(", ") : String(value).substring(0, 50)}
                  {String(value).length > 50 ? "..." : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep("enter_data")} className="flex-1">
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {submitting ? "Saving..." : "Save Entry"}
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}

// Field Input Component
function FieldInput({ field, value, error, onChange, showCondition = true }) {
  if (!showCondition) return null;

  const baseProps = {
    value,
    onChange: (e) => onChange(e.target.value),
    className: error ? "border-red-500" : "",
    disabled: field.read_only,
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {(field.type === "text" || !field.type) && <Input {...baseProps} placeholder={field.placeholder} />}

      {field.type === "number" && (
        <Input {...baseProps} type="number" step={field.step || "1"} placeholder={field.placeholder} />
      )}

      {field.type === "date" && <Input {...baseProps} type="date" />}

      {field.type === "textarea" && (
        <Textarea
          {...baseProps}
          placeholder={field.placeholder}
          className={`resize-none min-h-[80px] ${error ? "border-red-500" : ""}`}
        />
      )}

      {field.type === "boolean" && (
        <div className="flex items-center gap-2">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
          <Label className="text-xs cursor-pointer">{field.label}</Label>
        </div>
      )}

      {field.type === "select" && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={error ? "border-red-500" : ""}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <SelectItem key={optValue} value={optValue}>
                  {optLabel}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {field.type === "multiselect" && (
        <Select value={Array.isArray(value) ? value[0] : value} onValueChange={onChange}>
          <SelectTrigger className={error ? "border-red-500" : ""}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <SelectItem key={optValue} value={optValue}>
                  {optLabel}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {field.help_text && <p className="text-xs text-slate-500">{field.help_text}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}