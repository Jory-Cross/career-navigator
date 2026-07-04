import React from "react";
import { Link } from "react-router-dom";
import { Users, Clock } from "lucide-react";

/**
 * Dashboard narrowed during the security remediation freeze.
 *
 * The legacy dashboard directly listed organization-wide Client,
 * JobApplication, Task, and TimeEntry records in the browser. Restore summary
 * widgets only after organization-scoped server aggregate routes exist.
 */
export default function Dashboard() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dashboard summaries are temporarily unavailable while security remediation is in progress.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/TimeTracking"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <Clock className="h-5 w-5 text-slate-700" />
          <h2 className="mt-3 font-semibold text-slate-900">Time Tracking</h2>
          <p className="mt-1 text-sm text-slate-600">
            Record and review time through the authorized TimeEntry workflow.
          </p>
        </Link>

        <Link
          to="/Clients"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <Users className="h-5 w-5 text-slate-700" />
          <h2 className="mt-3 font-semibold text-slate-900">Clients</h2>
          <p className="mt-1 text-sm text-slate-600">
            Continue to the client workspace through its scoped access controls.
          </p>
        </Link>
      </section>
    </main>
  );
}
