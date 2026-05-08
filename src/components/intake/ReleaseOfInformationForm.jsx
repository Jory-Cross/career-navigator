import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, addYears } from "date-fns";

const ROI_INFO_ITEMS = [
  { key: "roi_release_name", label: "My Name" },
  { key: "roi_release_disability", label: "The nature of my disability/barriers and how they affect my ability to work" },
  { key: "roi_release_employment", label: "Previous Employment" },
  { key: "roi_release_skills", label: "My skills, abilities and employment preferences" },
  { key: "roi_release_accommodations", label: "Accommodations that will be needed at work" },
];

const ROI_MEANS_ITEMS = [
  { key: "roi_means_resumes", label: "Resumes" },
  { key: "roi_means_emails", label: "Emails" },
  { key: "roi_means_verbal", label: "Verbal Communication" },
  { key: "roi_means_social_media", label: "Social Media Profiles (If marked Yes, read and sign media release form)" },
  { key: "roi_means_text", label: "Text Messages" },
  { key: "roi_means_other_social", label: "Other forms of Social Media such as, but not limited to: brochures, newsletters, etc." },
];

function YesNoToggle({ value, onChange, readOnly }) {
  return (
    <div className="flex gap-1.5 shrink-0">
      {["yes", "no"].map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange(value === opt ? null : opt)}
          className={cn(
            "px-3 py-1 rounded-md border text-xs font-semibold uppercase tracking-wide transition-all",
            value === opt && opt === "yes" && "bg-emerald-600 text-white border-emerald-600",
            value === opt && opt === "no" && "bg-red-500 text-white border-red-500",
            value !== opt && "border-slate-200 text-slate-500 hover:bg-slate-50",
            readOnly && "cursor-default"
          )}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function RoiRow({ label, fieldKey, answers, setField, readOnly }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700 flex-1">{label}</span>
      <YesNoToggle
        value={answers[fieldKey] ?? null}
        onChange={(v) => setField(fieldKey, v)}
        readOnly={readOnly}
      />
    </div>
  );
}

export default function ReleaseOfInformationForm({ answers, setField, readOnly, client }) {
  const clientName = client
    ? ([client.first_name, client.last_name].filter(Boolean).join(" ") || client.name || "")
    : "";

  // Default expiration = today + 1 year
  const defaultExpiration = format(addYears(new Date(), 1), "yyyy-MM-dd");
  const defaultSignatureDate = format(new Date(), "yyyy-MM-dd");

  const expirationDate = answers.release_expiration_date || defaultExpiration;
  const sigDate = answers.roi_signature_date || defaultSignatureDate;

  return (
    <div className="space-y-6">
      {/* Opening statement */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm text-slate-800 leading-relaxed">
          I,{" "}
          <span className="font-semibold underline underline-offset-4 decoration-dotted">
            {clientName || "___________________________"}
          </span>
          , hereby agree to allow <strong>Community Options</strong> to release the following
          information concerning me and my work history to prospective employers for the purposes
          of obtaining or improving my employment to better accommodate my needs.
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          <strong>Information to be released:</strong> The information I will allow to be released
          is indicated below under <strong>Yes</strong>. The information I would like kept
          confidential is indicated below under <strong>No</strong>. If I indicate that no
          information is to be released, I understand that Community Options will still continue
          in their job placement efforts on my behalf.
        </p>
      </div>

      {/* Information to be released */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Information to be released
        </h4>
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 px-4">
          {ROI_INFO_ITEMS.map((item) => (
            <RoiRow
              key={item.key}
              label={item.label}
              fieldKey={item.key}
              answers={answers}
              setField={setField}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {/* Means of release */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          I allow Community Options to release the above information through the means of
        </h4>
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 px-4">
          {ROI_MEANS_ITEMS.map((item) => (
            <RoiRow
              key={item.key}
              label={item.label}
              fieldKey={item.key}
              answers={answers}
              setField={setField}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {/* Expiration */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm text-slate-800">
          This release will expire upon case closure or on{" "}
          <span className="font-semibold">
            {expirationDate
              ? format(new Date(expirationDate + "T12:00:00"), "MMMM d, yyyy")
              : "___________"}
          </span>
          .
        </p>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-slate-600 whitespace-nowrap">Expiration Date</Label>
          <Input
            type="date"
            value={expirationDate}
            onChange={(e) => setField("release_expiration_date", e.target.value)}
            readOnly={readOnly}
            className="max-w-[180px] text-sm"
          />
        </div>
      </div>

      {/* VR counselor permission statement */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-sm text-slate-800 leading-relaxed">
          In addition, I give <strong>Community Options</strong> permission to release and/or
          obtain information regarding the progress of my job placement activities to my Vocational
          Rehabilitation Counselor. I also give Community Options permission to discuss this
          information with the following individuals:
        </p>
      </div>

      {/* Additional individuals */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">Additional individuals allowed for discussion</Label>
        <Textarea
          value={answers.roi_additional_individuals ?? ""}
          onChange={(e) => setField("roi_additional_individuals", e.target.value)}
          placeholder="List names and relationships..."
          className="min-h-[80px]"
          readOnly={readOnly}
        />
      </div>

      {/* Signature block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
        <div className="space-y-1">
          <Label className="text-sm font-medium">Customer Signature</Label>
          <Input
            value={answers.roi_signature ?? ""}
            onChange={(e) => setField("roi_signature", e.target.value)}
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
            onChange={(e) => setField("roi_signature_date", e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}