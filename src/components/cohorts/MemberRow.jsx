import React from "react";
import { Mail } from "lucide-react";

/**
 * MemberRow — Phase 6B
 *
 * Read-only display of a single active cohort member (manager or member).
 * No actions — Phase 6B is view-only by spec.
 */
export default function MemberRow({ member, user }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {(user?.full_name || user?.email || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {user?.full_name || "Unknown user"}
          </p>
          {user?.email && (
            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
              <Mail className="w-3 h-3 shrink-0" />
              {user.email}
            </p>
          )}
        </div>
      </div>
      {member.joined_at && (
        <span className="text-xs text-slate-400 whitespace-nowrap">
          Joined {new Date(member.joined_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}