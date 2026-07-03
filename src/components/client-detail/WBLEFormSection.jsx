import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Download, Loader2, ClipboardList, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

export default function WBLEFormSection({ clientId, client, user }) {
  // Can download if admin, management, or the assigned employee
  const canDownloadReports = user && (
    user.role === 'admin' ||
    user.role === 'management' ||
    (user.role === 'employee' && client?.assigned_employee_id === user.id)
  );
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const openNewForm = () => {
    setFormData({
      employer_name: client?.employer_name || "",
      employer_phone: client?.employer_phone || "",
      employer_address: client?.employer_address || "",
    });
    setShowForm(true);
  };
   const [generatingPdf, setGeneratingPdf] = useState(null);
  const [deletingForm, setDeletingForm] = useState(null);
  const [deletingReport, setDeletingReport] = useState(null);
  const queryClient = useQueryClient();

  const {
    data: wbleWorkspace = {
      wble_forms: [],
      progress_reports: [],
    },
    isLoading,
    error: workspaceError,
  } = useQuery({
    queryKey: ["authorizedPreEtsWbleWorkspace", clientId],
    queryFn: async () => {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsWbleForm",
        {
          action: "get_staff_wble_workspace",
          client_id: clientId,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The WBLE workspace could not be loaded."
        );
      }

      return data;
    },
    enabled: !!clientId,
    refetchOnMount: "always",
  });

  const wbleForms = Array.isArray(wbleWorkspace?.wble_forms)
    ? wbleWorkspace.wble_forms
    : [];

  const progressReports = Array.isArray(
    wbleWorkspace?.progress_reports
  )
    ? wbleWorkspace.progress_reports
    : [];

  const refreshWorkspace = () =>
    queryClient.invalidateQueries({
      queryKey: ["authorizedPreEtsWbleWorkspace", clientId],
    });

  const handleDeleteReport = async (reportId) => {
    if (!confirm("Delete this progress report? This cannot be undone.")) {
      return;
    }

    setDeletingReport(reportId);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsProgressReportManagement",
        {
          action: "delete_staff_progress_report",
          report_id: reportId,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "The progress report could not be deleted."
        );
      }

      await refreshWorkspace();
      toast.success("Report deleted.");
    } catch (err) {
      toast.error(
        err?.message || "The progress report could not be deleted."
      );
    } finally {
      setDeletingReport(null);
    }
  };

  const handleDeleteForm = async (formId) => {
    if (!confirm("Delete this WBLE form? This cannot be undone.")) {
      return;
    }

    setDeletingForm(formId);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsWbleForm",
        {
          action: "delete_staff_wble_form",
          form_id: formId,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "The WBLE form could not be deleted."
        );
      }

      await refreshWorkspace();
      toast.success("Form deleted.");
    } catch (err) {
      toast.error(
        err?.message || "The WBLE form could not be deleted."
      );
    } finally {
      setDeletingForm(null);
    }
  };

  const handleGenerateReportPDF = async (report) => {
    setGeneratingPdf(report.id);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsProgressReportManagement",
        {
          action: "regenerate_staff_progress_report_pdf",
          report_id: report.id,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            "The progress-report PDF could not be generated."
        );
      }

      await refreshWorkspace();
      toast.success("PDF generated.");
    } catch (err) {
      toast.error(
        err?.message || "The progress-report PDF could not be generated."
      );
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const response = await base44.functions.invoke(
        "mutateAuthorizedPreEtsWbleForm",
        {
          action: "create_staff_wble_form",
          client_id: clientId,
          form: formData,
        }
      );

      const data = response?.data ?? response ?? {};

      if (!data?.ok) {
        throw new Error(
          data?.error || "The WBLE form could not be saved."
        );
      }

      await refreshWorkspace();
      setShowForm(false);
      setFormData({});

      toast.success(
        data?.pdf_generated
          ? "WBLE form saved and PDF generated."
          : "WBLE form saved."
      );
    } catch (error) {
      toast.error(
        error?.message || "The WBLE form could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Work Based Learning Experience Forms</CardTitle>
          <Button size="sm" onClick={openNewForm}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New WBLE Form
          </Button>
        </div>
      </CardHeader>
      <CardContent>
                {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : workspaceError ? (
          <div className="py-8 text-center text-sm text-red-700">
            {workspaceError.message ||
              "The WBLE workspace could not be loaded."}
          </div>
        ) : wbleForms.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">No WBLE forms yet</div>
        ) : (
          <div className="space-y-3">
            {wbleForms.map(form => (
              <div key={form.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-slate-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        WBLE Agreement
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Created {format(new Date(form.created_date), "MMM d, yyyy")}
                      </p>
                      {form.start_date && form.end_date && (
                        <p className="text-xs text-slate-600 mt-1">
                          {format(new Date(form.start_date), "MMM d, yyyy")} - {format(new Date(form.end_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {form.pdf_url && (
                      <a href={form.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteForm(form.id)}
                      disabled={deletingForm === form.id}
                    >
                      {deletingForm === form.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Training Progress Reports Section */}
      {progressReports.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">Training Progress Reports (DWS-USOR 72)</p>
          </div>
          <div className="space-y-2">
            {progressReports.map(report => (
              <div key={report.id} className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Progress Report: {report.reporting_period_from && format(new Date(report.reporting_period_from), "MMM d")} – {report.reporting_period_to && format(new Date(report.reporting_period_to), "MMM d, yyyy")}
                    </p>
                    {report.supervisor_name && <p className="text-xs text-slate-500 mt-0.5">Supervisor: {report.supervisor_name}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">Submitted: {format(new Date(report.created_date), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-green-100 text-green-700 text-xs">Submitted</Badge>
                    {canDownloadReports && (
                      report.pdf_url ? (
                        <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs">
                            <Download className="w-3.5 h-3.5" /> PDF
                          </Button>
                        </a>
                      ) : (
                        <Button
                          size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => handleGenerateReportPDF(report)}
                          disabled={generatingPdf === report.id}
                        >
                          {generatingPdf === report.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />
                          }
                          Generate PDF
                        </Button>
                      )
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                      onClick={() => handleDeleteReport(report.id)}
                      disabled={deletingReport === report.id}
                    >
                      {deletingReport === report.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Work Based Learning Experience Form</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* VR Counselor Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3">2. VR Counselor Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Counselor Name</Label>
                  <Input value={formData.vr_counselor_name || ""} onChange={(e) => setFormData({...formData, vr_counselor_name: e.target.value})} />
                </div>
                <div>
                  <Label>Office Phone</Label>
                  <Input value={formData.vr_office_phone || ""} onChange={(e) => setFormData({...formData, vr_office_phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Office Address</Label>
                  <Textarea rows={2} value={formData.vr_office_address || ""} onChange={(e) => setFormData({...formData, vr_office_address: e.target.value})} />
                </div>
                <div>
                  <Label>Fax Number</Label>
                  <Input value={formData.vr_fax || ""} onChange={(e) => setFormData({...formData, vr_fax: e.target.value})} />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input type="email" value={formData.vr_email || ""} onChange={(e) => setFormData({...formData, vr_email: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Employer Information */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">3. Employer Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Employer Name</Label>
                  <Input value={formData.employer_name || ""} onChange={(e) => setFormData({...formData, employer_name: e.target.value})} />
                </div>
                <div>
                  <Label>Office Phone</Label>
                  <Input value={formData.employer_phone || ""} onChange={(e) => setFormData({...formData, employer_phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <Textarea rows={2} value={formData.employer_address || ""} onChange={(e) => setFormData({...formData, employer_address: e.target.value})} />
                </div>
                <div>
                  <Label>Fax Number</Label>
                  <Input value={formData.employer_fax || ""} onChange={(e) => setFormData({...formData, employer_fax: e.target.value})} />
                </div>
                <div>
                  <Label>WBLE Employer Trainer</Label>
                  <Input value={formData.employer_trainer || ""} onChange={(e) => setFormData({...formData, employer_trainer: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Email Address</Label>
                  <Input type="email" value={formData.employer_email || ""} onChange={(e) => setFormData({...formData, employer_email: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Pre-ETS Provider Information */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">4. Pre-ETS Provider Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Specialist Name</Label>
                  <Input value={formData.pre_ets_specialist_name || ""} onChange={(e) => setFormData({...formData, pre_ets_specialist_name: e.target.value})} />
                </div>
                <div>
                  <Label>Office Phone</Label>
                  <Input value={formData.pre_ets_office_phone || ""} onChange={(e) => setFormData({...formData, pre_ets_office_phone: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <Label>Office Address</Label>
                  <Textarea rows={2} value={formData.pre_ets_office_address || ""} onChange={(e) => setFormData({...formData, pre_ets_office_address: e.target.value})} />
                </div>
                <div>
                  <Label>Fax Number</Label>
                  <Input value={formData.pre_ets_fax || ""} onChange={(e) => setFormData({...formData, pre_ets_fax: e.target.value})} />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input type="email" value={formData.pre_ets_email || ""} onChange={(e) => setFormData({...formData, pre_ets_email: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">5 & 6. Work Based Learning Experience Dates</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.start_date || ""} onChange={(e) => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={formData.end_date || ""} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Wages and Training Fee */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">7 & 8. Compensation</h3>
              <div className="space-y-3">
                <div>
                  <Label>Trainee's Wages (payment amount and schedule)</Label>
                  <Textarea rows={2} value={formData.trainee_wages || ""} onChange={(e) => setFormData({...formData, trainee_wages: e.target.value})} placeholder="At least commensurate with the prevailing wage..." />
                </div>
                <div>
                  <Label>Negotiated Training Fee</Label>
                  <Input value={formData.training_fee || ""} onChange={(e) => setFormData({...formData, training_fee: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                "Submit & Generate PDF"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
