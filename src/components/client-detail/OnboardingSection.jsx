import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Textarea,
} from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  Plus,
  Mail,
  Loader2,
  ClipboardList,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  getOnboardingSteps,
  initializeClientOnboarding,
  updateOnboardingStep,
  createOnboardingStep,
  sendOnboardingEmail,
} from "@/lib/api/clientPortalApi";
import InviteClientPortalDialog from "@/components/intake/InviteClientPortalDialog";
import PortalInvitationStatus from "@/components/intake/PortalInvitationStatus";

const statusColors = {
  pending: "text-slate-400",
  in_progress: "text-blue-600",
  completed: "text-green-600",
  skipped: "text-slate-300",
};

function defaultSteps() {
  return [
    { step_name: "Send welcome email", step_type: "custom", order: 1 },
    { step_name: "Collect resume", step_type: "collect_resume", order: 2 },
    { step_name: "Complete client profile", step_type: "setup_profile", order: 3 },
    { step_name: "Initial consultation meeting", step_type: "initial_consultation", order: 4 },
    { step_name: "Discuss career goals", step_type: "discuss_goals", order: 5 },
  ];
}

function emptyForm(nextOrder = 1) {
  return {
    step_name: "",
    step_type: "custom",
    order: nextOrder,
    notes: "",
  };
}

function safeFormatDate(value, pattern = "MMM d, yyyy") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, pattern);
}

export default function OnboardingSection({ client, onRefresh }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showInvitePortal, setShowInvitePortal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [form, setForm] = useState(emptyForm(1));

  const clientId = client?.id;

  const loadSteps = async () => {
    if (!clientId) {
      setSteps([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getOnboardingSteps(clientId);
      setSteps(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load onboarding steps:", error);
      toast.error("Failed to load onboarding steps");
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSteps();
  }, [clientId]);

  const completedCount = useMemo(
    () => steps.filter((s) => s.status === "completed").length,
    [steps]
  );

  const progress = useMemo(() => {
    return steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  }, [completedCount, steps.length]);

  const openAddDialog = () => {
    setForm(emptyForm((steps?.length || 0) + 1));
    setShowAdd(true);
  };

  const closeAddDialog = () => {
    if (savingStep) return;
    setShowAdd(false);
    setForm(emptyForm((steps?.length || 0) + 1));
  };

  const initializeOnboarding = async () => {
    if (!clientId) return;

    setInitializing(true);
    try {
      await initializeClientOnboarding(clientId, defaultSteps());
      toast.success("Onboarding initialized");
      await loadSteps();
      onRefresh?.();
    } catch (error) {
      console.error("Failed to initialize onboarding:", error);
      toast.error("Failed to initialize onboarding");
    } finally {
      setInitializing(false);
    }
  };

  const toggleStep = async (step) => {
    if (!step?.id) return;

    const newStatus = step.status === "completed" ? "pending" : "completed";

    try {
      await updateOnboardingStep(step.id, {
        status: newStatus,
        completed_date:
          newStatus === "completed" ? format(new Date(), "yyyy-MM-dd") : null,
      });

      await loadSteps();
      onRefresh?.();
    } catch (error) {
      console.error("Failed to update step:", error);
      toast.error("Failed to update step");
    }
  };

  const addCustomStep = async () => {
    if (!clientId) return;

    if (!form.step_name?.trim()) {
      toast.error("Please enter a step name");
      return;
    }

    setSavingStep(true);
    try {
      await createOnboardingStep({
        client_id: clientId,
        step_name: form.step_name,
        step_type: form.step_type,
        order: Number(form.order) || steps.length + 1,
        notes: form.notes || "",
      });

      toast.success("Step added");
      closeAddDialog();
      await loadSteps();
    } catch (error) {
      console.error("Failed to add step:", error);
      toast.error("Failed to add step");
    } finally {
      setSavingStep(false);
    }
  };

  const handleSendEmail = async (emailType) => {
    if (!clientId) return;

    setSendingEmail(emailType);
    try {
      await sendOnboardingEmail(clientId, emailType);
      toast.success("Email sent");
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <>
      <Card className="border-slate-100 p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">Client Onboarding</h3>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {(client?.onboarding_status || "not_started").replace(/_/g, " ")}
              </Badge>

              {steps.length > 0 ? (
                <span className="text-sm text-slate-500">
                  {completedCount}/{steps.length} steps
                </span>
              ) : null}
            </div>
          </div>

          {steps.length > 0 ? (
            <div className="min-w-[160px]">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading onboarding...</div>
        ) : steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center space-y-3">
            <p className="text-sm text-slate-500">No onboarding steps yet</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={initializeOnboarding} disabled={initializing}>
                {initializing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  "Initialize Onboarding"
                )}
              </Button>
              <Button
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowInvitePortal(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Invite to Portal
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStep(step)}
                      className="mt-0.5 shrink-0"
                    >
                      {step.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle
                          className={cn(
                            "h-5 w-5",
                            statusColors[step.status] || "text-slate-400"
                          )}
                        />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{step.step_name}</p>
                        <Badge variant="outline" className="capitalize">
                          {(step.step_type || "custom").replace(/_/g, " ")}
                        </Badge>
                      </div>

                      {step.notes ? (
                        <p className="mt-1 text-sm text-slate-500">{step.notes}</p>
                      ) : null}

                      {step.completed_date ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Completed {safeFormatDate(step.completed_date)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handleSendEmail("welcome")}
                disabled={sendingEmail === "welcome"}
              >
                {sendingEmail === "welcome" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Welcome Email
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSendEmail("request_info")}
                disabled={sendingEmail === "request_info"}
              >
                {sendingEmail === "request_info" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Request Info
              </Button>

              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </Button>
              <Button
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowInvitePortal(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Invite to Portal
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Portal invitation status — always visible below the step list */}
      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Portal Access</p>
        <PortalInvitationStatus client={client} />
      </div>

      <InviteClientPortalDialog
        open={showInvitePortal}
        onOpenChange={setShowInvitePortal}
        client={client}
      />

      <Dialog open={showAdd} onOpenChange={(open) => (!open ? closeAddDialog() : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Onboarding Step</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Step Name</label>
              <Input
                value={form.step_name}
                onChange={(e) => setForm((p) => ({ ...p, step_name: e.target.value }))}
                placeholder="Enter step name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Step Type</label>
              <Select
                value={form.step_type}
                onValueChange={(v) => setForm((p) => ({ ...p, step_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select step type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="collect_resume">Collect Resume</SelectItem>
                  <SelectItem value="setup_profile">Setup Profile</SelectItem>
                  <SelectItem value="discuss_goals">Discuss Goals</SelectItem>
                  <SelectItem value="upload_documents">Upload Documents</SelectItem>
                  <SelectItem value="initial_consultation">Initial Consultation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={savingStep}>
              Cancel
            </Button>
            <Button onClick={addCustomStep} disabled={savingStep}>
              {savingStep ? "Adding..." : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}