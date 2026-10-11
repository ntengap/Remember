# Remember — personal memory diary

A local-first, installable web app for recording important details, tracking changes, searching memories, and managing recurring reminders.

## What's implemented

- Daily diary entry with a local keyword-based organizer and a review-before-save step.
- Editable memory records with categories, event dates, verification status, and a simple change history when details are updated.
- Search and category filters.
- Recurring reminders with first due date, next-occurrence preview, completion, and month-end-safe date arithmetic.
- Browser-local persistence using `localStorage`.
- JSON export/import and delete-all controls.
- Responsive layout, web app manifest, service worker cache, and install prompt support.

## Important limitations in this first version

- Diary organization is rule-based, not an AI model. It splits entries into sentences and suggests a category from keywords. It does not send data to a server.
- Reminder dates are stored and shown inside the app, but **web push / scheduled operating-system notifications are not implemented**. A service worker cannot reliably wake itself at a future date without a push or platform scheduling service.
- Local-only storage is not encryption. Someone with access to the same browser profile may access the records. Do not save passwords, PINs, recovery codes, or full identity numbers.
- Browser storage can be erased by clearing site data. Export backups regularly.
- The SVG app icon is used for broad compatibility; some app stores and older install flows may prefer PNG icon sizes.

## Run it locally

You need Node.js installed.

1. Unzip the project.
2. Open a terminal in the `remember-app` folder.
3. Run a local static server. For example:

   ```bash
   npx serve .
   ```

4. Open the local URL printed by the server (often `http://localhost:3000`).

You can also use Python if it is installed:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Do not open `index.html` directly as a `file://` URL. Service workers and installability require `localhost` or HTTPS.

## Install on your device

- **Desktop Chromium browsers:** open the served app and use the install icon in the address bar or the app's install button if shown.
- **Android:** open the HTTPS-hosted app in Chrome, then use the browser menu → Install app / Add to Home screen.
- **iPhone/iPad:** host the app over HTTPS, open it in Safari, tap Share → Add to Home Screen.

Installability requirements vary by browser. The service worker caches the app shell for offline reopening after the first successful load.

## Data and backup

All records are saved in this browser's `localStorage` under the key `remember-local-v1`. Use Settings → Export to download a JSON backup. Settings → Import replaces current records with the selected Remember export. Store exported files somewhere private.

## Suggested next production steps

1. Add a local database migration layer (IndexedDB) if the record count grows substantially.
2. Add an explicit record type for belongings, locations, account references, and routines, with linked event history.
3. Add browser notification permission and best-effort local notifications while the app is open; use a platform-specific scheduler or push service for reliable background reminders.
4. Add an optional on-device language model or a user-configured AI provider only after designing consent and data-flow controls.
5. Add automated tests for date arithmetic, import validation, and backup restoration.
