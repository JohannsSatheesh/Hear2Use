/**
 * js/app.js
 * Entry point — imports and initialises every module.
 * Handles tab switching, keyboard navigation, Media Session API,
 * and the global "Repeat last message" button.
 *
 * Owner: app wiring / navigation
 */

import { initSettings, loadSettings, applyTheme } from "./settings.js";
import { initScan }     from "./scan.js";
import { initKitchen, speakExpiring, updateImpactCounter, getFirstItem } from "./kitchen.js";
import { initPlaces, speakPlacesSummary, startPlaceTour } from "./places.js";
import { repeatLast, announce, initVoiceCommands } from "./voice.js";

// ── Tab definitions ───────────────────────────────────────────
const TABS = [
  { tabId: "tab-scan",     panelId: "panel-scan"     },
  { tabId: "tab-kitchen",  panelId: "panel-kitchen"  },
  { tabId: "tab-places",   panelId: "panel-places"   },
  { tabId: "tab-settings", panelId: "panel-settings" },
];

// ─────────────────────────────────────────────────────────────
// Bootstrap — runs after DOM is ready
// ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // 1. Apply saved theme immediately (before any render)
  const settings = loadSettings();
  applyTheme(settings.highContrast);

  // 2. Init all feature modules
  initSettings();
  initScan();
  initKitchen();
  initPlaces();

  // 3. Wire tab bar
  _wireTabs();

  // 4. Repeat button
  document.getElementById("repeat-btn")?.addEventListener("click", repeatLast);

  // 5. Media Session API — headphone skip buttons navigate kitchen items
  _initMediaSession();

  // 6. Voice commands
  initVoiceCommands({
    scan:          () => { _showTab("tab-scan"); document.getElementById("scan-btn")?.click(); },
    speakExpiring: () => { _showTab("tab-kitchen"); speakExpiring(); },
    eatFirst:      () => { _showTab("tab-kitchen"); _speakEatFirst(); },
    markUsed:      () => { _showTab("tab-kitchen"); updateImpactCounter("used"); },
    markRecycled:  () => { _showTab("tab-kitchen"); updateImpactCounter("recycled"); },
    next:          () => _speakNextKitchenItem(1),
    previous:      () => _speakNextKitchenItem(-1),
    places:        () => { _showTab("tab-places"); speakPlacesSummary(); },
  });

  // 7. Welcome message
  announce("Welcome to Hear2Use. Tap Scan to read a label, or explore the tabs at the bottom. Say Help for voice commands.");
});

// ─────────────────────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────────────────────
function _wireTabs() {
  TABS.forEach(({ tabId, panelId }, index) => {
    const tab   = document.getElementById(tabId);
    const panel = document.getElementById(panelId);
    if (!tab || !panel) return;

    tab.addEventListener("click", () => _showTab(tabId));

    // Keyboard: left/right arrows move between tabs (ARIA tablist pattern)
    tab.addEventListener("keydown", (e) => {
      let next = -1;
      if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
      if (e.key === "ArrowLeft")  next = (index - 1 + TABS.length) % TABS.length;
      if (e.key === "Home")       next = 0;
      if (e.key === "End")        next = TABS.length - 1;
      if (next >= 0) {
        e.preventDefault();
        const nextTab = document.getElementById(TABS[next].tabId);
        nextTab?.focus();
        _showTab(TABS[next].tabId);
      }
    });
  });
}

function _showTab(activeTabId) {
  TABS.forEach(({ tabId, panelId }) => {
    const tab   = document.getElementById(tabId);
    const panel = document.getElementById(panelId);
    if (!tab || !panel) return;

    const isActive = tabId === activeTabId;

    // Tab button state
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.setAttribute("tabindex", isActive ? "0" : "-1");

    // Panel visibility
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    if (isActive) panel.style.display = "block";
    else          panel.style.display = "none";
  });
}

// ─────────────────────────────────────────────────────────────
// Media Session API
// Lets headphone skip buttons navigate kitchen items and speak them.
// Works on Chrome Android with wired or Bluetooth headphones,
// and on the Android lock screen.
// ─────────────────────────────────────────────────────────────
function _initMediaSession() {
  if (!("mediaSession" in navigator)) return;

  // Set metadata so the OS shows Hear2Use on the lock screen
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  "Hear2Use",
    artist: "Accessibility mode active",
    album:  "Tap skip buttons to navigate",
  });

  // We need a silent audio loop to keep the media session alive
  // without actually playing anything audible.
  _startSilentAudio();

  // Skip forward → speak next kitchen item
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    _speakNextKitchenItem(1);
  });

  // Skip back → speak previous kitchen item
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    _speakNextKitchenItem(-1);
  });

  // Play/pause → repeat last message (useful eyes-free)
  navigator.mediaSession.setActionHandler("play",  repeatLast);
  navigator.mediaSession.setActionHandler("pause", repeatLast);
}

// Tiny silent audio loop — keeps the media session alive
let _silentAudio = null;
function _startSilentAudio() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0;           // completely silent
    const osc = ctx.createOscillator();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    _silentAudio = osc;
  } catch (_) {
    // AudioContext not available — media session still works partially
  }
}

// ── Kitchen item pointer for Media Session navigation ─────────
let _kitchenNavIndex = 0;

function _speakNextKitchenItem(direction) {
  try {
    const raw   = localStorage.getItem("h2u_kitchen");
    const items = raw ? JSON.parse(raw) : [];
    if (!items.length) {
      announce("Your kitchen is empty. Scan a food label and save it to get started.");
      return;
    }

    // Sort: soonest date first, undated last (same as kitchen.js renderKitchen)
    const sorted = [...items].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    _kitchenNavIndex = (_kitchenNavIndex + direction + sorted.length) % sorted.length;
    const item  = sorted[_kitchenNavIndex];
    const days  = item.date ? _daysUntil(item.date) : null;
    const urgency = days === null ? "" :
                    days < 0  ? `, expired ${Math.abs(days)} day${Math.abs(days)===1?"":"s"} ago` :
                    days === 0 ? ", expires today" :
                    days === 1 ? ", expires tomorrow" :
                    `, ${days} days left`;

    announce(`Item ${_kitchenNavIndex + 1} of ${sorted.length}: ${item.name}${urgency}.`);
  } catch (err) {
    console.error("[app.js] Media session kitchen nav:", err);
  }
}

function _daysUntil(dateStr) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}

function _speakEatFirst() {
  try {
    const raw   = localStorage.getItem("h2u_kitchen");
    const items = raw ? JSON.parse(raw) : [];
    if (!items.length) { announce("Your kitchen is empty."); return; }
    const sorted = [...items].filter(i => i.date).sort((a,b) => new Date(a.date)-new Date(b.date));
    if (!sorted.length) { announce("No items with dates found."); return; }
    const first = sorted[0];
    const days  = _daysUntil(first.date);
    const msg   = days < 0  ? `Eat ${first.name} immediately — it is past its use-by date.`
                : days === 0 ? `Eat ${first.name} today.`
                : days === 1 ? `Eat ${first.name} next — it expires tomorrow.`
                :              `Eat ${first.name} next — ${days} days left.`;
    announce(msg);
  } catch (err) {
    console.error("[app.js] _speakEatFirst:", err);
  }
}
