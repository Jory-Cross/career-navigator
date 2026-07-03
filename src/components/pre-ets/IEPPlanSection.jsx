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
        "manageAuthorizedPreEtsIepPlan",
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
        "manageAuthorizedPreEtsIepPlan",
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
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (editing) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" /> IEP & Transition Plan
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">School Name</Label>
              <Input value={f("school_name")} onChange={e => set("school_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Grade Level</Label>
              <Input value={f("grade_level")} onChange={e => set("grade_level", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Disability Category</Label>
              <Input value={f("disability_category")} onChange={e => set("disability_category", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">VR / School Counselor Name</Label>
              <Input value={f("counselor_name")} onChange={e => set("counselor_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Counselor Email</Label>
              <Input type="email" value={f("counselor_email")} onChange={e => set("counselor_email", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">IEP Date</Label>
              <Input type="date" value={f("iep_date")} onChange={e => set("iep_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Next Review Date</Label>
              <Input type="date" value={f("next_review_date")} onChange={e => set("next_review_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Strengths & Interests</Label>
            <Textarea value={f("strengths")} onChange={e => set("strengths", e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Areas Requiring Support</Label>
            <Textarea value={f("areas_of_support")} onChange={e => set("areas_of_support", e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Post-Secondary Goals (Employment / Education)</Label>
            <Textarea value={f("post_secondary_goals")} onChange={e => set("post_secondary_goals", e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Transition Planning Goals</Label>
            <Textarea value={f("transition_goals")} onChange={e => set("transition_goals", e.target.value)} rows={3} />
          </div>
          <div>
            <Label className="text-xs">Workplace Accommodations Needed</Label>
            <Textarea value={f("accommodation_notes")} onChange={e => set("accommodation_notes", e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No IEP plan on file</p>
          {isStaff && (
            <Button size="sm" className="mt-4" onClick={startEdit}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Create IEP Plan
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const Field = ({ label, value }) => value ? (
    <div>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  ) : null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" /> IEP & Transition Plan
          </CardTitle>
          {isStaff && (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-indigo-50 rounded-lg">
          <Field label="School" value={plan.school_name} />
          <Field label="Grade Level" value={plan.grade_level} />
          <Field label="Disability Category" value={plan.disability_category} />
          <Field label="Counselor" value={plan.counselor_name} />
          <Field label="Counselor Email" value={plan.counselor_email} />
          <Field label="IEP Date" value={plan.iep_date ? format(new Date(plan.iep_date), "MMMM d, yyyy") : null} />
          {plan.next_review_date && (
            <div className="col-span-full p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium">
              📅 Next IEP Review: {format(new Date(plan.next_review_date), "MMMM d, yyyy")}
            </div>
          )}
        </div>

        {plan.strengths && (
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Strengths & Interests</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{plan.strengths}</p>
          </div>
        )}

        {plan.areas_of_support && (
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Areas Requiring Support</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{plan.areas_of_support}</p>
          </div>
        )}

        {plan.post_secondary_goals && (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Post-Secondary Goals</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{plan.post_secondary_goals}</p>
          </div>
        )}

        {plan.transition_goals && (
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Transition Planning Goals</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{plan.transition_goals}</p>
          </div>
        )}

        {plan.accommodation_notes && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Workplace Accommodations</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{plan.accommodation_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
