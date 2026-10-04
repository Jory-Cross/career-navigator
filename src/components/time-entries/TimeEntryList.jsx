import React from 'react';
import { useTimeEntries } from '../../hooks/useTimeEntries';
import TimeEntryRow from './TimeEntryRow';

export default function TimeEntryList() {
  const { entries, isLoading, error } = useTimeEntries();

  if (isLoading) return <div>Loading entries…</div>;
  if (error) return <div className="text-red-600">Failed to load entries</div>;

  return (
    <div className="rounded border">
      <div className="grid grid-cols-12 px-3 py-2 text-sm font-medium bg-gray-50">
        <div className="col-span-4">Notes</div>
        <div className="col-span-2">Project</div>
        <div className="col-span-2">Start</div>
        <div className="col-span-2">End</div>
        <div className="col-span-1 text-right">Duration</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>
      <div>
        {entries?.map((e) => (
          <TimeEntryRow key={e.id} entry={e} />
        ))}
        {(!entries || entries.length === 0) && (
          <div className="p-3 text-sm text-gray-500">No entries yet.</div>
        )}
      </div>
    </div>
  );
}
