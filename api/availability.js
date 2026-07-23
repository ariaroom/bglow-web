import { db } from '../lib/db.js';
import { taxInfo } from '../lib/tax.js';
import { priceAmounts } from '../lib/prices.js';
import {
    EARLY_BIRD_TOTAL,
    MAX_TICKETS_PER_ORDER,
    REFUND_POLICY
} from '../lib/config.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    try {
        const supabase = db();

        const { data: sessions, error: sErr } = await supabase
            .from('sessions')
            .select('id, session_date, day_label, time_label, sort_order, is_finale, capacity')
            .order('sort_order', { ascending: true });
        if (sErr) throw sErr;

        // Everything currently holding inventory (paid, or pending & unexpired).
        const { data: holds, error: hErr } = await supabase
            .from('live_holds')
            .select('session_id, quantity, early_bird_qty');
        if (hErr) throw hErr;

        const takenBySession = new Map();
        let earlyBirdSold = 0;
        for (const h of holds ?? []) {
            takenBySession.set(h.session_id, (takenBySession.get(h.session_id) ?? 0) + h.quantity);
            earlyBirdSold += h.early_bird_qty;
        }

        const earlyBirdRemaining = Math.max(0, EARLY_BIRD_TOTAL - earlyBirdSold);

        const payload = {
            sessions: (sessions ?? []).map((s) => {
                const spotsLeft = Math.max(0, s.capacity - (takenBySession.get(s.id) ?? 0));
                return {
                    id: s.id,
                    dayLabel: s.day_label,
                    timeLabel: s.time_label,
                    isFinale: s.is_finale,
                    spotsLeft,
                    soldOut: spotsLeft === 0
                };
            }),
            earlyBird: {
                total: EARLY_BIRD_TOTAL,
                sold: earlyBirdSold,
                remaining: earlyBirdRemaining,
                active: earlyBirdRemaining > 0
            },
            prices: await priceAmounts(),
            tax: await taxInfo(),
            refundPolicy: REFUND_POLICY,
            maxPerOrder: MAX_TICKETS_PER_ORDER
        };

        // Inventory changes constantly — never cache it.
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(payload);
    } catch (err) {
        console.error('[availability]', err);
        return res.status(500).json({ error: 'server_error' });
    }
}
