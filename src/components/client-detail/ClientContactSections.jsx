import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function displayValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "string") return String(value);
  return value.trim() ? value : "—";
}

export function ClientContactSectionsView({ client }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Phone</Label>
          <div className="mt-1 text-sm text-slate-700">
            {displayValue(client?.phone)}
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <div className="mt-1 text-sm text-slate-700">
            {displayValue(client?.email)}
          </div>
        </div>
      </div>

      <div>
        <Label>Address</Label>
        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
          {displayValue(client?.address)}
        </div>
      </div>

      {client?.client_type === "pre_ets" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>School</Label>
            <div className="mt-1 text-sm text-slate-700">
              {displayValue(client?.school)}
            </div>
          </div>

          <div>
            <Label>Graduation Year</Label>
            <div className="mt-1 text-sm text-slate-700">
              {displayValue(client?.graduation_year)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientContactSectionsEdit({ form, onChange, clientType }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form?.phone || ""}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={form?.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={form?.address || ""}
          onChange={(e) => onChange("address", e.target.value)}
          rows={3}
        />
      </div>

      {clientType === "pre_ets" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="school">School</Label>
            <Input
              id="school"
              value={form?.school || ""}
              onChange={(e) => onChange("school", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="graduation_year">Graduation Year</Label>
            <Input
              id="graduation_year"
              value={form?.graduation_year || ""}
              onChange={(e) => onChange("graduation_year", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
