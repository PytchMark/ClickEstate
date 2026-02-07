const Stripe = require('stripe');

let stripe = null;

// Pricing plans (amounts in dollars)
const PLANS = {
  starter: {
    name: 'Starter',
    price: 29.00,
    listings: 5,
    images: 3,
    videos: 0,
    features: ['5 Active Listings', '3 Images per Listing', 'Basic Analytics', 'Email Support']
  },
  pro: {
    name: 'Pro',
    price: 79.00,
    listings: 33,
    images: 6,
    videos: 2,
    features: ['33 Active Listings', '6 Images per Listing', '2 Videos per Listing', 'Advanced Analytics', 'Priority Support', 'Featured Listings']
  },
  unlimited: {
    name: 'Unlimited',
    price: 199.00,
    listings: Infinity,
    images: 12,
    videos: 3,
    features: ['Unlimited Listings', '12 Images per Listing', '3 Videos per Listing', 'Full Analytics Suite', '24/7 Phone Support', 'Custom Branding', 'API Access']
  }
};

function getStripe() {
  if (!stripe && process.env.STRIPE_API_KEY) {
    stripe = new Stripe(process.env.STRIPE_API_KEY);
  }
  return stripe;
}

function getPlans() {
  return PLANS;
}

async function createCheckoutSession({ planId, originUrl, metadata = {} }) {
  const stripeClient = getStripe();
  if (!stripeClient) {
    return { ok: false, error: 'Stripe not configured - STRIPE_API_KEY not set' };
  }

  const plan = PLANS[planId];
  if (!plan) {
    return { ok: false, error: 'Invalid plan selected' };
  }

  const successUrl = `${originUrl}/realtor/signup?success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${originUrl}/realtor/signup?canceled=true`;

  try {
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `ClickEstate ${plan.name} Plan`,
            description: plan.features.slice(0, 3).join(', '),
            images: ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400']
          },
          unit_amount: Math.round(plan.price * 100), // Convert to cents
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan_id: planId,
        plan_name: plan.name,
        ...metadata
      }
    });

    return {
      ok: true,
      url: session.url,
      sessionId: session.id
    };

  } catch (error) {
    console.error('[Stripe] Error creating checkout session:', error.message);
    return { ok: false, error: error.message };
  }
}

async function getCheckoutStatus(sessionId) {
  const stripeClient = getStripe();
  if (!stripeClient) {
    return { ok: false, error: 'Stripe not configured' };
  }

  try {
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    
    return {
      ok: true,
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
      customerEmail: session.customer_email || session.customer_details?.email
    };

  } catch (error) {
    console.error('[Stripe] Error retrieving session:', error.message);
    return { ok: false, error: error.message };
  }
}

async function handleWebhook(body, signature) {
  const stripeClient = getStripe();
  if (!stripeClient) {
    return { ok: false, error: 'Stripe not configured' };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  try {
    let event;
    
    if (webhookSecret) {
      event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(body.toString());
    }

    const eventType = event.type;
    const session = event.data.object;

    return {
      ok: true,
      eventType,
      eventId: event.id,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      metadata: session.metadata
    };

  } catch (error) {
    console.error('[Stripe] Webhook error:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = { getPlans, createCheckoutSession, getCheckoutStatus, handleWebhook };
