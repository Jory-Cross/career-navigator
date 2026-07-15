import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import {
  formatLongEntryDate,
  getEntryDisplayText,
} from "@/lib/timeTrackingHelpers";
import { getEntryTypeLabel } from "@/lib/getEntryTypeLabel";

export default function EntryDetailsDialog({
  selectedEntry,
  onClose,
  getClientName,
  getEntryStaffName,
  resolvedEntryTypeCodes,
  user,
  effectiveUser,
  canMutate,
  handleDeleteEntry,
  handleEditEntry,
  setSelectedEntry,
}) {
  return (
    <Dialog
      open={!!selectedEntry}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Time Entry Details</DialogTitle>
        </DialogHeader>

        {selectedEntry ? (() => {
          const isSelectedNonAttendance =
            selectedEntry.entry_type_code === "client_non_attendance";

          const selectedNonAttendanceLabel =
            selectedEntry.form_data?.event_label ||
            selectedEntry.form_data?.event_type?.replace(/_/g, " ") ||
            "No-show / cancellation";

          return (
            <div className="space-y-4">
              <div>
                <div className="mb-1 text-xs text-slate-500">Client</div>
                <div className="text-sm">
                  {selectedEntry.client_id ? getClientName(selectedEntry.client_id) : "Myself"}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">Date</div>
                <div className="text-sm">{formatLongEntryDate(selectedEntry.date)}</div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">
                  {isSelectedNonAttendance ? "Payroll" : "Duration"}
                </div>
                <div className="text-sm">
                  {isSelectedNonAttendance
                    ? "Not payroll eligible — 0 minutes"
                    : `${selectedEntry.duration_minutes || 0} minutes`}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">
                  {isSelectedNonAttendance ? "Record Type" : "Type"}
                </div>
                <div className="text-sm">
                  {isSelectedNonAttendance
                    ? "Client No-Show / Cancellation"
                    : getEntryTypeLabel(selectedEntry, resolvedEntryTypeCodes)}
                </div>
              </div>

              {isSelectedNonAttendance ? (
                <div>
                  <div className="mb-1 text-xs text-slate-500">Event Type</div>
                  <div className="text-sm capitalize">
                    {selectedNonAttendanceLabel}
                  </div>
                </div>
              ) : null}

              {selectedEntry.start_time || selectedEntry.end_time ? (
                <div>
                  <div className="mb-1 text-xs text-slate-500">Time</div>
                  <div className="text-sm">
                    {selectedEntry.start_time || "—"} - {selectedEntry.end_time || "—"}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-1 text-xs text-slate-500">Description</div>
                <div className="text-sm">{getEntryDisplayText(selectedEntry, "—")}</div>
              </div>

              {selectedEntry.created_by && (user?.role === "admin" || effectiveUser?.role === "management") ? (
                <div>
                  <div className="mb-1 text-xs text-slate-500">Staff</div>
                  <div className="text-sm">{getEntryStaffName(selectedEntry) || selectedEntry.created_by}</div>
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                {canMutate(selectedEntry) ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteEntry(selectedEntry)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Entry
                  </Button>
                ) : (
                  <Badge className="bg-slate-100 text-slate-400">
                    View only
                  </Badge>
                )}

                {!isSelectedNonAttendance ? (
                  canMutate(selectedEntry) ? (
                    <Button
                      onClick={() => {
                        const entry = selectedEntry;
                        setSelectedEntry(null);
                        handleEditEntry(entry);
                      }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700">
                      View only
                    </Badge>
                  )
                ) : (
                  <Badge className="bg-slate-100 text-slate-700">
                    Staff record
                  </Badge>
                )}
              </div>
            </div>
          );
        })() : null}
      </DialogContent>
    </Dialog>
  );
}