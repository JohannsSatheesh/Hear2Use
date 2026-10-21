/**
 * js/settings.js
 * Reads and writes the app settings object to localStorage.
 * Wires the Settings panel form.
 *
 * localStorage key: h2u_settings
 * Settings shape:
 * {
 *   apiKey:       string,
 *   rate:         number (0.5–2.0),
 *   detailLevel:  "brief" | "detailed",
 *   lang:         string (BCP-47, e.g. "en-GB"),
 *   warningDays:  number (1–14),
 *   highContrast: boolean,
 *   useAppVoice:  boolean,
 * }
 *
 * Owner: settings feature
 */

import { setVoiceConfig } from "./voice.js";

const SK = "h2u_settings";

const DEFAULTS = {
  apiKey:       "",
  rate:         0.9,
  detailLevel:  "brief",
  lang:         "en-GB",
  warningDays:  2,
  highContrast: true,
  useAppVoice:  true,
};

// ─────────────────────────────────────────────────────────────
// loadSettings()
//   Returns the merged settings object (defaults + stored).
// ─────────────────────────────────────────────────────────────
export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SK)) ?? {};
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

// ─────────────────────────────────────────────────────────────
// saveSettings(obj)
// ─────────────────────────────────────────────────────────────
export function saveSettings(obj) {
  localStorage.setItem(SK, JSON.stringify({ ...DEFAULTS, ...obj }));
}

// ─────────────────────────────────────────────────────────────
// applyTheme(highContrast)
//   Toggles data-theme="high-contrast" on <html>.
// ─────────────────────────────────────────────────────────────
export function applyTheme(highContrast) {
  if (highContrast) {
    document.documentElement.setAttribute("data-theme", "high-contrast");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// ─────────────────────────────────────────────────────────────
// initSettings()
//   Populates the form, wires all inputs, Save, Load demo, Clear.
// ─────────────────────────────────────────────────────────────
export function initSettings() {
  const settings = loadSettings();

  // Populate form controls
  _val("api-key-input",  settings.apiKey);
  _val("voice-rate",     settings.rate);
  _val("voice-lang",     settings.lang);
  _val("detail-level",   settings.detailLevel);
  _val("warning-days",   settings.warningDays);
  _checked("high-contrast", settings.highContrast);
  _checked("use-app-voice", settings.useAppVoice);

  // Rate slider live output
  const rateSlider = document.getElementById("voice-rate");
  const rateOutput = document.getElementById("rate-output");
  if (rateSlider && rateOutput) {
    rateOutput.textContent = `${settings.rate}×`;
    rateSlider.addEventListener("input", () => {
      rateOutput.textContent = `${rateSlider.value}×`;
    });
  }

  // Apply theme on load
  applyTheme(settings.highContrast);

  // Apply voice config on load
  setVoiceConfig({
    rate:        settings.rate,
    lang:        settings.lang,
    useAppVoice: settings.useAppVoice,
  });

  // Save button
  document.getElementById("save-settings-btn")?.addEventListener("click", () => {
    const updated = _readForm();
    saveSettings(updated);
    applyTheme(updated.highContrast);
    setVoiceConfig({
      rate:        updated.rate,
      lang:        updated.lang,
      useAppVoice: updated.useAppVoice,
    });
    // Announce via the live region directly (voice config may have changed)
    const live = document.getElementById("live-status");
    if (live) { live.textContent = ""; requestAnimationFrame(() => { live.textContent = "Settings saved."; }); }
    const bar = document.getElementById("last-msg-text");
    if (bar) bar.textContent = "Settings saved.";
  });

  // High contrast live toggle (apply immediately on change)
  document.getElementById("high-contrast")?.addEventListener("change", (e) => {
    applyTheme(e.target.checked);
  });

  // Clear API key button
  document.getElementById("clear-key-btn")?.addEventListener("click", () => {
    const input = document.getElementById("api-key-input");
    if (input) { input.value = ""; input.focus(); }
  });

  // Load demo data
  document.getElementById("load-demo-btn")?.addEventListener("click", loadDemoData);

  // Clear all data
  document.getElementById("clear-data-btn")?.addEventListener("click", () => {
    if (confirm("This will delete all saved items, settings and impact data. Are you sure?")) {
      clearAllData();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// loadDemoData()
//   Pushes 3 demo kitchen items so the demo never looks empty.
//   Imports kitchen.js dynamically to avoid circular deps.
// ─────────────────────────────────────────────────────────────
export async function loadDemoData() {
  const { saveItem, renderKitchen } = await import("./kitchen.js");

  const today = new Date();
  const d = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x.toISOString().slice(0,10); };

  const demos = [
    { kind:"food", name:"Semi-skimmed milk",           date: d(2),  dateType:"use_by",      storageTip:"Keep refrigerated below 5 °C.",                      disposal:"Rinse the bottle and put it in recycling.", confidence:"high" },
    { kind:"food", name:"Chicken tikka ready meal",    date: d(0),  dateType:"best_before", storageTip:"Refrigerate. Reheat to 75 °C.",                       disposal:"Cardboard sleeve: recycling. Plastic tray: general waste.", confidence:"high" },
    { kind:"food", name:"Wholemeal bread",             date: d(4),  dateType:"use_by",      storageTip:"Keep in a cool dry place or freeze.",                 disposal:"Plastic bag: soft plastics collection point at a supermarket.", confidence:"high" },
  ];

  demos.forEach(d => saveItem(d));
  renderKitchen();

  const live = document.getElementById("live-status");
  if (live) { live.textContent=""; requestAnimationFrame(()=>{ live.textContent="Demo data loaded. Check My Kitchen."; }); }
  const bar  = document.getElementById("last-msg-text");
  if (bar) bar.textContent = "Demo data loaded. Check My Kitchen.";
}

// ─────────────────────────────────────────────────────────────
// clearAllData()
// ─────────────────────────────────────────────────────────────
export function clearAllData() {
  localStorage.clear();
  window.location.reload();
}

// ── Private helpers ───────────────────────────────────────────

function _val(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
function _checked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}
function _readForm() {
  return {
    apiKey:       document.getElementById("api-key-input")?.value.trim()        ?? "",
    rate:         parseFloat(document.getElementById("voice-rate")?.value)       ?? 0.9,
    detailLevel:  document.getElementById("detail-level")?.value                 ?? "brief",
    lang:         document.getElementById("voice-lang")?.value                   ?? "en-GB",
    warningDays:  parseInt(document.getElementById("warning-days")?.value, 10)   ?? 2,
    highContrast: document.getElementById("high-contrast")?.checked              ?? true,
    useAppVoice:  document.getElementById("use-app-voice")?.checked              ?? true,
  };
}
