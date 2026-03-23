import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Briefcase, FileText, ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import TrainingProgressReportForm from "@/components/pre-ets/TrainingProgressReportForm";

export default function PreEtsEmployerPortal() {
  const [user, setUser] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Fetch only clients assigned to this employer
  const { data: assignedClients = [] } = useQuery({
    queryKey: ["employer-clients", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list();
      return all.filter(c => c.assigned_employer_id === user.id && c.client_type === "pre_ets");
    },
    enabled: !!user
  });

  const activeClient = assignedClients.find(c => c.id === selectedClientId);

  // WBLE forms for selected client
  const { data: wbleForms = [] } = useQuery({
    queryKey: ["employer-wble", selectedClientId],
    queryFn: () => base44.entities.WBLEForm.filter({ client_id: selectedClientId }),
    enabled: !!selectedClientId
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  if (!user || user.role !== "pre_ets_employer") {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-slate-600">Access denied.</p>
      </div>
    );
  }

  // Client list view
  if (!activeClient) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pre-ETS Employer Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome, {user.full_name}. Select a student to view their forms.</p>
        </div>

        {assignedClients.length === 0 ? (
          <Card className="p-12 text-center border-0 shadow-sm">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No students assigned to you yet</p>
            <p className="text-slate-400 text-sm mt-1">Contact your Pre-ETS coordinator to be assigned students.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {assignedClients.map(c => (
              <Card
                key={c.id}
                className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClientId(c.id)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                    <Badge className={cn("mt-1 text-xs", c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600")}>
                      {c.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student detail view — WBLE forms only
  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <div>
        <button
          onClick={() => setSelectedClientId(null)}
          className="text-xs text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Back to student list
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
            {activeClient.first_name[0]}{activeClient.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{activeClient.first_name} {activeClient.last_name}</h1>
            <p className="text-sm text-slate-500">Pre-ETS Student</p>
          </div>
        </div>
      </div>

      {/* WBLE Forms */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-green-600" /> Work-Based Learning Experience Forms
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wbleForms.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No WBLE forms available yet</p>
              <p className="text-xs text-slate-400 mt-1">Forms will appear here when created by the Pre-ETS coordinator.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {wbleForms.map(form => (
                <div key={form.id} className="p-4 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-800">WBLE Agreement</p>
                        <Badge className={cn("text-xs",
                          form.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {form.status}
                        </Badge>
                      </div>
                      {form.employer_name && <p className="text-xs text-slate-600">Employer: {form.employer_name}</p>}
                      <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        {form.start_date && <span>Start: {format(new Date(form.start_date), "MMM d, yyyy")}</span>}
                        {form.end_date && <span>End: {format(new Date(form.end_date), "MMM d, yyyy")}</span>}
                      </div>
                    </div>
                    {form.pdf_url && (
                      <a href={form.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">View PDF</Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for future forms */}
      <Card className="border-0 shadow-sm border-dashed border-2 border-slate-200 bg-slate-50">
        <CardContent className="p-6 text-center">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400 font-medium">More forms coming soon</p>
          <p className="text-xs text-slate-400 mt-1">Additional employer forms will be added here.</p>
        </CardContent>
      </Card>
    </div>
  );
}