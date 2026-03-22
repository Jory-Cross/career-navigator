import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UserNotRegisteredError = () => {
  const [step, setStep] = useState('info'); // 'info' | 'form' | 'submitted'
  const [form, setForm] = useState({ full_name: '', email: '', message: '', client_type: 'job_seeker' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email) { setError('Name and email are required'); return; }
    setSubmitting(true);
    setError('');
    try {
      // Use fetch directly to bypass SDK auth restrictions for unregistered users
      const res = await fetch('/api/functions/submitAccessRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit');
      }
      setStep('submitted');
    } catch (err) {
      // Fallback: try SDK invoke
      try {
        await base44.functions.invoke('submitAccessRequest', form);
        setStep('submitted');
      } catch (err2) {
        setError('Unable to submit request. Please contact your employment specialist directly.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'submitted') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-green-100">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Request Submitted!</h1>
          <p className="text-slate-600 mb-4">Your access request has been sent. Your employment specialist will review it shortly.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-blue-800 text-sm font-semibold mb-1">⚠️ Important: Check your email</p>
            <p className="text-blue-700 text-sm">Once approved, you will receive an <strong>invitation email</strong>. You <strong>must use the link in that email</strong> to log in — do not try to log in directly to the app or your access will be delayed.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Request Access</h1>
          <p className="text-slate-500 text-sm mb-6">Fill out the form below and your specialist will approve your access.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Program Type</Label>
              <Select value={form.client_type} onValueChange={v => setForm(f => ({ ...f, client_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job_seeker">Job Seeker</SelectItem>
                  <SelectItem value="pre_ets">Pre-ETS Student</SelectItem>
                  <SelectItem value="dspd">DSPD</SelectItem>
                  <SelectItem value="employed">Employed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Message (optional)</Label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Any additional information..." rows={3} />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep('info')} className="flex-1">Back</Button>
              <Button type="submit" disabled={submitting} className="flex-1">{submitting ? 'Submitting...' : 'Submit Request'}</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Restricted</h1>
          <p className="text-slate-600 mb-4">
            You're not yet registered in this system. If your employment specialist has already invited you, <strong>check your email for an invitation link</strong> and use that to log in.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
            <p className="text-amber-800 text-sm"><strong>Note:</strong> Always use the invitation link from your email to access this app — logging in directly without an invite link will not work.</p>
          </div>
          <p className="text-slate-600 mb-6">If you haven't received an invite, submit an access request below and your specialist will send you one.</p>
          <Button onClick={() => setStep('form')} className="w-full">Request Access</Button>
          <button
            onClick={() => base44.auth.logout()}
            className="mt-4 text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;