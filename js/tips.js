/**
 * js/tips.js
 * Pure logic — no DOM, no speech, no imports.
 * Date interpretation, urgency labels, storage/disposal fallbacks,
 * and the speech sentence builder.
 *
 * Owner: content / label-reading logic
 */

// ─────────────────────────────────────────────────────────────
// explainDateLabel(dateType)
//   Returns a plain-English sentence explaining the label type.
// ─────────────────────────────────────────────────────────────
export function explainDateLabel(dateType) {
  switch (dateType) {
    case "use_by":
      return "This is a use-by date. That is a safety date — do not eat the food after this date, even if it looks fine.";
    case "best_before":
      return "This is a best-before date. That is a quality date — the food may still be safe to eat after this date, but it might not taste as good.";
    case "expiry":
      return "This is an expiry date. Do not use the product after this date.";
    case "unknown":
      return "I found a date on this item but I am not sure what type it is. Check the label carefully.";
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────
// isExpired(dateStr)
//   dateStr: "YYYY-MM-DD" or null
//   Returns { expired: bool, daysUntil: number }
//   daysUntil is negative if expired.
// ─────────────────────────────────────────────────────────────
export function isExpired(dateStr) {
  if (!dateStr) return { expired: false, daysUntil: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return { expired: diff < 0, daysUntil: diff };
}

// ─────────────────────────────────────────────────────────────
// formatUrgency(daysUntil)
//   Returns a short phrase and a CSS class name.
//   { text, chipClass }  chipClass: "chip-ok" | "chip-warn" | "chip-danger"
// ─────────────────────────────────────────────────────────────
export function formatUrgency(daysUntil) {
  if (daysUntil === null) return { text: "No date found", chipClass: "" };
  if (daysUntil < 0)  return { text: `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`, chipClass: "chip-danger" };
  if (daysUntil === 0) return { text: "Expires today",    chipClass: "chip-danger" };
  if (daysUntil === 1) return { text: "Expires tomorrow", chipClass: "chip-warn" };
  if (daysUntil <= 3)  return { text: `${daysUntil} days left`, chipClass: "chip-warn" };
  return { text: `${daysUntil} days left`, chipClass: "chip-ok" };
}

// ─────────────────────────────────────────────────────────────
// storageFallback(kind)
//   Generic storage tip when the AI returns nothing.
// ─────────────────────────────────────────────────────────────
export function storageFallback(kind) {
  switch (kind) {
    case "food": return "Store in a cool, dry place or refrigerate if the label says to.";
    case "post": return "Keep in a safe, dry place.";
    default:     return "";
  }
}

// ─────────────────────────────────────────────────────────────
// disposalFallback(kind)
//   Generic disposal sentence when the AI returns nothing.
// ─────────────────────────────────────────────────────────────
export function disposalFallback(kind) {
  switch (kind) {
    case "food":  return "Check the packaging for recycling symbols. Rinse containers before recycling.";
    case "post":  return "Paper and envelopes go in the paper recycling bin. Shred anything with your personal details first.";
    default:      return "Check local recycling guidelines for this item.";
  }
}

// ─────────────────────────────────────────────────────────────
// buildSpeechFromResult(result, detailLevel)
//   Assembles the full spoken sentence from the AI JSON result.
//   detailLevel: "brief" | "detailed"
//   result shape: { kind, name, summary, date, dateType, storageTip, disposal, confidence }
// ─────────────────────────────────────────────────────────────
export function buildSpeechFromResult(result, detailLevel = "brief") {
  const parts = [];

  // Name / what it is
  if (result.name) {
    parts.push(`This is ${result.name}.`);
  } else if (result.summary) {
    parts.push(result.summary);
  }

  // Date
  if (result.date) {
    const { expired, daysUntil } = isExpired(result.date);
    const { text: urgText } = formatUrgency(daysUntil);

    if (expired) {
      parts.push(`Warning: ${urgText}.`);
    } else if (daysUntil === 0) {
      parts.push("You must use this today.");
    } else if (daysUntil !== null) {
      parts.push(`${urgText}.`);
    }

    // Always explain the label type
    const labelExplanation = explainDateLabel(result.dateType);
    if (labelExplanation) parts.push(labelExplanation);
  } else {
    parts.push("No date was found on this item.");
  }

  // Storage
  const storage = result.storageTip || storageFallback(result.kind);
  if (storage) parts.push(`Storage: ${storage}`);

  // Disposal — always one sentence
  const disposal = result.disposal || disposalFallback(result.kind);
  if (disposal) parts.push(`Disposal: ${disposal}`);

  // Detailed mode: add full summary if different from name
  if (detailLevel === "detailed" && result.summary && result.summary !== result.name) {
    parts.push(result.summary);
  }

  // Low confidence warning
  if (result.confidence === "low") {
    parts.push("I am not very confident about this result. Try rescanning in better light, or hold the label closer to the camera.");
  }

  return parts.join(" ");
}
