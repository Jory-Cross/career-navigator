import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

const TIER_LIMITS = {
  starter: { max_employees: 3, max_clients: 25 },
  professional: { max_employees: 10, max_clients: 100 },
  enterprise: { max_employees: 999, max_clients: 9999 }
};

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { org_id, tier } = session.metadata || {};
      if (org_id) {
        await base44.asServiceRole.entities.Organization.update(org_id, {
          subscription_status: "active",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscription_tier: tier,
          ...(TIER_LIMITS[tier] || {})
        });
        console.log(`Org ${org_id} activated on ${tier}`);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const org_id = sub.metadata?.org_id;
      if (org_id) {
        await base44.asServiceRole.entities.Organization.update(org_id, {
          subscription_status: sub.status
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const org_id = sub.metadata?.org_id;
      if (org_id) {
        await base44.asServiceRole.entities.Organization.update(org_id, {
          subscription_status: "cancelled",
          is_active: false
        });
        console.log(`Org ${org_id} subscription cancelled`);
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err.message);
  }

  return Response.json({ received: true });
});