/**
 * js/voice.js
 * Handles all speech output (Web Speech API speechSynthesis).
 * Also updates the on-screen last-message bar and aria-live region.
 *
 * Owner: voice / speech feature
 */

// ── Internal state ────────────────────────────────────────────
let _lastMessage = "";
let _config = {
  rate:         0.9,
  lang:         "en-GB",
  useAppVoice:  true,
};

// ── DOM refs (set on first use, not at import time) ────────────
function _getLiveStatus() { return document.getElementById("live-status"); }
function _getLastMsgText() { return document.getElementById("last-msg-text"); }

// ─────────────────────────────────────────────────────────────
// speak(text, interrupt = true)
//   Speaks text via speechSynthesis.
//   If useAppVoice is false, silently skips speech but still
//   updates the screen (screen reader picks it up via aria-live).
// ─────────────────────────────────────────────────────────────
export function speak(text, interrupt = true) {
  if (!text) return;
  _lastMessage = text;

  // Always update the visible last-message bar
  const bar = _getLastMsgText();
  if (bar) bar.textContent = text;

  // Update aria-live region so screen reader can announce it
  // (even when useAppVoice is off, the screen reader reads aria-live)
  const live = _getLiveStatus();
  if (live) {
    live.textContent = "";                // clear first so repeat triggers a new event
    requestAnimationFrame(() => { live.textContent = text; });
  }

  // Skip actual speech if the user has turned off app voice
  if (!_config.useAppVoice) return;
  if (!window.speechSynthesis) return;

  if (interrupt) window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = _config.lang;
  utt.rate  = _config.rate;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// announce(text)
//   For status updates that should reach screen readers.
//   Uses the polite live region. Also calls speak().
// ─────────────────────────────────────────────────────────────
export function announce(text) {
  speak(text, true);
}

// ─────────────────────────────────────────────────────────────
// announceAlert(text)
//   For urgent / error messages. Uses the assertive live region.
// ─────────────────────────────────────────────────────────────
export function announceAlert(text) {
  _lastMessage = text;

  const bar = _getLastMsgText();
  if (bar) bar.textContent = text;

  const alert = document.getElementById("live-alert");
  if (alert) {
    alert.textContent = "";
    requestAnimationFrame(() => { alert.textContent = text; });
  }

  if (!_config.useAppVoice || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = _config.lang;
  utt.rate  = _config.rate;
  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// repeatLast()
//   Re-speaks the last message. Wired to the "Repeat" button.
// ─────────────────────────────────────────────────────────────
export function repeatLast() {
  if (!_lastMessage) return;
  if (!_config.useAppVoice || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(_lastMessage);
  utt.lang  = _config.lang;
  utt.rate  = _config.rate;
  window.speechSynthesis.speak(utt);
}

// ─────────────────────────────────────────────────────────────
// setVoiceConfig(obj)
//   Called by settings.js when the user changes preferences.
// ─────────────────────────────────────────────────────────────
export function setVoiceConfig({ rate, lang, useAppVoice } = {}) {
  if (rate        !== undefined) _config.rate        = parseFloat(rate);
  if (lang        !== undefined) _config.lang        = lang;
  if (useAppVoice !== undefined) _config.useAppVoice = !!useAppVoice;
}

// ─────────────────────────────────────────────────────────────
// getVoiceConfig()
// ─────────────────────────────────────────────────────────────
export function getVoiceConfig() {
  return { ..._config };
}
