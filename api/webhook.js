import { db } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';

// Stripe signature verification needs the raw, unparsed body.
export const config = { api: { bodyParser: false } };

function rawBody(req) {
    // Some runtimes hand us the body already; only read the stream if not.
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));

    // If the body was parsed into an object, the exact bytes Stripe signed are
    // gone and verification can never succeed. Fail loudly instead of silently.
    if (req.body && typeof req.body === 'object') {
        return Promise.reject(
            new Error(
                'Request body was parsed before reaching the handler. ' +
                'Stripe signature verification needs the raw body — ' +
                'ensure `export const config = { api: { bodyParser: false } }` is honored.'
            )
        );
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
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
