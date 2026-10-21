/**
 * js/scan.js
 * Camera input, Gemini AI call, demo fallback, result display.
 *
 * ⚠️  DEMO / PROTOTYPE ONLY.
 *     The Gemini API key is stored in localStorage and sent from the browser.
 *     In a production app you MUST proxy all AI calls through a server so the
 *     key is never exposed to the client.
 *
 * Owner: scan / AI feature
 */

import { announce, announceAlert } from "./voice.js";
import { buildSpeechFromResult }   from "./tips.js";
import { loadSettings }            from "./settings.js";
import { saveItem }                from "./kitchen.js";

// ── Demo results — used when no API key is set or network fails ──
//   Three rotating results: milk → letter → ready meal → milk …
const DEMO_RESULTS = [
  {
    kind:       "food",
    name:       "Semi-skimmed milk (2 litres)",
    summary:    "A carton of semi-skimmed milk.",
    date:       _daysFromToday(3),
    dateType:   "use_by",
    storageTip: "Keep refrigerated below 5 degrees Celsius. Once opened, use within 3 days.",
    disposal:   "Rinse the carton and put it in the recycling bin. The cap can stay on.",
    confidence: "high",
  },
  {
    kind:       "post",
    name:       "Electricity bill",
    summary:    "A letter from an energy company with an account number and payment due date.",
    date:       _daysFromToday(14),
    dateType:   "expiry",
    storageTip: "Keep in a safe, dry place until you have paid or filed it.",
    disposal:   "Shred this letter before recycling because it contains your personal details. Then put it in the paper recycling bin.",
    confidence: "high",
  },
  {
    kind:       "food",
    name:       "Chicken tikka masala ready meal",
    summary:    "A supermarket ready meal — chicken tikka masala with rice.",
    date:       _daysFromToday(-1),
    dateType:   "best_before",
    storageTip: "Best stored in the fridge. Reheat thoroughly to 75 degrees Celsius before eating.",
    disposal:   "The cardboard sleeve goes in recycling. The plastic tray usually goes in general waste — check the tray for the recycling symbol.",
    confidence: "medium",
  },
];

let _demoIndex = 0;

// ── Helper: build a date string N days from today ─────────────
function _daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Current result (kept so "Save" and "Speak again" work) ────
let _currentResult = null;

// ─────────────────────────────────────────────────────────────
// initScan()
//   Wires the Scan button → file input → handlePhoto.
//   Call once from app.js after DOM is ready.
// ─────────────────────────────────────────────────────────────
export function initScan() {
  const scanBtn    = document.getElementById("scan-btn");
  const cameraInput = document.getElementById("camera-input");
  const rescanBtn  = document.getElementById("rescan-btn");
  const saveBtn    = document.getElementById("save-btn");
  const speakAgainBtn = document.getElementById("result-speak-btn");

  if (!scanBtn || !cameraInput) return;

  scanBtn.addEventListener("click", () => cameraInput.click());
  rescanBtn?.addEventListener("click", () => cameraInput.click());

  cameraInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be chosen again
    e.target.value = "";
    await handlePhoto(file);
  });

  saveBtn?.addEventListener("click", () => {
    if (!_currentResult) return;
    saveItem(_currentResult);
    announce("Saved to your kitchen.");
    saveBtn.hidden = true;
  });

  speakAgainBtn?.addEventListener("click", () => {
    if (!_currentResult) return;
    const { detailLevel } = loadSettings();
    announce(buildSpeechFromResult(_currentResult, detailLevel));
  });
}

// ─────────────────────────────────────────────────────────────
// handlePhoto(file)
//   Shows loading, calls AI (or demo), displays and speaks result.
// ─────────────────────────────────────────────────────────────
export async function handlePhoto(file) {
  _showLoading("Reading the label…");

  try {
    const base64   = await _fileToBase64(file);
    const mimeType = file.type || "image/jpeg";
    const result   = await getAIResult(base64, mimeType);
    _currentResult = result;
    _hideLoading();
    _renderResult(result);

    const { detailLevel } = loadSettings();
    announce(buildSpeechFromResult(result, detailLevel));
  } catch (err) {
    _hideLoading();
    announceAlert("Sorry, something went wrong. Please try scanning again.");
    console.error("[scan.js]", err);
  }
}

// ─────────────────────────────────────────────────────────────
// getAIResult(imageBase64)
//   Calls the Gemini vision API.
//   Falls back to getDemoResult() if no key or network error.
// ─────────────────────────────────────────────────────────────
export async function getAIResult(imageBase64, mimeType = "image/jpeg") {
  const { apiKey } = loadSettings();

  // Debug: log whether a key was found (never logs the key itself)
  console.log("[scan.js] API key present:", !!apiKey, "| length:", apiKey?.length ?? 0);

  if (!apiKey) {
    console.log("[scan.js] No API key — using demo result");
    return getDemoResult();
  }

  const prompt = `You are a label-reading assistant for a visually impaired user.
Look at the image and return ONLY a JSON object — no markdown, no explanation.
JSON shape:
{
  "kind": "food|post|sign|other",
  "name": "short product name or document type",
  "summary": "one sentence describing what this is",
  "date": "YYYY-MM-DD or null",
  "dateType": "use_by|best_before|expiry|unknown|null",
  "storageTip": "one sentence on how to store it, or empty string",
  "disposal": "one sentence on how to dispose of the packaging or document",
  "confidence": "high|medium|low"
}
If there is no date, set date and dateType to null.
Do not include any text outside the JSON object.`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
  };

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      }
    );

    if (!resp.ok) throw new Error(`API error ${resp.status}`);

    const data = await resp.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip possible markdown code fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    console.log("[scan.js] AI raw response:", cleaned);
    return JSON.parse(cleaned);

  } catch (err) {
    console.warn("[scan.js] AI call failed, using demo result:", err.message);
    // Show the error visibly in the last-message bar so we can debug on phone
    const bar = document.getElementById("last-msg-text");
    if (bar) bar.textContent = `AI error: ${err.message} — showing demo result`;
    return getDemoResult();
  }
}

// ─────────────────────────────────────────────────────────────
// getDemoResult()
//   Returns the next pre-written demo result (cycles through 3).
// ─────────────────────────────────────────────────────────────
export function getDemoResult() {
  const result = DEMO_RESULTS[_demoIndex % DEMO_RESULTS.length];
  _demoIndex++;
  // Refresh relative dates so they are correct whenever the demo runs
  if (_demoIndex % DEMO_RESULTS.length === 1) result.date = _daysFromToday(3);
  if (_demoIndex % DEMO_RESULTS.length === 2) result.date = _daysFromToday(14);
  if (_demoIndex % DEMO_RESULTS.length === 0) result.date = _daysFromToday(-1);
  return { ...result };
}

// ── Private helpers ───────────────────────────────────────────

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function _showLoading(msg = "Loading…") {
  const el = document.getElementById("loading");
  const msgEl = document.getElementById("loading-msg");
  if (!el) return;
  if (msgEl) msgEl.textContent = msg;
  el.hidden = false;
  el.removeAttribute("aria-hidden");
}

function _hideLoading() {
  const el = document.getElementById("loading");
  if (!el) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
}

function _renderResult(result) {
  const card       = document.getElementById("scan-result");
  const heading    = document.getElementById("result-heading");
  const dl         = document.getElementById("result-dl");
  const saveBtn    = document.getElementById("save-btn");

  if (!card || !heading || !dl) return;

  heading.textContent = result.name || "Scanned item";

  // Build definition list
  const rows = [];

  if (result.date) {
    const { isExpired: exp, daysUntil } = _calcDays(result.date);
    const urgency = _urgencyChip(daysUntil);
    rows.push(["Date", `<span class="chip ${urgency.cls}">${urgency.text}</span> (${result.dateType?.replace("_", " ") ?? ""})`]);
  } else {
    rows.push(["Date", "None found"]);
  }

  if (result.storageTip) rows.push(["Storage", _esc(result.storageTip)]);
  if (result.disposal)   rows.push(["Disposal", _esc(result.disposal)]);
  if (result.confidence === "low") rows.push(["Note", "Low confidence — try rescanning"]);

  dl.innerHTML = rows.map(([k, v]) =>
    `<dt>${_esc(k)}</dt><dd>${v}</dd>`
  ).join("");

  // Show "Save" only for food items
  if (saveBtn) saveBtn.hidden = result.kind !== "food";

  card.hidden = false;
  card.focus?.();
}

function _calcDays(dateStr) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const daysUntil = Math.round((target - today) / 86400000);
  return { daysUntil, isExpired: daysUntil < 0 };
}

function _urgencyChip(daysUntil) {
  if (daysUntil === null) return { text: "No date",       cls: "" };
  if (daysUntil < 0)      return { text: `Expired ${Math.abs(daysUntil)}d ago`, cls: "chip-danger" };
  if (daysUntil === 0)    return { text: "Expires today",  cls: "chip-danger" };
  if (daysUntil === 1)    return { text: "Tomorrow",       cls: "chip-warn" };
  if (daysUntil <= 3)     return { text: `${daysUntil} days`, cls: "chip-warn" };
  return { text: `${daysUntil} days`, cls: "chip-ok" };
}

function _esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
