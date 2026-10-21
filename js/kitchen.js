/**
 * js/kitchen.js
 * Saved food items, expiry warnings, impact counter.
 *
 * localStorage keys:
 *   h2u_kitchen  → KitchenItem[]
 *   h2u_impact   → { used: number, recycled: number, weekKey: string }
 *
 * KitchenItem: { id, name, date, dateType, storageTip, disposal, savedAt }
 *
 * Owner: kitchen / food-waste feature
 */

import { announce }       from "./voice.js";
import { isExpired, formatUrgency } from "./tips.js";
import { loadSettings }   from "./settings.js";

const SK_KITCHEN = "h2u_kitchen";
const SK_IMPACT  = "h2u_impact";
const SK_WEEK    = "h2u_impact_week";
const SK_STREAK  = "h2u_streak";

// ─────────────────────────────────────────────────────────────
// initKitchen()
//   Call once from app.js after DOM is ready.
// ─────────────────────────────────────────────────────────────
export function initKitchen() {
  renderKitchen();
  renderImpact();
  renderStreak();

  document.getElementById("expiring-btn")     ?.addEventListener("click", speakExpiring);
  document.getElementById("mark-used-btn")    ?.addEventListener("click", () => updateImpactCounter("used"));
  document.getElementById("mark-recycled-btn")?.addEventListener("click", () => updateImpactCounter("recycled"));
}

// ─────────────────────────────────────────────────────────────
// saveItem(scanResult)
//   Called from scan.js when the user taps "Save to my kitchen".
// ─────────────────────────────────────────────────────────────
export function saveItem(scanResult) {
  const items = _loadKitchen();
  const item = {
    id:         crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name:       scanResult.name       || "Unknown item",
    date:       scanResult.date       || null,
    dateType:   scanResult.dateType   || null,
    storageTip: scanResult.storageTip || "",
    disposal:   scanResult.disposal   || "",
    savedAt:    new Date().toISOString(),
  };
  items.push(item);
  _saveKitchen(items);
  renderKitchen();
}

// ─────────────────────────────────────────────────────────────
// renderKitchen()
//   Sorts items by date (soonest first, null dates last).
//   Rebuilds the kitchen list in the DOM.
// ─────────────────────────────────────────────────────────────
export function renderKitchen() {
  const items  = _loadKitchen();
  const list   = document.getElementById("kitchen-list");
  const empty  = document.getElementById("kitchen-empty");

  if (!list) return;
  list.innerHTML = "";

  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  // Sort: items with dates first (soonest first), then undated
  const sorted = [...items].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  sorted.forEach(item => {
    const li = _buildKitchenCard(item);
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────────────────────
// deleteItem(id)
// ─────────────────────────────────────────────────────────────
export function deleteItem(id) {
  const items   = _loadKitchen().filter(i => i.id !== id);
  _saveKitchen(items);
  renderKitchen();
}

// ─────────────────────────────────────────────────────────────
// speakExpiring()
//   Reads out items expiring within Settings.warningDays.
// ─────────────────────────────────────────────────────────────
export function speakExpiring() {
  const { warningDays = 2 } = loadSettings();
  const items = _loadKitchen();

  const expiring = items.filter(item => {
    if (!item.date) return false;
    const { daysUntil } = isExpired(item.date);
    return daysUntil !== null && daysUntil <= warningDays;
  });

  if (!expiring.length) {
    announce(`No items are expiring within ${warningDays} days. Your kitchen looks good.`);
    return;
  }

  // Sort by urgency
  expiring.sort((a, b) => new Date(a.date) - new Date(b.date));

  const lines = expiring.map(item => {
    const { daysUntil } = isExpired(item.date);
    const { text } = formatUrgency(daysUntil);
    return `${item.name}: ${text}`;
  });

  const msg = `You have ${expiring.length} item${expiring.length === 1 ? "" : "s"} expiring soon. ${lines.join(". ")}.`;
  announce(msg);
}

// ─────────────────────────────────────────────────────────────
// updateImpactCounter(type)
//   type: "used" | "recycled"
// ─────────────────────────────────────────────────────────────
export function updateImpactCounter(type) {
  const imp = _loadImpact();
  if (type === "used")     imp.used++;
  if (type === "recycled") imp.recycled++;
  _saveImpact(imp);
  renderImpact();

  // Increment streak when marking used
  if (type === "used") _incrementStreak();

  const msg = type === "used"
    ? `Great job! ${imp.used} item${imp.used === 1 ? "" : "s"} used in time this week.`
    : `Well done! ${imp.recycled} package${imp.recycled === 1 ? "" : "s"} recycled correctly this week.`;
  announce(msg);
}

// ─────────────────────────────────────────────────────────────
// getImpactCounts()
// ─────────────────────────────────────────────────────────────
export function getImpactCounts() {
  return _loadImpact();
}

// ─────────────────────────────────────────────────────────────
// getFirstItem()
//   Returns the most urgent kitchen item (for voice commands).
// ─────────────────────────────────────────────────────────────
export function getFirstItem() {
  const items = _loadKitchen().filter(i => i.date).sort((a,b) => new Date(a.date)-new Date(b.date));
  return items[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// renderStreak()
//   Shows the food-rescued streak in the kitchen panel.
// ─────────────────────────────────────────────────────────────
export function renderStreak() {
  const streak = _loadStreak();
  let bar = document.getElementById("streak-bar");
  if (!bar) {
    // Create the streak bar if it doesn't exist yet
    bar = document.createElement("div");
    bar.id = "streak-bar";
    bar.className = "streak-bar";
    bar.setAttribute("aria-label", `Food rescued streak: ${streak.count} day${streak.count === 1 ? "" : "s"}`);
    bar.innerHTML = `
      <span class="streak-num" id="streak-num" aria-live="polite">${streak.count}</span>
      <span class="streak-label">🔥 Day streak<br><small>items used before expiry</small></span>
    `;
    const impactRow = document.querySelector(".impact-row");
    impactRow?.parentNode?.insertBefore(bar, impactRow);
  } else {
    const numEl = document.getElementById("streak-num");
    if (numEl) numEl.textContent = streak.count;
    bar.setAttribute("aria-label", `Food rescued streak: ${streak.count} day${streak.count === 1 ? "" : "s"}`);
  }
}

// ─────────────────────────────────────────────────────────────
// renderImpact()
//   Updates the two impact number tiles in the kitchen panel.
// ─────────────────────────────────────────────────────────────
export function renderImpact() {
  const imp = _loadImpact();
  const usedEl     = document.getElementById("count-used");
  const recycledEl = document.getElementById("count-recycled");
  if (usedEl)     usedEl.textContent     = imp.used;
  if (recycledEl) recycledEl.textContent = imp.recycled;
}

// ── Private ───────────────────────────────────────────────────

function _loadKitchen() {
  try { return JSON.parse(localStorage.getItem(SK_KITCHEN)) ?? []; }
  catch { return []; }
}
function _saveKitchen(items) {
  localStorage.setItem(SK_KITCHEN, JSON.stringify(items));
}

function _currentWeekKey() {
  const d   = new Date();
  const jan = new Date(d.getFullYear(), 0, 1);
  const wk  = Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${wk}`;
}

function _loadImpact() {
  try {
    const wk  = _currentWeekKey();
    const stored = JSON.parse(localStorage.getItem(SK_IMPACT)) ?? { used: 0, recycled: 0 };
    const storedWeek = localStorage.getItem(SK_WEEK);
    if (storedWeek !== wk) {
      // New week — reset
      localStorage.setItem(SK_WEEK, wk);
      const fresh = { used: 0, recycled: 0 };
      localStorage.setItem(SK_IMPACT, JSON.stringify(fresh));
      return fresh;
    }
    return stored;
  } catch {
    return { used: 0, recycled: 0 };
  }
}
function _saveImpact(obj) {
  localStorage.setItem(SK_WEEK, _currentWeekKey());
  localStorage.setItem(SK_IMPACT, JSON.stringify(obj));
}

function _buildKitchenCard(item) {
  const { daysUntil } = isExpired(item.date);
  const { text: urgText, chipClass } = formatUrgency(daysUntil);

  // Border class
  let borderCls = "exp-ok";
  if (daysUntil !== null) {
    if (daysUntil < 0 || daysUntil === 0) borderCls = "exp-now";
    else if (daysUntil <= 3)              borderCls = "exp-soon";
  }

  const li = document.createElement("li");
  li.setAttribute("role", "listitem");
  li.className = `kitchen-card ${borderCls}`;
  li.setAttribute("aria-label", `${item.name}, ${urgText}`);

  li.innerHTML = `
    <div class="kc-body">
      <div class="kc-name">${_esc(item.name)}</div>
      <div class="kc-date">
        ${item.date
          ? `<span class="chip ${chipClass}" aria-label="${urgText}">${urgText}</span>
             <span style="margin-left:.4rem;font-size:.8rem;color:var(--muted)">${item.dateType ? `(${item.dateType.replace("_", " ")})` : ""}</span>`
          : '<span style="color:var(--muted)">No date</span>'}
      </div>
    </div>
    <button class="kc-delete" aria-label="Delete ${_esc(item.name)} from kitchen" data-id="${item.id}" title="Delete">✕</button>
  `;

  li.querySelector(".kc-delete").addEventListener("click", () => {
    deleteItem(item.id);
    announce(`${item.name} removed from your kitchen.`);
  });

  return li;
}


// ─────────────────────────────────────────────────────────────
// STREAK helpers
// ─────────────────────────────────────────────────────────────
function _loadStreak() {
  try { return JSON.parse(localStorage.getItem(SK_STREAK)) ?? { count: 0, lastDate: null }; }
  catch { return { count: 0, lastDate: null }; }
}
function _saveStreak(obj) { localStorage.setItem(SK_STREAK, JSON.stringify(obj)); }

const STREAK_MILESTONES = [3, 7, 14, 30];

function _incrementStreak() {
  const streak  = _loadStreak();
  const today   = new Date().toISOString().slice(0, 10);
  if (streak.lastDate === today) return; // already counted today

  streak.count++;
  streak.lastDate = today;
  _saveStreak(streak);
  renderStreak();

  // Announce milestones
  if (STREAK_MILESTONES.includes(streak.count)) {
    announce(`Amazing! ${streak.count} day streak — ${streak.count} days with food rescued. Keep it up!`);
  }
}

// ─────────────────────────────────────────────────────────────
// WHICH BIN? QUIZ
//   Called from scan.js after a successful food scan.
//   Injects a quiz card below the scan result.
// ─────────────────────────────────────────────────────────────
export function startBinQuiz(disposal) {
  // Extract the bin type from the disposal text
  const lower = disposal.toLowerCase();
  let correctBin, options;

  if (/recycl/.test(lower)) {
    correctBin = "recycling";
    options = ["recycling", "general waste", "food waste", "compost"];
  } else if (/general waste|black bin/.test(lower)) {
    correctBin = "general waste";
    options = ["recycling", "general waste", "food waste", "compost"];
  } else if (/food waste|compost/.test(lower)) {
    correctBin = "food waste";
    options = ["recycling", "general waste", "food waste", "paper bin"];
  } else if (/paper|card/.test(lower)) {
    correctBin = "paper recycling";
    options = ["recycling", "general waste", "paper recycling", "food waste"];
  } else {
    return; // can't make a quiz from this
  }

  // Remove existing quiz
  document.getElementById("bin-quiz")?.remove();

  const quiz = document.createElement("div");
  quiz.id = "bin-quiz";
  quiz.className = "quiz-card";
  quiz.setAttribute("role", "region");
  quiz.setAttribute("aria-label", "Which bin quiz");
  quiz.innerHTML = `
    <h3>♻️ Which bin?</h3>
    <p id="quiz-question">Where does this packaging go?</p>
    <div class="quiz-options" role="group" aria-label="Bin options">
      ${options.map(opt =>
        `<button class="btn-secondary quiz-opt" data-bin="${opt}" aria-label="${opt}">${opt}</button>`
      ).join("")}
    </div>
    <p id="quiz-feedback" aria-live="polite" style="margin-top:.75rem;font-weight:700;"></p>
  `;

  // Insert after scan result
  const result = document.getElementById("scan-result");
  result?.parentNode?.insertBefore(quiz, result.nextSibling);

  // Speak the question
  announce("Quick quiz! Where does this packaging go? Choose from the options on screen.");

  // Wire buttons
  quiz.querySelectorAll(".quiz-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      const chosen = btn.dataset.bin;
      const fb = document.getElementById("quiz-feedback");
      if (chosen === correctBin) {
        if (fb) fb.textContent = "✅ Correct! Well done.";
        announce("Correct! Well done. That's one more package recycled right.");
        updateImpactCounter("recycled");
        // Remove quiz after short delay
        setTimeout(() => quiz.remove(), 3000);
      } else {
        if (fb) fb.textContent = `❌ Not quite — it goes in the ${correctBin} bin.`;
        announce(`Not quite. This one goes in the ${correctBin} bin. Try to remember for next time.`);
        // Highlight correct answer
        quiz.querySelectorAll(".quiz-opt").forEach(b => {
          if (b.dataset.bin === correctBin) b.style.borderColor = "var(--ok)";
        });
      }
    });
  });
}


function _esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
