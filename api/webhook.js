import { db } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';
import { sendTicketEmail } from '../lib/email.js';
import { REFUND_POLICY } from '../lib/config.js';

// Runs once, the first time an order is confirmed paid. Best-effort: a failure
// here must not 500 the webhook (that would make Stripe retry and double-process),
// so each side effect is wrapped and only logged on failure.
async function onOrderConfirmed({ supabase, cs, hold, email, pi }) {
    // Human-readable session labels for the ticket.
    let dayLabel = hold.session_id, timeLabel = '';
    try {
        const { data: s } = await supabase
            .from('sessions')
            .select('day_label, time_label')
            .eq('id', hold.session_id)
            .single();
        if (s) { dayLabel = s.day_label; timeLabel = s.time_label; }
    } catch (e) {
        console.error('[webhook] session lookup failed:', e.message);
    }

    const orderRef = 'LLL-' + String(hold.id).slice(0, 8).toUpperCase();

    // 1) Our branded ticket email (from bglowteam@gmail.com).
    if (email) {
        try {
            await sendTicketEmail({
                to: email,
                name: cs.customer_details?.name || '',
                dayLabel,
                timeLabel,
                quantity: hold.quantity,
                amount: (cs.amount_total ?? 0) / 100,
                orderRef,
                refundPolicy: REFUND_POLICY
            });
            console.log('[webhook] ticket emailed to', email, orderRef);
        } catch (e) {
            console.error('[webhook] ticket email FAILED:', e.message);
        }
    } else {
        console.warn('[webhook] no email on', orderRef, '- ticket not sent');
    }

    // 2) Also trigger Stripe's official payment receipt.
    if (pi && email) {
        try {
            await stripe().paymentIntents.update(pi, { receipt_email: email });
        } catch (e) {
            console.error('[webhook] receipt_email set failed:', e.message);
        }
    }
}

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
                const email = cs.customer_details?.email ?? null;
                const pi = typeof cs.payment_intent === 'string'
                    ? cs.payment_intent
                    : cs.payment_intent?.id ?? null;

                // Idempotent: only rows still 'pending' flip to 'paid'. .select()
                // returns them, so a re-delivered event updates nothing and we
                // skip re-sending the ticket.
                const { data: confirmed } = await supabase
                    .from('holds')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        customer_email: email,
                        stripe_payment_intent: pi
                    })
                    .eq('stripe_session_id', cs.id)
                    .eq('status', 'pending')
                    .select('id, session_id, quantity');

                if (confirmed && confirmed.length) {
                    // First confirmation for this order → send the ticket + receipt.
                    await onOrderConfirmed({ supabase, cs, hold: confirmed[0], email, pi });
                }
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
