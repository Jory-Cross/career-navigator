import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Extract key concepts from evidence strings for summary chips.
 * Deduplicates across multiple evidence lists.
 */
export function extractKeyTopics(evidenceLists = {}) {
  const topics = new Set();
  const keywords = {
    customer: ["customer", "interaction", "social demand", "conversational"],
    standing: ["standing", "prolonged", "physical demand"],
    licensing: ["licensing", "training", "certification", "credential"],
    transportation: ["transportation", "unknown", "mobility"],
    support: ["coaching", "support", "onboarding", "accommodation"],
    structure: ["structure", "routine", "predictable", "consistency"],
    sensory: ["sensory", "stimulation", "noise", "environment"],
  };

  const allText = Object.values(evidenceLists)
    .flat()
    .map((item) => (typeof item === "string" ? item : item?.summary || item?.text || ""))
    .join(" ")
    .toLowerCase();

  Object.entries(keywords).forEach(([topic, patterns]) => {
    if (patterns.some((p) => allText.includes(p))) {
      topics.add(topic);
    }
  });

  return Array.from(topics);
}

/**
 * Collapsible evidence list with top N items shown by default.
 */
export function ExpandableEvidenceList({
  items = [],
  icon: Icon,
  iconClass,
  showCount = 2,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!items?.length) return null;

  const displayed = expanded ? items : items.slice(0, showCount);
  const hasMore = items.length > showCount;

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {displayed.map((item, i) => {
          const text =
            typeof item === "string"
              ? item
              : item?.label ||
                item?.summary ||
                item?.reason ||
                item?.detail ||
                item?.text ||
                "";
          return (
            <li
              key={i}
              className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-relaxed"
            >
              {Icon && (
                <Icon
                  className={cn("w-3 h-3 mt-0.5 shrink-0", iconClass)}
                />
              )}
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 mt-1 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" /> +{items.length - showCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Summary chips for high-impact topics.
 */
export function SummaryChips({ topics = [] }) {
  if (!topics?.length) return null;

  const chipLabels = {
    customer: "High customer interaction",
    standing: "Prolonged standing",
    licensing: "Licensing required",
    transportation: "Transportation unclear",
    support: "Support recommended",
    structure: "Structured environment",
    sensory: "Sensory considerations",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.map((topic) => (
        <span
          key={topic}
          className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-full font-medium"
        >
          {chipLabels[topic] || topic}
        </span>
      ))}
    </div>
  );
}

/**
 * Deduplicate evidence strings across multiple lists.
 * Returns unique strings, filtering exact duplicates and very similar phrases.
 */
export function deduplicateEvidence(evidenceLists = {}) {
  const normalized = [];
  const seen = new Set();

  Object.values(evidenceLists).forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      const text =
        typeof item === "string"
          ? item
          : item?.label ||
            item?.summary ||
            item?.reason ||
            item?.detail ||
            item?.text ||
            "";
      if (!text) return;

      const key = text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(text);
      }
    });
  });

  return normalized;
}