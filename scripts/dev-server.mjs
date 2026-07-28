// Local dev server — serves the static site and runs api/*.js the way Vercel does.
// Dev only: it lives outside /api, so Vercel never deploys it.
//   node scripts/dev-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- load .env ---
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        if (/^\s*(#|$)/.test(line)) continue;
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) process.env[m[1]] = m[2].trim();
    }
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
    '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

// Vercel adds these helpers to the response object.
function enhance(res) {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => {
        if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(o));
        return res;
    };
    res.send = (b) => { res.end(b); return res; };
}

const server = http.createServer(async (req, res) => {
    enhance(res);
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname.startsWith('/api/')) {
        const name = url.pathname.slice(5).split('/')[0];
        const file = path.join(root, 'api', `${name}.js`);
        if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });

        // Importing happens per request so edits are picked up. A syntax error in
        // a handler must not take the whole server down, so catch it here too —
        // an unhandled rejection in this async handler would kill the process.
        let mod;
        try {
            mod = await import(`file://${file}?t=${Date.now()}`);
        } catch (err) {
            console.error(`[${name}] failed to load:`, err.message);
            return res.status(500).json({ error: 'handler_load_failed' });
        }

        const bodyParserOff = mod.config?.api?.bodyParser === false;

        // Match Vercel: parse JSON bodies, EXCEPT where bodyParser is disabled
        // (the webhook needs the raw bytes for signature verification).
        if (!bodyParserOff && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            const raw = Buffer.concat(chunks).toString('utf8');
            try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
        }
        req.query = Object.fromEntries(url.searchParams);

        try {
            await mod.default(req, res);
        } catch (err) {
            console.error(`[${name}]`, err);
            if (!res.headersSent) res.status(500).json({ error: 'server_error' });
        }
        return;
    }

    const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = path.join(root, rel);
    if (!file.startsWith(root)) return res.status(403).send('Forbidden');

    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
        // Never cache during development: a stale HTML/JS copy makes edits look
        // like they did nothing, and keeps showing errors after a fix landed.
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        // Range support so audio/video can seek locally, same as Vercel static.
        const size = fs.statSync(file).size;
        res.setHeader('Accept-Ranges', 'bytes');
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (range && (range[1] || range[2])) {
            const start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10);
            const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
            if (start >= size || start > end) {
                res.setHeader('Content-Range', `bytes */${size}`);
                return res.status(416).end();
            }
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
            res.setHeader('Content-Length', end - start + 1);
            fs.createReadStream(file, { start, end }).pipe(res);
        } else {
            res.setHeader('Content-Length', size);
            fs.createReadStream(file).pipe(res);
        }
    } else {
        res.status(404).send('Not found');
    }
});

// Last line of defence: never let a stray error end the dev session.
process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`dev server → http://localhost:${PORT}`));
