import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Building2, Rocket, Users, Brain, Shield, ChevronRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    icon: Rocket,
    color: "from-blue-500 to-blue-600",
    badge: null,
    description: "Perfect for small job coaching practices",
    features: [
      "Up to 3 employees",
      "Up to 25 clients",
      "Job application tracking",
      "Resume builder",
      "Task management",
      "Time tracking",
      "Email templates",
      "Client portal"
    ],
    limits: { employees: 3, clients: 25 }
  },
  {
    id: "professional",
    name: "Professional",
    price: 99,
    icon: Zap,
    color: "from-purple-500 to-purple-600",
    badge: "Most Popular",
    description: "For growing teams with advanced needs",
    features: [
      "Up to 10 employees",
      "Up to 100 clients",
      "Everything in Starter",
      "AI interview coaching",
      "AI resume builder",
      "AI job suggestions",
      "Advanced reporting",
      "Calendar integration",
      "Priority support"
    ],
    limits: { employees: 10, clients: 100 }
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 249,
    icon: Building2,
    color: "from-emerald-500 to-emerald-600",
    badge: null,
    description: "For large organizations at scale",
    features: [
      "Unlimited employees",
      "Unlimited clients",
      "Everything in Professional",
      "Custom branding",
      "Dedicated support",
      "SLA guarantee",
      "Bulk onboarding",
      "API access"
    ],
    limits: { employees: "∞", clients: "∞" }
  }
];

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

  const handleSelect = async (plan) => {
    // Check if in iframe
    if (window.self !== window.top) {
      alert("Checkout is only available from the published app, not the preview.");
      return;
    }

    try {
      setLoading(plan.id);
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      // Navigate to org signup with plan pre-selected
      navigate(`/OrgSignup?plan=${plan.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <div className="text-center pt-20 pb-12 px-4">
        <Badge className="mb-4 bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <Star className="w-3 h-3 mr-1" /> Job Coaching Platform
        </Badge>
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          Grow Your Coaching Business
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Everything you need to manage clients, track applications, and deliver exceptional career coaching — all in one platform.
        </p>
      </div>

      {/* Value Props */}
      <div className="flex justify-center gap-8 mb-16 px-4 flex-wrap">
        {[
          { icon: Users, label: "Client Management" },
          { icon: Brain, label: "AI-Powered Tools" },
          { icon: Shield, label: "Secure & Compliant" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-slate-400">
            <Icon className="w-4 h-4 text-purple-400" />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isPopular = plan.badge === "Most Popular";
            return (
              <Card key={plan.id} className={`relative border-0 p-0 overflow-hidden ${isPopular ? 'ring-2 ring-purple-500 scale-105' : ''}`}>
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 text-center py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}
                <div className={`p-6 ${isPopular ? 'pt-10' : ''}`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900">${plan.price}</span>
                    <span className="text-slate-500 text-sm">/month</span>
                  </div>

                  <div className="flex gap-4 mb-6 p-3 bg-slate-50 rounded-lg">
                    <div className="text-center flex-1">
                      <div className="text-lg font-bold text-slate-900">{plan.limits.employees}</div>
                      <div className="text-xs text-slate-500">Employees</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-lg font-bold text-slate-900">{plan.limits.clients}</div>
                      <div className="text-xs text-slate-500">Clients</div>
                    </div>
                  </div>

                  <Button
                    className={`w-full bg-gradient-to-r ${plan.color} hover:opacity-90 text-white border-0 mb-6`}
                    onClick={() => handleSelect(plan)}
                    disabled={loading === plan.id}
                  >
                    {loading === plan.id ? "Loading..." : "Get Started"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <ul className="space-y-2.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-slate-500 text-sm mt-10">
          All plans include a 14-day free trial. No credit card required to start.
        </p>
      </div>
    </div>
  );
}