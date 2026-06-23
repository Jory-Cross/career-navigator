import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";

// ── Print styles injected into popup window ──────────────────────────────────

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #1e293b; background: white; }
  .page { padding: 36px 40px; max-width: 760px; margin: 0 auto; }
  .page-break { page-break-before: always; padding-top: 36px; }
  h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
  .meta { font-size: 10px; color: #94a3b8; margin-bottom: 6px; }
  .disclaimer { font-size: 10px; color: #cbd5e1; font-style: italic; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-bottom: 24px; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6366f1; border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; margin-bottom: 12px; margin-top: 28px; }
  h3 { font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 3px; margin-top: 14px; }
  p { font-size: 11px; line-height: 1.6; color: #475569; }
  ul { list-style: none; padding: 0; }
  li { font-size: 10.5px; line-height: 1.7; color: #334155; padding-left: 12px; position: relative; }
  li::before { content: "•"; position: absolute; left: 0; color: #94a3b8; }
  .source-tag { font-size: 9px; color: #94a3b8; margin-left: 4px; }
  .overflow-note { font-size: 9px; color: #6366f1; font-style: italic; margin-top: 4px; }
  /* Score bar */
  .score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .score-label { font-size: 10px; color: #64748b; min-width: 180px; }
  .score-bar-wrap { flex: 1; height: 7px; background: #e2e8f0; border-radius: 4px; }
  .score-bar-fill { height: 7px; border-radius: 4px; background: #6366f1; }
  .score-val { font-size: 10px; font-weight: 700; color: #4f46e5; min-width: 34px; text-align: right; }
  /* Gate rows */
  .gate-row { display: flex; align-items: center; gap-8px; margin-bottom: 5px; font-size: 10.5px; }
  .gate-pass { color: #16a34a; font-weight: 600; }
  .gate-fail { color: #dc2626; font-weight: 600; }
  /* Fidelity table */
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
  th { background: #f8fafc; font-weight: 700; text-align: left; padding: 5px 8px; border: 1px solid #e2e8f0; color: #64748b; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 4px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .status-strong { color: #16a34a; font-weight: 700; }
  .status-weak { color: #d97706; font-weight: 700; }
  .status-missing { color: #dc2626; font-weight: 700; }
  /* Milestone grid */
  .milestone-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px; }
  .milestone-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
  .milestone-done { border-color: #bbf7d0; background: #f0fdf4; }
  .milestone-pending { border-color: #e2e8f0; background: #f8fafc; }
  .milestone-title { font-size: 10px; font-weight: 700; color: #1e293b; }
  .milestone-status { font-size: 9px; margin-top: 2px; }
  .ms-done { color: #16a34a; }
  .ms-pending { color: #94a3b8; }
  /* Summary stat boxes */
  .stat-row { display: flex; gap: 12px; margin: 10px 0; }
  .stat-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; text-align: center; }
  .stat-num { font-size: 22px; font-weight: 800; color: #4f46e5; }
  .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
  /* Evidence section */
  .evidence-category { margin-bottom: 18px; break-inside: avoid; }
  .evidence-cat-header { font-size: 10.5px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px; }
  .source-breakdown { font-size: 9px; color: #94a3b8; margin-bottom: 5px; }
  @media print {
    .page { padding: 24px 28px; }
    .page-break { page-break-before: always; }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFidelityRows(sections) {
  return sections.map((sec) => {
    const sources = new Set(sec.items.map((i) => i.source).filter(Boolean));
    const count = sec.items.length;
    const srcCount = sources.size;
    let status;
    if (count === 0) status = "missing";
    else if (sec.singleSource) status = count >= 3 ? "strong" : "weak";
    else if (count < 3 || srcCount < 2) status = "weak";
    else status = "strong";
    return { label: sec.label, count, srcCount, sources: [...sources], status };
  });
}

function buildSourceBreakdown(items) {
  const map = {};
  items.forEach((i) => { if (i.source) map[i.source] = (map[i.source] || 0) + 1; });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s} (${c})`).join(", ");
}

function buildPrintHTML({ client, exportDate, exportMode, sections, fidelityRows, props }) {
  const {
    totalReadinessScore,
    homeDiscoveryCompleted,
    benefitsCompleted,
    assistiveTechCompleted,
    discoveryInterviewCompletedCount,
    discoveryInterviewTotalCount,
    informationalInterviewCompletedCount,
    informationalInterviewTotalCount,
    discoveryActivityCompletedCount,
    discoveryActivityTotalCount,
    fidelityMissingCount,
    fidelityWeakCount,
    gateRules,
  } = props;

  const strong = fidelityRows.filter((r) => r.status === "strong").length;
  const weak = fidelityRows.filter((r) => r.status === "weak").length;
  const missing = fidelityRows.filter((r) => r.status === "missing").length;

  const milestones = [
    { title: "Home & Community Discovery", done: homeDiscoveryCompleted },
    { title: "Benefits & Resources Assessment", done: benefitsCompleted },
    { title: "Assistive Technology Assessment", done: assistiveTechCompleted },
    { title: `Discovery Interviews (${discoveryInterviewCompletedCount}/${Math.max(discoveryInterviewTotalCount, 3)} needed)`, done: discoveryInterviewCompletedCount >= 3 },
    { title: `Informational Interviews (${informationalInterviewCompletedCount}/${Math.max(informationalInterviewTotalCount, 2)} needed)`, done: informationalInterviewCompletedCount >= 2 },
    { title: `Discovery Activities (${discoveryActivityCompletedCount} completed)`, done: discoveryActivityCompletedCount >= 1 },
  ];

  const failedRules = (gateRules || []).filter((r) => !r.passed);

  // ── Page 1: Summary ──────────────────────────────────────────────────────
  const page1 = `
    <div class="page">
      <h1>Discovery Staging Record</h1>
      <p class="meta">${client?.first_name || ""} ${client?.last_name || ""} &nbsp;·&nbsp; Stage One Export &nbsp;·&nbsp; ${exportDate}</p>
      <p class="disclaimer">Staff review document only — not a finalized report. Contains raw discovery evidence.</p>

      <h2>Stage One Milestones</h2>
      <div class="milestone-grid">
        ${milestones.map((m) => `
          <div class="milestone-card ${m.done ? "milestone-done" : "milestone-pending"}">
            <div class="milestone-title">${m.title}</div>
            <div class="milestone-status ${m.done ? "ms-done" : "ms-pending"}">${m.done ? "✓ Complete" : "○ Pending"}</div>
          </div>
        `).join("")}
      </div>

      <h2>Discovery Readiness Score</h2>
      <div class="score-row">
        <span class="score-label">Overall Readiness</span>
        <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${totalReadinessScore}%"></div></div>
        <span class="score-val">${totalReadinessScore}%</span>
      </div>
      <div class="stat-row">
        <div class="stat-box"><div class="stat-num">${totalReadinessScore}%</div><div class="stat-label">Readiness Score</div></div>
        <div class="stat-box"><div class="stat-num">${milestones.filter((m) => m.done).length}/${milestones.length}</div><div class="stat-label">Milestones Complete</div></div>
        <div class="stat-box"><div class="stat-num">${strong}/${fidelityRows.length}</div><div class="stat-label">Strong Evidence Categories</div></div>
      </div>

      <h2>Stage Two Readiness Gate</h2>
      <p style="font-size:10px;color:#64748b;margin-bottom:8px;">Pass/fail status for each readiness requirement:</p>
      ${(gateRules || []).map((r) => `
        <div class="gate-row">
          <span class="${r.passed ? "gate-pass" : "gate-fail"}">${r.passed ? "✓" : "✗"}</span>
          <span style="margin-left:8px;font-size:10.5px;color:${r.passed ? "#334155" : "#dc2626"}">${r.label}</span>
          ${!r.passed && r.description ? `<span style="font-size:9px;color:#94a3b8;margin-left:8px;"> — ${r.description}</span>` : ""}
        </div>
      `).join("")}

      ${failedRules.length > 0 ? `
        <h2>Remaining Stage One Work</h2>
        ${failedRules.map((r) => `
          <div style="margin-bottom:6px;padding:6px 10px;border:1px solid #fecaca;border-radius:6px;background:#fef2f2;">
            <div style="font-size:10.5px;font-weight:700;color:#dc2626">${r.label}</div>
            ${r.description ? `<div style="font-size:9.5px;color:#64748b;margin-top:2px">${r.description}</div>` : ""}
          </div>
        `).join("")}
      ` : `<p style="font-size:10.5px;color:#16a34a;font-weight:600;margin-top:8px;">✓ All Stage One requirements are complete.</p>`}
    </div>
  `;

  // ── Page 2: Fidelity Summary ─────────────────────────────────────────────
  const page2 = `
    <div class="page page-break">
      <h2 style="margin-top:0">Discovery Fidelity & Evidence Gap Analysis</h2>
      <div class="stat-row">
        <div class="stat-box" style="border-color:#bbf7d0;background:#f0fdf4"><div class="stat-num" style="color:#16a34a">${strong}</div><div class="stat-label">Strong</div></div>
        <div class="stat-box" style="border-color:#fde68a;background:#fffbeb"><div class="stat-num" style="color:#d97706">${weak}</div><div class="stat-label">Weak</div></div>
        <div class="stat-box" style="border-color:#fecaca;background:#fef2f2"><div class="stat-num" style="color:#dc2626">${missing}</div><div class="stat-label">Missing</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Status</th>
            <th>Items</th>
            <th>Sources</th>
            <th>Contributing Sources</th>
          </tr>
        </thead>
        <tbody>
          ${fidelityRows.map((row) => `
            <tr>
              <td style="font-weight:600">${row.label}</td>
              <td class="${row.status === "strong" ? "status-strong" : row.status === "weak" ? "status-weak" : "status-missing"}">
                ${row.status === "strong" ? "Strong" : row.status === "weak" ? "Weak" : "Missing"}
              </td>
              <td style="text-align:center">${row.count}</td>
              <td style="text-align:center">${row.srcCount}</td>
              <td style="color:#64748b">${row.sources.join(", ") || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  // ── Page 3+: Evidence Preview ────────────────────────────────────────────
  let evidencePages = "";
  if (exportMode !== "summary_only") {
    const limit = exportMode === "full_appendix" ? Infinity : 10;
    evidencePages = `
      <div class="page page-break">
        <h2 style="margin-top:0">Evidence Preview${exportMode === "full_appendix" ? " — Full Appendix" : ""}</h2>
        <p style="font-size:9.5px;color:#94a3b8;margin-bottom:16px;">
          ${exportMode === "full_appendix"
            ? "All evidence entries with source attribution."
            : "Top 10 entries per category. Additional evidence is available in the DSR Source Explorer."}
        </p>
        ${sections.filter((sec) => sec.items.length > 0).map((sec) => {
          const displayed = sec.items.slice(0, limit === Infinity ? sec.items.length : limit);
          const overflow = sec.items.length - displayed.length;
          const breakdown = buildSourceBreakdown(sec.items);
          return `
            <div class="evidence-category">
              <div class="evidence-cat-header">${sec.label}</div>
              <div class="source-breakdown">Sources: ${breakdown || "—"}</div>
              <ul>
                ${displayed.map((item) => `
                  <li>${item.text}<span class="source-tag">(${item.source})</span></li>
                `).join("")}
              </ul>
              ${overflow > 0 ? `<p class="overflow-note">+ ${overflow} additional entries available in DSR Source Explorer</p>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>DSR Export – ${client?.first_name} ${client?.last_name}</title>
    <style>${PRINT_CSS}</style>
  </head><body>${page1}${page2}${evidencePages}</body></html>`;
}

// ── Modal preview component ───────────────────────────────────────────────────

function ExportModeSelector({ value, onChange }) {
  const options = [
    { key: "summary_evidence", label: "Summary + Evidence Preview", desc: "Pages 1–2 + top 10 per category" },
    { key: "summary_only", label: "Summary Only", desc: "Pages 1–2: milestones, score, gate, fidelity" },
    { key: "full_appendix", label: "Full Evidence Appendix", desc: "All evidence entries included" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
            value === opt.key
              ? "border-indigo-300 bg-indigo-50"
              : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
            value === opt.key ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
          }`} />
          <div>
            <p className={`text-sm font-medium ${value === opt.key ? "text-indigo-900" : "text-slate-900"}`}>
              {opt.label}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Report-style preview ──────────────────────────────────────────────────────

function ReportSection({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-1 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function ReportTable({ headers, rows }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-slate-50">
          {headers.map((h) => (
            <th key={h.key} className={`px-3 py-2 border border-slate-200 font-semibold text-slate-600 ${h.align === "center" ? "text-center" : "text-left"}`}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i % 2 === 1 ? "bg-slate-50/40" : ""}>
            {headers.map((h) => (
              <td key={h.key} className={`px-3 py-2 border border-slate-200 text-slate-700 ${h.align === "center" ? "text-center" : ""} ${h.bold ? "font-medium" : ""}`}>
                {row[h.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportPreview({ props, fidelityRows, sections, exportMode }) {
  const {
    totalReadinessScore, homeDiscoveryCompleted, benefitsCompleted, assistiveTechCompleted,
    discoveryInterviewCompletedCount, informationalInterviewCompletedCount, discoveryActivityCompletedCount,
    gateRules,
  } = props;

  const milestones = [
    { title: "Home & Community Discovery", done: homeDiscoveryCompleted },
    { title: "Benefits & Resources Assessment", done: benefitsCompleted },
    { title: "Assistive Technology Assessment", done: assistiveTechCompleted },
    { title: "Discovery Interviews", detail: `${discoveryInterviewCompletedCount} completed (3 required)`, done: discoveryInterviewCompletedCount >= 3 },
    { title: "Informational Interviews", detail: `${informationalInterviewCompletedCount} completed (2 required)`, done: informationalInterviewCompletedCount >= 2 },
    { title: "Discovery Activities", detail: `${discoveryActivityCompletedCount} completed`, done: discoveryActivityCompletedCount >= 1 },
  ];

  const limit = exportMode === "full_appendix" ? Infinity : 10;
  const populated = sections.filter((s) => s.items.length > 0);

  return (
    <div className="font-mono text-xs leading-relaxed text-slate-800 space-y-0">

      {/* Section 1: Stage One Status */}
      <ReportSection title="Section 1 — Stage One Status">
        <ReportTable
          headers={[
            { key: "milestone", label: "Milestone", bold: true },
            { key: "detail", label: "Detail" },
            { key: "status", label: "Status", align: "center" },
          ]}
          rows={milestones.map((m) => ({
            milestone: m.title,
            detail: m.detail || "—",
            status: (
              <span className={m.done ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                {m.done ? "Complete" : "Pending"}
              </span>
            ),
          }))}
        />
        <p className="mt-3 text-xs text-slate-500">
          Overall readiness score: <span className="font-bold text-slate-700">{totalReadinessScore}%</span>
          &nbsp;·&nbsp; {milestones.filter((m) => m.done).length} of {milestones.length} milestones complete
        </p>
      </ReportSection>

      {/* Section 2: Stage Two Readiness */}
      <ReportSection title="Section 2 — Stage Two Readiness Gate">
        <ReportTable
          headers={[
            { key: "requirement", label: "Requirement", bold: true },
            { key: "result", label: "Result", align: "center" },
            { key: "notes", label: "Notes" },
          ]}
          rows={(gateRules || []).map((r) => ({
            requirement: r.label,
            result: (
              <span className={r.passed ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
                {r.passed ? "Pass" : "Fail"}
              </span>
            ),
            notes: r.passed ? "—" : (r.description || "—"),
          }))}
        />
      </ReportSection>

      {/* Section 3: Fidelity Summary */}
      <ReportSection title="Section 3 — Fidelity & Evidence Gap Analysis">
        <ReportTable
          headers={[
            { key: "category", label: "Evidence Category", bold: true },
            { key: "status", label: "Rating", align: "center" },
            { key: "count", label: "Items", align: "center" },
            { key: "sources", label: "# Sources", align: "center" },
            { key: "sourceList", label: "Contributing Sources" },
          ]}
          rows={fidelityRows.map((row) => ({
            category: row.label,
            status: (
              <span className={
                row.status === "strong" ? "text-emerald-700 font-semibold" :
                row.status === "weak" ? "text-amber-600 font-semibold" :
                "text-red-600 font-semibold"
              }>
                {row.status === "strong" ? "Strong" : row.status === "weak" ? "Weak" : "Missing"}
              </span>
            ),
            count: row.count,
            sources: row.srcCount,
            sourceList: row.sources.join(", ") || "—",
          }))}
        />
      </ReportSection>

      {/* Section 4: Evidence Summary */}
      {exportMode !== "summary_only" && (
        <ReportSection title={`Section 4 — Evidence Summary${exportMode === "full_appendix" ? " (Full Appendix)" : " (Top 10 per Category)"}`}>
          {populated.length === 0 ? (
            <p className="text-slate-400 italic">No evidence recorded yet.</p>
          ) : (
            populated.map((sec) => {
              const displayed = sec.items.slice(0, limit === Infinity ? sec.items.length : limit);
              const overflow = sec.items.length - displayed.length;
              const breakdown = buildSourceBreakdown(sec.items);
              return (
                <div key={sec.label} className="mb-4">
                  <p className="text-xs font-bold text-slate-700 mb-0.5">{sec.label}</p>
                  {breakdown && <p className="text-xs text-slate-400 mb-1">Sources: {breakdown}</p>}
                  <ul className="space-y-0.5 ml-2">
                    {displayed.map((item, i) => (
                      <li key={i} className="text-xs text-slate-600">
                        — {item.text}
                        <span className="text-slate-400 ml-1">({item.source})</span>
                      </li>
                    ))}
                  </ul>
                  {overflow > 0 && (
                    <p className="text-xs text-indigo-500 italic mt-1 ml-2">
                      + {overflow} additional entries in DSR Source Explorer
                    </p>
                  )}
                </div>
              );
            })
          )}
        </ReportSection>
      )}
    </div>
  );
}

// ── Main export component (trigger + modal) ───────────────────────────────────

export default function DSRExportPackage({
  client,
  totalReadinessScore,
  homeDiscoveryCompleted,
  benefitsCompleted,
  assistiveTechCompleted,
  discoveryInterviewCompletedCount,
  discoveryInterviewTotalCount,
  informationalInterviewCompletedCount,
  informationalInterviewTotalCount,
  discoveryActivityCompletedCount,
  discoveryActivityTotalCount,
  fidelityMissingCount,
  fidelityWeakCount,
  gateRules,
  emergingInterests,
  observedSkills,
  conditionsForSuccess,
  potentialBusinessSettings,
  relationshipsAndNaturalSupports,
  communityConnections,
  employerLeads,
  benefitsAndFinancialConsiderations,
  assistiveTechnologyAndAccommodations,
  discoveryHypotheses,
  vocationalThemesEvidence,
}) {
  const [open, setOpen] = useState(false);
  const [exportMode, setExportMode] = useState("summary_evidence");

  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const evidenceSections = [
    { label: "Emerging Interests", items: emergingInterests || [] },
    { label: "Observed Skills", items: observedSkills || [] },
    { label: "Conditions for Success", items: conditionsForSuccess || [] },
    { label: "Potential Business Settings", items: potentialBusinessSettings || [] },
    { label: "Relationships / Natural Supports", items: relationshipsAndNaturalSupports || [] },
    { label: "Community Connections", items: communityConnections || [] },
    { label: "Employer Leads", items: employerLeads || [] },
    { label: "Benefits & Financial Considerations", items: benefitsAndFinancialConsiderations || [], singleSource: true },
    { label: "Assistive Technology & Accommodations", items: assistiveTechnologyAndAccommodations || [], singleSource: true },
    { label: "Discovery Hypotheses", items: discoveryHypotheses || [] },
    { label: "Vocational Themes Evidence", items: vocationalThemesEvidence || [] },
  ];

  const fidelityRows = buildFidelityRows(evidenceSections);

  const readinessProps = {
    totalReadinessScore, homeDiscoveryCompleted, benefitsCompleted, assistiveTechCompleted,
    discoveryInterviewCompletedCount, discoveryInterviewTotalCount,
    informationalInterviewCompletedCount, informationalInterviewTotalCount,
    discoveryActivityCompletedCount, discoveryActivityTotalCount,
    fidelityMissingCount, fidelityWeakCount, gateRules,
  };

  const handlePrint = () => {
    const html = buildPrintHTML({
      client, exportDate, exportMode,
      sections: evidenceSections,
      fidelityRows,
      props: readinessProps,
    });
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <>
      {/* Trigger button rendered inline by the parent */}
      <Button size="sm" variant="outline" className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => setOpen(true)}>
        <Printer className="h-3.5 w-3.5" />
        Export Package
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  DSR Export Package
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {client?.first_name} {client?.last_name} &nbsp;·&nbsp; {exportDate}
                </p>
              </div>
              <Button size="sm" onClick={handlePrint} className="gap-1.5 ml-4 shrink-0">
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: options */}
            <div className="w-56 shrink-0 border-r border-slate-200 p-4 overflow-y-auto bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Export Options</p>
              <ExportModeSelector value={exportMode} onChange={setExportMode} />
              <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-400 space-y-1">
                <p>The print dialog will open in a new window.</p>
                <p className="mt-1">Choose "Save as PDF" in your browser's print dialog.</p>
              </div>
            </div>

            {/* Right: report preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              <ReportPreview
                props={readinessProps}
                fidelityRows={fidelityRows}
                sections={evidenceSections}
                exportMode={exportMode}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}