import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Circle, Plus, Mail, Loader2, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusColors = {
  pending: "text-slate-400",
  in_progress: "text-blue-600",
  completed: "text-green-600",
  skipped: "text-slate-300"
};

export default function OnboardingSection({ client, onRefresh }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [form, setForm] = useState({
    step_name: "",
    step_type: "custom",
    order: 0
  });

  useEffect(() => {
    loadSteps();
  }, [client.id]);

  const loadSteps = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.OnboardingStep.filter({ client_id: client.id });
      setSteps(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      toast.error("Failed to load onboarding steps");
    } finally {
      setLoading(false);
    }
  };

  const initializeOnboarding = async () => {
    const defaultSteps = [
      { step_name: "Send welcome email", step_type: "custom", order: 1 },
      { step_name: "Collect resume", step_type: "collect_resume", order: 2 },
      { step_name: "Complete client profile", step_type: "setup_profile", order: 3 },
      { step_name: "Initial consultation meeting", step_type: "initial_consultation", order: 4 },
      { step_name: "Discuss career goals", step_type: "discuss_goals", order: 5 }
    ];

    try {
      for (const step of defaultSteps) {
        await base44.entities.OnboardingStep.create({
          client_id: client.id,
          ...step
        });
      }
      await base44.entities.Client.update(client.id, {
        onboarding_status: "in_progress",
        onboarding_started_date: format(new Date(), "yyyy-MM-dd")
      });
      toast.success("Onboarding initialized");
      loadSteps();
      onRefresh();
    } catch (error) {
      toast.error("Failed to initialize onboarding");
    }
  };

  const toggleStep = async (step) => {
    const newStatus = step.status === "completed" ? "pending" : "completed";
    try {
      await base44.entities.OnboardingStep.update(step.id, {
        status: newStatus,
        completed_date: newStatus === "completed" ? format(new Date(), "yyyy-MM-dd") : null
      });
      
      // Check if all steps are completed
      const updatedSteps = await base44.entities.OnboardingStep.filter({ client_id: client.id });
      const allCompleted = updatedSteps.every(s => s.status === "completed" || s.status === "skipped");
      
      if (allCompleted && client.onboarding_status !== "completed") {
        await base44.entities.Client.update(client.id, {
          onboarding_status: "completed",
          onboarding_completed_date: format(new Date(), "yyyy-MM-dd")
        });
        toast.success("Onboarding completed!");
        onRefresh();
      }
      
      loadSteps();
    } catch (error) {
      toast.error("Failed to update step");
    }
  };

  const addCustomStep = async () => {
    if (!form.step_name) {
      toast.error("Please enter a step name");
      return;
    }
    try {
      await base44.entities.OnboardingStep.create({
        client_id: client.id,
        step_name: form.step_name,
        step_type: form.step_type,
        order: steps.length + 1
      });
      setShowAdd(false);
      setForm({ step_name: "", step_type: "custom", order: 0 });
      loadSteps();
      toast.success("Step added");
    } catch (error) {
      toast.error("Failed to add step");
    }
  };

  const sendEmail = async (emailType) => {
    setSendingEmail(emailType);
    try {
      await base44.functions.invoke('sendOnboardingEmail', {
        client_id: client.id,
        email_type: emailType
      });
      toast.success("Email sent");
    } catch (error) {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  const completedCount = steps.filter(s => s.status === "completed").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">Client Onboarding</h3>
              <Badge className={cn(
                "text-xs",
                client.onboarding_status === "completed" ? "bg-green-100 text-green-700" :
                client.onboarding_status === "in_progress" ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-600"
              )}>
                {client.onboarding_status?.replace(/_/g, " ")}
              </Badge>
            </div>
            {steps.length > 0 && (
              <span className="text-xs text-slate-500">{completedCount}/{steps.length} steps</span>
            )}
          </div>
          
          {steps.length > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 mb-4">No onboarding steps yet</p>
              <Button onClick={initializeOnboarding}>
                <ClipboardList className="w-4 h-4 mr-2" /> Initialize Onboarding
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {steps.map(step => (
                  <div 
                    key={step.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <button 
                      onClick={() => toggleStep(step)}
                      className="mt-0.5"
                    >
                      {step.status === "completed" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className={cn("w-5 h-5", statusColors[step.status])} />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        step.status === "completed" ? "text-slate-500 line-through" : "text-slate-800"
                      )}>
                        {step.step_name}
                      </p>
                      {step.completed_date && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Completed {format(new Date(step.completed_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-xs font-medium text-slate-600 mb-2">Quick Actions:</p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => sendEmail('welcome')}
                    disabled={sendingEmail === 'welcome'}
                  >
                    {sendingEmail === 'welcome' ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Mail className="w-3 h-3 mr-1" />
                    )}
                    Welcome Email
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => sendEmail('request_info')}
                    disabled={sendingEmail === 'request_info'}
                  >
                    {sendingEmail === 'request_info' ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Mail className="w-3 h-3 mr-1" />
                    )}
                    Request Info
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowAdd(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Step
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Onboarding Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Input
                placeholder="Step name"
                value={form.step_name}
                onChange={e => setForm(p => ({ ...p, step_name: e.target.value }))}
              />
            </div>
            <div>
              <Select 
                value={form.step_type} 
                onValueChange={v => setForm(p => ({ ...p, step_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addCustomStep}>Add Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}