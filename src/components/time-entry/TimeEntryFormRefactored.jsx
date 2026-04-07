import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { getActiveEntryTypes, validateTimeEntryData } from '@/lib/timeEntryFactory';

/**
 * TimeEntry Form (Refactored)
 * Uses entry_type_id/entry_type_code as source of truth
 * No longer relies on legacy category enum
 */

export default function TimeEntryFormRefactored({ clientId, onSuccess, defaultDate }) {
  const [entryTypes, setEntryTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    date: defaultDate || new Date().toISOString().split('T')[0],
    entry_type_code: '',
    duration_minutes: '',
    start_time: '',
    end_time: '',
    description: '',
    general_notes: ''
  });

  useEffect(() => {
    loadEntryTypes();
  }, []);

  const loadEntryTypes = async () => {
    try {
      const types = await getActiveEntryTypes(base44);
      setEntryTypes(types);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load entry types');
      setLoading(false);
    }
  };

  const calculateDuration = () => {
    if (!formData.start_time || !formData.end_time) return;

    const [startHour, startMin] = formData.start_time.split(':').map(Number);
    const [endHour, endMin] = formData.end_time.split(':').map(Number);

    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;
    const duration = Math.max(0, endTotalMin - startTotalMin);

    setFormData(prev => ({
      ...prev,
      duration_minutes: duration || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      // Find entry type to get id
      const selectedType = entryTypes.find(t => t.code === formData.entry_type_code);
      if (!selectedType) {
        toast.error('Please select an entry type');
        setSubmitting(false);
        return;
      }

      // Validate data
      const validation = await validateTimeEntryData(base44, {
        client_id: clientId,
        date: formData.date,
        duration_minutes: parseInt(formData.duration_minutes),
        entry_type_code: formData.entry_type_code,
        description: formData.description,
        general_notes: formData.general_notes,
        start_time: formData.start_time,
        end_time: formData.end_time
      });

      if (!validation.valid) {
        setErrors({ submit: validation.errors.join(', ') });
        toast.error(validation.errors[0]);
        setSubmitting(false);
        return;
      }

      // Create time entry with entry_type_id and code
      const entry = await base44.asServiceRole.entities.TimeEntry.create({
        client_id: clientId,
        date: formData.date,
        duration_minutes: parseInt(formData.duration_minutes),
        entry_type_id: selectedType.id,
        entry_type_code: selectedType.code,
        description: formData.description || null,
        general_notes: formData.general_notes || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        org_id: base44.auth.me?.()?.org_id
      });

      toast.success(`Time entry logged: ${selectedType.name} - ${formData.duration_minutes} minutes`);

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        entry_type_code: '',
        duration_minutes: '',
        start_time: '',
        end_time: '',
        description: '',
        general_notes: ''
      });

      onSuccess?.(entry);
    } catch (err) {
      console.error('Error creating time entry:', err);
      const errorMsg = err.response?.data?.message || err.message;
      setErrors({ submit: errorMsg });
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading entry types...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Log Time Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-xs font-semibold">
              Date
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Entry Type (NEW: Uses entry_type_code, not category) */}
          <div className="space-y-2">
            <Label htmlFor="entry_type" className="text-xs font-semibold">
              Entry Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.entry_type_code}
              onValueChange={(value) => setFormData(prev => ({ ...prev, entry_type_code: value }))}
            >
              <SelectTrigger id="entry_type">
                <SelectValue placeholder="Select entry type..." />
              </SelectTrigger>
              <SelectContent>
                {entryTypes.map(type => (
                  <SelectItem key={type.id} value={type.code}>
                    {type.name}
                    {type.description && ` - ${type.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="grid grid-cols-3 gap-3">
            {/* Manual Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-xs font-semibold">
                Duration (min)
              </Label>
              <Input
                id="duration"
                type="number"
                min="0"
                step="5"
                value={formData.duration_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                placeholder="0"
                required
              />
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label htmlFor="start_time" className="text-xs font-semibold">
                Start
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, start_time: e.target.value }));
                  }}
                  className="pl-9"
                  onBlur={calculateDuration}
                />
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="end_time" className="text-xs font-semibold">
                End
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, end_time: e.target.value }));
                  }}
                  className="pl-9"
                  onBlur={calculateDuration}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold">
              Description
            </Label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Interview prep session"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Internal Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.general_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, general_notes: e.target.value }))}
              placeholder="Internal notes (not included in VR reports)"
              className="text-xs h-20"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Logging...' : 'Log Time Entry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}