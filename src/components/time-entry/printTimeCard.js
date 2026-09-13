// Builds a clean, payroll-friendly printable view of a Time Card and sends it
// to the browser's print dialog via a hidden iframe (avoids popup blockers).

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateLabel(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "—";
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDurationLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function formatTimestampLabel(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString();
}

const ENTRY_TYPE_LABELS = {
  admin_time: "Admin Time",
  client_non_attendance: "No-Show / Cancellation",
  csb: "CSB",
  dspd: "DSPD",
  eom_reporting: "End-of-Month Reporting",
  job_coaching: "Job Coaching",
  job_development: "Job Development",
  life_skills: "Life Skills",
  misc: "Miscellaneous",
  miscellaneous: "Miscellaneous",
  pre_ets: "Pre-ETS",
  pto: "PTO",
  wsa: "WSA",
};

function getEntryTypeLabel(entry) {
  const code = String(entry?.entry_type_code || "")
    .trim()
    .toLowerCase();

  if (ENTRY_TYPE_LABELS[code]) {
    return ENTRY_TYPE_LABELS[code];
  }

  if (!code) {
    return "Time Entry";
  }

  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getClientName(entry, clientById) {
  if (!entry?.client_id) {
    return "Staff / non-client";
  }

  const client = clientById?.[entry.client_id];

  if (!client) {
    return "—";
  }

  return (
    `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
    client.email ||
    "—"
  );
}

const STATUS_LABELS = {
  submitted: "Submitted",
  returned: "Returned for Correction",
  approved: "Approved",
};

function buildTimeCardHtml(card, clientById) {
  const entries = Array.isArray(card?.entries) ? card.entries : [];

  const grouped = new Map();

  for (const entry of entries) {
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(entry?.date || "")
      ? entry.date
      : "undated";

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey).push(entry);
  }

  const dayRows = Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayEntries]) => {
      const sortedEntries = [...dayEntries].sort((left, right) =>
        `${left?.start_time || ""}`.localeCompare(
          `${right?.start_time || ""}`
        )
      );

      const dayTotal = dayEntries.reduce(
        (total, entry) => total + Number(entry?.duration_minutes || 0),
        0
      );

      const entryRows = sortedEntries
        .map(
          (entry) => `
            <tr>
              <td></td>
              <td>${escapeHtml(getEntryTypeLabel(entry))}</td>
              <td>${escapeHtml(getClientName(entry, clientById))}</td>
              <td class="nowrap">${
                entry.start_time
                  ? `${escapeHtml(entry.start_time)}${
                      entry.end_time ? ` – ${escapeHtml(entry.end_time)}` : ""
                    }`
                  : "—"
              }</td>
              <td class="nowrap">${escapeHtml(
                formatDurationLabel(entry.duration_minutes)
              )}</td>
              <td>${escapeHtml(entry.description || "")}</td>
            </tr>`
        )
        .join("");

      return `
            <tr class="day-row">
              <td colspan="2">${
                date === "undated" ? "Date unavailable" : escapeHtml(formatDateLabel(date))
              }</td>
              <td colspan="3" class="day-total">Daily total: ${escapeHtml(
                formatDurationLabel(dayTotal)
              )}</td>
              <td></td>
            </tr>
            ${entryRows}`;
    })
    .join("");

  const periodLabel =
    card?.pay_period_label ||
    `${formatDateLabel(card?.period_start)} – ${formatDateLabel(card?.period_end)}`;

  const statusLabel =
    STATUS_LABELS[card?.status] ||
    escapeHtml(card?.status || "Unknown");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Time Card — ${escapeHtml(card?.employee_name || "Staff")}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        margin: 24px;
        font-size: 12px;
      }
      h1 { font-size: 18px; margin: 0 0 2px; }
      .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td {
        border: 1px solid #d1d5db;
        padding: 4px 6px;
        text-align: left;
        vertical-align: top;
      }
      th { background: #f3f4f6; font-size: 11px; }
      .day-row td { background: #f9fafb; font-weight: bold; font-size: 11px; }
      .day-total { text-align: right; }
      .nowrap { white-space: nowrap; }
      .summary {
        display: flex;
        gap: 24px;
        margin-top: 8px;
        font-size: 12px;
      }
      .summary div span { display: block; color: #6b7280; font-size: 10px; text-transform: uppercase; }
      .signature-block {
        margin-top: 48px;
        display: flex;
        gap: 48px;
      }
      .signature-line {
        flex: 1;
        border-top: 1px solid #111827;
        padding-top: 4px;
        font-size: 10px;
        color: #6b7280;
      }
      @media print {
        body { margin: 0.5in; }
      }
    </style>
  </head>
  <body>
    <h1>Time Card</h1>
    <div class="subtitle">${escapeHtml(card?.employee_name || "Staff")} · ${escapeHtml(periodLabel)}</div>

    <div class="summary">
      <div><span>Status</span>${escapeHtml(statusLabel)}</div>
      <div><span>Total time</span>${escapeHtml(formatDurationLabel(card?.total_minutes))}</div>
      <div><span>Entries</span>${escapeHtml(card?.entry_count ?? entries.length)}</div>
      <div><span>Submitted</span>${escapeHtml(formatTimestampLabel(card?.last_submitted_at))}</div>
      ${
        card?.approved_at
          ? `<div><span>Approved</span>${escapeHtml(formatTimestampLabel(card.approved_at))}</div>`
          : ""
      }
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 90px">Date</th>
          <th>Entry type</th>
          <th>Client</th>
          <th>Time</th>
          <th>Duration</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${dayRows || `<tr><td colspan="6">No entries in this Time Card.</td></tr>`}
      </tbody>
    </table>

    ${
      card?.return_note
        ? `<p style="margin-top:16px"><strong>Return note:</strong> ${escapeHtml(card.return_note)}</p>`
        : ""
    }
    ${
      card?.approval_note
        ? `<p style="margin-top:16px"><strong>Approval note:</strong> ${escapeHtml(card.approval_note)}</p>`
        : ""
    }

    <div class="signature-block">
      <div class="signature-line">Employee signature / date</div>
      <div class="signature-line">Manager signature / date</div>
    </div>
  </body>
</html>`;
}

export function printTimeCard(card, clientById = {}) {
  if (!card) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  doc.open();
  doc.write(buildTimeCardHtml(card, clientById));
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const runPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      // print() blocks until the dialog is dismissed in most browsers;
      // still wait a beat before tearing down the iframe.
      setTimeout(cleanup, 500);
    }
  };

  if (iframe.contentWindow.document.readyState === "complete") {
    setTimeout(runPrint, 50);
  } else {
    iframe.onload = () => setTimeout(runPrint, 50);
  }
}