/* =========================================================================
   Catch The Beat — script.js
   Vanilla JS, no dependencies. Uses the Web Audio API (not <audio>/currentTime)
   for scheduling and measuring the tap, because HTMLAudioElement.currentTime
   only updates a few times a second — nowhere near accurate enough to judge
   a hit in milliseconds. AudioContext.currentTime is sample-accurate.
   ========================================================================= */

(function () {
  "use strict";

  /* ------------------------------ DOM refs ------------------------------ */
  const appEl            = document.getElementById("app");
  const vinylBtn          = document.getElementById("vinylBtn");
  const drumPad           = document.getElementById("drumPad");
  const rippleLayer       = document.getElementById("rippleLayer");
  const drumCaption       = document.getElementById("drumCaption");
  const songTitleEl       = document.getElementById("songTitle");
  const songArtistEl      = document.getElementById("songArtist");
  const songHintEl        = document.getElementById("songHint");
  const resultOverlay     = document.getElementById("resultOverlay");
  const resultKicker      = document.getElementById("resultKicker");
  const resultHeadline    = document.getElementById("resultHeadline");
  const resultSub         = document.getElementById("resultSub");
  const resultMs          = document.getElementById("resultMs");
  const timingMeter       = document.getElementById("timingMeter");
  const timingMeterNeedle = document.getElementById("timingMeterNeedle");
  const confettiCanvas    = document.getElementById("confettiCanvas");
  const staffResetBtn     = document.getElementById("staffReset");
  const staffResetToast   = document.getElementById("staffResetToast");
  const screensaverEl     = document.getElementById("screensaver");
  const screensaverVideo  = document.getElementById("screensaverVideo");

  /* ------------------------------- Config -------------------------------- */
  const AUDIO_BASE       = "assets/audio/";
  const SFX = {
    cymbal:  "assets/sounds/cymbal-hit.wav",
    success: "assets/sounds/success-chime.wav",
    miss:    "assets/sounds/miss-thud.wav"
  };
  const AUTO_RESET_MS   = 7000;  // idle screen returns automatically after a result
  const LATE_GRACE_MS   = 5500;  // if nobody hits the pad this long after the target, auto-resolve as a miss
  const POST_ROUND_PLAY_MS = 3200; // how long the song keeps playing after a hit/miss before fading out
  const TOAST_MS         = 1600;

  // Screen saver: kicks in after this long with zero touches anywhere on
  // the screen. Change the number, nothing else — swap the video file at
  // assets/videos/screensaver.mp4, also nothing else to configure.
  const SCREENSAVER_IDLE_MS = 30 * 60 * 1000; // 30 minutes
  const SCREENSAVER_VIDEO_SRC = "assets/videos/screensaver.mp4";

  // Hidden staff gesture: 3 taps anywhere on the screen within this many
  // ms triggers an instant full reset, from any state.
  const TRIPLE_TAP_WINDOW_MS = 2000;

  const songs = Array.isArray(window.SONGS) ? window.SONGS.slice() : [];
  // Two windows around the exact beat: inside the tighter one = "Perfect!",
  // inside the wider one (but outside the tight one, early OR late) =
  // "Good!", anything beyond that = "Missed It". Generous on purpose —
  // real touchscreens and speakers add their own latency, so a razor-thin
  // window just punishes people for the hardware, not their timing.
  const DEFAULT_PERFECT_TOLERANCE_MS = window.DEFAULT_PERFECT_TOLERANCE_MS || 150;
  const DEFAULT_GOOD_TOLERANCE_MS    = window.DEFAULT_GOOD_TOLERANCE_MS    || 500;

  /* --------------------------- Web Audio engine --------------------------- */
  let audioCtx = null;
  const songBufferCache = new Map();
  const sfxBufferCache = new Map();

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  async function loadBuffer(url, cache) {
    if (cache.has(url)) return cache.get(url);
    const ctx = ensureCtx();
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    cache.set(url, audioBuffer);
    return audioBuffer;
  }

  function playSfx(name) {
    const url = SFX[name];
    if (!url) return;
    const ctx = ensureCtx();
    const fire = (buf) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    };
    const cached = sfxBufferCache.get(url);
    if (cached) fire(cached);
    else loadBuffer(url, sfxBufferCache).then(fire).catch(() => {});
  }

  // Warm the HTTP cache for sfx immediately (decode happens lazily on first play).
  Object.values(SFX).forEach((url) => { fetch(url).catch(() => {}); });

  /* -------------------------------- State -------------------------------- */
  const STATE = { IDLE: "idle", PLAYING: "playing", RESULT: "result" };
  let state = STATE.IDLE;

  let currentSongIndex = -1;
  let currentSong = null;
  let currentBuffer = null;   // null => song audio unavailable, runs in silent timing mode
  let isReady = false;
  let pendingStart = false;

  let sourceNode = null;
  let gainNode = null;
  let songStartCtxTime = 0;
  let currentStartOffset = 0;
  let hasTapped = false;
  let lateTimer = null;
  let resetTimer = null;
  let postRoundFadeTimer = null;

  /* ------------------------------ Song rotation --------------------------- */
  // Shuffle-bag: play through every song once, in random order, before
  // reshuffling for the next full pass — avoids the same song popping up
  // twice within a handful of rounds like pure random selection would.
  let shuffleBag = [];
  let lastPlayedIndex = -1;

  function refillShuffleBag() {
    const arr = songs.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    // Avoid an immediate repeat right at the seam between one bag and the next.
    if (arr.length > 1 && arr[0] === lastPlayedIndex) {
      const swapWith = 1 + Math.floor(Math.random() * (arr.length - 1));
      const tmp = arr[0]; arr[0] = arr[swapWith]; arr[swapWith] = tmp;
    }
    shuffleBag = arr;
  }

  function drawNextIndex() {
    if (songs.length === 0) return -1;
    if (songs.length === 1) return 0;
    if (shuffleBag.length === 0) refillShuffleBag();
    const idx = shuffleBag.shift();
    lastPlayedIndex = idx;
    return idx;
  }

  function songUrl(song) { return AUDIO_BASE + song.audio; }

  async function preloadSong(index) {
    const song = songs[index];
    if (!song) return null;
    try {
      return await loadBuffer(songUrl(song), songBufferCache);
    } catch (err) {
      // No audio file yet (or it failed to decode) — the game still runs
      // in silent timing mode so staff can test the full flow before the
      // real MP3s are dropped into assets/audio/.
      console.warn(
        "[Catch The Beat] Couldn't load \"" + song.audio + "\" for \u201c" + song.title +
        "\u201d. Add the matching MP3 to assets/audio/. Running this round in silent test mode.",
        err
      );
      return null;
    }
  }

  function loadRound(index) {
    currentSongIndex = index;
    currentSong = songs[index];
    if (!currentSong) {
      songTitleEl.textContent = "No songs configured";
      songArtistEl.textContent = "";
      songHintEl.textContent = "Add entries to songs.js to get started.";
      return;
    }
    songTitleEl.textContent = currentSong.title;
    songArtistEl.textContent = currentSong.artist || "";
    songHintEl.textContent = currentSong.targetMoment;

    isReady = false;
    currentBuffer = null;

    preloadSong(index).then((buf) => {
      // Guard against a reset happening while this was in flight.
      if (currentSongIndex !== index) return;
      currentBuffer = buf;
      isReady = true;
      if (pendingStart) {
        pendingStart = false;
        beginPlayback();
      }
    });
  }

  /* -------------------------------- Flow ---------------------------------- */
  function onStartRequested() {
    if (state !== STATE.IDLE) return;
    if (!isReady) {
      pendingStart = true;
      drumCaption.textContent = "Cueing up the record\u2026";
      return;
    }
    beginPlayback();
  }

  function beginPlayback() {
    state = STATE.PLAYING;
    appEl.classList.remove("is-idle");
    appEl.classList.add("is-playing");

    const ctx = ensureCtx();

    if (gainNode) { try { gainNode.disconnect(); } catch (e) {} }
    gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(ctx.destination);

    hasTapped = false;
    sourceNode = null;

    // Some songs skip a dead intro (startOffset) and/or stop early
    // (endOffset) rather than playing the whole file — both optional,
    // set per-song in songs.js.
    const startOffset = (currentSong && currentSong.startOffset) || 0;
    const endOffset = currentSong && currentSong.endOffset;
    const clipDuration = endOffset ? Math.max(0.1, endOffset - startOffset) : undefined;

    if (currentBuffer) {
      sourceNode = ctx.createBufferSource();
      sourceNode.buffer = currentBuffer;
      sourceNode.connect(gainNode);
      sourceNode.onended = handleSongEnded;
      if (clipDuration !== undefined) sourceNode.start(0, startOffset, clipDuration);
      else sourceNode.start(0, startOffset);
    }

    // songStartCtxTime marks the ctx-clock instant at which the file's
    // playhead was at `startOffset` — so file-time = elapsed-since-start
    // + startOffset. Every timing calculation below routes through this.
    songStartCtxTime = ctx.currentTime;
    currentStartOffset = startOffset;

    drumPad.disabled = false;
    drumPad.classList.add("is-active");
    drumCaption.textContent = "Listen closely\u2026 strike the cymbal on the beat!";

    clearTimeout(lateTimer);
    const msUntilTarget = (currentSong.targetTime - startOffset) * 1000;
    lateTimer = setTimeout(() => {
      if (state === STATE.PLAYING && !hasTapped) handleMissTimeout();
    }, msUntilTarget + LATE_GRACE_MS);
  }

  function handleSongEnded() {
    if (state === STATE.PLAYING && !hasTapped) handleMissTimeout();
  }

  function fadeOutAndStop() {
    if (!sourceNode || !gainNode) return;
    const ctx = ensureCtx();
    try {
      const now = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      sourceNode.onended = null;
      sourceNode.stop(now + 0.55);
    } catch (e) { /* already stopped — fine */ }
    sourceNode = null;
  }

  // Used on reset (idle button or auto-reset) — audio needs to go
  // completely silent right now, not fade out over half a second.
  function hardStopAudio() {
    if (sourceNode) {
      try { sourceNode.onended = null; sourceNode.stop(); } catch (e) {}
      sourceNode = null;
    }
    if (gainNode) {
      try { gainNode.disconnect(); } catch (e) {}
      gainNode = null;
    }
  }

  // The song keeps playing for a little while after the round ends (hit
  // or missed) instead of cutting out abruptly — feels much nicer than a
  // hard stop right as the result appears.
  function scheduleFadeOut() {
    clearTimeout(postRoundFadeTimer);
    postRoundFadeTimer = setTimeout(fadeOutAndStop, POST_ROUND_PLAY_MS);
  }

  function onDrumHit() {
    if (state !== STATE.PLAYING || hasTapped) return;
    hasTapped = true;

    const ctx = ensureCtx();
    const tapFileTime = (ctx.currentTime - songStartCtxTime) + currentStartOffset;
    const diffMs = (tapFileTime - currentSong.targetTime) * 1000;

    clearTimeout(lateTimer);
    drumPad.disabled = true;
    drumPad.classList.remove("is-active");
    drumPad.classList.add("is-hit");
    spawnRipple();
    playSfx("cymbal");
    scheduleFadeOut();

    resolveRound(diffMs, true);
  }

  function handleMissTimeout() {
    if (state !== STATE.PLAYING || hasTapped) return;
    hasTapped = true;
    drumPad.disabled = true;
    drumPad.classList.remove("is-active");
    scheduleFadeOut();
    resolveRound(null, false);
  }

  function formatMs(diffMs) {
    const rounded = Math.round(diffMs);
    if (rounded > 0) return "+" + rounded + " ms";
    if (rounded < 0) return rounded + " ms";
    return "0 ms";
  }

  function updateTimingMeter(diffMs) {
    const range = 1000; // ms represented by the full width of the meter
    const clamped = Math.max(-range, Math.min(range, diffMs));
    const pct = 50 + (clamped / range) * 50;
    timingMeterNeedle.style.left = pct + "%";
  }

  function resolveRound(diffMs, tapped) {
    state = STATE.RESULT;
    appEl.classList.remove("is-playing");

    const perfectMs = (currentSong && currentSong.perfectToleranceMs) || DEFAULT_PERFECT_TOLERANCE_MS;
    const goodMs    = (currentSong && currentSong.goodToleranceMs)    || DEFAULT_GOOD_TOLERANCE_MS;
    const absDiff = tapped ? Math.abs(diffMs) : Infinity;

    let tier; // "perfect" | "good" | "miss"
    if (tapped && absDiff <= perfectMs) tier = "perfect";
    else if (tapped && absDiff <= goodMs) tier = "good";
    else tier = "miss";

    resultOverlay.classList.remove("tier-perfect", "tier-good", "tier-miss");
    resultOverlay.classList.add("tier-" + tier);

    if (tier === "perfect") {
      resultKicker.textContent = "Nailed It";
      resultHeadline.textContent = "Perfect!";
      resultSub.textContent = "You caught it right on the beat of \u201c" + currentSong.title + ".\u201d";
      resultMs.style.display = "";
      resultMs.className = "result-ms tier-perfect";
      resultMs.textContent = formatMs(diffMs);
      timingMeter.style.display = "none";
      playSfx("success");
      launchConfetti(1);
    } else if (tier === "good") {
      resultKicker.textContent = "Good Catch";
      resultHeadline.textContent = "Good!";
      resultSub.textContent = "Right in the pocket on \u201c" + currentSong.title + ".\u201d";
      resultMs.style.display = "";
      resultMs.className = "result-ms tier-good";
      resultMs.textContent = formatMs(diffMs);
      timingMeter.style.display = "none";
      playSfx("success");
      launchConfetti(0.55);
    } else if (tapped) {
      resultKicker.textContent = "Missed It";
      resultHeadline.textContent = "Better Luck Next Time!";
      resultSub.textContent = (diffMs < 0 ? "A touch early on \u201c" : "A touch late on \u201c") + currentSong.title + ".\u201d";
      resultMs.style.display = "";
      resultMs.className = "result-ms " + (diffMs < 0 ? "early" : "late");
      resultMs.textContent = formatMs(diffMs);
      timingMeter.style.display = "";
      updateTimingMeter(diffMs);
      playSfx("miss");
    } else {
      resultKicker.textContent = "Missed It";
      resultHeadline.textContent = "Better Luck Next Time!";
      resultSub.textContent = "\u00a0";
      resultMs.style.display = "none";
      timingMeter.style.display = "none";
      playSfx("miss");
    }

    resultOverlay.setAttribute("aria-hidden", "false");
    resultOverlay.classList.add("is-visible");

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => resetToIdle(false), AUTO_RESET_MS);
  }

  function resetToIdle(isStaffForced) {
    clearTimeout(resetTimer);
    clearTimeout(lateTimer);
    clearTimeout(postRoundFadeTimer);
    stopConfetti();
    hardStopAudio(); // instant silence — no fade, this is a hard reset

    state = STATE.IDLE;
    appEl.classList.remove("is-playing");
    appEl.classList.add("is-idle");

    // Result overlay: hide it and defensively wipe every field inside it,
    // so nothing stale is even present if the next round is interrupted
    // mid-transition.
    resultOverlay.classList.remove("is-visible", "tier-perfect", "tier-good", "tier-miss");
    resultOverlay.setAttribute("aria-hidden", "true");
    resultKicker.textContent = "Result";
    resultHeadline.textContent = "\u2014";
    resultSub.textContent = "\u00a0";
    resultMs.textContent = "\u00a0";
    resultMs.className = "result-ms";
    resultMs.style.display = "none";
    timingMeter.style.display = "none";
    timingMeterNeedle.style.left = "50%";

    drumPad.disabled = true;
    drumPad.classList.remove("is-active", "is-hit");
    drumCaption.textContent = "Waiting for the record to drop\u2026";

    hasTapped = false;
    pendingStart = false;

    const nextIndex = drawNextIndex();
    loadRound(nextIndex);

    if (isStaffForced) {
      staffResetToast.classList.add("is-visible");
      setTimeout(() => staffResetToast.classList.remove("is-visible"), TOAST_MS);
    }
  }

  /* ------------------------------- Ripple FX ------------------------------ */
  function spawnRipple() {
    const el = document.createElement("span");
    el.className = "ripple";
    rippleLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  /* ------------------------------- Confetti -------------------------------- */
  let confettiCtx = null;
  let confettiRAF = null;
  let confettiParticles = [];
  const CONFETTI_COLORS = ["#f4b942", "#ffe1a1", "#81d1d8", "#ffffff", "#ef7a5f"];

  function launchConfetti(intensity) {
    intensity = intensity || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = confettiCanvas.clientWidth * dpr;
    confettiCanvas.height = confettiCanvas.clientHeight * dpr;
    confettiCtx = confettiCanvas.getContext("2d");

    const w = confettiCanvas.width, h = confettiCanvas.height;
    const count = Math.round(130 * intensity);
    confettiParticles = Array.from({ length: count }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.5,
      y: h * 0.28 + (Math.random() - 0.5) * 40 * dpr,
      vx: (Math.random() - 0.5) * 7 * dpr,
      vy: (Math.random() * -7 - 2) * dpr,
      size: (Math.random() * 6 + 4) * dpr,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      gravity: 0.16 * dpr,
      life: 0,
      maxLife: 110 + Math.random() * 70
    }));

    cancelAnimationFrame(confettiRAF);
    const step = () => {
      confettiCtx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of confettiParticles) {
        if (p.life > p.maxLife) continue;
        alive = true;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life++;
        const fadeStart = p.maxLife - 30;
        const alpha = p.life > fadeStart ? Math.max(0, (p.maxLife - p.life) / 30) : 1;
        confettiCtx.save();
        confettiCtx.globalAlpha = alpha;
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        confettiCtx.restore();
      }
      confettiRAF = alive ? requestAnimationFrame(step) : null;
      if (!alive) confettiCtx.clearRect(0, 0, w, h);
    };
    step();
  }

  function stopConfetti() {
    cancelAnimationFrame(confettiRAF);
    confettiRAF = null;
    confettiParticles = [];
    if (confettiCtx) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  /* ------------------------------ Screen saver -----------------------------
     Activates after SCREENSAVER_IDLE_MS with no touches anywhere. Any touch
     while it's showing closes it instantly and drops back to a guaranteed-
     clean idle screen. */
  let inactivityTimer = null;
  let screensaverActive = false;
  let screensaverWarned = false;

  function armInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(showScreensaver, SCREENSAVER_IDLE_MS);
  }

  function showScreensaver() {
    if (screensaverActive) return;
    screensaverActive = true;

    // Whatever was happening, land on a guaranteed-clean idle state
    // underneath the screen saver first.
    resetToIdle(false);

    screensaverEl.classList.add("is-visible");
    screensaverEl.setAttribute("aria-hidden", "false");

    try { screensaverVideo.currentTime = 0; } catch (e) {}
    const playPromise = screensaverVideo.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch((err) => {
        // Missing file, unsupported format, or autoplay blocked — fail
        // silently in the UI; log once so it's easy to diagnose.
        if (!screensaverWarned) {
          screensaverWarned = true;
          console.warn(
            "[Catch The Beat] Screen saver video didn't start (" + SCREENSAVER_VIDEO_SRC +
            "). Make sure that file exists.", err
          );
        }
      });
    }
  }

  function hideScreensaver() {
    if (!screensaverActive) return;
    screensaverActive = false;

    screensaverEl.classList.remove("is-visible");
    screensaverEl.setAttribute("aria-hidden", "true");
    screensaverVideo.pause();
    try { screensaverVideo.currentTime = 0; } catch (e) {}

    // Guarantee the game is sitting at a clean idle screen, ready for
    // the next participant.
    resetToIdle(false);
    armInactivityTimer();
  }

  /* --------------------------- Global touch handling -----------------------
     One listener does double duty:
       1. Resets the screen-saver countdown on any touch.
       2. Dismisses the screen saver instantly if it's showing.
       3. Tracks the hidden triple-tap-anywhere gesture for staff. */
  let tapTimestamps = [];

  function handleGlobalPointerDown() {
    if (screensaverActive) {
      hideScreensaver();
      return;
    }

    armInactivityTimer();

    const now = Date.now();
    tapTimestamps.push(now);
    tapTimestamps = tapTimestamps.filter((t) => now - t <= TRIPLE_TAP_WINDOW_MS);
    if (tapTimestamps.length >= 3) {
      tapTimestamps = [];
      resetToIdle(true);
    }
  }

  document.addEventListener("pointerdown", handleGlobalPointerDown, { passive: true });

  /* --------------------------------- Idle / reset button -------------------
     Fires immediately on click/tap — no hold, no delay. It's a real button
     now (visible, if faint), so it needs to behave like one: press it,
     the game is instantly back to idle. */
  staffResetBtn.addEventListener("click", () => resetToIdle(true));

  /* --------------------------------- Events -------------------------------- */
  vinylBtn.addEventListener("click", onStartRequested);

  // pointerdown (not click) on the drum pad: fires as early as physically
  // possible, which matters a lot when we're judging milliseconds.
  drumPad.addEventListener("pointerdown", (e) => { e.preventDefault(); onDrumHit(); });
  drumPad.addEventListener("click", onDrumHit); // fallback for non-pointer environments

  window.addEventListener("resize", () => {
    if (confettiCtx && resultOverlay.classList.contains("is-visible")) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      confettiCanvas.width = confettiCanvas.clientWidth * dpr;
      confettiCanvas.height = confettiCanvas.clientHeight * dpr;
    }
  });

  /* ---------------------------------- Init --------------------------------- */
  function init() {
    appEl.classList.add("is-idle");
    drumPad.disabled = true;
    drumCaption.textContent = "Waiting for the record to drop\u2026";
    const firstIndex = drawNextIndex();
    loadRound(firstIndex);
    armInactivityTimer();
  }

  init();
})();
