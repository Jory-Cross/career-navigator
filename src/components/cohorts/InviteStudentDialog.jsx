import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail } from 'lucide-react';

export default function InviteStudentDialog({ open, onOpenChange, onSuccess }) {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error('Please enter a student email');
      return;
    }

    setInviting(true);
    try {
      const res = await base44.functions.invoke('inviteCEStudent', {
        email: email.trim(),
      });

      if (res.data?.ok) {
        toast.success(`Invitation sent to ${email}`);
        setEmail('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(res.data?.error || 'Failed to send invitation');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to invite student');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite CE Student</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="student-email">Student Email Address</Label>
            <Input
              id="student-email"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={inviting}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <p className="text-xs text-slate-500">
              The student will receive an invitation to register for the CE Training Portal. Assign the student to a cohort after registration.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={inviting}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={inviting} className="gap-2">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {inviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
