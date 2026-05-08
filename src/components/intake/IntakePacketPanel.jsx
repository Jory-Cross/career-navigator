import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { INTAKE_SECTIONS } from "@/lib/intakeSections";
import IntakeSectionCard from "./IntakeSectionCard";
import IntakeSectionForm from "./IntakeSectionForm";
import IntakeProgressBar from "./IntakeProgressBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IntakePacketPanel({ client, currentUser }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState(null);
  const [showAssignAll, setShowAssignAll] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const formPanelRef = useRef(null);

  const clientId = client?.id;
  const orgId = client?.org_id;

  const loadSections = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const records = await base44.entities.IntakeSection.filter({ client_id: clientId });
      setSections(Array.isArray(records) ? records : []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const getSectionRecord = (key) => sections.find((s) => s.section_key === key);
  const activeSectionDef = INTAKE_SECTIONS.find((s) => s.key === activeKey);
  const activeSectionRecord = activeKey ? getSectionRecord(activeKey) : null;

  const handleAssignAll = async () => {
    setAssigning(true);
    try {
      const now = new Date().toISOString();
      for (const sectionDef of INTAKE_SECTIONS) {
        const existing = getSectionRecord(sectionDef.key);
        if (existing) {
          if (!existing.assigned_to_client) {
            await base44.entities.IntakeSection.update(existing.id, {
              assigned_to_client: true,
              assigned_by: currentUser?.email,
              assigned_at: now,
              status: existing.status === "not_started" ? "assigned" : existing.status,
            });
          }
        } else {
          await base44.entities.IntakeSection.create({
            client_id: clientId,
            org_id: orgId,
            section_key: sectionDef.key,
            section_label: sectionDef.label,
            answers: {},
            status: "assigned",
            assigned_to_client: true,
            assigned_by: currentUser?.email,
            assigned_at: now,
          });
        }
      }
      await loadSections();
    } finally {
      setAssigning(false);
      setShowAssignAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const assignedCount = sections.filter((s) => s.assigned_to_client).length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <IntakeProgressBar sections={sections} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="text-sm text-slate-500">
          {assignedCount} of {INTAKE_SECTIONS.length} sections assigned to client
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAssignAll(true)}
          disabled={assigning}
        >
          <UserCheck className="w-4 h-4 mr-1.5" />
          Assign All to Client
        </Button>
      </div>

      {/* Mobile: open section via sheet */}
      <div className="block lg:hidden">
        <div className="space-y-2">
          {INTAKE_SECTIONS.map((sectionDef) => (
            <IntakeSectionCard
              key={sectionDef.key}
              sectionDef={sectionDef}
              sectionRecord={getSectionRecord(sectionDef.key)}
              isActive={activeKey === sectionDef.key}
              onClick={() => {
                setActiveKey(sectionDef.key);
                setMobileOpen(true);
              }}
            />
          ))}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>{activeSectionDef?.label || ""}</SheetTitle>
            </SheetHeader>
            {activeSectionDef && (
              <IntakeSectionForm
                sectionDef={activeSectionDef}
                sectionRecord={activeSectionRecord}
                clientId={clientId}
                orgId={orgId}
                currentUser={currentUser}
                onSaved={() => {
                  loadSections();
                  setMobileOpen(false);
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: two-panel layout */}
      <div className="hidden lg:flex gap-5" style={{ height: "calc(100vh - 260px)", minHeight: "500px" }}>
        {/* Left nav — independently scrollable */}
        <div className="w-[280px] shrink-0 overflow-y-auto space-y-2 pr-1">
          {INTAKE_SECTIONS.map((sectionDef) => (
            <IntakeSectionCard
              key={sectionDef.key}
              sectionDef={sectionDef}
              sectionRecord={getSectionRecord(sectionDef.key)}
              isActive={activeKey === sectionDef.key}
              onClick={() => {
                setActiveKey(sectionDef.key === activeKey ? null : sectionDef.key);
                if (formPanelRef.current) formPanelRef.current.scrollTop = 0;
              }}
            />
          ))}
        </div>

        {/* Right form panel — scrolls independently, always starts at top */}
        <div ref={formPanelRef} className="flex-1 overflow-y-auto">
          {activeSectionDef ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <IntakeSectionForm
                key={activeKey}
                sectionDef={activeSectionDef}
                sectionRecord={activeSectionRecord}
                clientId={clientId}
                orgId={orgId}
                currentUser={currentUser}
                onSaved={loadSections}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-slate-400 text-sm">← Select a section to start filling it in</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm assign all dialog */}
      <Dialog open={showAssignAll} onOpenChange={setShowAssignAll}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Assign All Sections to Client?</h3>
            <p className="text-sm text-slate-600">
              This will assign all 20 intake sections to the client portal so they can complete them. Sections already assigned will be skipped.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleAssignAll} disabled={assigning}>
                {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Yes, Assign All
              </Button>
              <Button variant="outline" onClick={() => setShowAssignAll(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}