# Matrix JWT xApp POC (Xaman + Synapse 1.47.1)

Minimal proof-of-concept Matrix client intended for Xaman xApp WebView.

## Features

- Login using Synapse legacy JWT flow: `org.matrix.login.jwt`
- Room list and room timeline
- Join room by alias/ID
- Create private room
- Send plain text messages
- Basic Xaman environment detection and optional XRPL account display

## Tech Stack

- React + TypeScript + Vite
- `matrix-js-sdk`
- `@xaman/xdk` (installed as an npm alias to the official `xumm` package)

## Prerequisites

- Node.js 18+
- A Synapse homeserver with JWT login enabled (tested target: 1.47.1 behavior)
- A JWT that your homeserver accepts for `org.matrix.login.jwt`
- HTTPS hosting target for xApp testing

## Local Development

```bash
npm install
npm run dev
```

Open the URL shown by Vite in your browser.

## Environment Variables

Create a local env file (for example `.env.local`) if desired:

```bash
VITE_DEFAULT_HOMESERVER_URL=https://your-synapse-server.com
VITE_XAMAN_API_KEY=xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

Notes:

- `VITE_DEFAULT_HOMESERVER_URL` pre-fills the homeserver input.
- `VITE_XAMAN_API_KEY` is optional. It improves Xaman context retrieval in app runtime.

## Build

```bash
npm run build
npm run preview
```

## Synapse JWT Notes (1.47.1 Compatibility)

- Login type used by this app: `org.matrix.login.jwt`
- JWT is entered manually in the UI (no backend JWT minting in this POC).
- Ensure your JWT contains a valid `sub` claim mapped by Synapse to the Matrix user identity expected by your JWT auth configuration.
- Homeserver URL must be HTTPS in this client.

## Developer Instructions: Xaman xApp Builder + Xaman App

### 1) Prepare a reachable HTTPS URL

Xaman xApps must load over HTTPS. For development, either:

- deploy the app build to an HTTPS host, or
- expose local dev with a secure tunnel (for example, ngrok or Cloudflare Tunnel).

If using local dev, keep Vite running:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

Then tunnel that URL using your preferred HTTPS tunneling tool.

### 2) Configure in Xaman xApp Builder (sandbox/developer mode)

1. Open the Xaman xApp Builder for your developer account.
2. Create or edit your sandbox xApp project.
3. Set the xApp URL/entrypoint to your HTTPS app URL.
4. Use the included `xapp.json` values as your manifest baseline:
   - name/short name
   - description
   - icon path
   - entry path
5. Save/publish to sandbox.

### 3) Open and test in Xaman app

1. Use the Builder-provided launch method (deep link/QR) to open the sandbox xApp in Xaman.
2. Confirm runtime section shows xApp environment.
3. Enter:
   - your Synapse HTTPS base URL
   - your JWT token
4. Press **Login with JWT**.
5. Validate:
   - room list loads
   - join room works (`#alias:server` or `!roomId:server`)
   - create room works
   - timeline updates
   - text sending works

### 4) Recommended test checklist

- Invalid JWT shows clear error
- Unreachable homeserver shows clear error
- Non-HTTPS homeserver is blocked client-side
- Login/logout cycles do not crash
- Timeline and room list refresh after actions

## Project Files

- `src/App.tsx` - main app logic and UI
- `src/App.css` - responsive layout/styling
- `xapp.json` - xApp manifest example
- `public/xapp-icon.svg` - simple icon for manifest usage
