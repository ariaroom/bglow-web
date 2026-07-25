// Ticketing configuration for "Love's Last Letter".
// NOTE: Product/Price IDs are NOT secrets — they are safe to keep in source.
// Secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY)
// must only ever come from environment variables.

// Test mode and live mode have completely separate objects: a live price id is
// invalid when called with a test key. Keep them overridable per environment,
// defaulting to the live ids used in production.
export const STRIPE_PRODUCT_ID =
    process.env.STRIPE_PRODUCT_ID || 'prod_Uvg8KzAoi2qcP2';

export const PRICE_EARLY_BIRD =
    process.env.STRIPE_PRICE_EARLY_BIRD || 'price_1Tvolx3uIq1zFZFfdswnhFT2'; // $29

export const PRICE_GENERAL =
    process.env.STRIPE_PRICE_GENERAL || 'price_1Tvolx3uIq1zFZFfQtFc4lme'; // $32

// Amounts are NOT stored here — lib/prices.js reads them from Stripe so the
// displayed price always matches what is charged.

// Early Bird is capped across the WHOLE run, not per session.
export const EARLY_BIRD_TOTAL = 14;

export const SPOTS_PER_SESSION = 9;

// No per-person cap: the only limit is what the chosen session still has free.
export const MAX_TICKETS_PER_ORDER = SPOTS_PER_SESSION;

// How long a pending checkout holds its spots before they are released.
export const HOLD_MINUTES = 30;

export const CURRENCY = 'usd';

// After this date (America/New_York) the Love's Last Letter exhibition is over:
// checkout is refused and the ticket page shows an 'ended' state.
export const EXHIBITION_END = '2026-08-31';

// Refund policy (shown on the ticket page AND inside Stripe Checkout, so the
// buyer sees the same terms in both places).
export const REFUND_POLICY =
    'Full refund up to 7 days before your session. Within 7 days, tickets are ' +
    'non-refundable but may be exchanged for another session, subject to availability. ' +
    'Email bglowteam@gmail.com to request a refund or exchange.';
