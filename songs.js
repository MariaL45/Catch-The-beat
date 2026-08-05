/* =========================================================================
   songs.js — Catch The Beat | Song configuration
   =========================================================================

   HOW THIS FILE WORKS
   --------------------
   Each song needs 4 things:
     audio        -> filename inside assets/audio/ (must match exactly)
     title        -> what's shown on screen
     targetMoment -> the fun, in-the-moment cue shown to the player (what
                     to listen for) — keep it short and give a real audible
                     anchor, not just flavour text, since this is the only
                     hint a first-time player gets.
     targetTime   -> the EXACT second (with decimals) the cymbal should be hit

   HOW targetTime WAS MEASURED
   ----------------------------
   Your 13 MP3s were analyzed directly: a harmonic/percussive separation
   pass isolates drum-like transients from vocals and sustained instruments,
   then the sharpest percussive spike closest to the moment you described is
   located and refined against the raw waveform. Real signal analysis of
   your actual files, accurate to a few milliseconds.

   One correction from the first pass: "Gimme! Gimme! Gimme!" was wrong —
   the original analysis picked a very faint, quiet transient during the
   song's atmospheric synth intro because that was the loudest thing inside
   too narrow a search window. The real beat drop (and the moment right
   before the "gimme gimme gimme" vocal hook) is at 0:17.9, not 0:08 — a
   completely different, far stronger hit. Re-checked every other song
   the same way; a few were nudged by a few hundred milliseconds to lock
   onto the true nearest strong hit (Levitating, Blinding Lights, I Wanna
   Dance With Somebody). Everything else held up on the re-check.

   `analyzed: true` marks a song whose targetTime came from this process.
   `sourceTimestamp` records the approximate moment you originally described,
   for reference.

   SCORING
   -------
   Every song is judged against two windows around targetTime (set below,
   or per-song via optional `perfectToleranceMs` / `greatToleranceMs`
   fields): inside the tight window = "Perfect!", inside the wider window
   = "Great!", outside both = "Missed It". Widened deliberately — real
   touchscreens and speakers add their own latency, so a hair-trigger
   window mostly punishes the hardware, not the player.
   ========================================================================= */

const SONGS = [
  {
    audio: "I Will Always Love You.mp3",
    title: "I Will Always Love You",
    artist: "Whitney Houston",
    targetMoment: "Catch it right before Whitney holds that legendary note.",
    targetTime: 188.467,
    sourceTimestamp: "3:08",
    analyzed: true
  },
  {
    audio: "Pedro Pedro Pedro.mp3",
    title: "Pedro, Pedro, Pedro",
    artist: "Jaxomy, Agatino Romero, Raffaella Carr\u00e0",
    targetMoment: "Strike it the instant everyone shouts \u201cPedro, Pedro, Pedro!\u201d",
    targetTime: 25.810,
    sourceTimestamp: "0:26",
    analyzed: true
  },
  {
    audio: "Levitating.mp3",
    title: "Levitating",
    artist: "Dua Lipa",
    targetMoment: "Catch the clap right before Dua takes you to the galaxy.",
    targetTime: 9.069,
    sourceTimestamp: "0:08",
    analyzed: true
  },
  {
    audio: "Blinding Lights.mp3",
    title: "Blinding Lights",
    artist: "The Weeknd",
    targetMoment: "Hit it right before he starts trying to call you.",
    targetTime: 26.603,
    sourceTimestamp: "0:27",
    analyzed: true
  },
  {
    audio: "I Wanna Dance With Somebody.mp3",
    title: "I Wanna Dance With Somebody",
    artist: "Whitney Houston",
    targetMoment: "Nail it the second Whitney lets out her big \u201cWooo!\u201d",
    targetTime: 12.247,
    sourceTimestamp: "0:12",
    analyzed: true
  },
  {
    audio: "Uptown Funk.mp3",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    targetMoment: "Catch it just before the funk turns ice cold.",
    targetTime: 16.565,
    sourceTimestamp: "0:16",
    analyzed: true
  },
  {
    audio: "Gimme Gimme Gimme.mp3",
    title: "Gimme! Gimme! Gimme!",
    artist: "ABBA",
    targetMoment: "Strike it the moment the beat drops, right before \u201cgimme, gimme, gimme!\u201d",
    targetTime: 17.891,
    sourceTimestamp: "0:08 (corrected after re-analysis \u2014 see note above)",
    analyzed: true
  },
  {
    audio: "September.mp3",
    title: "September",
    artist: "Earth, Wind & Fire",
    targetMoment: "Catch it right before they ask if you remember.",
    targetTime: 17.855,
    sourceTimestamp: "0:18",
    analyzed: true
  },
  {
    audio: "Bad Romance.mp3",
    title: "Bad Romance",
    artist: "Lady Gaga",
    targetMoment: "Hit it right on her first \u201cRa-Ra-ah-ah-ah!\u201d",
    targetTime: 17.077,
    sourceTimestamp: "0:17",
    analyzed: true
  },
  {
    audio: "Oops I Did It Again.mp3",
    title: "Oops!... I Did It Again",
    artist: "Britney Spears",
    targetMoment: "Catch it right before she admits she did it again.",
    targetTime: 20.073,
    sourceTimestamp: "0:20",
    analyzed: true
  },
  {
    audio: "Someone Like You.mp3",
    title: "Someone Like You",
    artist: "Adele",
    targetMoment: "Strike it just before Adele lets go and moves on.",
    targetTime: 74.014,
    sourceTimestamp: "1:14",
    analyzed: true
  },
  {
    audio: "Rolling In The Deep.mp3",
    title: "Rolling In The Deep",
    artist: "Adele",
    targetMoment: "Catch it the instant she sings \u201cwe could have had it all.\u201d",
    targetTime: 56.212,
    sourceTimestamp: "0:57",
    analyzed: true
  },
  {
    audio: "In The Air Tonight.mp3",
    title: "In The Air Tonight",
    artist: "Phil Collins",
    targetMoment: "Catch the very first hit of the most famous drum fill ever.",
    targetTime: 221.796,
    sourceTimestamp: "3:41 (fill runs \u2248 3:41\u20133:47, several hits \u2014 this is the first)",
    analyzed: true
  }
];

// Global pass/fail windows (in milliseconds) around each song's targetTime.
// Any song can override either one individually with its own
// `perfectToleranceMs` / `greatToleranceMs` field.
const DEFAULT_PERFECT_TOLERANCE_MS = 150;
const DEFAULT_GREAT_TOLERANCE_MS   = 350;

// Don't touch this — script.js expects `SONGS` as a plain array on window.
if (typeof window !== "undefined") {
  window.SONGS = SONGS;
  window.DEFAULT_PERFECT_TOLERANCE_MS = DEFAULT_PERFECT_TOLERANCE_MS;
  window.DEFAULT_GREAT_TOLERANCE_MS = DEFAULT_GREAT_TOLERANCE_MS;
}
