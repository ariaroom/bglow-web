import { db } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';

// Stripe signature verification needs the exact raw bytes. Read them straight
// off the request stream and NEVER touch req.body — accessing it triggers
// @vercel/node's lazy JSON parse, which consumes the stream and leaves us with
// re-serialized bytes that no longer match Stripe's signature.
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        console.error('[webhook] missing STRIPE_WEBHOOK_SECRET');
        return res.status(500).json({ error: 'server_error' });
    }

    let event;
    try {
        const buf = await rawBody(req);
        console.log('[webhook] rawBody bytes:', buf.length, '| bodyType:', typeof req.body);
        event = stripe().webhooks.constructEvent(buf, req.headers['stripe-signature'], secret);
    } catch (err) {
        // Bad signature = not from Stripe. Reject.
        console.error('[webhook] signature verification failed:', err.message);
        return res.status(400).json({ error: 'invalid_signature' });
    }

    const supabase = db();

    try {
        if (event.type === 'checkout.session.completed') {
            const cs = event.data.object;

            // Only confirm if actually paid.
            if (cs.payment_status === 'paid') {
                // Idempotent: re-delivering the same event is a no-op because we
                // only flip rows that are still pending.
                await supabase
                    .from('holds')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        customer_email: cs.customer_details?.email ?? null,
                        // Needed to match a later refund back to this hold.
                        stripe_payment_intent:
                            typeof cs.payment_intent === 'string'
                                ? cs.payment_intent
                                : cs.payment_intent?.id ?? null
                    })
                    .eq('stripe_session_id', cs.id)
                    .eq('status', 'pending');
            }
        } else if (event.type === 'checkout.session.expired') {
            // Buyer abandoned checkout — release the spots immediately.
            const cs = event.data.object;
            await supabase
                .from('holds')
                .update({ status: 'expired' })
                .eq('stripe_session_id', cs.id)
                .eq('status', 'pending');
        } else if (event.type === 'charge.refunded') {
            // A refunded order must give its spots back, or they stay locked forever.
            const charge = event.data.object;
            const pi =
                typeof charge.payment_intent === 'string'
                    ? charge.payment_intent
                    : charge.payment_intent?.id ?? null;

            if (!pi) {
                console.warn('[webhook] charge.refunded with no payment_intent');
            } else if (charge.amount_refunded >= charge.amount) {
                const { data } = await supabase
                    .from('holds')
                    .update({ status: 'refunded' })
                    .eq('stripe_payment_intent', pi)
                    .eq('status', 'paid')
                    .select('id, session_id, quantity');
                console.log('[webhook] refunded, spots released:', data ?? []);
            } else {
                // Partial refunds can't be mapped to a spot count automatically.
                console.warn(
                    `[webhook] PARTIAL refund on ${pi} ` +
                    `(${charge.amount_refunded}/${charge.amount}). ` +
                    'Adjust the hold in Supabase by hand.'
                );
            }
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        // Return 500 so Stripe retries.
        console.error('[webhook] handler error', err);
        return res.status(500).json({ error: 'server_error' });
    }
}
