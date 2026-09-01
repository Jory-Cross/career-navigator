import React from 'react';
import { useTimeEntries } from '../../hooks/useTimeEntries';

function sumDur(list) { return (list||[]).reduce((a,b)=>a+(b.durationSec||0),0); }

export default function SummaryCards() {
  const { entries } = useTimeEntries();
  const total = sumDur(entries);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="border rounded p-3"><div className="text-sm text-gray-500">Total</div><div className="text-xl font-semibold">{Math.round(total/3600)} h</div></div>
      <div className="border rounded p-3"><div className="text-sm text-gray-500">Today</div><div className="text-xl font-semibold">TBD</div></div>
      <div className="border rounded p-3"><div className="text-sm text-gray-500">This Week</div><div className="text-xl font-semibold">TBD</div></div>
    </div>
  );
}
