import { db } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';
import { taxRateIds } from '../lib/tax.js';
import { exhibitionEnded } from '../lib/ended.js';
import {
    REFUND_POLICY,
    PRICE_EARLY_BIRD,
    PRICE_GENERAL,
    EARLY_BIRD_TOTAL,
    HOLD_MINUTES,
    MAX_TICKETS_PER_ORDER
} from '../lib/config.js';

function siteUrl(req) {
    if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');

    const host = req.headers.host || '';
    const forwarded = req.headers['x-forwarded-proto'];

    // Local dev serves plain HTTP; assuming https there sends Stripe's redirect
    // to https://localhost and the browser fails with ERR_SSL_PROTOCOL_ERROR.
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    const proto = forwarded || (isLocal ? 'http' : 'https');

    return `${proto}://${host}`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const sessionId = String(body.sessionId ?? '');
    const quantity = Number(body.quantity ?? 1);
    const email = String(body.email ?? '').trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Never trust the client: re-validate everything server-side.
    if (!sessionId) return res.status(400).json({ error: 'missing_session' });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
        return res.status(400).json({ error: 'invalid_quantity' });
    }

    // Refuse once the exhibition is over — no reserving past-dated sessions.
    if (exhibitionEnded()) {
        return res.status(410).json({ error: 'ended' });
    }

    const supabase = db();
    let hold;

    try {
        // Atomically reserve the spots and decide the Early Bird / General split.
        const { data, error } = await supabase.rpc('reserve_spots', {
            p_session_id: sessionId,
            p_quantity: quantity,
            p_early_bird_total: EARLY_BIRD_TOTAL,
            p_hold_minutes: HOLD_MINUTES
        });

        if (error) {
            const msg = error.message || '';
            if (msg.includes('sold_out')) return res.status(409).json({ error: 'sold_out' });
            if (msg.includes('unknown_session')) return res.status(404).json({ error: 'unknown_session' });
            if (msg.includes('invalid_quantity')) return res.status(400).json({ error: 'invalid_quantity' });
            throw error;
        }

        hold = Array.isArray(data) ? data[0] : data;
        if (!hold) throw new Error('reserve_spots returned no row');
    } catch (err) {
        console.error('[checkout:reserve]', err);
        return res.status(500).json({ error: 'server_error' });
    }

    // Build line items. An order can straddle the Early Bird cap, e.g. buying 2
    // when only 1 Early Bird ticket is left -> 1 @ $29 + 1 @ $35.
    // tax_rates is undefined unless STRIPE_TAX_RATE_ID is configured.
    const rates = taxRateIds();
    const lineItems = [];
    if (hold.early_bird_qty > 0) {
        lineItems.push({ price: PRICE_EARLY_BIRD, quantity: hold.early_bird_qty, tax_rates: rates });
    }
    if (hold.general_qty > 0) {
        lineItems.push({ price: PRICE_GENERAL, quantity: hold.general_qty, tax_rates: rates });
    }

    try {
        const base = siteUrl(req);
        const checkout = await stripe().checkout.sessions.create({
            mode: 'payment',
            line_items: lineItems,
            // Expire the Stripe session with the hold so spots are not stranded.
            expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
            // Prefill the email they entered so it's consistent across payment
            // methods (Apple Pay would otherwise override it with its own).
            customer_email: emailOk ? email : undefined,
            success_url: `${base}/tickets-success.html?cs={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}/loves-last-letter-tickets.html?canceled=1`,
            custom_text: {
                submit: { message: REFUND_POLICY }
            },
            metadata: {
                hold_id: hold.hold_id,
                session_id: sessionId,
                quantity: String(quantity),
                early_bird_qty: String(hold.early_bird_qty),
                general_qty: String(hold.general_qty)
            }
        });

        await supabase
            .from('holds')
            .update({ stripe_session_id: checkout.id })
            .eq('id', hold.hold_id);

        return res.status(200).json({ url: checkout.url });
    } catch (err) {
        if (err?.raw?.code === 'resource_missing' && /price/i.test(err?.raw?.param || '')) {
            console.error(
                '[checkout:stripe] Price id not found for this key. Test and live mode ' +
                'have separate objects — set STRIPE_PRICE_EARLY_BIRD / STRIPE_PRICE_GENERAL ' +
                'to ids created in the same mode as STRIPE_SECRET_KEY.'
            );
        }
        console.error('[checkout:stripe]', err.message);
        // Stripe failed — release the spots we just reserved.
        await supabase.from('holds').update({ status: 'expired' }).eq('id', hold.hold_id);
        return res.status(500).json({ error: 'stripe_error' });
    }
}
