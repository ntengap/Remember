# Remember — encrypted edition (v0.2)

## Install on GitHub Pages
Upload all eight files in this folder to the root of your existing GitHub Pages repository. This includes the NEW `security.js` and the seven updated/original files. Wait for deployment, then reload the site (close and reopen the installed app if needed).

## Encryption and locking
On first visit, choose and confirm a passphrase (at least 10 characters). Remember encrypts all saved records before writing them to localStorage, using AES-256-GCM and a key derived via PBKDF2-SHA256 (310,000 iterations, random salt). Each save uses a fresh random nonce. The passphrase is not saved. Remember locks after five minutes of inactivity, whenever the tab is backgrounded, or when you select **Lock now** in Settings. Locking waits for pending saves and reloads the page.

The new version refuses to overwrite existing unencrypted `remember-local-v1` data. If it detects older data, use the previous app to export it before upgrading. Because this upgrade is intended for an empty diary, it creates a fresh encrypted vault; import the old backup afterward if needed.

## Critical cautions
- **No passphrase recovery.** Losing your passphrase means losing access to encrypted records.
- Settings > Export creates a **plaintext JSON backup**, not an encrypted one. Protect exported files separately.
- Clearing site data deletes the vault. Keep a protected backup.
- An unlocked device, malicious browser extension, or compromised browser can still expose your records while the app is open.
- This is not professionally audited security software. Do not store passwords, PINs, recovery codes, or full identity numbers.
- GitHub Pages hosts app code, not your local diary. There is no cloud sync.
- Browser Web Crypto requires HTTPS or localhost.

## Local development
From this folder, run `python -m http.server 8000`, then open `http://localhost:8000`.
