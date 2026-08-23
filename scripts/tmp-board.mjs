import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--mute-audio'],
});
const errors = [];
const page = await browser.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

const slugs = {
    nature: 'nature-90dc06', dog: 'dog-d33fcd', music: 'music-49e3ac',
    lover: 'lover-0c8aae', mother: 'mother-18ebb9', myself: 'myself-cdf866'
};
await page.goto('http://localhost:3210/letter/nature-90dc06.html?reset', { waitUntil: 'networkidle0' });

let i = 0;
for (const [ch, slug] of Object.entries(slugs)) {
    i++;
    await page.goto(`http://localhost:3210/letter/${slug}.html`, { waitUntil: 'networkidle0' });
    await page.click('.st-seal-btn');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    const b = await page.evaluate(() => ({
        url: location.pathname + location.search,
        stamped: document.querySelectorAll('.st-slot.stamped').length,
        animating: !!document.querySelector('.st-seal-btn.pressing'),
        count: document.getElementById('stampCount').textContent,
    }));
    console.log(`${i}. ${ch} → ${b.url} | stamped=${b.stamped} anim=${b.animating} | ${b.count}`);
    if (!b.url.includes('board-e6489d')) errors.push(ch + ': did not land on board');
    if (b.stamped !== i) errors.push(ch + ': wrong stamp count');
    await new Promise(r => setTimeout(r, 1400));
    const after = await page.evaluate(() => ({
        guide: !document.getElementById('boardGuide').hidden,
        finale: !document.getElementById('boardFinale').hidden,
    }));
    if (i < 6 && (!after.guide || after.finale)) errors.push(ch + ': guide/finale state wrong');
    if (i === 6 && !after.finale) errors.push('finale missing at 6/6');
    if (i === 3) await page.screenshot({ path: process.env.SHOT_DIR + '/board-mid.png', fullPage: true });
}
await page.screenshot({ path: process.env.SHOT_DIR + '/board-finale.png', fullPage: true });

// revisit letter page: pressed seal + view-stamps note; button leads to board without re-anim
await page.goto('http://localhost:3210/letter/dog-d33fcd.html', { waitUntil: 'networkidle0' });
const re = await page.evaluate(() => ({
    pressed: !!document.querySelector('.st-seal-btn.pressed'),
    go: !!document.querySelector('.st-board-go'),
}));
console.log('revisit dog:', JSON.stringify(re));
if (!re.pressed || !re.go) errors.push('revisit letter state wrong');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL OK');
await browser.close();
process.exit(errors.length ? 1 : 0);
