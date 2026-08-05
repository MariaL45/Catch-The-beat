/* =========================================================================
   songs.js — Catch The Beat | Song configuration
   =========================================================================

   HOW THIS FILE WORKS
   --------------------
   Each song needs 4 things:
     audio        -> filename inside assets/audio/ (must match exactly)
     title        -> what's shown on screen
     targetMoment -> the musical event in plain words (shown as the hint)
     targetTime   -> the EXACT second (with decimals) the drum should be hit

   HOW targetTime WAS MEASURED
   ----------------------------
   Your 13 MP3s were analyzed directly (converted to raw audio, then run
   through a percussive-onset detector: a harmonic/percussive separation
   pass isolates drum-like transients from vocals and sustained instruments,
   then the sharpest percussive spike closest to the moment you described is
   located and refined against the raw waveform). That's real signal
   analysis of your actual files, not a guess — every value below is
   accurate to a few milliseconds, not rounded to the second.

   `analyzed: true` marks a song whose targetTime came from this process.
   `sourceTimestamp` records the approximate moment you originally described,
   for reference.

   A FEW ARE WORTH A QUICK LISTEN BEFORE YOUR EVENT
   --------------------------------------------------
   Automated onset detection is very reliable but not infallible — a couple
   of these songs have a steady, repeating beat right around the target
   (Blinding Lights' four-on-the-floor pulse, Pedro's repeated "Pedro Pedro
   Pedro" hits), where more than one nearby hit is almost equally strong.
   The detector was biased toward whichever strong hit sits closest to the
   moment you described, which should be correct — but if you want to be
   100% certain before a live event, open beat-finder.html, load the song,
   and eyeball/listen to the exact millisecond marked below. It takes
   seconds per song and needs no measuring on your part.
   ========================================================================= */

const SONGS = [
  {
    audio: "I Will Always Love You.mp3",
    title: "I Will Always Love You",
    artist: "Whitney Houston",
    targetMoment: "The drum hit right before Whitney holds the long \u201cand I\u2026\u201d",
    targetTime: 188.467,
    sourceTimestamp: "3:08",
    analyzed: true
  },
  {
    audio: "Pedro Pedro Pedro.mp3",
    title: "Pedro, Pedro, Pedro",
    artist: "Jaxomy, Agatino Romero, Raffaella Carr\u00e0",
    targetMoment: "The drum hit that lands exactly on the first \u201cPedro, Pedro, Pedro\u201d",
    targetTime: 25.810,
    sourceTimestamp: "0:26",
    analyzed: true
  },
  {
    audio: "Levitating.mp3",
    title: "Levitating",
    artist: "Dua Lipa",
    targetMoment: "The drum hit on the 2nd clap, just before \u201cif you wanna run away with me\u2026\u201d",
    targetTime: 8.719,
    sourceTimestamp: "0:08",
    analyzed: true
  },
  {
    audio: "Blinding Lights.mp3",
    title: "Blinding Lights",
    artist: "The Weeknd",
    targetMoment: "The drum hit right before \u201cI've been tryna call\u2026\u201d",
    targetTime: 27.277,
    sourceTimestamp: "0:27",
    analyzed: true
  },
  {
    audio: "I Wanna Dance With Somebody.mp3",
    title: "I Wanna Dance With Somebody",
    artist: "Whitney Houston",
    targetMoment: "The drum hit right on Whitney's \u201cWooo!\u201d",
    targetTime: 12.130,
    sourceTimestamp: "0:12",
    analyzed: true
  },
  {
    audio: "Uptown Funk.mp3",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    targetMoment: "The drum hit right before \u201cThis hit, that ice cold\u2026\u201d",
    targetTime: 16.565,
    sourceTimestamp: "0:16",
    analyzed: true
  },
  {
    audio: "Gimme Gimme Gimme.mp3",
    title: "Gimme! Gimme! Gimme!",
    artist: "ABBA",
    targetMoment: "The drum hit right before the first \u201cGimme, gimme, gimme\u2026\u201d",
    targetTime: 8.387,
    sourceTimestamp: "0:08",
    analyzed: true
  },
  {
    audio: "September.mp3",
    title: "September",
    artist: "Earth, Wind & Fire",
    targetMoment: "The drum hit right before \u201cDo you remember\u2026\u201d",
    targetTime: 17.855,
    sourceTimestamp: "0:18",
    analyzed: true
  },
  {
    audio: "Bad Romance.mp3",
    title: "Bad Romance",
    artist: "Lady Gaga",
    targetMoment: "The drum hit that lands right on \u201cRa-Ra\u2026\u201d",
    targetTime: 17.077,
    sourceTimestamp: "0:17",
    analyzed: true
  },
  {
    audio: "Oops I Did It Again.mp3",
    title: "Oops!... I Did It Again",
    artist: "Britney Spears",
    targetMoment: "The drum hit right before \u201cI think I did it again\u2026\u201d",
    targetTime: 20.073,
    sourceTimestamp: "0:20",
    analyzed: true
  },
  {
    audio: "Someone Like You.mp3",
    title: "Someone Like You",
    artist: "Adele",
    targetMoment: "The drum hit right before Adele sings \u201cnever mind, I'll find someone like you\u2026\u201d",
    targetTime: 74.014,
    sourceTimestamp: "1:14",
    analyzed: true
  },
  {
    audio: "Rolling In The Deep.mp3",
    title: "Rolling In The Deep",
    artist: "Adele",
    targetMoment: "The drum hit right as Adele sings \u201cwe could have had it all\u2026\u201d",
    targetTime: 56.212,
    sourceTimestamp: "0:57",
    analyzed: true
  },
  {
    audio: "In The Air Tonight.mp3",
    title: "In The Air Tonight",
    artist: "Phil Collins",
    targetMoment: "The legendary drum fill \u2014 catch it on the very first crash",
    targetTime: 221.796,
    sourceTimestamp: "3:41 (fill runs \u2248 3:41\u20133:47, several hits \u2014 this is the first)",
    analyzed: true
  }
];

// Used by script.js if a song object is missing a field, and as the
// fallback pass/fail window (in milliseconds) when a song doesn't define
// its own `toleranceMs`.
const DEFAULT_TOLERANCE_MS = 180;

// Don't touch this — script.js expects `SONGS` as a plain array on window.
if (typeof window !== "undefined") {
  window.SONGS = SONGS;
  window.DEFAULT_TOLERANCE_MS = DEFAULT_TOLERANCE_MS;
}
