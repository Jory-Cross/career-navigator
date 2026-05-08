import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, UserX, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AccessRequestsPanel() {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);

  const { data: requests = [] } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.filter({ status: 'pending' }, '-created_date'),
    refetchInterval: 30000
  });

  const handle = async (req, action) => {
    setProcessing(req.id);
    try {
      await base44.functions.invoke('approveAccessRequest', {
        requestId: req.id,
        email: req.email,
        full_name: req.full_name,
        client_type: req.client_type,
        action
      });
      toast.success(action === 'approve' ? `Access approved for ${req.full_name}` : `Request denied`);
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <Card className="p-4 border-orange-200 bg-orange-50">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-600" />
        <h3 className="font-semibold text-orange-900 text-sm">Pending Access Requests</h3>
        <Badge className="bg-orange-600 text-white text-xs">{requests.length}</Badge>
      </div>

      {/* Security warning */}
      <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3 mb-3 text-xs text-red-800">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
        <div>
          <p className="font-semibold">Do not approve public signups for client portal access.</p>
          <p className="mt-0.5 text-red-700">
            Use the <strong>Invite to Portal</strong> button from the client record instead. Approving
            unknown signups here is a security risk.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {requests.map(req => (
          <div key={req.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
            <div>
              <p className="font-medium text-sm text-slate-900">{req.full_name}</p>
              <p className="text-xs text-slate-500">{req.email} · <span className="capitalize">{req.client_type?.replace('_', ' ')}</span></p>
              {req.message && <p className="text-xs text-slate-400 mt-0.5 italic">"{req.message}"</p>}
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                disabled={processing === req.id}
                onClick={() => handle(req, 'deny')}
              >
                <UserX className="w-3 h-3 mr-1" /> Deny
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                disabled={processing === req.id}
                onClick={() => handle(req, 'approve')}
              >
                <UserCheck className="w-3 h-3 mr-1" /> Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}