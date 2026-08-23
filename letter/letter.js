/*
 * Shared engine for the QR letter pages.
 *
 * Each page defines window.LETTER_PAGE = {
 *   narration: "audio url",
 *   soundscapes: [{ id, num, label, labelKo, sub, src, icon }, ...],  // 0..N
 *   letter: { ko: "...", en: "..." }
 * }
 *
 * Narration plays through an <audio> element routed into a single AudioContext.
 * Soundscapes are decoded buffers behind individual GainNodes so switching
 * landscapes crossfades gains without ever touching the narration — this is
 * also why we use Web Audio at all: iOS Safari ignores HTMLMediaElement.volume.
 */
(() => {
    const cfg = window.LETTER_PAGE;
    const FADE = 1.5;           // crossfade seconds
    const SC_LEVEL = 0.4;       // soundscape gain under narration
    const SC_LEVEL_SOLO = 0.55; // soundscape gain after narration ends

    const ICONS = {
        sea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 14c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0"/><path d="M2 18.5c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0"/><path d="M13 9.5c1.8-4 5.5-4.5 7.5-2.5"/></svg>',
        grass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 20V9c0-2.5-1.5-4.5-4-5.5 1 2 1.2 3.6 1 5.5"/><path d="M12 20v-7c0-2.5 1.5-4.5 4-5.5-1 2-1.2 3.6-1 5.5"/><path d="M12 20v-4c0-2-1-3.5-3-4.5"/><path d="M4 20h16"/></svg>',
        paw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6.5" cy="9.5" r="1.7"/><circle cx="12" cy="7.5" r="1.7"/><circle cx="17.5" cy="9.5" r="1.7"/><path d="M12 12.5c-2.9 0-5.2 2.3-5.2 4.5 0 1.4 1.2 2.2 2.5 1.9 1-.2 1.8-.5 2.7-.5s1.7.3 2.7.5c1.3.3 2.5-.5 2.5-1.9 0-2.2-2.3-4.5-5.2-4.5z"/></svg>',
        note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
        sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>'
    };

    const player = document.getElementById('player');
    const playBtn = document.getElementById('playBtn');
    const seek = document.getElementById('seek');
    const curEl = document.getElementById('cur');
    const durEl = document.getElementById('dur');
    const subEl = document.getElementById('playerSub');
    const narration = document.getElementById('narration');
    const letterBody = document.getElementById('letterBody');

    // Narration is optional: until the recorded file arrives the player is
    // hidden and the soundscape buttons drive playback on their own.
    const hasNarration = !!cfg.narration;
    if (hasNarration) {
        narration.src = cfg.narration;
    } else {
        player.hidden = true;
        const hintNarr = document.getElementById('hintNarr');
        if (hintNarr) hintNarr.hidden = true;
    }

    // ---------- Soundscape selector ----------
    let currentId = cfg.soundscapes[0] ? cfg.soundscapes[0].id : null;
    const scapesHead = document.querySelector('.lp-scapes-head');

    // Multiple soundscapes always show the selector. A single soundscape
    // shows it only while there is no narration — then the card doubles as
    // the play button. (With narration, a lone soundscape simply plays
    // underneath and needs no UI.)
    const showSelector = cfg.soundscapes.length > 1 ||
        (cfg.soundscapes.length === 1 && !hasNarration);

    if (showSelector) {
        document.getElementById('scapes').hidden = false;
        const grid = document.querySelector('.lp-scape-grid');
        grid.style.gridTemplateColumns = `repeat(${cfg.soundscapes.length}, 1fr)`;
        cfg.soundscapes.forEach((s) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lp-scape' + (s.id === currentId ? ' active' : '');
            btn.dataset.id = s.id;
            btn.innerHTML =
                (s.num ? `<span class="lp-scape-num">${s.num}</span>` : '') +
                `<span class="lp-scape-icon">${ICONS[s.icon] || ''}</span>` +
                (s.labelKo ? `<span class="lp-scape-ko">${s.labelKo}</span>` : '') +
                `<span class="lp-scape-en">${s.label}</span>` +
                `<span class="lp-scape-sub">${s.sub}</span>`;
            btn.addEventListener('click', () => selectScape(s.id));
            grid.appendChild(btn);
        });
        // Until the visitor starts the sound themselves, invite the tap.
        if (!hasNarration && scapesHead) scapesHead.textContent = 'Tap to Play';
    } else {
        const section = document.getElementById('scapes');
        if (section) section.hidden = true;
        const hint = document.getElementById('scapeHint');
        if (hint) hint.hidden = true;
    }

    function updateScapeUI() {
        document.querySelectorAll('.lp-scape').forEach((el) => {
            el.classList.toggle('active', el.dataset.id === currentId);
        });
    }

    // ---------- Audio engine ----------
    let ctx = null;
    let started = false;    // narration has been started
    let ambienceOn = false; // a soundscape has been started (tap on card or play)
    let ended = false;
    const arrayBuffers = {}; // id -> Promise<ArrayBuffer>
    const buffers = {};      // id -> AudioBuffer
    const active = {};       // id -> { src, gain }

    // Prefetch soundscape bytes immediately; decode lazily once the context exists.
    cfg.soundscapes.forEach((s) => {
        arrayBuffers[s.id] = fetch(s.src).then((r) => {
            if (!r.ok) throw new Error(`soundscape ${s.id}: HTTP ${r.status}`);
            return r.arrayBuffer();
        });
    });

    // iOS mutes Web Audio (but not <audio> elements) while the ringer
    // switch is on silent. Looping a silent <audio> track flips the page's
    // audio session to "playback", which un-mutes Web Audio too.
    const SILENCE_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAACQAAA2AAVVVVVVVVVVVVVVVqampqampqampqaoCAgICAgICAgICAlZWVlZWVlZWVlZWqqqqqqqqqqqqqqsDAwMDAwMDAwMDA1dXV1dXV1dXV1dXq6urq6urq6urq6v//////////////AAAAAExhdmM2Mi4yOAAAAAAAAAAAAAAAACQCYAAAAAAAAANgUN+kLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxLEAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    let silentKeepAlive = null;

    function ensureCtx() {
        if (!silentKeepAlive) {
            silentKeepAlive = new Audio(SILENCE_MP3);
            silentKeepAlive.loop = true;
            silentKeepAlive.setAttribute('playsinline', '');
            silentKeepAlive.play().catch(() => { silentKeepAlive = null; });
        }
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaElementSource(narration);
            src.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    async function getBuffer(id) {
        if (!buffers[id]) {
            const bytes = await arrayBuffers[id];
            buffers[id] = await ctx.decodeAudioData(bytes.slice(0));
        }
        return buffers[id];
    }

    async function startScape(id) {
        let buf;
        try {
            buf = await getBuffer(id);
        } catch (e) {
            console.warn('soundscape unavailable', e);
            return; // narration still works without ambience
        }
        // Selection may have changed while the buffer was loading.
        if (id !== currentId || active[id] || !ambienceOn) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        const level = (hasNarration && started && !ended) ? SC_LEVEL : SC_LEVEL_SOLO;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(level, now + FADE);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        active[id] = { src, gain };
        if (scapesHead) scapesHead.textContent = 'Now Playing';
    }

    function stopScape(id) {
        const a = active[id];
        if (!a) return;
        delete active[id];
        const now = ctx.currentTime;
        a.gain.gain.cancelScheduledValues(now);
        a.gain.gain.setValueAtTime(a.gain.gain.value, now);
        a.gain.gain.linearRampToValueAtTime(0.0001, now + FADE);
        setTimeout(() => {
            try { a.src.stop(); } catch (e) { /* already stopped */ }
        }, (FADE + 0.2) * 1000);
    }

    function selectScape(id) {
        // A card tap is a user gesture, so the ambience can start right here —
        // no narration needed.
        ensureCtx();
        ambienceOn = true;
        if (id === currentId) {
            if (!active[id]) startScape(id);
            return;
        }
        currentId = id;
        updateScapeUI();
        Object.keys(active).forEach(stopScape);
        startScape(id);
    }

    // ---------- Playback control ----------
    function setState(state) {
        player.dataset.state = state;
        playBtn.setAttribute('aria-label',
            state === 'playing' ? 'Pause' : state === 'ended' ? 'Replay' : 'Play');
    }

    playBtn.addEventListener('click', () => {
        ensureCtx();
        ambienceOn = true;
        if (!started) {
            started = true;
            narration.play().catch(showAudioError);
            if (currentId) startScape(currentId);
            setState('playing');
        } else if (ended) {
            // Replay: narration restarts from the top, soundscape keeps looping.
            narration.currentTime = 0;
            ended = false;
            narration.play().catch(showAudioError);
            const a = currentId && active[currentId];
            if (a) {
                // Duck the ambience back under the narration.
                const now = ctx.currentTime;
                a.gain.gain.cancelScheduledValues(now);
                a.gain.gain.setValueAtTime(a.gain.gain.value, now);
                a.gain.gain.linearRampToValueAtTime(SC_LEVEL, now + 1);
            } else if (currentId) {
                startScape(currentId);
            }
            setState('playing');
        } else if (narration.paused) {
            ctx.resume();
            narration.play().catch(showAudioError);
            setState('playing');
        } else {
            narration.pause();
            ctx.suspend();
            setState('paused');
        }
    });

    function showAudioError(e) {
        console.warn(e);
        subEl.textContent = 'Audio failed to load — tap to retry';
        started = false;
        setState('idle');
    }

    // ---------- Progress bar ----------
    let scrubbing = false;

    function fmt(t) {
        if (!isFinite(t)) return '–:––';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function renderProgress(t) {
        curEl.textContent = fmt(t);
        const pct = narration.duration ? (t / narration.duration) * 100 : 0;
        seek.value = pct;
        seek.style.setProperty('--progress', pct + '%');
    }

    narration.addEventListener('loadedmetadata', () => {
        durEl.textContent = fmt(narration.duration);
    });

    narration.addEventListener('timeupdate', () => {
        if (!scrubbing) renderProgress(narration.currentTime);
    });

    narration.addEventListener('ended', () => {
        ended = true;
        setState('ended');
        // Let the ambience breathe a little louder while the visitor keeps looking.
        const a = currentId && active[currentId];
        if (a && ctx) {
            const now = ctx.currentTime;
            a.gain.gain.cancelScheduledValues(now);
            a.gain.gain.setValueAtTime(a.gain.gain.value, now);
            a.gain.gain.linearRampToValueAtTime(SC_LEVEL_SOLO, now + 2);
        }
    });

    narration.addEventListener('error', () => showAudioError(new Error('narration load error')));

    seek.addEventListener('input', () => {
        scrubbing = true;
        const t = (seek.value / 100) * (narration.duration || 0);
        curEl.textContent = fmt(t);
        seek.style.setProperty('--progress', seek.value + '%');
    });

    seek.addEventListener('change', () => {
        if (narration.duration) {
            narration.currentTime = (seek.value / 100) * narration.duration;
        }
        scrubbing = false;
    });

    // ---------- Letter language toggle ----------
    let lang = 'ko';

    function renderLetter() {
        letterBody.dataset.lang = lang;
        // Optional per-language UI copy (e.g. the Music chapter's song intro).
        if (cfg.playerSub && subEl) {
            subEl.innerHTML = cfg.playerSub[lang];
            subEl.dataset.lang = lang;
        }
        const noteText = document.querySelector('.lp-note-text');
        if (cfg.note && noteText) noteText.textContent = cfg.note[lang];
        letterBody.innerHTML = cfg.letter[lang]
            .trim()
            .split(/\n\s*\n/)
            .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
            .join('');
        document.querySelectorAll('.lp-lang button').forEach((b) => {
            b.classList.toggle('active', b.dataset.lang === lang);
        });
    }

    document.querySelectorAll('.lp-lang button').forEach((b) => {
        b.addEventListener('click', () => {
            lang = b.dataset.lang;
            renderLetter();
        });
    });

    renderLetter();
    setState('idle');

    // Tiny hook for automated smoke tests; harmless in production.
    window.__lp = {
        active: () => Object.keys(active),
        ctxState: () => (ctx ? ctx.state : null)
    };
})();
