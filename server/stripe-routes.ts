/**
 * Stripe API Routes
 *
 * Backend endpoints for Stripe Checkout, Customer Portal, and Webhooks.
 * These routes handle web subscription purchases.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();

// Stripe configuration (from environment variables)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

// Product/Price IDs (configure in Stripe Dashboard)
const STRIPE_PRICES = {
  'price_ironvault_pro_monthly': {
    name: 'IronVault Pro Monthly',
    amount: 299, // $2.99
    interval: 'month',
    trialDays: 14,
  },
  'price_ironvault_pro_yearly': {
    name: 'IronVault Pro Yearly',
    amount: 2999, // $29.99
    interval: 'year',
    trialDays: 14,
  },
  'price_ironvault_lifetime': {
    name: 'IronVault Lifetime',
    amount: 9999, // $99.99
    interval: null, // one-time
    trialDays: 0,
  },
};

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout-session
 */
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { priceId, successUrl, cancelUrl, customerEmail, trialDays } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Missing priceId' });
    }

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = getStripe();
    const isLifetime = priceId.includes('lifetime');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isLifetime ? 'payment' : 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/subscriptions?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      customer_email: customerEmail,
      ...(isLifetime ? {} : {
        subscription_data: { trial_period_days: trialDays || 14 },
      }),
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('[Stripe] Checkout session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

/**
 * Create Stripe Customer Portal Session
 * POST /api/stripe/create-portal-session
 */
router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const { returnUrl, customerId } = req.body;

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.FRONTEND_URL}/subscriptions`,
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('[Stripe] Portal session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create portal session' });
  }
});

/**
 * Get Subscription Status
 * GET /api/stripe/subscription-status
 */
router.get('/subscription-status', async (req: Request, res: Response) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const customerId = (req as any).session?.stripeCustomerId;
    if (!customerId) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });

    if (!subscriptions.data.length) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const sub = subscriptions.data[0];
    return res.json({
      id: sub.id,
      status: sub.status,
      priceId: sub.items.data[0].price.id,
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    });
  } catch (error: any) {
    console.error('[Stripe] Subscription status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get subscription status' });
  }
});

/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles subscription events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Stripe webhooks not configured' });
    }

    const stripe = getStripe();
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Stripe Webhook] Subscription updated:', subscription.id, subscription.status);
        // TODO: update user entitlements in database
        break;
      }
      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        console.log('[Stripe Webhook] Subscription deleted:', deletedSub.id);
        // TODO: downgrade user to free tier
        break;
      }
      case 'invoice.paid':
        console.log('[Stripe Webhook] Invoice paid');
        break;
      case 'invoice.payment_failed':
        console.log('[Stripe Webhook] Invoice payment failed');
        break;
      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
});

/**
 * Get Stripe publishable key (for client-side initialization)
 * GET /api/stripe/config
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    publishableKey: STRIPE_PUBLISHABLE_KEY || null,
    prices: Object.entries(STRIPE_PRICES).map(([id, price]) => ({
      id,
      name: price.name,
      amount: price.amount,
      currency: 'usd',
      interval: price.interval,
      trialDays: price.trialDays,
    })),
  });
});

export default router;
