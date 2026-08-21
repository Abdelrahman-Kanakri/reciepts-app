# Receipts

A personal, installable receipt generator. Fill in a form, get a clean
printable receipt with two signature lines, saved to a local history on
your device.

No account, no server, no backend — everything lives in your browser's
`localStorage`.

## Use it locally

Open `index.html` directly in a browser, or serve the folder:

    python -m http.server 8080

Then visit http://localhost:8080/. Opening the file directly works for
filling out and printing a receipt; installing it as an app (below)
needs it served over HTTPS.

## Install it on your phone / desktop

"Add to Home Screen" / "Install app" only appears once these files are
served over HTTPS from a real host — e.g. add this folder to your
existing Cloudflare Pages project, GitHub Pages, or any static host.

Once it's live at an https:// URL:
- **Android (Chrome):** menu → "Install app"
- **iPhone (Safari):** Share → "Add to Home Screen"
- **Desktop (Chrome/Edge):** install icon in the address bar

## Making a receipt

1. "+ New Receipt" → fill in your info, their info, and item rows.
2. The "I am the Provider/Client" dropdown decides which signature line
   is labeled which way — use it whichever direction the transaction
   goes.
3. "Generate Receipt" saves it to your local history and opens the
   printable view.
4. "Print / Save as PDF" uses your browser's native print dialog — pick
   "Save as PDF" as the destination to get a PDF file, or pick an
   actual printer.

## Regenerating the icon

Icons live in `icons/`, generated from `tools/icon-source.html` via
Playwright's screenshot CLI:

    npx --yes playwright install chromium
    npx --yes playwright screenshot --viewport-size=512,512 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=512" icons/icon-512.png
    npx --yes playwright screenshot --viewport-size=192,192 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=192" icons/icon-192.png
    npx --yes playwright screenshot --viewport-size=180,180 --wait-for-timeout=400 "file://<absolute-path>/tools/icon-source.html?size=180" icons/icon-180.png

Edit the letter/colors in `tools/icon-source.html` and re-run to change it.

## Updating the app after it's installed

If you change any cached file (any `.html`/`.css`/`.js` file, `manifest.json`, or an icon),
bump the version string in `sw.js`'s `CACHE_NAME` (e.g. `receipts-cache-v1` →
`receipts-cache-v2`). Browsers only re-run the service worker's install/cache-refresh cycle
when `sw.js`'s own bytes change — if you edit `form.js` but leave `sw.js` untouched, anyone
who already installed the app keeps serving the old, cached version of `form.js` indefinitely.

## Running the logic tests

    node --test storage.test.js calc.test.js
