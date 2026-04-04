/**
 * Stripe API Routes
 * 
 * Backend endpoints for Stripe Checkout, Customer Portal, and Webhooks.
 * These routes handle web subscription purchases.
 */

import { Router, Request, Response } from 'express';

// Note: In production, use actual Stripe SDK
// import Stripe from 'stripe';

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

    // In production, use Stripe SDK:
    // const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    // 
    // const session = await stripe.checkout.sessions.create({
    //   mode: priceId.includes('lifetime') ? 'payment' : 'subscription',
    //   payment_method_types: ['card'],
    //   line_items: [{ price: priceId, quantity: 1 }],
    //   success_url: successUrl,
    //   cancel_url: cancelUrl,
    //   customer_email: customerEmail,
    //   subscription_data: priceId.includes('lifetime') ? undefined : {
    //     trial_period_days: trialDays || 14,
    //   },
    // });
    // 
    // return res.json({ url: session.url });

    // Mock response for development
    console.log('[Stripe] Creating checkout session:', { priceId, customerEmail });
    
    return res.json({
      url: `https://checkout.stripe.com/mock-session?price=${priceId}`,
      sessionId: `cs_mock_${Date.now()}`,
    });
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
    const { returnUrl } = req.body;

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // In production, use Stripe SDK:
    // const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    // 
    // // Get customer ID from session/database
    // const customerId = req.session?.stripeCustomerId;
    // 
    // const portalSession = await stripe.billingPortal.sessions.create({
    //   customer: customerId,
    //   return_url: returnUrl,
    // });
    // 
    // return res.json({ url: portalSession.url });

    // Mock response for development
    console.log('[Stripe] Creating portal session');
    
    return res.json({
      url: `https://billing.stripe.com/mock-portal`,
    });
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

    // In production, get from database or Stripe API:
    // const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    // 
    // const customerId = req.session?.stripeCustomerId;
    // if (!customerId) {
    //   return res.status(404).json({ error: 'No subscription found' });
    // }
    // 
    // const subscriptions = await stripe.subscriptions.list({
    //   customer: customerId,
    //   status: 'all',
    //   limit: 1,
    // });
    // 
    // if (!subscriptions.data.length) {
    //   return res.status(404).json({ error: 'No subscription found' });
    // }
    // 
    // const sub = subscriptions.data[0];
    // return res.json({
    //   id: sub.id,
    //   status: sub.status,
    //   priceId: sub.items.data[0].price.id,
    //   currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    //   cancelAtPeriodEnd: sub.cancel_at_period_end,
    //   trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    // });

    // Mock response for development - return no subscription
    return res.status(404).json({ error: 'No subscription found' });
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

    // In production, verify webhook signature:
    // const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    // const sig = req.headers['stripe-signature'] as string;
    // 
    // let event;
    // try {
    //   event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    // } catch (err: any) {
    //   console.error('[Stripe Webhook] Signature verification failed:', err.message);
    //   return res.status(400).send(`Webhook Error: ${err.message}`);
    // }
    // 
    // switch (event.type) {
    //   case 'customer.subscription.created':
    //   case 'customer.subscription.updated':
    //     const subscription = event.data.object;
    //     // Update user's entitlements in database
    //     await updateUserEntitlements(subscription.customer, subscription);
    //     break;
    //   
    //   case 'customer.subscription.deleted':
    //     const deletedSub = event.data.object;
    //     // Downgrade user to free tier
    //     await downgradeUserToFree(deletedSub.customer);
    //     break;
    //   
    //   case 'invoice.paid':
    //     // Subscription payment successful
    //     break;
    //   
    //   case 'invoice.payment_failed':
    //     // Handle payment failure (send email, retry, etc.)
    //     break;
    // }

    console.log('[Stripe Webhook] Received event');
    
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
