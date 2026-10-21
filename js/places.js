/**
 * js/places.js
 * Loads data/places.json and runs a spoken guided tour of nearby places.
 *
 * Data is demo-only (marked in places.json).
 * Optionally uses the browser Geolocation API but degrades gracefully.
 *
 * Owner: places / local discovery feature
 */

import { announce, speak } from "./voice.js";

// ── Category display names and order ─────────────────────────
const CATEGORY_ORDER  = ["grocery", "cafe", "pharmacy", "launderette", "recycling", "campus"];
const CATEGORY_LABELS = {
  grocery:     "Grocery shops",
  cafe:        "Cafés and food",
  pharmacy:    "Pharmacies",
  launderette: "Launderettes",
  recycling:   "Recycling points",
  campus:      "Campus services",
};

// ── Tour state ────────────────────────────────────────────────
let _places      = [];       // all loaded places
let _tourPlaces  = [];       // flat ordered list for the tour
let _tourIndex   = 0;
let _tourActive  = false;

// ─────────────────────────────────────────────────────────────
// initPlaces()
//   Fetches places.json, renders the list, wires tour buttons.
// ─────────────────────────────────────────────────────────────
export async function initPlaces() {
  try {
    const resp = await fetch("data/places.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _places = await resp.json();
  } catch (err) {
    console.error("[places.js] Could not load places.json:", err);
    announce("Sorry, the places data could not be loaded.");
    return;
  }

  _renderPlacesList(_places);
  _wireTourButtons();
}

// ─────────────────────────────────────────────────────────────
// speakPlacesSummary()
//   Speaks a short grouped summary, independents first within each category.
// ─────────────────────────────────────────────────────────────
export function speakPlacesSummary() {
  if (!_places.length) {
    announce("No places data loaded.");
    return;
  }

  const parts = [];
  parts.push("Here is what is near you.");

  for (const cat of CATEGORY_ORDER) {
    const inCat = _places.filter(p => p.category === cat);
    if (!inCat.length) continue;

    const label      = CATEGORY_LABELS[cat] ?? cat;
    const independents = inCat.filter(p => p.independent);
    const chains       = inCat.filter(p => !p.independent);

    // Independents first
    const ordered = [...independents, ...chains];
    const names   = ordered.map(p => `${p.name} (${p.approxWalkMinutes} minutes walk)`);

    parts.push(`${label}: ${names.join(", ")}.`);
  }

  parts.push("Tap Next to hear each place in detail.");

  // Build tour order: independents first overall, then chains, sorted by walk time
  _tourPlaces = [
    ..._places.filter(p => p.independent).sort((a,b) => a.approxWalkMinutes - b.approxWalkMinutes),
    ..._places.filter(p => !p.independent).sort((a,b) => a.approxWalkMinutes - b.approxWalkMinutes),
  ];
  _tourIndex  = 0;
  _tourActive = true;

  _showTourControls(true);
  announce(parts.join(" "));
}

// ─────────────────────────────────────────────────────────────
// startPlaceTour()
//   Called by "Next" button. Advances and speaks the next place.
// ─────────────────────────────────────────────────────────────
export function startPlaceTour() {
  if (!_tourActive || !_tourPlaces.length) {
    speakPlacesSummary();
    return;
  }
  if (_tourIndex >= _tourPlaces.length) {
    announce("That was the last place. Tap the summary button to start again.");
    _showTourControls(false);
    _tourActive = false;
    return;
  }
  _speakCurrentPlace();
  _highlightPlaceInList(_tourPlaces[_tourIndex]);
  _tourIndex++;
}

// ─────────────────────────────────────────────────────────────
// speakPlaceDetail(place)
//   Speaks full detail for a place.
// ─────────────────────────────────────────────────────────────
export function speakPlaceDetail(place) {
  const p = place ?? _tourPlaces[_tourIndex - 1];
  if (!p) return;
  const msg =
    `${p.name}. ${p.shortDescription} ` +
    `About ${p.approxWalkMinutes} minutes walk. ` +
    (p.independent ? "This is an independent business. " : "") +
    `Accessibility: ${p.accessibilityNotes}`;
  announce(msg);
}

// ── Private ───────────────────────────────────────────────────

function _speakCurrentPlace() {
  const p = _tourPlaces[_tourIndex];
  if (!p) return;
  const msg =
    `${p.independent ? "Independent: " : ""}${p.name}. ` +
    `${p.shortDescription} About ${p.approxWalkMinutes} minutes walk.`;
  announce(msg);
}

function _wireTourButtons() {
  document.getElementById("near-me-btn")   ?.addEventListener("click", speakPlacesSummary);
  document.getElementById("next-place-btn") ?.addEventListener("click", startPlaceTour);
  document.getElementById("detail-place-btn")?.addEventListener("click", () => speakPlaceDetail(_tourPlaces[_tourIndex - 1]));
  document.getElementById("repeat-place-btn")?.addEventListener("click", () => {
    const idx = Math.max(0, _tourIndex - 1);
    const p   = _tourPlaces[idx];
    if (p) announce(
      `${p.independent ? "Independent: " : ""}${p.name}. ` +
      `${p.shortDescription} About ${p.approxWalkMinutes} minutes walk.`
    );
  });
  document.getElementById("stop-tour-btn")?.addEventListener("click", () => {
    _tourActive = false;
    _showTourControls(false);
    speak.cancel?.();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    announce("Tour stopped.");
  });
}

function _showTourControls(show) {
  const ids = ["next-place-btn", "repeat-place-btn", "detail-place-btn", "stop-tour-btn"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = !show;
  });
}

function _renderPlacesList(places) {
  const ul = document.getElementById("places-list");
  if (!ul) return;
  ul.innerHTML = "";

  // Group by category
  for (const cat of CATEGORY_ORDER) {
    const inCat = places.filter(p => p.category === cat);
    if (!inCat.length) continue;

    // Category heading as a list item
    const heading = document.createElement("li");
    heading.setAttribute("role", "presentation");
    heading.innerHTML = `<h2 style="font-family:var(--fh);font-size:1rem;color:var(--accent);padding:.5rem 0 .25rem;font-weight:700;">${CATEGORY_LABELS[cat] ?? cat}</h2>`;
    ul.appendChild(heading);

    // Independents first within category
    const ordered = [
      ...inCat.filter(p => p.independent),
      ...inCat.filter(p => !p.independent),
    ];

    ordered.forEach(p => {
      const li = document.createElement("li");
      li.setAttribute("role", "listitem");
      li.id = `place-${p.id}`;
      li.className = "place-card";
      li.setAttribute("aria-label", `${p.name}, ${p.approxWalkMinutes} minutes walk${p.independent ? ", independent business" : ""}`);
      li.innerHTML = `
        <div class="place-name">${_esc(p.name)}</div>
        ${p.independent ? '<div class="place-indie">★ Independent</div>' : ""}
        <div class="place-meta">${_esc(p.shortDescription)}</div>
        <div class="place-meta">🚶 ~${p.approxWalkMinutes} min walk</div>
        <div class="place-a11y">♿ ${_esc(p.accessibilityNotes)}</div>
      `;
      ul.appendChild(li);
    });
  }
}

function _highlightPlaceInList(place) {
  if (!place) return;
  // Remove previous highlight
  document.querySelectorAll(".place-card.current-place")
    .forEach(el => el.classList.remove("current-place"));
  const el = document.getElementById(`place-${place.id}`);
  if (el) {
    el.classList.add("current-place");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function _esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
