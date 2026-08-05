/* =========================================================================
   songs.js — Catch The Beat | Song configuration
   =========================================================================

   HOW THIS FILE WORKS
   --------------------
   Each song needs:
     audio        -> filename inside assets/audio/ (must match exactly)
     title        -> what's shown on screen (only revealed once the record
                     is spinning — the idle screen shows no song info)
     targetMoment -> the fun, in-the-moment cue shown to the player
     targetTime   -> the EXACT second (in the MP3 file) the cymbal should
                     be hit

   Optional per song:
     startOffset  -> second (in the MP3 file) where playback begins. Omit
                     or 0 to start from the top. Used to skip a long intro.
     endOffset    -> second (in the MP3 file) where playback is trimmed to
                     stop. Omit to let it play to the end of the file.
     perfectToleranceMs / goodToleranceMs -> per-song overrides of the
                     global scoring windows defined at the bottom of this
                     file (rarely needed).

   HOW targetTime WAS MEASURED
   ----------------------------
   Every MP3 was analyzed directly with a percussive-onset detector
   (harmonic/percussive separation isolates drum-like transients from
   vocals, then the sharpest nearby percussive spike is located and
   refined against the raw waveform). For the songs where you gave an
   exact minute:second this round, that value was used as the anchor and
   the analysis just pinpointed the precise millisecond right around it.

   `analyzed: true` marks a song whose targetTime came from this process.
   `sourceTimestamp` records what you told me, for reference.
   ========================================================================= */

const SONGS = [
  {
    audio: "I Will Always Love You.mp3",
    title: "I Will Always Love You",
    artist: "Whitney Houston",
    targetMoment: "Catch the drum right before Whitney holds that legendary note.",
    targetTime: 190.296,
    startOffset: 172.0, // 2:52 — skips straight to the buildup, no long intro
    sourceTimestamp: "buzzer 3:10, playback starts 2:52",
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
    targetMoment: "Catch it right before he tries to call you.",
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
    targetMoment: "Strike it right when the beat kicks back into gear.",
    targetTime: 68.939,
    startOffset: 47.0, // 0:47
    sourceTimestamp: "buzzer 1:09, playback starts 0:47",
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
    targetMoment: "Catch it right before she sings \u201csomeone like you\u201d for the first time.",
    targetTime: 74.014,
    sourceTimestamp: "1:14",
    analyzed: true
  },
  {
    audio: "Rolling In The Deep.mp3",
    title: "Rolling In The Deep",
    artist: "Adele",
    targetMoment: "Catch it the instant the cymbal crashes into the chorus.",
    targetTime: 60.785,
    startOffset: 40.0, // 0:40
    sourceTimestamp: "buzzer 1:00, playback starts 0:40",
    analyzed: true
  },
  {
    audio: "In The Air Tonight.mp3",
    title: "In The Air Tonight",
    artist: "Phil Collins",
    targetMoment: "Catch the very first hit of the most famous drum fill ever.",
    targetTime: 221.796,
    startOffset: 157.0, // 2:37
    endOffset: 232.0,   // extended a little past the requested 3:20 so the
                         // fill itself (the actual target, ~3:41\u20133:47)
                         // is still inside the trimmed window \u2014 see note
                         // to the team about this.
    sourceTimestamp: "playback 2:37\u20133:20 as requested; window extended to ~3:52 so the fill itself stays reachable",
    analyzed: true
  }
];

// Global pass/fail windows (in milliseconds) around each song's targetTime.
// Inside PERFECT = "Perfect!", inside GOOD (but outside PERFECT) = "Good!",
// outside both = "Missed It". Any song can override either one with its own
// `perfectToleranceMs` / `goodToleranceMs` field.
const DEFAULT_PERFECT_TOLERANCE_MS = 150;
const DEFAULT_GOOD_TOLERANCE_MS    = 500;

// Don't touch this — script.js expects `SONGS` as a plain array on window.
if (typeof window !== "undefined") {
  window.SONGS = SONGS;
  window.DEFAULT_PERFECT_TOLERANCE_MS = DEFAULT_PERFECT_TOLERANCE_MS;
  window.DEFAULT_GOOD_TOLERANCE_MS = DEFAULT_GOOD_TOLERANCE_MS;
}
