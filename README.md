# Hear2Use

> A voice-first web app that helps blind and partially sighted students live independently — less food wasted, correct recycling, and a spoken guide to what's nearby.

**Team Z** — IBM Bob Design Thinking Hackathon | UN SDG 12

---

## Quick start on your phone

### Option A — GitHub Pages (recommended, no setup)

1. Push this folder to a GitHub repository (instructions below).
2. Go to **Settings → Pages → Source → main branch → / (root)**.
3. GitHub will give you a URL like `https://yourname.github.io/hear2use/`.
4. Open that URL in Chrome (Android) or Safari (iOS) on your phone.
5. The camera will work because it is served over HTTPS.

### Option B — Local server + tunnel (for testing before pushing)

You need Node.js installed once. After that it's two commands.

```bash
# 1. Serve the folder locally
npx serve hear2use

# 2. In a second terminal, open a tunnel to HTTPS
npx localtunnel --port 3000
```

`localtunnel` prints a URL like `https://xyz.loca.lt`.  
Open that URL in your phone browser.  
The camera needs HTTPS — `http://localhost` does NOT work on a phone.

### Option C — VS Code Live Share / Live Server extension

If you use VS Code, install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**. Then use localtunnel or ngrok to get HTTPS.

---

## How to run locally on desktop (for development)

```bash
cd hear2use
npx serve .
# open http://localhost:3000 in Chrome
```

No build step. No npm install. `npx serve` downloads and runs serve once.

---

## File structure

```
hear2use/
├── index.html          Main HTML — single page, four tab panels
├── styles.css          All styles — two themes (dark / high-contrast)
├── README.md
├── data/
│   └── places.json     Demo places data (15 places, London area)
└── js/
    ├── app.js          Entry point — tab wiring, Media Session API
    ├── scan.js         Camera input, Gemini AI call, demo fallback
    ├── voice.js        speechSynthesis wrapper, aria-live updates
    ├── kitchen.js      Saved food items, expiry warnings, impact counter
    ├── places.js       Nearby places tour (spoken, grouped)
    ├── tips.js         Date logic, urgency labels, speech builder (pure)
    └── settings.js     Settings form, localStorage, theme, demo data
```

---

## How to use the Gemini AI (optional)

The app works fully without an API key — it uses realistic demo results.

To enable real label scanning:

1. Go to [ai.google.dev](https://ai.google.dev) and get a free Gemini API key.
2. Open the app → **Settings** tab → paste your key into **Gemini API Key** → **Save settings**.
3. The key is stored only on your device in `localStorage`. It is never sent anywhere except to Google's Gemini API.

> ⚠️ **Security note:** This is a hackathon prototype. The API key is stored in the browser. In a production app, all AI calls must go through your own server so the key is never exposed to the client. See `js/scan.js` for the comment marking where this change would go.

---

## How to swap the AI provider

All AI code is in **`js/scan.js`** — specifically the `getAIResult()` function.

To swap to a different provider (e.g. OpenAI GPT-4o, Anthropic Claude):

1. Open `js/scan.js`.
2. Find `getAIResult()`.
3. Replace the `fetch()` call and the `body` object with your provider's API.
4. The prompt and the expected JSON shape stay the same.
5. `getDemoResult()` is the fallback — keep it.

The rest of the app does not care which AI you use, as long as `getAIResult()` returns an object matching this shape:

```js
{
  kind:       "food|post|sign|other",
  name:       "product name",
  summary:    "one sentence description",
  date:       "YYYY-MM-DD or null",
  dateType:   "use_by|best_before|expiry|unknown|null",
  storageTip: "storage instruction",
  disposal:   "disposal instruction",
  confidence: "high|medium|low"
}
```

---

## 2-minute demo script

This script is for the live demo or video recording.

**Setup:** Load the app at your HTTPS URL. Go to Settings → tap "Load demo data" → switch to Kitchen so the judges can see items are already there.

---

**[Scene 1 — Scan, 30 seconds]**

> "Maya has just moved into halls and she's holding a carton of milk. She can't read the use-by date."

1. Tap **Scan**.
2. The camera opens. Point at the milk (or any food label). Tap the shutter.
3. The app says: *"Semi-skimmed milk. 3 days left. This is a use-by date — a safety date, do not eat after this date. Store refrigerated below 5 degrees. Rinse the bottle and put it in recycling."*

> "Everything Maya needs — in one sentence, spoken aloud."

4. Tap **Save to my kitchen**.

---

**[Scene 2 — Kitchen / expiry, 30 seconds]**

> "A few days later, Maya wants to know what she needs to use up."

1. Switch to the **Kitchen** tab.
2. Tap **What's expiring?**
3. The app reads out the items closest to expiry.

> "No guessing. No asking a flatmate. Just the facts."

---

**[Scene 3 — Places, 30 seconds]**

> "Maya is new to the area and wants to find somewhere to shop independently."

1. Switch to the **Places** tab.
2. Tap **What's near me?**
3. The app says: *"Here is what is near you. Grocery shops: Green Leaf Grocer, 4 minutes walk — independent…"*
4. Tap **Next** to hear details of the first place.
5. Tap **Details** to hear full accessibility notes.

> "She can plan a route without needing sighted help."

---

**[Scene 4 — Impact, 15 seconds]**

1. Switch back to **Kitchen**.
2. Tap **Mark used** — the counter increments.
3. Tap **Mark recycled** — the counter increments.

> "Every item used and every package recycled correctly is tracked. That is SDG 12 in action."

---

**[Bonus — headphone navigation]**

> "For a fully hands-free experience, plug in earphones and use the skip button."

The skip-forward button on the headphone cable speaks the next kitchen item. Skip-back speaks the previous one.

---

## Accessibility test checklist

Run this with a screen reader before the presentation.

### VoiceOver (iOS Safari)

- [ ] Enable VoiceOver: **Settings → Accessibility → VoiceOver → On**
- [ ] Open the app URL in Safari
- [ ] Swipe right — every tab button is announced with its label and role ("tab")
- [ ] Double-tap the Scan tab — the panel opens and VoiceOver announces "Scan and Speak, tab, selected"
- [ ] Swipe to the Scan button — announced as "Scan, button"
- [ ] Double-tap Scan — file picker opens or camera launches
- [ ] After a scan result appears — VoiceOver reads the result heading and each row in the definition list
- [ ] Swipe to "Save to my kitchen" — announced correctly, hidden when not applicable
- [ ] Switch to Kitchen tab — impact numbers are announced
- [ ] Tap "What's expiring?" — result spoken AND visible on screen
- [ ] Tap "Repeat" in the header — last message re-spoken
- [ ] Switch to Settings — all labels read, toggle switches announced as "switch, on/off"
- [ ] Focus never gets lost or trapped at any point

### TalkBack (Android Chrome)

- [ ] Enable TalkBack: **Settings → Accessibility → TalkBack → On**
- [ ] Swipe through all tab buttons — each has a label
- [ ] Activate Scan — camera or file picker opens
- [ ] Scan result is announced via aria-live region
- [ ] Kitchen items are listed in logical order with urgency described in text (not colour only)
- [ ] "What's near me?" speaks a full summary
- [ ] Skip button on headphones speaks next kitchen item (Media Session API)
- [ ] Loading overlay is announced when AI is running

### Keyboard only (desktop Chrome)

- [ ] Tab key reaches every interactive element in a logical order
- [ ] All buttons have a visible focus ring (white outline)
- [ ] Arrow keys move between tabs
- [ ] Home and End jump to first/last tab
- [ ] Enter/Space activates buttons
- [ ] No keyboard trap anywhere

### General checks

- [ ] Base font size is at least 20px
- [ ] All touch targets are at least 64px tall
- [ ] In high-contrast mode (default), text contrast is at least 7:1
- [ ] Urgency (expiring soon, expired) is shown in text AND colour (never colour alone)
- [ ] Every spoken message also appears in the "Last message" bar on screen
- [ ] Demo mode works with no API key — three results cycle: milk → letter → ready meal
- [ ] "Load demo data" in Settings populates the Kitchen tab immediately
- [ ] "Clear all data" resets everything and reloads

---

## Pushing to GitHub

```bash
# From the parent folder (IBM BOB/Hackathon/)
cd "c:\Users\johan\Downloads\IBM BOB\Hackathon"

# Initialise git if not already done
git init
git add hear2use/
git commit -m "feat: Hear2Use full prototype — all 4 features"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/hear2use.git
git branch -M main
git push -u origin main
```

Then enable GitHub Pages:  
**Repo → Settings → Pages → Source: Deploy from branch → Branch: main → Folder: /hear2use → Save**

Your live URL will be: `https://YOUR_USERNAME.github.io/hear2use/`

---

## Team

Team Z — IBM Bob Design Thinking Hackathon  
Johanns · Jesse · Vanesa · Fariah · Hayden · Mo

UN SDG 12: Responsible Consumption and Production  
Targets: 12.8 · 12.3 · 12.5 · 10.2
