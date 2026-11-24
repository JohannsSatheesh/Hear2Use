# Hear2Use: accessibility test checklist

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
