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
  const ctaBtn            = document.getElementById("ctaBtn");
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

  /* ------------------------------- Config -------------------------------- */
  const AUDIO_BASE       = "assets/audio/";
  const SFX = {
    cymbal:  "assets/sounds/cymbal-hit.wav",
    success: "assets/sounds/success-chime.wav",
    miss:    "assets/sounds/miss-thud.wav"
  };
  const AUTO_RESET_MS   = 7000;  // idle screen returns automatically after a result
  const LATE_GRACE_MS   = 4500;  // if nobody hits the pad this long after the target, auto-resolve as a miss
  const TOAST_MS         = 1600;

  const songs = Array.isArray(window.SONGS) ? window.SONGS.slice() : [];
  const DEFAULT_TOLERANCE_MS = window.DEFAULT_TOLERANCE_MS || 180;

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
  let hasTapped = false;
  let lateTimer = null;
  let resetTimer = null;

  /* ------------------------------ Song rotation --------------------------- */
  function pickNextIndex(excludeIndex) {
    if (songs.length === 0) return -1;
    if (songs.length === 1) return 0;
    let idx;
    do { idx = Math.floor(Math.random() * songs.length); }
    while (idx === excludeIndex);
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
    ctaBtn.disabled = true;

    preloadSong(index).then((buf) => {
      // Guard against a reset happening while this was in flight.
      if (currentSongIndex !== index) return;
      currentBuffer = buf;
      isReady = true;
      ctaBtn.disabled = false;
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

    if (currentBuffer) {
      sourceNode = ctx.createBufferSource();
      sourceNode.buffer = currentBuffer;
      sourceNode.connect(gainNode);
      sourceNode.onended = handleSongEnded;
      sourceNode.start(0);
    }

    songStartCtxTime = ctx.currentTime;

    drumPad.disabled = false;
    drumPad.classList.add("is-active");
    drumCaption.textContent = "Listen closely\u2026 strike the cymbal on the beat!";

    clearTimeout(lateTimer);
    const lateAt = (currentSong.targetTime * 1000) + LATE_GRACE_MS;
    lateTimer = setTimeout(() => {
      if (state === STATE.PLAYING && !hasTapped) handleMissTimeout();
    }, lateAt);
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

  function onDrumHit() {
    if (state !== STATE.PLAYING || hasTapped) return;
    hasTapped = true;

    const ctx = ensureCtx();
    const tapTime = ctx.currentTime - songStartCtxTime;
    const diffMs = (tapTime - currentSong.targetTime) * 1000;

    clearTimeout(lateTimer);
    drumPad.disabled = true;
    drumPad.classList.remove("is-active");
    drumPad.classList.add("is-hit");
    spawnRipple();
    playSfx("cymbal");
    fadeOutAndStop();

    resolveRound(diffMs, true);
  }

  function handleMissTimeout() {
    if (state !== STATE.PLAYING || hasTapped) return;
    hasTapped = true;
    drumPad.disabled = true;
    drumPad.classList.remove("is-active");
    fadeOutAndStop();
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

    const toleranceMs = (currentSong && currentSong.toleranceMs) || DEFAULT_TOLERANCE_MS;
    const perfect = tapped && Math.abs(diffMs) <= toleranceMs;

    resultOverlay.classList.remove("win", "miss");
    resultOverlay.classList.add(perfect ? "win" : "miss");

    if (perfect) {
      resultKicker.textContent = "Nailed It";
      resultHeadline.textContent = "Perfect!";
      resultSub.textContent = "You caught it right on the beat of \u201c" + currentSong.title + ".\u201d";
      resultMs.style.display = "";
      resultMs.className = "result-ms perfect";
      resultMs.textContent = formatMs(diffMs);
      timingMeter.style.display = "none";
      playSfx("success");
      launchConfetti();
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
      resultSub.textContent = "The moment slipped by \u2014 give it another go next round!";
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
    stopConfetti();
    fadeOutAndStop();
    if (sourceNode) { try { sourceNode.stop(); } catch (e) {} sourceNode = null; }

    state = STATE.IDLE;
    appEl.classList.remove("is-playing");
    appEl.classList.add("is-idle");

    resultOverlay.classList.remove("is-visible");
    resultOverlay.setAttribute("aria-hidden", "true");
    setTimeout(() => resultOverlay.classList.remove("win", "miss"), 400);

    drumPad.disabled = true;
    drumPad.classList.remove("is-active", "is-hit");
    drumCaption.textContent = "Waiting for the record to drop\u2026";

    hasTapped = false;
    pendingStart = false;

    const nextIndex = pickNextIndex(currentSongIndex);
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

  function launchConfetti() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = confettiCanvas.clientWidth * dpr;
    confettiCanvas.height = confettiCanvas.clientHeight * dpr;
    confettiCtx = confettiCanvas.getContext("2d");

    const w = confettiCanvas.width, h = confettiCanvas.height;
    confettiParticles = Array.from({ length: 130 }, () => ({
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

  /* --------------------------- Staff reset (hidden) ------------------------ */
  let holdTimer = null;
  function armHold() {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { resetToIdle(true); }, 1200);
  }
  function disarmHold() { clearTimeout(holdTimer); }

  staffResetBtn.addEventListener("pointerdown", armHold);
  ["pointerup", "pointerleave", "pointercancel"].forEach((evt) =>
    staffResetBtn.addEventListener(evt, disarmHold)
  );

  /* --------------------------------- Events -------------------------------- */
  vinylBtn.addEventListener("click", onStartRequested);
  ctaBtn.addEventListener("click", onStartRequested);

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
    const firstIndex = pickNextIndex(-1);
    loadRound(firstIndex);
  }

  init();
})();
