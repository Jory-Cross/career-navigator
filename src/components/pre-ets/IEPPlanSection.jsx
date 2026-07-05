import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, Edit2, Save, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * IEP plan section backed by the scoped Pre-ETS IEP route.
 */
export default function IEPPlanSection({ clientId, isStaff }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const {
    data: iepPlanData = { plan: null },
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["authorizedPreEtsIepPlan", clientId],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "manageAuthorizedPreEtsIepPlanV2",
        {
          action: "get_plan",
          client_id: clientId,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "The IEP plan could not be loaded."
        );
      }

      return data;
    },
    enabled: !!clientId,
    refetchOnMount: "always",
  });

  const plan = iepPlanData?.plan || null;

  const startEdit = () => {
    setForm(plan || {});
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);

    try {
      const response = await base44.functions.invoke(
        "manageAuthorizedPreEtsIepPlanV2",
        {
          action: "save_plan",
          client_id: clientId,
          plan: form,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "The IEP plan could not be saved."
        );
      }

      await refetch();
      setEditing(false);
      toast.success(data?.message || "IEP plan saved.");
    } catch (saveError) {
      const errorData =
        saveError?.response?.data?.data ??
        saveError?.response?.data ??
        saveError?.data ??
        {};

      toast.error(
        errorData?.error ||
          saveError?.message ||
          "The IEP plan could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const f = (key) => form[key] || "";
  const set = (key, val) => setForm((current) => ({ ...current, [key]: val }));

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center text-sm text-slate-500">
          Loading IEP plan...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center text-sm text-red-700">
          {error.message || "The IEP plan could not be loaded."}
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-indigo-600" /> IEP & Transition Plan
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">School Name</Label>
              <Input value={f("school_name")} onChange={(event) => set("school_name", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Grade Level</Label>
              <Input value={f("grade_level")} onChange={(event) => set("grade_level", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Disability Category</Label>
              <Input value={f("disability_category")} onChange={(event) => set("disability_category", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">VR / School Counselor Name</Label>
              <Input value={f("counselor_name")} onChange={(event) => set("counselor_name", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Counselor Email</Label>
              <Input type="email" value={f("counselor_email")} onChange={(event) => set("counselor_email", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">IEP Date</Label>
              <Input type="date" value={f("iep_date")} onChange={(event) => set("iep_date", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Next Review Date</Label>
              <Input type="date" value={f("next_review_date")} onChange={(event) => set("next_review_date", event.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Strengths & Interests</Label>
            <Textarea value={f("strengths")} onChange={(event) => set("strengths", event.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Areas Requiring Support</Label>
            <Textarea value={f("areas_of_support")} onChange={(event) => set("areas_of_support", event.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Post-Secondary Goals (Employment / Education)</Label>
            <Textarea value={f("post_secondary_goals")} onChange={(event) => set("post_secondary_goals", event.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Transition Planning Goals</Label>
            <Textarea value={f("transition_goals")} onChange={(event) => set("transition_goals", event.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Workplace Accommodations Needed</Label>
            <Textarea value={f("accommodation_notes")} onChange={(event) => set("accommodation_notes", event.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">No IEP plan on file</p>
          {isStaff && (
            <Button size="sm" className="mt-4" onClick={startEdit}>
              <Edit2 className="mr-1 h-3.5 w-3.5" /> Create IEP Plan
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const Field = ({ label, value }) => value ? (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  ) : null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-indigo-600" /> IEP & Transition Plan
          </CardTitle>
          {isStaff && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-indigo-50 p-4 md:grid-cols-3">
          <Field label="School" value={plan.school_name} />
          <Field label="Grade Level" value={plan.grade_level} />
          <Field label="Disability Category" value={plan.disability_category} />
          <Field label="Counselor" value={plan.counselor_name} />
          <Field label="Counselor Email" value={plan.counselor_email} />
          <Field label="IEP Date" value={plan.iep_date ? format(new Date(plan.iep_date), "MMMM d, yyyy") : null} />
          {plan.next_review_date && (
            <div className="col-span-full rounded border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">
              📅 Next IEP Review: {format(new Date(plan.next_review_date), "MMMM d, yyyy")}
            </div>
          )}
        </div>

        {plan.strengths && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">Strengths & Interests</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{plan.strengths}</p>
          </div>
        )}

        {plan.areas_of_support && (
          <div className="rounded-lg bg-orange-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-700">Areas Requiring Support</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{plan.areas_of_support}</p>
          </div>
        )}

        {plan.post_secondary_goals && (
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Post-Secondary Goals</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{plan.post_secondary_goals}</p>
          </div>
        )}

        {plan.transition_goals && (
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-700">Transition Planning Goals</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{plan.transition_goals}</p>
          </div>
        )}

        {plan.accommodation_notes && (
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Workplace Accommodations</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{plan.accommodation_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
