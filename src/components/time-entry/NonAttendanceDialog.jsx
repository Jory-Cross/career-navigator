import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function NonAttendanceDialog({
  open,
  onOpenChange,
  form,
  setForm,
  clients,
  saving,
  onSave,
  onClose,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>No-Show / Cancellation Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Use this to document a client no-show, cancellation, or related staff note. This creates a staff record with 0 hours and does not count toward payroll.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <Select
              value={form.client_id}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, client_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {clients
                  .filter((client) => !client.is_archived)
                  .map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {`${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                        client.full_name ||
                        client.email ||
                        "Unknown"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event Type</label>
              <Select
                value={form.event_type}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, event_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72 overflow-y-auto">
                  <SelectItem value="no_show">No show</SelectItem>
                  <SelectItem value="late_cancellation">Late cancellation</SelectItem>
                  <SelectItem value="excused_cancellation">Excused cancellation</SelectItem>
                  <SelectItem value="transportation_issue">Transportation issue</SelectItem>
                  <SelectItem value="client_unavailable">Client unavailable</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note</label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Example: Client cancelled 20 minutes before scheduled service. Staff attempted contact and documented cancellation."
              className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}