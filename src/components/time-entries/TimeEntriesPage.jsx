import React from 'react';
import SummaryCards from './SummaryCards';
import TimeEntryList from './TimeEntryList';
import TimeEntryForm from './TimeEntryForm';
import TimerWidget from './TimerWidget';

export default function TimeEntriesPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Time Entries</h1>
        <TimerWidget />
      </div>
      <SummaryCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TimeEntryList />
        </div>
        <div className="lg:col-span-1">
          <div className="rounded border p-3">
            <h2 className="font-medium mb-2">Add / Edit Entry</h2>
            <TimeEntryForm />
          </div>
        </div>
      </div>
    </div>
  );
}
