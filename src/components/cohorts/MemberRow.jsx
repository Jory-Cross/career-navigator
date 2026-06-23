import React from "react";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * MemberRow — Phase 6E
 *
 * Display of a single active cohort member (manager or member).
 * Shows Remove button when appropriate based on permissions and context.
 */
export default function MemberRow({ member, user, onRemove, canRemove }) {
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
      <div className="flex items-center gap-2">
        {member.joined_at && (
          <span className="text-xs text-slate-400 whitespace-nowrap">
            Joined {new Date(member.joined_at).toLocaleDateString()}
          </span>
        )}
        {canRemove && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(member)}
            disabled={!canRemove}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}