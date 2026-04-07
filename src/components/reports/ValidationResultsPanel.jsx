import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ValidationResultsPanel({ validation, showDetails = true }) {
  if (!validation) return null;

  const {
    isValid,
    canGenerate,
    errors = [],
    warnings = [],
    summary = {},
    totalEntries,
    validEntries,
    missingFields = []
  } = validation;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-600 mb-1">Total Entries</p>
            <p className="text-lg font-semibold text-slate-900">{totalEntries || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Valid Entries</p>
            <p className="text-lg font-semibold text-green-600">{validEntries || 0}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Entry Types</p>
            <p className="text-lg font-semibold text-slate-900">{Object.keys(summary).length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 mb-1">Status</p>
            <div className="flex items-center gap-1.5">
              {isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">Valid</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-600">Invalid</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* By Entry Type */}
      {Object.keys(summary).length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Breakdown by Entry Type</h4>
          <div className="space-y-2">
            {Object.entries(summary).map(([typeId, counts]) => (
              <div key={typeId} className="flex items-center justify-between p-2 rounded bg-slate-50">
                <span className="text-sm font-medium text-slate-700">{typeId}</span>
                <div className="flex items-center gap-3">
                  {counts.valid > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs text-green-600 font-medium">{counts.valid} valid</span>
                    </div>
                  )}
                  {counts.incomplete > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs text-amber-600 font-medium">{counts.incomplete} incomplete</span>
                    </div>
                  )}
                  {counts.invalid > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      <span className="text-xs text-red-600 font-medium">{counts.invalid} invalid</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-2">Validation Errors ({errors.length})</h4>
              <ul className="space-y-1">
                {errors.slice(0, showDetails ? undefined : 3).map((error, i) => (
                  <li key={i} className="text-xs text-red-800">
                    <span className="font-medium">•</span> {error}
                  </li>
                ))}
              </ul>
              {!showDetails && errors.length > 3 && (
                <p className="text-xs text-red-700 mt-2">+{errors.length - 3} more errors</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">Warnings ({warnings.length})</h4>
              <ul className="space-y-1">
                {warnings.slice(0, showDetails ? undefined : 3).map((warning, i) => (
                  <li key={i} className="text-xs text-amber-800">
                    <span className="font-medium">•</span> {warning}
                  </li>
                ))}
              </ul>
              {!showDetails && warnings.length > 3 && (
                <p className="text-xs text-amber-700 mt-2">+{warnings.length - 3} more warnings</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Missing Fields */}
      {missingFields.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-2">Missing Field Definitions</h4>
              <div className="flex flex-wrap gap-1">
                {missingFields.map((field, i) => (
                  <Badge key={i} variant="outline" className="bg-white border-amber-300">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Success State */}
      {isValid && errors.length === 0 && warnings.length === 0 && (
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-900">All validations passed</h4>
              <p className="text-xs text-green-800 mt-1">
                {canGenerate
                  ? 'Ready to generate reports'
                  : 'Entries are valid but reports cannot be generated yet'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}