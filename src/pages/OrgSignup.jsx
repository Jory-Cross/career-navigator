import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PLAN_LABELS = { starter: "Starter — $49/mo", professional: "Professional — $99/mo", enterprise: "Enterprise — $249/mo" };

export default function OrgSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", industry: "", plan: "professional" });
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan) setForm(f => ({ ...f, plan }));
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Organization name is required"); return; }

    // Block if in iframe
    if (window.self !== window.top) {
      alert("Checkout is only available from the published app, not the preview.");
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke("createCheckoutSession", {
        tier: form.plan,
        org_name: form.name,
        org_industry: form.industry,
        success_url: `${window.location.origin}/OrgDashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/Pricing`
      });

      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.data?.error || "Failed to start checkout");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Your Organization</h1>
          <p className="text-slate-500 mt-1 text-sm">Set up your team's coaching portal in minutes</p>
        </div>

        <Card className="border-0 shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Organization Name *</Label>
              <Input
                placeholder="e.g. Bright Futures Coaching"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Industry</Label>
              <Input
                placeholder="e.g. Workforce Development, Vocational Rehab..."
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Plan</Label>
              <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter — $49/mo</SelectItem>
                  <SelectItem value="professional">Professional — $99/mo</SelectItem>
                  <SelectItem value="enterprise">Enterprise — $249/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2 mt-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
              14-day free trial included — you won't be charged until after the trial ends.
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</> : "Continue to Payment"}
            </Button>
            <p className="text-center text-xs text-slate-400">Secured by Stripe. Cancel anytime.</p>
          </form>
        </Card>

        {user && (
          <p className="text-center text-xs text-slate-400 mt-4">Signing up as <strong>{user.email}</strong></p>
        )}
      </div>
    </div>
  );
}