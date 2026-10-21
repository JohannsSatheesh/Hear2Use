/**
 * js/voice.js
 * Speech output (speechSynthesis) + voice command input (SpeechRecognition).
 * Also updates the on-screen last-message bar and aria-live regions.
 *
 * Owner: voice / speech feature
 */

// ── Internal state ────────────────────────────────────────────
let _lastMessage = "";
let _config = {
  rate:        0.9,
  lang:        "en-GB",
  useAppVoice: true,
};

// ── SpeechRecognition state ───────────────────────────────────
let _recognition   = null;
let _listening     = false;
let _commandHandler = null;   // set by initVoiceCommands()

// ── DOM refs ──────────────────────────────────────────────────
function _getLiveStatus() { return document.getElementById("live-status"); }
function _getLastMsgText() { return document.getElementById("last-msg-text"); }

// ═════════════════════════════════════════════════════════════
// SPEECH OUTPUT
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// speak(text, interrupt = true)
// ─────────────────────────────────────────────────────────────
export function speak(text, interrupt = true) {
  if (!text) return;
  _lastMessage = text;

  const bar = _getLastMsgText();
  if (bar) bar.textContent = text;

  const live = _getLiveStatus();
  if (live) {
    live.textContent = "";
    requestAnimationFrame(() => { live.textContent = text; });
  }

  if (!_config.useAppVoice) return;
  if (!window.speechSynthesis) return;

  if (interrupt) window.speechSynthesis.cancel();

  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = _config.lang;
  utt.rate   = _config.rate;
  utt.pitch  = 1;
  window.speechSynthesis.speak(utt);
}

export function announce(text) { speak(text, true); }

export function announceAlert(text) {
  _lastMessage = text;

  const bar = _getLastMsgText();
  if (bar) bar.textContent = text;

  const alertEl = document.getElementById("live-alert");
  if (alertEl) {
    alertEl.textContent = "";
    requestAnimationFrame(() => { alertEl.textContent = text; });
  }

  if (!_config.useAppVoice || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = _config.lang;
  utt.rate  = _config.rate;
  window.speechSynthesis.speak(utt);
}

export function repeatLast() {
  if (!_lastMessage) return;
  if (!_config.useAppVoice || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(_lastMessage);
  utt.lang  = _config.lang;
  utt.rate  = _config.rate;
  window.speechSynthesis.speak(utt);
}

export function setVoiceConfig({ rate, lang, useAppVoice } = {}) {
  if (rate        !== undefined) _config.rate        = parseFloat(rate);
  if (lang        !== undefined) _config.lang        = lang;
  if (useAppVoice !== undefined) _config.useAppVoice = !!useAppVoice;
}

export function getVoiceConfig() { return { ..._config }; }

// ═════════════════════════════════════════════════════════════
// VOICE COMMANDS  (SpeechRecognition)
// ═════════════════════════════════════════════════════════════

const HELP_TEXT =
  "Available voice commands: " +
  "Say Scan to open the camera. " +
  "Say What's in my kitchen, or What's expiring, to hear expiring items. " +
  "Say What should I eat first to hear the most urgent item. " +
  "Say Mark as used, or Mark as recycled, to update your impact. " +
  "Say Next, Previous, or Repeat to navigate items. " +
  "Say Places, or What's near me, to hear nearby shops. " +
  "Say Help to hear this list again.";

// ─────────────────────────────────────────────────────────────
// initVoiceCommands(handler)
//   handler is an object of { commandName: fn } provided by app.js.
//   Sets up the button, keyboard shortcut, and recognition engine.
// ─────────────────────────────────────────────────────────────
export function initVoiceCommands(handler) {
  _commandHandler = handler;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById("voice-cmd-btn");
  const statusEl = document.getElementById("voice-cmd-status");

  if (!SR) {
    // Not supported — hide button, show message
    if (btn) {
      btn.hidden = true;
      // Replace with a plain message instead
      const msg = document.createElement("p");
      msg.className = "hint-text";
      msg.style.color = "var(--warn)";
      msg.textContent = "Voice commands are not supported in this browser. Use Chrome on Android for voice control.";
      btn.parentNode?.insertBefore(msg, btn);
    }
    return;
  }

  // Set up recognition
  _recognition = new SR();
  _recognition.lang       = _config.lang;
  _recognition.continuous = false;
  _recognition.interimResults = false;
  _recognition.maxAlternatives = 3;

  _recognition.onstart = () => {
    _listening = true;
    _setListeningState(true);
    if (statusEl) statusEl.textContent = "Listening…";
  };

  _recognition.onend = () => {
    _listening = false;
    _setListeningState(false);
    if (statusEl) statusEl.textContent = "";
  };

  _recognition.onerror = (e) => {
    _listening = false;
    _setListeningState(false);
    if (statusEl) statusEl.textContent = "";
    if (e.error === "no-speech") {
      announce("I didn't hear anything. Hold the button and speak clearly.");
    } else if (e.error !== "aborted") {
      announce(`Voice error: ${e.error}. Please try again.`);
    }
  };

  _recognition.onresult = (e) => {
    // Try all alternatives for best match
    const transcripts = Array.from(e.results[0]).map(r => r.transcript.toLowerCase().trim());
    if (statusEl) statusEl.textContent = `Heard: "${transcripts[0]}"`;
    const matched = _matchCommand(transcripts);
    if (!matched) {
      announce(`Sorry, I didn't catch that. You said: ${transcripts[0]}. Say Help for a list of commands.`);
    }
  };

  // ── Button wiring ──
  if (btn) {
    btn.hidden = false;

    // Hold-to-talk on touch devices
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      _startListening();
    });
    btn.addEventListener("pointerup",   _stopListening);
    btn.addEventListener("pointerleave", _stopListening);

    // Click / Enter / Space for keyboard users (toggle)
    btn.addEventListener("click", () => {
      if (_listening) _stopListening();
      else            _startListening();
    });
  }

  // ── Keyboard shortcut: Space or V when not in an input ──
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Space" || e.key === "v" || e.key === "V") {
      e.preventDefault();
      if (_listening) _stopListening();
      else            _startListening();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// isVoiceSupported()
// ─────────────────────────────────────────────────────────────
export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// ── Private ───────────────────────────────────────────────────

function _startListening() {
  if (_listening || !_recognition) return;
  // Cancel speech so it doesn't bleed into the microphone
  window.speechSynthesis?.cancel();
  try { _recognition.start(); } catch (_) {}
}

function _stopListening() {
  if (!_listening || !_recognition) return;
  try { _recognition.stop(); } catch (_) {}
}

function _setListeningState(active) {
  const btn = document.getElementById("voice-cmd-btn");
  if (!btn) return;
  btn.setAttribute("aria-pressed", active ? "true" : "false");
  btn.classList.toggle("listening", active);
  btn.textContent = active ? "🎙️ Listening…" : "🎙️ Hold to talk";
}

function _matchCommand(transcripts) {
  if (!_commandHandler) return false;

  for (const t of transcripts) {

    // scan
    if (/\bscan\b/.test(t)) {
      announce("Opening scanner.");
      _commandHandler.scan?.();
      return true;
    }

    // what's expiring / what's in my kitchen
    if (/expir|kitchen|what.s in/.test(t)) {
      announce("Checking your kitchen.");
      _commandHandler.speakExpiring?.();
      return true;
    }

    // what should I eat first / most urgent
    if (/eat first|most urgent|urgent/.test(t)) {
      _commandHandler.eatFirst?.();
      return true;
    }

    // mark as used
    if (/mark.*(used|use)|used in time/.test(t)) {
      announce("Marked as used in time.");
      _commandHandler.markUsed?.();
      return true;
    }

    // mark as recycled
    if (/recycle|recycled/.test(t)) {
      announce("Marked as recycled.");
      _commandHandler.markRecycled?.();
      return true;
    }

    // next
    if (/\bnext\b/.test(t)) {
      _commandHandler.next?.();
      return true;
    }

    // previous / back
    if (/prev|back/.test(t)) {
      _commandHandler.previous?.();
      return true;
    }

    // repeat
    if (/\brepeat\b/.test(t)) {
      repeatLast();
      return true;
    }

    // places / what's near me
    if (/place|near me|nearby/.test(t)) {
      announce("Opening places.");
      _commandHandler.places?.();
      return true;
    }

    // help
    if (/\bhelp\b/.test(t)) {
      announce(HELP_TEXT);
      return true;
    }
  }

  return false;
}
