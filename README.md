# 🥁 Catch The Beat

A single-page, no-backend rhythm game built for a live event activation.
A vinyl record spins, a song plays, and the player gets **one** tap on a
drum pad to hit an exact musical moment. Vanilla HTML/CSS/JS only — no
frameworks, no build step, no server.

---

## ✅ Status: complete, including real audio analysis

All 13 songs you uploaded are in `assets/audio/`, and every `targetTime` in
`songs.js` was measured directly from those files — not estimated from the
minute:second you described. Each MP3 was analyzed with a percussive-onset
detector (harmonic/percussive separation isolates drum-like transients from
vocals and other instruments, then the sharpest percussive spike closest to
the moment you described is located and refined against the raw waveform),
so the numbers are accurate to a few milliseconds.

Two songs are worth a quick sanity check before your event, because they
have a steady, repeating beat right around the target moment, where more
than one nearby hit is almost equally strong: **Blinding Lights** (constant
four-on-the-floor pulse) and **Pedro, Pedro, Pedro** (the phrase repeats).
The detector picked whichever strong hit sits closest to what you
described, which should be right — but if you want certainty, open
`beat-finder.html`, load the song, and look/listen at the timestamp in
`songs.js` for that entry. Every other song is a clean, isolated hit and
should need no review.

There is nothing left to build or upload. The only optional step is that
spot-check.

---

## What's included

```
catch-the-beat/
├── index.html              The game itself
├── style.css                All styling and animation
├── script.js                 Game logic (Web Audio timing, states, confetti)
├── songs.js                   Song list + analyzed target timestamps
├── beat-finder.html         Standalone tool to double-check/adjust a timestamp
├── README.md                 This file
└── assets/
    ├── audio/               Your 13 MP3s (already in place)
    ├── images/
    │   ├── background.jpg           full-screen background art
    │   ├── icon-512.png              the vinyl record graphic
    │   └── icon-maskable-512.png    spare icon variant
    └── sounds/
        ├── cymbal-hit.wav        synthesized cymbal crash (pad hit)
        ├── success-chime.wav    "Perfect" result chime
        └── miss-thud.wav        "Missed it" result sound
```

## How the game works

1. **Idle** — the vinyl, the title, the song's name and the moment to catch,
   and a pulsing "Tap The Record To Start" button are shown. Tapping the
   vinyl record itself (or the button) both do the same thing.
2. **Playing** — the vinyl spins, the tonearm lowers onto it, the song
   starts immediately (no countdown), and the drum pad becomes active.
   The player gets exactly one tap.
3. **Result** — the instant the pad is hit, it locks, plays a drum sound,
   and shows a ripple. The overlay reports **Perfect!** (with confetti) or
   **Better Luck Next Time!** along with exactly how many milliseconds
   early (`-84 ms`) or late (`+12 ms`) the tap was, plus a horizontal
   timing meter on a miss.
4. **Auto-reset** — 7 seconds after the result appears, the screen returns
   to a completely clean idle state with a new random song queued up. No
   leftover score, message, or animation carries over.
5. **Staff reset** — press and hold the very bottom-right corner of the
   screen (it's intentionally invisible) for about a second to force the
   game back to idle instantly, from any state.

### Why "Perfect" isn't 0ms exactly
No human taps at *exactly* 0.000ms. Each song can optionally set its own
`toleranceMs` in `songs.js`; anything without one uses the shared
`DEFAULT_TOLERANCE_MS` (180ms) defined at the top of that file. Inside that
window = Perfect. Outside it = Miss, and the exact early/late offset is
always shown either way.

### Timing accuracy
Timing is measured with the Web Audio API (`AudioContext.currentTime`), not
the `<audio>` element — `<audio>.currentTime` only updates a few times a
second, which isn't precise enough to judge milliseconds. The song is
played through an `AudioBufferSourceNode`, and the tap is captured on
`pointerdown` (fires earlier than `click`), so the measured offset is as
tight as the browser allows.

### How the beat detection actually worked
Each MP3 was decoded to raw audio and run through a short-time Fourier
transform. A median-filtering harmonic/percussive separation pass (the
same family of technique used in DAW "stem splitting" tools) isolates
drum-like broadband transients from vocals and sustained instruments. An
onset-strength function was then computed from just the percussive energy,
and — searching in a window around the minute:second you described — the
strongest genuine percussive spike closest to that moment was selected and
refined against the raw waveform's rise time. That's how `songs.js` ended
up with values like `221.796` instead of a rounded `221.0`.

## Customizing

- **Song list / timing / tolerance** — all in `songs.js`, plain objects,
  well commented.
- **Auto-reset delay, "too late" grace window** — top of `script.js`
  (`AUTO_RESET_MS`, `LATE_GRACE_MS`).
- **Colors** — CSS custom properties at the top of `style.css`
  (`:root { --teal-deep, --gold, --ink, ... }`), sampled directly from the
  background and vinyl artwork you provided.
- **Drum/result sounds** — swap the files in `assets/sounds/` (keep the
  same filenames, or update the `SFX` object in `script.js`).

## Deployment (GitHub Pages)

1. Create a new GitHub repository and push everything in this folder to it
   (keep the folder structure exactly as-is). The repo will be roughly
   55MB because of the 13 MP3s — that's well within GitHub's normal
   limits, no Git LFS needed.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   pick your default branch (e.g. `main`) and the `/ (root)` folder, then
   save.
4. GitHub will publish a URL like
   `https://<your-username>.github.io/<repo-name>/` — that's your game.
   It usually takes a minute or two after the first push.
5. Open it once on the actual event touchscreen and load it full-screen
   (most kiosk browsers have a kiosk/full-screen mode) — the layout is
   built for a portrait touchscreen around 31 × 54.5cm, and scales down to
   phones and up to tablets/desktop automatically.

No build step, no `npm install`, no server config — it's static files, so
this is the entire deployment process.

## Before your event: a quick pre-flight checklist

- [ ] Spot-check **Blinding Lights** and **Pedro, Pedro, Pedro** in
      `beat-finder.html` (see the note at the top of this file) — every
      other song should already be exact.
- [ ] Tested on the actual kiosk hardware/browser, at full volume, with the
      real speakers/headphones that will be used on the day.
- [ ] Confirmed the hidden staff-reset corner (bottom-right, press & hold)
      works from a phone/tablet you'll have on hand during the event.
