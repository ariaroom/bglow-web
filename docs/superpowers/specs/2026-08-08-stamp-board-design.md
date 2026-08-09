# Digital Stamp Board — Design

Date: 2026-08-08
Status: Approved via Q&A (storage approach, finale, route order confirmed by owner)

## Goal

Replace the planned paper stamp board for *LOVE'S LAST LETTER* (Aug 30–31, 2026)
with a digital one. Scanning an artwork's QR code — which already opens that
chapter's letter page — is the moment the stamp is earned. A stamp board page
shows progress, guides visitors along the fixed route, and, once all six stamps
are collected, tells the visitor to place a flower in the vase (the physical
finale: when every visitor in the session has placed a flower, the song begins —
staff-run, out of web scope).

Route order (fixed): **nature → dog → music → lover → mother → myself**.

## Approach

Pure client-side, localStorage (Option A — chosen over Supabase logging and
server-issued visitor codes). No backend changes, existing artwork QRs unchanged,
works offline mid-session. Trade-off accepted: stamps live per device/browser.
Signage will say "기본 카메라 앱으로 스캔해 주세요" so in-app browsers
(KakaoTalk/Instagram) don't fragment storage.

## Architecture

```
letter/
  stamps.js              shared stamp module (new) — included by all 6 letter
                         pages and the board page
  board-<slug>.html      stamp board page (new, random slug, noindex)
  <chapter>-<slug>.html  existing letter pages — add `chapter` to LETTER_PAGE
                         config + <script src="stamps.js">
```

A seventh QR code (board page URL) is printed for the exhibition entrance; it is
the visitor's starting point and guide.

### stamps.js

- Storage: one localStorage key `bglow.stamps.v1` holding
  `{ "<chapter>": "<ISO timestamp>", ... }`.
- Chapter list + route order + display names (ko/en) live here as the single
  source of truth.
- On a letter page (detects `window.LETTER_PAGE.chapter`):
  - Records the stamp on load.
  - First visit only: plays a brief ink-stamp "pressed" animation (~1.5 s,
    self-dismissing — must not interfere with the letter/audio experience).
  - Renders a floating "스탬프 보드" link with a progress badge (e.g. 3/6)
    pointing to the board page.
- On the board page: renders the six slots from the same data.
- Graceful degradation: if localStorage throws (blocked/private mode), skip
  persistence silently — letter pages behave exactly as today.
- `?reset` query param clears the key (testing).

### Board page

- Same design language as the letter pages: cream/beige, Playfair Display +
  Inter + Noto Serif KR, random slug, `noindex, nofollow`, no links from the
  public site.
- Six slots laid out in route order. Collected → ink-stamp style mark with a
  chapter icon (reuse/extend the icon set in letter.js). Not collected → empty
  outline.
- The first uncollected chapter in route order is highlighted:
  "다음 작품 → ○○". Progress count shown (e.g. 3 / 6).
- The board never links to letter pages (their URLs stay QR-only); it names the
  next artwork so the visitor walks to it and scans there.

### Completion state

All six collected → the board transitions (one-time animation, persists on
reload) into the finale screen: congratulatory line + instruction
"이제 꽃 한 송이를 화병에 꽂아주세요". Nothing further — the song trigger is
physical staging.

## Error handling

- localStorage unavailable → no stamps, no animation, board shows the six
  chapters as a plain guide. Never a visible error.
- Unknown/missing `chapter` on a letter page → stamps.js does nothing.
- Corrupt stored JSON → treated as empty, overwritten on next stamp.

## Testing

Manual, on iOS Safari and Android Chrome (the two real-world paths from a
camera-app QR scan): stamp recorded per chapter, first-visit animation shows
once, progress badge correct, board order and next-artwork highlight correct,
completion screen at 6/6, `?reset` works, private-mode degradation silent.

## Out of scope

- Visitor analytics (Supabase) — can be layered on later without UX change.
- Cross-device stamp sync.
- The vase/song finale mechanics (physical, staff-run).
