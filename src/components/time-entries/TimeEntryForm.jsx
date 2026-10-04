import React, { useState } from 'react';
import { useTimeEntries } from '../../hooks/useTimeEntries';

export default function TimeEntryForm() {
  const { addEntry } = useTimeEntries();
  const [form, setForm] = useState({ note: '', startedAt: '', endedAt: '', projectId: '', billable: false, rate: '' });

  function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      rate: form.rate ? Number(form.rate) : null,
      startedAt: form.startedAt ? new Date(form.startedAt).toISOString() : null,
      endedAt: form.endedAt ? new Date(form.endedAt).toISOString() : null,
    };
    addEntry(payload);
    setForm({ note: '', startedAt: '', endedAt: '', projectId: '', billable: false, rate: '' });
  }

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <input className="w-full border rounded px-2 py-1" placeholder="Note" value={form.note} onChange={(e)=>setForm(v=>({...v, note: e.target.value}))} />
      <input className="w-full border rounded px-2 py-1" type="datetime-local" value={form.startedAt} onChange={(e)=>setForm(v=>({...v, startedAt: e.target.value}))} />
      <input className="w-full border rounded px-2 py-1" type="datetime-local" value={form.endedAt} onChange={(e)=>setForm(v=>({...v, endedAt: e.target.value}))} />
      <div className="flex items-center gap-2">
        <input id="billable" type="checkbox" checked={form.billable} onChange={(e)=>setForm(v=>({...v, billable: e.target.checked}))} />
        <label htmlFor="billable">Billable</label>
        <input className="border rounded px-2 py-1 ml-auto" placeholder="Rate" value={form.rate} onChange={(e)=>setForm(v=>({...v, rate: e.target.value}))} />
      </div>
      <button className="w-full bg-black text-white rounded px-3 py-1">Save Entry</button>
    </form>
  );
}
