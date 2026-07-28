# QR Letter Pages — Design

Date: 2026-07-28
Status: Approved (verbal), implemented same day

## Goal

Private mobile web pages for the exhibition *LOVE'S LAST LETTER*, reached only by
scanning a QR code next to each artwork. Each page plays a letter narration with a
looping background soundscape, and shows the letter text in Korean/English.

The Nature chapter is special: one narration, three selectable soundscapes
(Sea / Grass / Sunset). Switching landscapes crossfades the soundscape (~1.5 s)
while the narration continues uninterrupted. All other chapters (Lovers, Dog,
Music, Mother) use the same page with a single fixed soundscape.

## Architecture

Static pages on the existing bglow-web static site (no build step, Vercel deploy).

```
letter/
  letter.css            shared styles (cream/beige, Playfair Display + Inter + Noto Serif KR)
  letter.js             shared audio engine + UI logic
  nature-90dc06.html    Nature chapter (random slug)
assets/audio/
  nature_narration.m4a  + nature_sea / nature_grass / nature_sunset
```

Each page declares a `window.LETTER_PAGE` config: chapter, theme, narration src,
soundscapes array (id, label, labelKo, sub, src), letter { ko, en }. `letter.js`
renders the soundscape selector from the config; with ≤1 soundscape the selector
section is hidden entirely. Adding a chapter = copy HTML, edit config, new slug.

## Audio engine

Web Audio API, single AudioContext created on the first tap (autoplay policy).

- Narration: `<audio>` element → MediaElementAudioSourceNode → gain → destination.
  Gives free progress/seek support.
- Soundscapes: fetched as ArrayBuffers on page load, decoded on demand,
  played as looping AudioBufferSourceNodes each behind its own GainNode.
- Crossfade: gain ramps (1.5 s) — required because iOS Safari ignores
  `HTMLMediaElement.volume`, so element-based fades would not work.
- Pause = pause narration element + `ctx.suspend()`; resume = the reverse.
- Narration ended → soundscape keeps looping, play button becomes replay.
- Slow soundscape load → narration starts anyway, soundscape fades in when ready.

## Privacy

Random-slug URL, `<meta name="robots" content="noindex, nofollow">`, no links
from anywhere on the site. No auth (deliberate — zero friction for visitors).

## Placeholders

Letter text: sample paragraphs until the artist's text arrives.
Audio: synthesized with ffmpeg (noise/tone beds) + macOS `say -v Yuna` narration,
so crossfade behavior is testable end-to-end. Real audio will be extracted from
delivered videos via `ffmpeg -vn`.
