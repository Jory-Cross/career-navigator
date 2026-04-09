import React from 'react';
import { useTimeEntries } from '../../hooks/useTimeEntries';

function fmt(ts) {
  if (!ts) return '-';
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '-';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function TimeEntryRow({ entry }) {
  const { removeEntry } = useTimeEntries();
  return (
    <div className="grid grid-cols-12 px-3 py-2 text-sm border-t items-center">
      <div className="col-span-4 truncate" title={entry.note}>{entry.note || '—'}</div>
      <div className="col-span-2">{entry.projectName || '—'}</div>
      <div className="col-span-2">{fmt(entry.startedAt)}</div>
      <div className="col-span-2">{fmt(entry.endedAt)}</div>
      <div className="col-span-1 text-right">{fmtDuration(entry.durationSec)}</div>
      <div className="col-span-1 text-right space-x-2">
        <button className="text-blue-600 hover:underline" onClick={() => alert('Edit TBD')}>Edit</button>
        <button className="text-red-600 hover:underline" onClick={() => removeEntry(entry.id)}>Delete</button>
      </div>
    </div>
  );
}
