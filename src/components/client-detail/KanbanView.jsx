import React from "react";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Target, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const statusConfig = {
  saved: { color: "bg-slate-100 text-slate-600", label: "Saved", headerColor: "bg-slate-50 border-slate-200" },
  applied: { color: "bg-blue-100 text-blue-700", label: "Applied", headerColor: "bg-blue-50 border-blue-200" },
  phone_screen: { color: "bg-cyan-100 text-cyan-700", label: "Phone Screen", headerColor: "bg-cyan-50 border-cyan-200" },
  interview: { color: "bg-violet-100 text-violet-700", label: "Interview", headerColor: "bg-violet-50 border-violet-200" },
  final_round: { color: "bg-amber-100 text-amber-700", label: "Final Round", headerColor: "bg-amber-50 border-amber-200" },
  offer: { color: "bg-emerald-100 text-emerald-700", label: "Offer", headerColor: "bg-emerald-50 border-emerald-200" },
  accepted: { color: "bg-green-100 text-green-700", label: "Accepted", headerColor: "bg-green-50 border-green-200" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected", headerColor: "bg-red-50 border-red-200" },
  withdrawn: { color: "bg-gray-100 text-gray-500", label: "Withdrawn", headerColor: "bg-gray-50 border-gray-200" },
};

const COLUMN_ORDER = ["saved", "applied", "phone_screen", "interview", "final_round", "offer", "accepted", "rejected", "withdrawn"];

export default function KanbanView({ applications, onEdit, onRefresh }) {
  const [dragging, setDragging] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);

  const grouped = COLUMN_ORDER.reduce((acc, status) => {
    acc[status] = applications.filter(a => a.status === status);
    return acc;
  }, {});

  const handleDragStart = (e, app) => {
    setDragging(app);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!dragging || dragging.status === newStatus) {
      setDragging(null);
      setDragOver(null);
      return;
    }
    try {
      await base44.entities.JobApplication.update(dragging.id, { status: newStatus });
      toast.success(`Moved to ${statusConfig[newStatus].label}`);
      onRefresh();
    } catch {
      toast.error("Failed to update status");
    }
    setDragging(null);
    setDragOver(null);
  };

  // Only show columns that have apps, plus a few key empty ones
  const visibleColumns = COLUMN_ORDER.filter(s => grouped[s].length > 0 || ["saved", "applied", "interview", "offer"].includes(s));

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 p-4 min-w-max">
        {visibleColumns.map(status => {
          const cfg = statusConfig[status];
          const apps = grouped[status];
          return (
            <div
              key={status}
              className={cn("w-52 rounded-xl border flex flex-col", cfg.headerColor, dragOver === status && "ring-2 ring-blue-400")}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, status)}
            >
              {/* Column header */}
              <div className={cn("px-3 py-2 border-b flex items-center justify-between", cfg.headerColor)}>
                <span className="text-xs font-semibold text-slate-700">{cfg.label}</span>
                <Badge className={cn("text-[10px] border-0 px-1.5 py-0", cfg.color)}>{apps.length}</Badge>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                {apps.map(app => (
                  <div
                    key={app.id}
                    draggable
                    onDragStart={e => handleDragStart(e, app)}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onClick={() => onEdit(app)}
                    className={cn(
                      "bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:shadow-md transition-all text-xs",
                      dragging?.id === app.id && "opacity-40"
                    )}
                  >
                    <p className="font-semibold text-slate-800 truncate">{app.position}</p>
                    <div className="flex items-center gap-1 mt-1 text-slate-500">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{app.company}</span>
                    </div>
                    {app.location && (
                      <div className="flex items-center gap-1 mt-0.5 text-slate-400">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{app.location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {app.ai_fit_score != null && (
                        <span className={cn(
                          "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded",
                          app.ai_fit_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                          app.ai_fit_score >= 60 ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          <Target className="w-2.5 h-2.5" />{app.ai_fit_score}%
                        </span>
                      )}
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="ml-auto text-slate-300 hover:text-blue-500">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {apps.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-slate-300 italic py-4">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}