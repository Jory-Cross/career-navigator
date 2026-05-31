import React from "react";

export default function OnetOccupationExplorer({ clientId, client }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-800">
        O*NET Occupation Explorer
      </h4>
      <p className="mt-1 text-xs text-slate-500">
        Search and explore O*NET occupations for this client.
      </p>
    </div>
  );
}
