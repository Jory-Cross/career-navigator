import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { MapPin, Briefcase, Archive, ArchiveRestore, Mail, UserCheck, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AssignClientDialog from "@/components/clients/AssignClientDialog";
import RestoreClientDialog from "@/components/clients/RestoreClientDialog";
import PermanentDeleteDialog from "@/components/clients/PermanentDeleteDialog";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700"
};

const clientTypeLabels = {
  client: "Client",
  pre_ets: "Pre-ETS",
  dspd: "DSPD",
  employed: "Employed"
};

const clientTypeColors = {
  client: "bg-violet-100 text-violet-700",
  pre_ets: "bg-amber-100 text-amber-700",
  dspd: "bg-teal-100 text-teal-700",
  employed: "bg-green-100 text-green-700"
};

export default function ClientCard({ client, totalHours, applicationCount, onArchiveToggle, canAssign, employees = [] }) {
  const [showAssign, setShowAssign] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [showPermanentDelete, setShowPermanentDelete] = useState(false);
  const [timeEntries, setTimeEntries] = useState([]);

  useEffect(() => {
    const fetchTimeEntries = async () => {
      try {
        const entries = await base44.entities.TimeEntry.filter({ client_id: client.id });
        setTimeEntries(Array.isArray(entries) ? entries : []);
      } catch {
        setTimeEntries([]);
      }
    };
    fetchTimeEntries();
  }, [client.id]);

  const authStatus = useMemo(() => {
    const status = {};
    
    // Job Coaching calculation (including additional authorizations)
    const jcAuths = [];
    if (Number(client.job_coaching_authorized_hours_total) > 0) {
      jcAuths.push({
        authorized_hours: Number(client.job_coaching_authorized_hours_total),
        start_date: client.job_coaching_auth_start_date || "",
      });
    }
    const jcAdditionalAuths = Array.isArray(client.job_coaching_additional_auths) ? client.job_coaching_additional_auths : [];
    jcAuths.push(...jcAdditionalAuths);
    
    let jcTotalAuthorized = jcAuths.reduce((sum, a) => sum + Number(a.authorized_hours || 0), 0);
    
    if (jcTotalAuthorized > 0) {
      // Filter entries by earliest authorization start_date (like AuthorizationHoursCards does)
      const startDates = jcAuths.map(a => a.start_date).filter(Boolean).sort();
      const earliestStart = startDates[0] || null;
      
      const jcUsedMinutes = timeEntries
        .filter(e => {
          const code = (e.entry_type_code || "").toLowerCase();
          if (code !== "job_coaching") return false;
          if (!e.date) return true;
          if (earliestStart && e.date < earliestStart) return false;
          return true;
        })
        .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
      const jcUsedHours = jcUsedMinutes / 60;
      const jcRemaining = jcTotalAuthorized - jcUsedHours;
      status.jobCoaching = {
        authorized: jcTotalAuthorized,
        remaining: parseFloat(jcRemaining.toFixed(2)),
        isLow: jcRemaining > 0 && jcRemaining <= 10,
        isExhausted: jcRemaining <= 0
      };
    }
    
    // Life Skills calculation (overall total, not monthly reset)
    let lsTotalAuthorized = Number(client.life_skills_authorized_hours_total) || 0;
    const lsAdditionalAuths = Array.isArray(client.life_skills_additional_auths) ? client.life_skills_additional_auths : [];
    for (const auth of lsAdditionalAuths) {
      lsTotalAuthorized += Number(auth.authorized_hours || 0);
    }
    
    if (lsTotalAuthorized > 0) {
      const lsUsedMinutes = timeEntries
        .filter(e => (e.entry_type_code || "").toLowerCase() === "life_skills")
        .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
      const lsUsedHours = lsUsedMinutes / 60;
      const lsRemaining = lsTotalAuthorized - lsUsedHours;
      status.lifeSkills = {
        authorized: lsTotalAuthorized,
        remaining: parseFloat(lsRemaining.toFixed(2)),
        isLow: lsRemaining > 0 && lsRemaining <= 10,
        isExhausted: lsRemaining <= 0
      };
    }
    
    // DSPD monthly calculation (resets each month)
    const dspdMonthlyAuthorized = Number(client.dspd_monthly_authorized_hours) || 0;
    if (dspdMonthlyAuthorized > 0) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const dspdUsedMinutes = timeEntries
        .filter(e => {
          const code = (e.entry_type_code || "").toLowerCase();
          if (code !== "dspd") return false;
          if (!e.date) return false;
          const entryDate = new Date(e.date);
          return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
        })
        .reduce((sum, e) => sum + Number(e.duration_minutes || 0), 0);
      const dspdUsedHours = dspdUsedMinutes / 60;
      const dspdRemaining = dspdMonthlyAuthorized - dspdUsedHours;
      status.dspd = {
        authorized: dspdMonthlyAuthorized,
        remaining: parseFloat(dspdRemaining.toFixed(2)),
        isExhausted: dspdRemaining <= 0
      };
    }
    
    return status;
  }, [client.job_coaching_authorized_hours_total, client.job_coaching_auth_start_date, client.job_coaching_additional_auths, client.life_skills_authorized_hours_total, client.life_skills_additional_auths, client.dspd_monthly_authorized_hours, timeEntries]);

  // Archive active client (soft delete)
  const handleArchive = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await base44.entities.Client.update(client.id, { is_archived: true });
      toast.success("Client archived");
      if (onArchiveToggle) onArchiveToggle();
    } catch {
      toast.error("Failed to archive client");
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await base44.functions.invoke('inviteClient', {
        email: client.email,
        firstName: client.first_name,
        clientId: client.id
      });
      toast.success("Invitation sent to " + client.email);
    } catch {
      toast.error("Failed to send invitation");
    }
  };

  const stopProp = (e) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className="relative group/card">
      <Link to={createPageUrl("ClientDetail") + `?id=${client.id}`}>
        <Card className={cn(
          "border-0 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden",
          client.is_archived && "opacity-70 bg-slate-50"
        )}>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {client.first_name?.[0]}{client.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                    {client.first_name} {client.last_name}
                  </h3>
                  {client.is_archived && (
                    <Badge className="text-[10px] border-0 bg-slate-200 text-slate-600 shrink-0">Archived</Badge>
                  )}
                  {!client.is_archived && (
                    <Badge className={cn("text-[10px] border-0 shrink-0", statusColors[client.status])}>
                      {client.status}
                    </Badge>
                  )}
                  {client.client_type && client.client_type !== 'client' && (
                    <Badge className={cn("text-[10px] border-0 shrink-0", clientTypeColors[client.client_type])}>
                      {clientTypeLabels[client.client_type]}
                    </Badge>
                  )}
                </div>
                {client.target_role && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {client.target_role}
                  </p>
                )}
                {client.location && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {client.location}
                  </p>
                )}
              </div>
            </div>

            {/* Authorization Hours Status */}
            {(authStatus.jobCoaching || authStatus.lifeSkills || authStatus.dspd) && (
              <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
                {authStatus.jobCoaching && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                    authStatus.jobCoaching.isExhausted
                      ? "bg-red-50 text-red-700"
                      : authStatus.jobCoaching.isLow
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-600"
                  )}>
                    {authStatus.jobCoaching.isExhausted || authStatus.jobCoaching.isLow ? (
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                    ) : null}
                    <span className="font-medium">Job Coaching:</span>
                    <span>{authStatus.jobCoaching.remaining}h remaining</span>
                  </div>
                )}
                {authStatus.lifeSkills && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                    authStatus.lifeSkills.isExhausted
                      ? "bg-red-50 text-red-700"
                      : authStatus.lifeSkills.isLow
                      ? "bg-amber-50 text-amber-700"
                      : "text-slate-600"
                  )}>
                    {authStatus.lifeSkills.isExhausted || authStatus.lifeSkills.isLow ? (
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                    ) : null}
                    <span className="font-medium">Life Skills:</span>
                    <span>{authStatus.lifeSkills.remaining}h remaining</span>
                  </div>
                )}
                {authStatus.dspd && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                    authStatus.dspd.isExhausted
                      ? "bg-red-50 text-red-700"
                      : "text-slate-600"
                  )}>
                    {authStatus.dspd.isExhausted ? (
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                    ) : null}
                    <span className="font-medium">DSPD Monthly:</span>
                    <span>{authStatus.dspd.remaining}h remaining</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </Link>

      {/* Action buttons — appear on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
        {!client.is_archived ? (
          // ── ACTIVE CLIENT ACTIONS ──
          <>
            <Button
              variant="ghost" size="icon"
              onClick={handleInvite}
              className="bg-white/80 backdrop-blur-sm hover:bg-white"
              title="Send invitation email"
            >
              <Mail className="w-4 h-4 text-blue-600" />
            </Button>
            {canAssign && (
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { stopProp(e); setShowAssign(true); }}
                className="bg-white/80 backdrop-blur-sm hover:bg-white"
                title="Assign to employee"
              >
                <UserCheck className="w-4 h-4 text-purple-600" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon"
              onClick={handleArchive}
              className="bg-white/80 backdrop-blur-sm hover:bg-white"
              title="Archive client"
            >
              <Archive className="w-4 h-4 text-slate-500" />
            </Button>
          </>
        ) : (
          // ── ARCHIVED CLIENT ACTIONS ──
          <>
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { stopProp(e); setShowRestore(true); }}
              className="bg-white/80 backdrop-blur-sm hover:bg-white"
              title="Restore client"
            >
              <ArchiveRestore className="w-4 h-4 text-emerald-600" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { stopProp(e); setShowPermanentDelete(true); }}
              className="bg-white/80 backdrop-blur-sm hover:bg-white"
              title="Permanently delete client"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </>
        )}
      </div>

      {showAssign && (
        <AssignClientDialog
          open={showAssign}
          onOpenChange={setShowAssign}
          client={client}
          onAssigned={onArchiveToggle}
        />
      )}

      <RestoreClientDialog
        open={showRestore}
        onOpenChange={setShowRestore}
        client={client}
        onRestored={() => { setShowRestore(false); if (onArchiveToggle) onArchiveToggle(); }}
      />

      <PermanentDeleteDialog
        open={showPermanentDelete}
        onOpenChange={setShowPermanentDelete}
        client={client}
        onDeleted={() => { if (onArchiveToggle) onArchiveToggle(); }}
      />
    </div>
  );
}