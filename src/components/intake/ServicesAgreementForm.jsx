import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function ServicesAgreementForm({ answers, setField, readOnly, client }) {
  const clientName = client
    ? [client.first_name, client.last_name].filter(Boolean).join(" ")
    : "";

  const defaultSignatureDate = format(new Date(), "yyyy-MM-dd");
  const sigDate = answers.agreement_signature_date || defaultSignatureDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h4 className="text-base font-bold text-slate-900 uppercase tracking-wide">
          Services Provided Agreement Form
        </h4>
      </div>

      {/* Intro paragraphs */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm text-slate-800 leading-relaxed">
          Thank you for entering into agreement with <strong>Community Options</strong>. We look
          forward to working with you. To ensure equal services with the same set of standards for
          all customers, we request all customers sign the agreement below.
        </p>
        <p className="text-sm text-slate-800 leading-relaxed">
          All missed appointments, failure to accept reasonable employment and terminations of
          employment will be documented in progress notes.
        </p>
      </div>

      {/* Agreement clauses */}
      <div className="space-y-4">
        <p className="text-sm text-slate-800 leading-relaxed">
          I,{" "}
          <span className="font-semibold underline underline-offset-4 decoration-dotted">
            {clientName || "___________________________"}
          </span>
          , have entered into agreement with <strong>Community Options</strong>.
        </p>

        <div className="space-y-3 pl-4 border-l-4 border-slate-200">
          <p className="text-sm text-slate-800 leading-relaxed">
            I understand and agree that if I miss three (3) appointments either consecutively or
            non-consecutively, Community Options will contact my VR Counselor and schedule an
            intervention meeting. Any missed appointments following will result in a discontinuation
            of services.
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">
            I understand and agree that if I fail to accept reasonable employment on three (3)
            occasions either consecutively or non-consecutively, Community Options reserves the
            right to discontinue in the agreement of services.
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">
            I understand and agree that if I am terminated by my employer, Community Options will
            evaluate the circumstances of the situation and decide whether or not to continue
            services.
          </p>
        </div>
      </div>

      {/* Signature block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Customer Signature</Label>
          <Input
            value={answers.agreement_signature ?? ""}
            onChange={(e) => setField("agreement_signature", e.target.value)}
            placeholder="Type full name as signature..."
            readOnly={readOnly}
          />
          <p className="text-xs text-slate-400">Typed signature</p>
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">Signature Date</Label>
          <Input
            type="date"
            value={sigDate}
            onChange={(e) => setField("agreement_signature_date", e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}