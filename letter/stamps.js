/*
 * Stamp collection for the QR letter pages.
 *
 * Flow: the visitor reads a letter page, presses the seal at the bottom, and
 * is taken to the stamp board page where the new stamp presses itself into
 * the collection. The board shows all six slots; once the sixth is collected
 * it reveals the finale (choose a flower, place it in the vase, the final
 * performance begins). No links between letter pages — visitors move through
 * the room by scanning each artwork's QR.
 *
 * localStorage is optional: when it throws (private mode, blocked) the press
 * still navigates to the board carrying the stamp in the URL, so the moment
 * itself never breaks — persistence across scans just isn't guaranteed.
 */
(() => {
    const KEY = 'bglow.stamps.v1';
    const BOARD_URL = 'board-e6489d.html';
    const FINALE_URL = 'finale-71cc50.html';

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

    const params = new URLSearchParams(location.search);
    if (params.has('reset')) {
        try { localStorage.removeItem(KEY); } catch { /* no-op */ }
    }

    const count = (stamps) => CHAPTERS.filter(c => stamps[c.id]).length;

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

    // ---------- letter page: seal button -> board ----------

    const chapterId = window.LETTER_PAGE && window.LETTER_PAGE.chapter;
    const chapter = CHAPTERS.find(c => c.id === chapterId);
    if (chapter) {
        const station = document.createElement('section');
        station.className = 'st-station';
        const footer = document.querySelector('.lp-footer');
        footer.parentNode.insertBefore(station, footer);

        const got = !!read()[chapterId];
        station.innerHTML =
            '<div class="st-head">Stamp</div>' +
            '<p class="st-lead">' +
            (got
                ? '<span class="ko">이 작품의 스탬프는 이미 모았습니다.</span>You already collected this stamp.'
                : '<span class="ko">작품을 감상하셨다면, 스탬프를 찍어 주세요.</span>' +
                  'When you have spent time with this artwork, press the seal.') +
            '</p>' +
            `<button type="button" class="st-seal-btn${got ? ' pressed' : ''}">` +
            `<span class="st-seal-icon">${chapter.icon}</span>` +
            `<span class="st-seal-name">${chapter.en}</span>` +
            '</button>' +
            (got ? '<p class="st-board-go">View your stamps &rarr;</p>' : '');

        const sealBtn = station.querySelector('.st-seal-btn');
        sealBtn.addEventListener('click', () => {
            if (sealBtn.classList.contains('pressing')) return;
            const stamps = read();
            if (!stamps[chapterId]) {
                stamps[chapterId] = new Date().toISOString();
                write(stamps);
            }
            // Press the seal here first, then drift over to the board.
            // ?just carries the stamp so even a storage-blocked browser
            // still gets its moment there.
            sealBtn.classList.add('pressing');
            setTimeout(() => {
                document.body.classList.add('st-leave');
                setTimeout(() => {
                    location.href = `${BOARD_URL}?just=${chapterId}`;
                }, 600);
            }, 950);
        });
    }

    // ---------- board page ----------

    const board = document.getElementById('stampBoard');
    if (board) {
        document.body.classList.add('st-arrive');
        const just = params.get('just');
        const stamps = read();
        // Storage may have been unavailable on the letter page — trust ?just.
        if (just && CHAPTERS.some(c => c.id === just) && !stamps[just]) {
            stamps[just] = new Date().toISOString();
            write(stamps);
        }

        const done = count(stamps);
        const complete = done === CHAPTERS.length;

        board.innerHTML = CHAPTERS.map((c) => {
            const got = !!stamps[c.id];
            const animate = got && c.id === just;
            return `
            <div class="st-slot${got ? ' stamped' : ''}">
                <div class="st-seal-btn slot${got ? ' pressed' : ''}${animate ? ' pressing' : ''}">
                    <span class="st-seal-icon">${c.icon}</span>
                    <span class="st-seal-name">${c.en}</span>
                </div>
                <span class="st-slot-ko">${c.ko}</span>
            </div>`;
        }).join('');

        document.getElementById('stampCount').textContent = `${done} / ${CHAPTERS.length}`;

        const guide = document.getElementById('boardGuide');
        if (complete) {
            // The board's job is done — hand over to the finale page.
            setTimeout(() => { location.href = FINALE_URL; }, just ? 2200 : 600);
        } else {
            setTimeout(() => { guide.hidden = false; }, just ? 1100 : 200);
        }
    }

    // ---------- finale page ----------

    const fn = document.querySelector('.fn-page');
    if (fn) {
        // Reached without a full collection (shared URL, cleared storage):
        // fall back to the board rather than showing an unearned ticket.
        if (count(read()) < CHAPTERS.length) {
            location.replace(BOARD_URL);
        } else {
            document.body.classList.add('fn-play');
            const petals = document.querySelector('.fn-petals');
            for (let i = 0; i < 10; i++) {
                const petal = document.createElement('span');
                petal.className = 'fn-petal';
                petal.style.left = (5 + Math.random() * 90) + '%';
                petal.style.animationDelay = (Math.random() * 6) + 's';
                petal.style.animationDuration = (7 + Math.random() * 5) + 's';
                petals.appendChild(petal);
            }
        }
    }
})();
