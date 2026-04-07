import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, User, ChevronDown, ChevronUp, Check } from "lucide-react";

// Color palette for team members
export const USER_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
];

export const USER_BLOCK_COLORS = [
  { bg: "bg-blue-500 text-white border-blue-600", dot: "bg-blue-500" },
  { bg: "bg-emerald-500 text-white border-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-purple-500 text-white border-purple-600", dot: "bg-purple-500" },
  { bg: "bg-amber-500 text-white border-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-500 text-white border-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-500 text-white border-cyan-600", dot: "bg-cyan-500" },
  { bg: "bg-indigo-500 text-white border-indigo-600", dot: "bg-indigo-500" },
  { bg: "bg-orange-500 text-white border-orange-600", dot: "bg-orange-500" },
];

/**
 * Props:
 *  user           - current auth user
 *  calendarMode   - "mine" | "team" | "custom"
 *  setCalendarMode
 *  selectedUserIds - Set of user IDs whose calendars are shown (for "custom")
 *  setSelectedUserIds
 *  teamUsers      - array of subordinate User objects (loaded on demand)
 *  loadingTeam    - boolean
 */
export default function CalendarViewSelector({
  user,
  calendarMode,
  setCalendarMode,
  selectedUserIds,
  setSelectedUserIds,
  teamUsers,
  loadingTeam,
}) {
  const [open, setOpen] = useState(false);
  const isPrivileged = user?.role === "admin" || user?.role === "management";

  if (!isPrivileged) return null;

  const toggleUser = (uid) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedUserIds(new Set(teamUsers.map((u) => u.id)));
  };

  const clearAll = () => {
    setSelectedUserIds(new Set());
  };

  return (
    <div className="relative">
      {/* Mode buttons */}
      <div className="flex items-center gap-2">
        <div className="flex border border-slate-200 rounded-md overflow-hidden">
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors",
              calendarMode === "mine"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => { setCalendarMode("mine"); setOpen(false); }}
          >
            <User className="w-3.5 h-3.5" /> My Calendar
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-xs font-medium border-l transition-colors",
              calendarMode === "team"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => { setCalendarMode("team"); setOpen(false); }}
          >
            <Users className="w-3.5 h-3.5" /> Team View
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 text-xs font-medium border-l transition-colors",
              calendarMode === "custom"
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => { setCalendarMode("custom"); setOpen(o => !o); }}
          >
            Custom
            {calendarMode === "custom" && selectedUserIds.size > 0 && (
              <Badge className="ml-1 h-4 min-w-[16px] px-1 text-[10px] bg-blue-500 text-white border-0">
                {selectedUserIds.size}
              </Badge>
            )}
            {calendarMode === "custom"
              ? <ChevronUp className="w-3 h-3 ml-0.5" />
              : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Custom dropdown */}
      {calendarMode === "custom" && open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-64 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600">Select Team Members</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">All</button>
                <span className="text-slate-300">|</span>
                <button onClick={clearAll} className="text-xs text-slate-500 hover:underline">None</button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {loadingTeam ? (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">Loading team...</div>
              ) : teamUsers.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">No team members found</div>
              ) : (
                teamUsers.map((u, idx) => {
                  const colorDot = USER_BLOCK_COLORS[idx % USER_BLOCK_COLORS.length].dot;
                  const isSelected = selectedUserIds.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorDot)} />
                      <span className="flex-1 text-sm text-slate-700 truncate">
                        {u.full_name || u.email}
                        <span className="text-xs text-slate-400 ml-1 capitalize">({u.role})</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                onClick={() => setOpen(false)}
                className="w-full text-xs text-center text-slate-500 hover:text-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}