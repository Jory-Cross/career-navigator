import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { INTAKE_SECTIONS, SECTION_STATUS_COLORS, SECTION_STATUS_LABELS } from "@/lib/intakeSections";
import IntakeSectionForm from "./IntakeSectionForm";
import { Loader2, ChevronLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ClientPortalIntakeSection({ client }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);

  const clientId = client?.id;

  const loadSections = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const records = await base44.entities.IntakeSection.filter({ client_id: clientId });
      // Only show sections assigned to client
      const assigned = Array.isArray(records) ? records.filter((r) => r.assigned_to_client) : [];
      setSections(assigned);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const activeSectionDef = INTAKE_SECTIONS.find((s) => s.key === activeKey);
  const activeSectionRecord = activeKey ? sections.find((s) => s.section_key === activeKey) : null;

  const pending = sections.filter((s) => s.status !== "completed" && s.status !== "reviewed");
  const completed = sections.filter((s) => s.status === "completed" || s.status === "reviewed");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-slate-500 text-sm font-medium">No intake forms assigned yet</p>
        <p className="text-slate-400 text-xs">Your specialist will assign forms for you to complete.</p>
      </div>
    );
  }

  if (activeKey && activeSectionDef) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveKey(null)} className="text-slate-600">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Intake Forms
        </Button>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <IntakeSectionForm
            key={activeKey}
            sectionDef={activeSectionDef}
            sectionRecord={activeSectionRecord}
            clientId={clientId}
            orgId={client?.org_id}
            currentUser={null}
            readOnly={false}
            onSaved={() => {
              loadSections();
              setActiveKey(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Intake Forms</h2>
        <p className="text-sm text-slate-500 mt-1">
          Complete the forms assigned by your specialist. Your progress saves automatically.
        </p>
      </div>

      {/* Progress summary */}
      <div className="rounded-xl border bg-indigo-50 border-indigo-100 p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-indigo-800">
            {completed.length} of {sections.length} forms complete
          </div>
          <div className="mt-2 h-2 rounded-full bg-indigo-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${sections.length > 0 ? Math.round((completed.length / sections.length) * 100) : 0}%` }}
            />
          </div>
        </div>
        <div className="text-2xl font-bold text-indigo-600">
          {sections.length > 0 ? Math.round((completed.length / sections.length) * 100) : 0}%
        </div>
      </div>

      {/* Pending forms */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">To Complete</h3>
          {pending.map((record) => {
            const def = INTAKE_SECTIONS.find((s) => s.key === record.section_key);
            if (!def) return null;
            const answerCount = record.answers ? Object.values(record.answers).filter(Boolean).length : 0;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => setActiveKey(record.section_key)}
                className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md hover:border-indigo-300 transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{def.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{def.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{answerCount} of {def.fields.length} fields filled</div>
                    </div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SECTION_STATUS_COLORS[record.status])}>
                    {SECTION_STATUS_LABELS[record.status]}
                  </span>
                </div>
                {/* progress bar */}
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all"
                    style={{ width: `${def.fields.length > 0 ? Math.min(100, Math.round((answerCount / def.fields.length) * 100)) : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Completed forms */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Completed</h3>
          {completed.map((record) => {
            const def = INTAKE_SECTIONS.find((s) => s.key === record.section_key);
            if (!def) return null;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => setActiveKey(record.section_key)}
                className="w-full text-left rounded-xl border border-emerald-100 bg-emerald-50 p-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{def.emoji}</span>
                    <div className="text-sm font-semibold text-emerald-800">{def.label}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                    ✓ {SECTION_STATUS_LABELS[record.status]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}