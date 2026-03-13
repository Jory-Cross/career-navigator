import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, FileText, MapPin, Briefcase, Plus, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700",
};

function ClientNotes({ client }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(client.notes || "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await base44.entities.Client.update(client.id, { notes });
    queryClient.invalidateQueries({ queryKey: ["dspd-clients"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("Notes saved");
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Add notes about this client..."
        className="min-h-[160px] resize-none"
      />
      <Button onClick={save} size="sm" className="gap-2">
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved" : "Save Notes"}
      </Button>
    </div>
  );
}

function ClientTimeEntries({ clientId }) {
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["time-dspd", clientId],
    queryFn: () => base44.entities.TimeEntry.filter({ client_id: clientId }),
    enabled: !!clientId
  });

  const totalHours = Math.round(timeEntries.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60 * 10) / 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Clock className="w-4 h-4" />
        <span className="font-medium text-slate-800">{totalHours}h</span> total logged
      </div>
      {timeEntries.length === 0 && (
        <p className="text-slate-400 text-sm py-4 text-center">No time entries yet</p>
      )}
      {timeEntries.map(entry => (
        <div key={entry.id} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">{entry.description || "Time logged"}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {entry.category} {entry.date ? `· ${format(new Date(entry.date), "MMM d, yyyy")}` : ""}
            </p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-0 shrink-0 text-xs">
            {Math.round((entry.duration_minutes || 0) / 60 * 10) / 10}h
          </Badge>
        </div>
      ))}
    </div>
  );
}

export default function DspdPortal() {
  const [user, setUser] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ["dspd-clients", user?.id],
    queryFn: async () => {
      const all = await base44.entities.Client.list("-created_date");
      return all.filter(c => c.assigned_employee_id === user.id && !c.is_archived);
    },
    enabled: !!user
  });

  if (selectedClient) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)} className="text-slate-500">
            ← Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{selectedClient.first_name} {selectedClient.last_name}</h1>
            <p className="text-sm text-slate-400">{selectedClient.email}</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Client Info</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {selectedClient.phone && (
              <div><span className="text-slate-400">Phone</span><p className="font-medium text-slate-800">{selectedClient.phone}</p></div>
            )}
            {selectedClient.location && (
              <div><span className="text-slate-400">Location</span><p className="font-medium text-slate-800">{selectedClient.location}</p></div>
            )}
            {selectedClient.target_role && (
              <div><span className="text-slate-400">Target Role</span><p className="font-medium text-slate-800">{selectedClient.target_role}</p></div>
            )}
            {selectedClient.industry && (
              <div><span className="text-slate-400">Industry</span><p className="font-medium text-slate-800">{selectedClient.industry}</p></div>
            )}
            <div>
              <span className="text-slate-400">Status</span>
              <div className="mt-0.5">
                <Badge className={cn("text-xs border-0", statusColors[selectedClient.status])}>{selectedClient.status}</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="time">
          <TabsList className="bg-white border border-slate-200 shadow-sm">
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="time" className="mt-4">
            <Card className="border-0 shadow-sm p-5">
              <ClientTimeEntries clientId={selectedClient.id} />
            </Card>
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <Card className="border-0 shadow-sm p-5">
              <ClientNotes client={selectedClient} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Clients</h1>
        <p className="text-sm text-slate-500 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''} assigned to you</p>
      </div>

      {clients.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No clients assigned yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => (
            <Card
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {client.first_name?.[0]}{client.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 truncate text-sm">{client.first_name} {client.last_name}</h3>
                    <Badge className={cn("text-[10px] border-0 shrink-0", statusColors[client.status])}>{client.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{client.email}</p>
                  {client.target_role && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3" />{client.target_role}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}