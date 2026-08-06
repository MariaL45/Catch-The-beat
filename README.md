# 🥁 Catch The Beat

A single-page, no-backend rhythm game built for a live event activation.
A vinyl record spins, a song plays, and the player gets **one** tap on a
cymbal pad to hit an exact musical moment. Vanilla HTML/CSS/JS only — no
frameworks, no build step, no server.

---

## ✅ Status: fully built and live

All 13 songs are analyzed against your real MP3s, the interface has been
through several rounds of design refinement, and a screen saver +
hidden staff-reset gesture are both in place. The only thing left for
you to add is your own screen saver video (see below) — everything else
works out of the box.

---

## What's included

```
catch-the-beat/
├── index.html              The game itself
├── style.css                All styling and animation
├── script.js                 Game logic (Web Audio timing, states, confetti,
│                              screen saver, hidden reset gesture)
├── songs.js                   Song list + analyzed target timestamps
├── beat-finder.html         Standalone tool to double-check/adjust a timestamp
├── README.md                 This file
└── assets/
    ├── audio/               Your 13 MP3s (already in place)
    ├── images/
    │   ├── background.jpg           full-screen background art
    │   ├── icon-512.png              the vinyl record graphic
    │   └── icon-maskable-512.png    spare icon variant
    ├── sounds/
    │   ├── cymbal-hit.wav        synthesized cymbal crash (pad hit)
    │   ├── success-chime.wav    "Perfect"/"Good" result chime
    │   └── miss-thud.wav        "Missed it" result sound
    └── videos/
        └── screensaver.mp4     ← you add this (see "Screen saver" below)
```

## How the game works

1. **Idle / home screen** — just the title and a big vinyl record. No song
   name, artist, or hint shown anywhere — it's a complete mystery until a
   round actually starts. The "Spin The Record" prompt lives right inside
   the vinyl's own yellow centre label — the record itself *is* the
   button, tap anywhere on it.
2. **Playing** — the vinyl spins, the tonearm lowers onto it, the song
   starts immediately (no countdown), the song's name/artist/instruction
   reveal themselves for the first time, and the cymbal becomes active.
   The player gets exactly one tap.
3. **Result** — the instant the cymbal is hit, it locks, plays a sound,
   and shows a ripple. The song keeps playing in the background for a few
   seconds after the tap (or after a miss) rather than cutting out
   abruptly. The overlay reports one of three outcomes:
   - **Perfect!** — inside the tight window, confetti burst.
   - **Good!** — inside the wider window but not dead-on (early or late
     by up to half a second), smaller confetti.
   - **Better Luck Next Time!** — outside both windows, with a horizontal
     timing meter showing how early or late.
4. **Auto-reset** — 7 seconds after the result appears, the screen returns
   to the same blank mystery idle state, with the next song already
   queued up. No leftover score, message, or animation carries over.
5. **Idle/reset button** — the small `⟲` in the bottom-right corner (faint
   on purpose, but visible) instantly forces a full reset to idle from any
   state — stops audio immediately, clears results, ready for the next
   participant.
6. **Hidden triple-tap reset** — the exact same full reset also triggers
   from **triple-tapping anywhere on the screen within ~2 seconds**, from
   any state. Completely invisible — no button, no visual cue — meant only
   for staff who know it's there.
7. **Screen saver** — after 30 minutes with zero touches anywhere, a
   full-screen looping video takes over. Any touch instantly closes it and
   drops back to a clean idle screen. See below to add your own video.

### Song rotation
Songs are drawn from a shuffle bag, not pure randomness — all 13 play
once, in random order, before the bag reshuffles for the next round of 13.
That's what stops the same song from popping up twice within a handful of
plays.

### Scoring: Perfect / Good / Missed It
Each song is judged against two windows around its `targetTime`:
`DEFAULT_PERFECT_TOLERANCE_MS` (150ms) for **Perfect!**, and
`DEFAULT_GOOD_TOLERANCE_MS` (500ms, early or late) for **Good!** — both
set at the bottom of `songs.js`, with optional per-song overrides
(`perfectToleranceMs` / `goodToleranceMs`) if one song needs a different
window. Outside both = **Missed It**, with the exact early/late offset
always shown either way.

### Timing accuracy
Timing is measured with the Web Audio API (`AudioContext.currentTime`), not
the `<audio>` element — `<audio>.currentTime` only updates a few times a
second, which isn't precise enough to judge milliseconds. The song is
played through an `AudioBufferSourceNode`, and the tap is captured on
`pointerdown` (fires earlier than `click`), so the measured offset is as
tight as the browser allows.

### Trimming a song (startOffset / endOffset)
Some songs skip a dead intro and/or stop early rather than playing the
whole file — set per-song in `songs.js` via optional `startOffset` /
`endOffset` fields (seconds into the MP3). `targetTime` always stays
anchored to the original file's timeline regardless of trimming, so the
scoring math doesn't need to change when you adjust either offset.

### How the beat detection actually worked
Each MP3 was decoded to raw audio and run through a short-time Fourier
transform. A median-filtering harmonic/percussive separation pass (the
same family of technique used in DAW "stem splitting" tools) isolates
drum-like broadband transients from vocals and sustained instruments. An
onset-strength function was then computed from just the percussive energy,
and — searching around the moment described — the strongest genuine
percussive spike closest to that moment was selected and refined against
the raw waveform's rise time. That's how `songs.js` ended up with values
like `221.796` instead of a rounded `221.0`.

## Screen saver

Drop your video in as:

```
assets/videos/screensaver.mp4
```

That's the only step — no code changes needed. If the file is missing or
fails to load, the game just skips the feature quietly (logs a note to
the browser console) rather than breaking anything.

Details:
- Kicks in after **30 minutes** with no touches anywhere on the screen.
  Change this in `script.js` → `SCREENSAVER_IDLE_MS` (in milliseconds).
- Plays muted, looping, full-screen, with a smooth fade in/out.
- Any touch anywhere instantly closes it and returns to a guaranteed-clean
  idle screen.
- See `assets/videos/README.md` for recommended video specs (format,
  orientation, file size).

## Customizing

- **Song list / timing / tolerance** — all in `songs.js`, plain objects,
  well commented.
- **Auto-reset delay, "too late" grace window, screen saver timeout** — top
  of `script.js` (`AUTO_RESET_MS`, `LATE_GRACE_MS`, `SCREENSAVER_IDLE_MS`).
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

- [ ] Add your screen saver video to `assets/videos/screensaver.mp4`.
- [ ] Tested on the actual kiosk hardware/browser, at full volume, with the
      real speakers/headphones that will be used on the day.
- [ ] Confirmed the idle/reset button (bottom-right corner) and the hidden
      triple-tap-anywhere gesture both work from a device you'll have on
      hand during the event.
- [ ] Let the screen sit untouched for 30 minutes once to confirm the
      screen saver actually kicks in and closes cleanly on touch.
