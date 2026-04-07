import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

const PRICE_MAP = {
  starter: "price_1TBR595DeONY1PDTEmvwkfa4",
  professional: "price_1TBR595DeONY1PDTUiS364VY",
  enterprise: "price_1TBR595DeONY1PDTfdbmX3rU"
};

const TIER_LIMITS = {
  starter: { max_employees: 3, max_clients: 25 },
  professional: { max_employees: 10, max_clients: 100 },
  enterprise: { max_employees: 999, max_clients: 9999 }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, org_name, org_industry, success_url, cancel_url } = await req.json();

    if (!PRICE_MAP[tier]) return Response.json({ error: 'Invalid tier' }, { status: 400 });

    // Create or get org record (trialing)
    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const org = await base44.asServiceRole.entities.Organization.create({
      name: org_name || `${user.full_name}'s Organization`,
      industry: org_industry || "",
      owner_email: user.email,
      subscription_tier: tier,
      subscription_status: "incomplete",
      trial_ends_at: trialEnds,
      ...TIER_LIMITS[tier]
    });

    // Stamp org_id on the admin user so tenant scoping works immediately
    const users = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (users[0]) {
      await base44.asServiceRole.entities.User.update(users[0].id, { org_id: org.id });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICE_MAP[tier], quantity: 1 }],
      customer_email: user.email,
      success_url: success_url || `${req.headers.get('origin')}/OrgDashboard?session_id={CHECKOUT_SESSION_ID}&org_id=${org.id}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/Pricing`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        org_id: org.id,
        user_email: user.email,
        tier
      },
      subscription_data: {
        metadata: { org_id: org.id }
      }
    });

    return Response.json({ url: session.url, org_id: org.id });
  } catch (error) {
    console.error("Checkout error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});