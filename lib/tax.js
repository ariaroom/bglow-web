import { stripe } from './stripe.js';

// Sales tax is OFF unless STRIPE_TAX_RATE_ID is set.
//
// Stripe is the single source of truth for the rate: we read the TaxRate object
// rather than keeping a percentage in two places, so the number shown to the
// buyer can never drift from the number actually charged.
let cache = null;

export async function taxInfo() {
    const id = process.env.STRIPE_TAX_RATE_ID;
    if (!id) return { enabled: false };

    if (cache && cache.id === id) return cache.info;

    try {
        const rate = await stripe().taxRates.retrieve(id);

        if (!rate.active) {
            console.warn('[tax] TaxRate %s is archived — treating tax as disabled', id);
            return { enabled: false };
        }

        const info = {
            enabled: true,
            percent: Number(rate.percentage),
            displayName: rate.display_name || 'Tax',
            inclusive: rate.inclusive === true
        };
        cache = { id, info };
        return info;
    } catch (err) {
        // Never block a sale because the tax lookup failed.
        console.error('[tax] could not retrieve TaxRate', id, err.message);
        return { enabled: false };
    }
}

export function taxRateIds() {
    const id = process.env.STRIPE_TAX_RATE_ID;
    return id ? [id] : undefined;
}
