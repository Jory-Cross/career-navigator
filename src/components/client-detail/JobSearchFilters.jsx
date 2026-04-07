import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JobSearchFilters({ filters, onFiltersChange }) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClear = (key) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const activeCount = Object.keys(filters).length;
  const showSummary = activeCount > 0 && !expanded;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">🔍 Search Filters</span>
          {activeCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{activeCount} active</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {showSummary && (
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
          {filters.workType && <span className="inline-block mr-3">📍 {filters.workType}</span>}
          {filters.employmentType && <span className="inline-block mr-3">⏱️ {filters.employmentType}</span>}
          {filters.locationRadius && <span className="inline-block mr-3">📏 {filters.locationRadius}</span>}
          {filters.payMin && <span className="inline-block mr-3">💰 ${filters.payMin}+/hr</span>}
          {filters.industry && <span className="inline-block mr-3">🏭 {filters.industry}</span>}
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
          {/* Location type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Work Location Type</Label>
            <Select value={filters.workType || 'any'} onValueChange={v => handleChange('workType', v === 'any' ? null : v)}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any (no preference)</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">In-Person Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location radius */}
          {filters.workType !== 'remote' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Search Radius</Label>
              <Select value={filters.locationRadius || '50 miles'} onValueChange={v => handleChange('locationRadius', v)}>
                <SelectTrigger className="text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5 miles">5 miles</SelectItem>
                  <SelectItem value="10 miles">10 miles</SelectItem>
                  <SelectItem value="25 miles">25 miles</SelectItem>
                  <SelectItem value="50 miles">50 miles</SelectItem>
                  <SelectItem value="100 miles">100 miles</SelectItem>
                  <SelectItem value="statewide">Statewide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Employment type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Employment Type</Label>
            <Select value={filters.employmentType || 'any'} onValueChange={v => handleChange('employmentType', v === 'any' ? null : v)}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any (no preference)</SelectItem>
                <SelectItem value="full-time">Full-Time</SelectItem>
                <SelectItem value="part-time">Part-Time</SelectItem>
                <SelectItem value="contract">Contract / Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Industry (optional)</Label>
            <Select value={filters.industry || ''} onValueChange={v => handleChange('industry', v || null)}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue placeholder="Any industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Any industry</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Food Service">Food Service</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                <SelectItem value="Warehouse / Logistics">Warehouse / Logistics</SelectItem>
                <SelectItem value="Administrative">Administrative</SelectItem>
                <SelectItem value="Custodial / Cleaning">Custodial / Cleaning</SelectItem>
                <SelectItem value="Landscaping">Landscaping</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pay range */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Min Pay/hr (optional)</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 15"
                  value={filters.payMin || ''}
                  onChange={e => handleChange('payMin', e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Max Pay/hr (optional)</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 30"
                  value={filters.payMax || ''}
                  onChange={e => handleChange('payMax', e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Schedule Preference (optional)</Label>
            <Select value={filters.schedule || ''} onValueChange={v => handleChange('schedule', v || null)}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue placeholder="Any schedule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Any schedule</SelectItem>
                <SelectItem value="Morning (6am-2pm)">Morning Shift (6am-2pm)</SelectItem>
                <SelectItem value="Afternoon (2pm-10pm)">Afternoon Shift (2pm-10pm)</SelectItem>
                <SelectItem value="Evening (4pm-midnight)">Evening Shift (4pm-midnight)</SelectItem>
                <SelectItem value="Flexible">Flexible Hours</SelectItem>
                <SelectItem value="Weekdays only">Weekdays Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters button */}
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7 border-slate-200 text-slate-500 hover:bg-slate-50"
              onClick={() => onFiltersChange({})}
            >
              <X className="w-3 h-3 mr-1" /> Clear All Filters
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}