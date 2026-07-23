import Stripe from 'stripe';

let client;

export function stripe() {
    if (client) return client;

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY');

    client = new Stripe(key, { apiVersion: '2024-06-20' });
    return client;
}
