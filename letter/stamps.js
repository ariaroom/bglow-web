/*
 * Stamp collection for the QR letter pages.
 *
 * Included by every letter page (after letter.js). Each page gets a "stamp
 * station" at the bottom: the visitor scrolls through the letter, presses the
 * seal, and an ink-stamp animation plays. Progress (6 mini seals) lives right
 * there — there is no separate board page. When the sixth stamp is pressed,
 * a finale overlay invites the visitor to place a flower in the vase for the
 * final performance.
 *
 * localStorage is optional: when it throws (private mode, blocked) pressing
 * still animates within the page — persistence just won't survive navigation.
 */
(() => {
    const KEY = 'bglow.stamps.v1';
    const FINALE_KEY = 'bglow.stamps.finale.v1';

    // Route order for the exhibition.
    const CHAPTERS = [
        {
            id: 'nature', ko: '자연', en: 'Nature',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 20V9c0-3 2-5.5 6.5-5.5.3 4.5-1.5 8-6.5 8.5"/><path d="M12 20v-6c0-2.3-1.6-4.2-5-4.2-.2 3.4 1.2 6 5 6.4"/><path d="M5 20h14"/></svg>'
        },
        {
            id: 'dog', ko: '강아지', en: 'Dog',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="6.5" cy="9.5" r="1.7"/><circle cx="12" cy="7.5" r="1.7"/><circle cx="17.5" cy="9.5" r="1.7"/><path d="M12 12.5c-2.9 0-5.2 2.3-5.2 4.5 0 1.4 1.2 2.2 2.5 1.9 1-.2 1.8-.5 2.7-.5s1.7.3 2.7.5c1.3.3 2.5-.5 2.5-1.9 0-2.2-2.3-4.5-5.2-4.5z"/></svg>'
        },
        {
            id: 'music', ko: '음악', en: 'Music',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9 18V5.5l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>'
        },
        {
            id: 'lover', ko: '연인', en: 'Lover',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5S4 15.5 4 9.9C4 7.2 6 5 8.6 5c1.5 0 2.8.7 3.4 1.9C12.6 5.7 13.9 5 15.4 5 18 5 20 7.2 20 9.9c0 5.6-8 10.6-8 10.6z"/></svg>'
        },
        {
            id: 'mother', ko: '엄마', en: 'Mother',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="9" r="2.2"/><path d="M12 13.5v6.5"/><path d="M12 17c-1.5-1.2-3.2-1.4-4.5-.8.5 1.8 2.3 2.8 4.5 2.3"/><path d="M12 17c1.5-1.2 3.2-1.4 4.5-.8-.5 1.8-2.3 2.8-4.5 2.3"/></svg>'
        },
        {
            id: 'myself', ko: '나', en: 'Myself',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21v-8"/><path d="M12 13c0-3 2-5.5 5-6-.3 3-2 5.5-5 6z"/><path d="M12 13c0-3-2-5.5-5-6 .3 3 2 5.5 5 6z"/><circle cx="12" cy="5.5" r="2"/></svg>'
        }
    ];

    // ---------- storage (fails silently when unavailable) ----------

    function read() {
        try {
            const raw = localStorage.getItem(KEY);
            const data = raw ? JSON.parse(raw) : {};
            return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
        } catch { return {}; }
    }

    function write(data) {
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* no-op */ }
    }

    if (new URLSearchParams(location.search).has('reset')) {
        try { localStorage.removeItem(KEY); localStorage.removeItem(FINALE_KEY); } catch { /* no-op */ }
    }

    const count = (stamps) => CHAPTERS.filter(c => stamps[c.id]).length;

    const chapterId = window.LETTER_PAGE && window.LETTER_PAGE.chapter;
    const chapter = CHAPTERS.find(c => c.id === chapterId);
    if (!chapter) return;

    // ---------- in-app browser warning (storage would fragment) ----------

    if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER/i.test(navigator.userAgent)) {
        const warn = document.createElement('div');
        warn.className = 'st-inapp';
        warn.innerHTML =
            '<span>스탬프를 모으려면 휴대폰 기본 브라우저(Safari · Chrome · 삼성 인터넷)로 열어 주세요.<br>' +
            'Please open this page in your phone&rsquo;s default browser so your stamps stay together.</span>' +
            '<button type="button" aria-label="Close">&times;</button>';
        warn.querySelector('button').addEventListener('click', () => warn.remove());
        document.body.prepend(warn);
    }

    // ---------- stamp station at the bottom of the page ----------

    const station = document.createElement('section');
    station.className = 'st-station';
    const footer = document.querySelector('.lp-footer');
    footer.parentNode.insertBefore(station, footer);

    function render() {
        const stamps = read();
        const got = !!stamps[chapterId];
        const done = count(stamps);

        station.innerHTML =
            '<div class="st-head">Stamp</div>' +
            '<p class="st-lead">' +
            (got
                ? '<span class="ko">이 작품의 스탬프를 모았습니다.</span>Stamp collected.'
                : '<span class="ko">작품을 감상하셨다면, 스탬프를 찍어 주세요.</span>' +
                  'When you have spent time with this artwork, press the seal.') +
            '</p>' +
            `<button type="button" class="st-seal-btn${got ? ' pressed' : ''}" ${got ? 'disabled' : ''}>` +
            `<span class="st-seal-icon">${chapter.icon}</span>` +
            `<span class="st-seal-name">${chapter.en}</span>` +
            '</button>' +
            `<div class="st-row">${CHAPTERS.map(c =>
                `<span class="st-mini${stamps[c.id] ? ' on' : ''}${c.id === chapterId ? ' here' : ''}" title="${c.en}">${c.icon}</span>`
            ).join('')}</div>` +
            `<p class="st-count">${done} / ${CHAPTERS.length}</p>`;

        const btn = station.querySelector('.st-seal-btn');
        if (!got) btn.addEventListener('click', press);
    }

    function press() {
        const stamps = read();
        if (!stamps[chapterId]) {
            stamps[chapterId] = new Date().toISOString();
            write(stamps);
        }
        const btn = station.querySelector('.st-seal-btn');
        btn.disabled = true;
        btn.classList.add('pressing');

        // let the ink animation land, then settle into the pressed state
        setTimeout(() => {
            render();
            const stampsNow = read();
            // storage may be unavailable — count the press locally anyway
            const done = Math.max(count(stampsNow), stampsNow[chapterId] ? count(stampsNow) : 1);
            if (done === CHAPTERS.length) showFinale();
        }, 950);
    }

    // ---------- finale ----------

    function showFinale() {
        try {
            if (localStorage.getItem(FINALE_KEY)) return;
            localStorage.setItem(FINALE_KEY, '1');
        } catch { /* still show it */ }

        const ov = document.createElement('div');
        ov.className = 'st-finale';
        ov.innerHTML =
            '<div class="st-finale-card">' +
            '<div class="st-finale-art">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">' +
            '<path d="M12 21v-8"/><path d="M12 13c0-3 2-5.5 5-6-.3 3-2 5.5-5 6z"/>' +
            '<path d="M12 13c0-3-2-5.5-5-6 .3 3 2 5.5 5 6z"/><circle cx="12" cy="5.5" r="2"/></svg>' +
            '</div>' +
            '<p class="st-finale-title">여섯 개의 조각이 모두 모였습니다</p>' +
            '<p class="st-finale-title-en">All six pieces have come together</p>' +
            '<p class="st-finale-text">이제 마음이 가는 꽃 한 송이를 골라<br>꽃병에 놓아 주세요.<br>마지막 공연이 시작됩니다.</p>' +
            '<p class="st-finale-text-en">Choose the flower that speaks to your heart<br>and place it in the vase.<br>The final performance will begin.</p>' +
            '<button type="button" class="st-finale-close">Close</button>' +
            '</div>';
        ov.querySelector('.st-finale-close').addEventListener('click', () => {
            ov.classList.remove('show');
            setTimeout(() => ov.remove(), 500);
        });
        document.body.appendChild(ov);
        requestAnimationFrame(() => ov.classList.add('show'));
    }

    render();

    // Revisit case: everything already collected but the finale was never
    // shown on this device (e.g. the sixth press happened while storage was
    // briefly unavailable) — offer it again quietly.
    const stamps = read();
    if (count(stamps) === CHAPTERS.length) {
        let seen = false;
        try { seen = !!localStorage.getItem(FINALE_KEY); } catch { /* ignore */ }
        if (!seen) showFinale();
    }
})();
