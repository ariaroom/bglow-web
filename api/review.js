import { db } from '../lib/db.js';

const CHAPTERS = ['nature', 'dog', 'music', 'lover', 'mother', 'myself'];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});

    // Honeypot: real visitors never fill this hidden field.
    if (String(body.website ?? '') !== '') return res.status(200).json({ ok: true });

    const comment = String(body.comment ?? '').trim();
    const name = String(body.name ?? '').trim().slice(0, 120);
    const feedback = String(body.feedback ?? '').trim().slice(0, 2000);
    const chapter = CHAPTERS.includes(body.chapter) ? body.chapter : null;
    const recommend = Number.isInteger(body.recommend) && body.recommend >= 1 && body.recommend <= 5
        ? body.recommend : null;
    const allowQuote = body.allowQuote !== false;

    if (!comment) return res.status(400).json({ error: 'empty_comment' });
    if (!name) return res.status(400).json({ error: 'empty_name' });
    if (comment.length > 2000) return res.status(400).json({ error: 'too_long' });

    try {
        const { error } = await db().from('reviews').insert({
            chapter,
            recommend,
            comment,
            name: name || null,
            feedback: feedback || null,
            allow_quote: allowQuote
        });
        if (error) throw error;
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[review]', err.message);
        return res.status(500).json({ error: 'server_error' });
    }
}
