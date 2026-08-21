# Receipt Generator — Design Spec

Date: 2026-08-21

## Purpose

A personal, installable web app for generating professional receipts for
one-off transactions — whether the user is buying from a client or selling
to one. No account system, no backend, no server storage. Everything lives
in the browser (`localStorage`) on the device it's installed on.

## Non-goals

- No multi-user accounts, auth, or cloud sync.
- No tax/discount calculation (out of scope unless requested later).
- No invoicing features (payment links, recurring billing, etc.) — this is
  a receipt (proof of a completed exchange), not an invoice (a request for
  payment).

## Stack

Static HTML/CSS/vanilla JS. No framework, no build step, no bundler.
Deployable to any static host (Cloudflare Pages, GitHub Pages, etc.) or
opened directly from disk (install/offline-cache requires HTTPS hosting).

## Theme

Pulled from `abdk.me/style.css`:

- Backgrounds: `hsl(228,25%,4%)` / `hsl(228,20%,7%)` / `hsl(228,18%,10%)`
- Accent: `hsl(217,95%,60%)` (gradient to `hsl(225,80%,40%)`)
- Text: `hsl(220,25%,96%)` primary / `hsl(225,12%,52%)` muted
- Fonts: Syne (headings, 400/600/700/800) + Outfit (body, 300–600) via
  Google Fonts
- Glass-card panels (`backdrop-filter: blur`), pill-shaped buttons,
  22–30px radii, soft blue glow shadows

Applies to the app screens (history list, form). The printed/exported
**receipt itself** renders on a white/print-safe background with the same
fonts and a blue accent header bar, since dark backgrounds waste ink and
read as unprofessional on paper. This is a default choice, flagged for the
user to override if they'd rather the printed receipt stay dark.

## Pages

### `index.html` — History
- Lists saved receipts (counterparty name, date, total), newest first.
- Each row: open, duplicate, delete.
- Empty state prompts "New Receipt".

### `new.html` — Form
- Your info: name, email — pre-filled from the last-used values, editable.
- Role toggle: "I am the: [Provider ▾ / Client ▾]" — determines which
  signature line is labeled which way on the output (the user is
  sometimes the seller, sometimes the buyer).
- Counterparty info: name, email.
- Item rows: description, qty, unit price → auto-computed line total.
  Add/remove rows.
- Notes field (optional, free text).
- Auto-generated receipt number and date.
- "Generate Receipt" → saves to `localStorage` → navigates to
  `receipt.html`.

### `receipt.html` — Receipt view / print
- Clean print-ready layout: issuer/counterparty info side-by-side,
  itemized table, subtotal/total, two blank signature lines
  (labeled per the role toggle).
- "Print / Save as PDF" button calls `window.print()` — the browser's
  native "Save as PDF" destination covers the export/install use case,
  works offline, identical flow on mobile and desktop.
- "Back to History" / "Edit" controls, hidden in print via
  `@media print`.

## Data model (`localStorage`)

```
Receipt {
  id: string,
  receiptNumber: string,
  date: string,           // ISO date
  issuer: { name, email, role },        // "you"
  counterparty: { name, email, role },  // the client
  items: [{ description, qty, unitPrice }],
  notes: string,
  total: number            // computed, stored for list display
}
```

Stored as a single JSON array under one `localStorage` key. Last-used
issuer name/email cached separately so the form pre-fills it next time.

## PDF / print

`window.print()` + a dedicated print stylesheet on `receipt.html`. No
bundled PDF library — keeps the app dependency-free and fully offline.
Works identically on Android/iOS/desktop browsers via their native
print-to-PDF destination.

## PWA / install

- `manifest.json` (name, theme color from the accent blue, icons,
  `display: standalone`).
- `sw.js` — precaches the 3 HTML pages, `style.css`, `app.js`, and icons
  for offline use.
- Icon: simple monogram in the accent blue, generated unless the user
  supplies a logo.
- Requires HTTPS hosting for the install prompt and offline caching to
  activate; opening the file directly from disk still works for
  filling out and printing a receipt, just without "Add to Home Screen".

## File layout

```
/index.html
/new.html
/receipt.html
/style.css
/app.js
/manifest.json
/sw.js
/icons/
```

## Open items resolved during brainstorming

- PDF mechanism: browser print-to-PDF (not a bundled library).
- History: saved locally, with a list/reopen/duplicate/delete screen.
- Roles: flexible per-receipt toggle, not a fixed seller/buyer template.
