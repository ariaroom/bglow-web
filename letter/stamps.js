/*
 * Stamp collection for the QR letter pages.
 *
 * Included by every letter page (after letter.js) and by the stamp board.
 * On a letter page (window.LETTER_PAGE.chapter is set) it records the visit
 * in localStorage, shows a one-time ink-stamp animation on the first visit,
 * and adds a floating link to the board with a progress badge.
 * On the board page (#stampBoard element) it renders the six slots in route
 * order, highlights the next unvisited artwork, and switches to the finale
 * ("place a flower in the vase") once all six are collected.
 *
 * localStorage is optional: when it throws (private mode, blocked) the pages
 * behave as before and the board becomes a plain route guide.
 */
(() => {
    const KEY = 'bglow.stamps.v1';
    const BOARD_URL = 'board-423ffb.html';

    // Route order for the exhibition — this, not the printed chapter number,
    // drives the board layout and the "next artwork" hint.
    const CHAPTERS = [
        {
            id: 'nature', ko: '자연', en: 'Nature',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21C7 17.5 4 13.8 4 9.8 4 6 7 3.5 12 3.5S20 6 20 9.8c0 4-3 7.7-8 11.2z" opacity="0"/><path d="M12 20V9c0-3 2-5.5 6.5-5.5.3 4.5-1.5 8-6.5 8.5"/><path d="M12 20v-6c0-2.3-1.6-4.2-5-4.2-.2 3.4 1.2 6 5 6.4"/><path d="M5 20h14"/></svg>'
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
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="9" r="2.2"/><path d="M12 6.8V4.5M12 11.2v2.3M9.8 9H7.5M14.2 9h2.3M10.4 7.4 8.8 5.8M13.6 7.4l1.6-1.6M10.4 10.6l-1.6 1.6M13.6 10.6l1.6 1.6" opacity=".55"/><path d="M12 13.5v6.5"/><path d="M12 17c-1.5-1.2-3.2-1.4-4.5-.8.5 1.8 2.3 2.8 4.5 2.3"/><path d="M12 17c1.5-1.2 3.2-1.4 4.5-.8-.5 1.8-2.3 2.8-4.5 2.3"/></svg>'
        },
        {
            id: 'myself', ko: '나', en: 'Myself',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.8-3.4 3.4-5.2 6.5-5.2s5.7 1.8 6.5 5.2"/></svg>'
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
        try { localStorage.removeItem(KEY); } catch { /* no-op */ }
    }

    const count = (stamps) => CHAPTERS.filter(c => stamps[c.id]).length;
    const nextChapter = (stamps) => CHAPTERS.find(c => !stamps[c.id]) || null;

    // ---------- letter page: record stamp + badge link ----------

    const chapterId = window.LETTER_PAGE && window.LETTER_PAGE.chapter;
    if (chapterId && CHAPTERS.some(c => c.id === chapterId)) {
        const stamps = read();
        const firstVisit = !stamps[chapterId];
        if (firstVisit) {
            stamps[chapterId] = new Date().toISOString();
            write(stamps);
        }

        const link = document.createElement('a');
        link.className = 'st-board-link';
        link.href = BOARD_URL;
        link.innerHTML =
            '<span class="st-board-link-label">Stamp Board <em>스탬프 보드</em></span>' +
            `<span class="st-board-link-count">${count(stamps)} / ${CHAPTERS.length}</span>`;
        document.body.appendChild(link);

        // First-visit only, and only when the stamp actually persisted —
        // otherwise every reload would replay the animation.
        if (firstVisit && read()[chapterId]) {
            const ch = CHAPTERS.find(c => c.id === chapterId);
            const toast = document.createElement('div');
            toast.className = 'st-toast';
            toast.innerHTML =
                '<div class="st-toast-seal">' +
                `<span class="st-toast-icon">${ch.icon}</span>` +
                `<span class="st-toast-name">${ch.en}</span>` +
                '</div>' +
                '<p class="st-toast-text">Stamp collected</p>' +
                '<p class="st-toast-text-ko">스탬프가 찍혔습니다</p>';
            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 600);
            }, 2200);
        }
    }

    // ---------- board page ----------

    const board = document.getElementById('stampBoard');
    if (board) {
        const stamps = read();
        const done = count(stamps);
        const complete = done === CHAPTERS.length;
        const next = nextChapter(stamps);

        document.getElementById('stampCount').textContent = `${done} / ${CHAPTERS.length}`;

        board.innerHTML = CHAPTERS.map((c, i) => {
            const got = !!stamps[c.id];
            const isNext = next && next.id === c.id;
            return `
            <div class="st-slot${got ? ' stamped' : ''}${isNext ? ' next' : ''}">
                <div class="st-seal">
                    <span class="st-num">${i + 1}</span>
                    <span class="st-icon">${c.icon}</span>
                </div>
                <span class="st-name-en">${c.en}</span>
                <span class="st-name-ko">${c.ko}</span>
                ${isNext ? '<span class="st-next-tag">Next</span>' : ''}
            </div>`;
        }).join('');

        const guide = document.getElementById('boardGuide');
        const finale = document.getElementById('boardFinale');
        if (complete) {
            finale.hidden = false;
            requestAnimationFrame(() => finale.classList.add('show'));
        } else if (next) {
            guide.hidden = false;
            guide.querySelector('.st-guide-next').textContent = `${next.en} · ${next.ko}`;
        }
    }
})();
