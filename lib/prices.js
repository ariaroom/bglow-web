import { stripe } from './stripe.js';
import { PRICE_EARLY_BIRD, PRICE_GENERAL } from './config.js';

// Stripe is the source of truth for amounts. Reading them here (instead of
// hard-coding numbers) means the price shown to the buyer can never drift from
// the amount actually charged — change it in the Dashboard and the site follows.
let cache = null;

async function amountOf(id) {
    const price = await stripe().prices.retrieve(id);
    if (typeof price.unit_amount !== 'number') {
        throw new Error(`Price ${id} has no unit_amount`);
    }
    return price.unit_amount / 100;
}

export async function priceAmounts() {
    const keyed = `${PRICE_EARLY_BIRD}|${PRICE_GENERAL}`;
    if (cache && cache.key === keyed) return cache.value;

    const [earlyBird, general] = await Promise.all([
        amountOf(PRICE_EARLY_BIRD),
        amountOf(PRICE_GENERAL)
    ]);

    cache = { key: keyed, value: { earlyBird, general } };
    return cache.value;
}
