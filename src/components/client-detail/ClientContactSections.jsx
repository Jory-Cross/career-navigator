import React, { useState } from "react";
import { ChevronDown, ChevronRight, Users, UserCheck, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Section({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700 flex-1">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-28 shrink-0">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

// Read-only view
export function ClientContactSectionsView({ client }) {
  const hasGuardian = client.guardian_name || client.guardian_phone || client.guardian_email;
  const hasSupportStaff = client.support_staff_name || client.support_staff_phone || client.support_staff_email;
  const hasEmployment = client.workplace_name || client.supervisor_name || client.employment_start_date;
  const isEmployed = client.client_type === "employed";

  if (!hasGuardian && !hasSupportStaff && !hasEmployment) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
      {hasGuardian && (
        <Section icon={Users} title="Parent / Guardian">
          <div className="space-y-1.5">
            <InfoRow label="Name" value={client.guardian_name} />
            <InfoRow label="Phone" value={client.guardian_phone} />
            <InfoRow label="Email" value={client.guardian_email} />
          </div>
        </Section>
      )}
      {hasSupportStaff && (
        <Section icon={UserCheck} title="Support Staff">
          <div className="space-y-1.5">
            <InfoRow label="Name" value={client.support_staff_name} />
            <InfoRow label="Phone" value={client.support_staff_phone} />
            <InfoRow label="Email" value={client.support_staff_email} />
          </div>
        </Section>
      )}
      {isEmployed && hasEmployment && (
        <Section icon={Building2} title="Employment Details">
          <div className="space-y-1.5">
            <InfoRow label="Employer" value={client.workplace_name} />
            <InfoRow label="Address" value={client.workplace_address} />
            <InfoRow label="Start Date" value={client.employment_start_date} />
            <InfoRow label="Supervisor" value={client.supervisor_name} />
            <InfoRow label="Sup. Phone" value={client.supervisor_phone} />
            <InfoRow label="Sup. Email" value={client.supervisor_email} />
          </div>
        </Section>
      )}
    </div>
  );
}

// Edit form fields
export function ClientContactSectionsEdit({ form, onChange, clientType }) {
  const u = (f, v) => onChange(f, v);

  return (
    <div className="space-y-4 pt-2">
      {/* Parent / Guardian */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Parent / Guardian
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.guardian_name || ""} onChange={e => u("guardian_name", e.target.value)} placeholder="Full Name" />
          <Input value={form.guardian_phone || ""} onChange={e => u("guardian_phone", e.target.value)} placeholder="Phone" />
          <Input value={form.guardian_email || ""} onChange={e => u("guardian_email", e.target.value)} placeholder="Email" className="col-span-2" />
        </div>
      </div>

      {/* Support Staff */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5" /> Support Staff
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.support_staff_name || ""} onChange={e => u("support_staff_name", e.target.value)} placeholder="Full Name" />
          <Input value={form.support_staff_phone || ""} onChange={e => u("support_staff_phone", e.target.value)} placeholder="Phone" />
          <Input value={form.support_staff_email || ""} onChange={e => u("support_staff_email", e.target.value)} placeholder="Email" className="col-span-2" />
        </div>
      </div>

      {/* Employment Details - employed only */}
      {clientType === "employed" && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> Employment Details
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input value={form.workplace_name || ""} onChange={e => u("workplace_name", e.target.value)} placeholder="Employer Name" />
            <Input value={form.employment_start_date || ""} onChange={e => u("employment_start_date", e.target.value)} placeholder="Start Date (YYYY-MM-DD)" type="date" />
            <Input value={form.workplace_address || ""} onChange={e => u("workplace_address", e.target.value)} placeholder="Workplace Address" className="col-span-2" />
            <Input value={form.supervisor_name || ""} onChange={e => u("supervisor_name", e.target.value)} placeholder="Supervisor Name" />
            <Input value={form.supervisor_phone || ""} onChange={e => u("supervisor_phone", e.target.value)} placeholder="Supervisor Phone" />
            <Input value={form.supervisor_email || ""} onChange={e => u("supervisor_email", e.target.value)} placeholder="Supervisor Email" className="col-span-2" />
          </div>
        </div>
      )}
    </div>
  );
}