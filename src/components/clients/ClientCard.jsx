import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Clock, Archive, ArchiveRestore, Mail, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AssignClientDialog from "@/components/clients/AssignClientDialog";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700"
};

export default function ClientCard({ client, totalHours, applicationCount, onArchiveToggle, canAssign, employees = [] }) {
  const [showAssign, setShowAssign] = useState(false);
  const handleArchiveToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await base44.entities.Client.update(client.id, { is_archived: !client.is_archived });
      toast.success(client.is_archived ? "Client restored" : "Client archived");
      if (onArchiveToggle) onArchiveToggle();
    } catch (error) {
      toast.error("Failed to update client");
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
    } catch (error) {
      toast.error("Failed to send invitation");
    }
  };

  return (
    <div className="relative group/card">
      <Link to={createPageUrl("ClientDetail") + `?id=${client.id}`}>
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {client.first_name?.[0]}{client.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                  {client.first_name} {client.last_name}
                </h3>
                <Badge className={cn("text-[10px] border-0 shrink-0", statusColors[client.status])}>
                  {client.status}
                </Badge>
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

          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{totalHours || 0}h logged</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Briefcase className="w-3 h-3" />
              <span>{applicationCount || 0} applications</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleInvite}
        className="bg-white/80 backdrop-blur-sm hover:bg-white"
        title="Send invitation email"
      >
        <Mail className="w-4 h-4 text-blue-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleArchiveToggle}
        className="bg-white/80 backdrop-blur-sm hover:bg-white"
      >
        {client.is_archived ? (
          <ArchiveRestore className="w-4 h-4 text-emerald-600" />
        ) : (
          <Archive className="w-4 h-4 text-slate-500" />
        )}
      </Button>
    </div>
  </div>
  );
}