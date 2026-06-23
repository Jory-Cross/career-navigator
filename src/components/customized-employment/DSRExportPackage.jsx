import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, CheckCircle2, XCircle, AlertCircle, MinusCircle } from "lucide-react";
import StageOneMilestoneTracker from "./StageOneMilestoneTracker";
import DiscoveryReadinessScore from "./DiscoveryReadinessScore";
import StageTwoReadinessGate from "./StageTwoReadinessGate";
import StageOneWorkDashboard from "./StageOneWorkDashboard";
import DiscoveryFidelityPanel from "./DiscoveryFidelityPanel";

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <div className="border-b border-slate-200 pb-2 mb-4">
      <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function EvidenceSection({ label, items, emptyText }) {
  return (
    <div className="break-inside-avoid mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-slate-700">
              <span>• {item.text}</span>
              <span className="text-xs text-slate-400 ml-2">({item.source})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 italic">{emptyText}</p>
      )}
    </div>
  );
}

function SourceSummaryTable({ sections }) {
  // Build a source × category matrix
  const allSources = [
    "Home & Community Discovery",
    "Discovery Interview",
    "Informational Interview",
    "Discovery Activity",
    "Benefits & Resources Assessment",
    "Assistive Technology Assessment",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-2 py-1.5 font-semibold text-slate-700 border border-slate-200">Category</th>
            <th className="text-center px-2 py-1.5 font-semibold text-slate-700 border border-slate-200">Items</th>
            <th className="text-center px-2 py-1.5 font-semibold text-slate-700 border border-slate-200">Sources</th>
            {allSources.map((s) => (
              <th key={s} className="text-center px-1 py-1.5 font-medium text-slate-500 border border-slate-200 max-w-[60px] whitespace-normal">
                {s.split(" ").slice(0, 2).join(" ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => {
            const sourceSet = new Set(sec.items.map((i) => i.source).filter(Boolean));
            return (
              <tr key={sec.label} className="even:bg-slate-50">
                <td className="px-2 py-1.5 text-slate-700 border border-slate-200 font-medium">{sec.label}</td>
                <td className="px-2 py-1.5 text-center text-slate-700 border border-slate-200">{sec.items.length}</td>
                <td className="px-2 py-1.5 text-center text-slate-700 border border-slate-200">{sourceSet.size}</td>
                {allSources.map((s) => {
                  const count = sec.items.filter((i) => i.source === s).length;
                  return (
                    <td key={s} className="px-1 py-1.5 text-center border border-slate-200">
                      {count > 0 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">{count}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Export Component ─────────────────────────────────────────────────────

export default function DSRExportPackage({
  client,
  // readiness props
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
  // evidence props
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
  const printRef = useRef(null);
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DSR Export – ${client?.first_name} ${client?.last_name}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; font-size: 11px; color: #1e293b; padding: 32px; }
            h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
            h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; margin-top: 24px; }
            h3 { font-size: 12px; font-weight: 600; margin-bottom: 4px; color: #334155; }
            p, li { font-size: 11px; line-height: 1.6; color: #475569; }
            ul { list-style: none; padding: 0; }
            .meta { font-size: 10px; color: #94a3b8; margin-bottom: 24px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; break-inside: avoid; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; border: 1px solid #e2e8f0; }
            .badge-ok { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
            .badge-weak { background: #fffbeb; color: #92400e; border-color: #fde68a; }
            .badge-missing { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
            .evidence-item { margin-bottom: 6px; }
            .evidence-source { font-size: 9px; color: #94a3b8; margin-left: 8px; }
            .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; }
            .pass { color: #16a34a; }
            .fail { color: #dc2626; }
            .score-bar { height: 8px; background: #e2e8f0; border-radius: 4px; margin-top: 4px; }
            .score-fill { height: 8px; border-radius: 4px; background: #6366f1; }
            @media print {
              body { padding: 20px; }
              h2 { margin-top: 16px; }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  const evidenceSections = [
    { label: "Emerging Interests", items: emergingInterests, emptyText: "No interests identified yet." },
    { label: "Observed Skills", items: observedSkills, emptyText: "No skills identified yet." },
    { label: "Conditions for Success", items: conditionsForSuccess, emptyText: "No conditions identified yet." },
    { label: "Potential Business Settings", items: potentialBusinessSettings, emptyText: "No business settings identified yet." },
    { label: "Relationships / Natural Supports", items: relationshipsAndNaturalSupports, emptyText: "No natural supports identified yet." },
    { label: "Community Connections", items: communityConnections, emptyText: "No community connections identified yet." },
    { label: "Employer Leads", items: employerLeads, emptyText: "No employer leads identified yet." },
    { label: "Benefits & Financial Considerations", items: benefitsAndFinancialConsiderations, emptyText: "No benefits evidence identified yet." },
    { label: "Assistive Technology & Accommodations", items: assistiveTechnologyAndAccommodations, emptyText: "No assistive technology evidence identified yet." },
    { label: "Discovery Hypotheses", items: discoveryHypotheses, emptyText: "No hypotheses identified yet." },
    { label: "Vocational Themes Evidence", items: vocationalThemesEvidence, emptyText: "No vocational themes evidence identified yet." },
  ];

  return (
    <div className="space-y-4">
      {/* Export trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">DSR Export Package</h4>
          <p className="text-xs text-slate-500 mt-0.5">Staff-facing Stage One review document</p>
        </div>
        <Button onClick={handlePrint} size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Export PDF
        </Button>
      </div>

      {/* Preview panel (also used as print source) */}
      <div
        ref={printRef}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-8 text-sm"
      >
        {/* Cover */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Discovery Staging Record — Stage One Export
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            {client?.first_name} {client?.last_name} &nbsp;·&nbsp; Exported {exportDate}
          </p>
          <p className="text-xs text-slate-400 mt-1 italic">
            Staff review document only. Contains raw discovery evidence — not a finalized report.
          </p>
        </div>

        {/* 1. Stage One Milestones */}
        <div>
          <SectionHeader title="1. Stage One Milestones" subtitle="Visual roadmap of completion requirements" />
          <StageOneMilestoneTracker
            homeDiscoveryCompleted={homeDiscoveryCompleted}
            benefitsCompleted={benefitsCompleted}
            assistiveTechCompleted={assistiveTechCompleted}
            discoveryInterviewCompletedCount={discoveryInterviewCompletedCount}
            informationalInterviewCompletedCount={informationalInterviewCompletedCount}
            discoveryActivityCompletedCount={discoveryActivityCompletedCount}
            stageTwoReady={totalReadinessScore === 100}
          />
        </div>

        {/* 2. Discovery Readiness Score */}
        <div>
          <SectionHeader title="2. Discovery Readiness Score" subtitle="Weighted completion score toward Stage Two" />
          <DiscoveryReadinessScore
            homeDiscoveryCompleted={homeDiscoveryCompleted}
            benefitsCompleted={benefitsCompleted}
            assistiveTechCompleted={assistiveTechCompleted}
            discoveryInterviewCompletedCount={discoveryInterviewCompletedCount}
            discoveryInterviewTotalCount={discoveryInterviewTotalCount}
            informationalInterviewCompletedCount={informationalInterviewCompletedCount}
            informationalInterviewTotalCount={informationalInterviewTotalCount}
            discoveryActivityCompletedCount={discoveryActivityCompletedCount}
            discoveryActivityTotalCount={discoveryActivityTotalCount}
          />
        </div>

        {/* 3. Stage Two Readiness Gate */}
        <div>
          <SectionHeader title="3. Stage Two Readiness Gate" subtitle="Deterministic pass/fail criteria for Stage Two advancement" />
          <StageTwoReadinessGate
            totalScore={totalReadinessScore}
            homeDiscoveryCompleted={homeDiscoveryCompleted}
            benefitsCompleted={benefitsCompleted}
            assistiveTechCompleted={assistiveTechCompleted}
            discoveryInterviewCompletedCount={discoveryInterviewCompletedCount}
            discoveryInterviewTotalCount={discoveryInterviewTotalCount}
            informationalInterviewCompletedCount={informationalInterviewCompletedCount}
            informationalInterviewTotalCount={informationalInterviewTotalCount}
            discoveryActivityCompletedCount={discoveryActivityCompletedCount}
            discoveryActivityTotalCount={discoveryActivityTotalCount}
            fidelityMissingCount={fidelityMissingCount}
            fidelityWeakCount={fidelityWeakCount}
            onRules={() => {}} // read-only in export
          />
        </div>

        {/* 4. Remaining Stage One Work */}
        {gateRules && gateRules.filter((r) => !r.passed).length > 0 && (
          <div>
            <SectionHeader title="4. Remaining Stage One Work" subtitle="Outstanding requirements before Stage Two" />
            <StageOneWorkDashboard rules={gateRules} />
          </div>
        )}

        {/* 5. Discovery Fidelity & Evidence Gap Analysis */}
        <div>
          <SectionHeader title="5. Discovery Fidelity & Evidence Gap Analysis" subtitle="Evidence depth and source diversity across discovery categories" />
          <DiscoveryFidelityPanel
            emergingInterests={emergingInterests}
            observedSkills={observedSkills}
            conditionsForSuccess={conditionsForSuccess}
            potentialBusinessSettings={potentialBusinessSettings}
            relationshipsAndNaturalSupports={relationshipsAndNaturalSupports}
            communityConnections={communityConnections}
            employerLeads={employerLeads}
            benefitsAndFinancialConsiderations={benefitsAndFinancialConsiderations}
            assistiveTechnologyAndAccommodations={assistiveTechnologyAndAccommodations}
            discoveryHypotheses={discoveryHypotheses}
            vocationalThemesEvidence={vocationalThemesEvidence}
          />
        </div>

        {/* 6. Draft Evidence Preview */}
        <div>
          <SectionHeader title="6. Draft Evidence Preview" subtitle="All categorized evidence items with source attribution" />
          <div className="grid gap-5 md:grid-cols-2">
            {evidenceSections.map((sec) => (
              <EvidenceSection
                key={sec.label}
                label={sec.label}
                items={sec.items}
                emptyText={sec.emptyText}
              />
            ))}
          </div>
        </div>

        {/* 7. Evidence Source Summary */}
        <div>
          <SectionHeader title="7. Evidence Source Summary" subtitle="Cross-reference of categories and contributing sources" />
          <SourceSummaryTable sections={evidenceSections} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
          Generated {exportDate} &nbsp;·&nbsp; {client?.first_name} {client?.last_name} &nbsp;·&nbsp; Stage One DSR Export Package
        </div>
      </div>
    </div>
  );
}