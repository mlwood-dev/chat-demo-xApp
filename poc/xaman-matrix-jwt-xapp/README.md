# Matrix xApp (JWT) POC

Minimal proof-of-concept Matrix client meant to run as a web xApp inside the Xaman wallet.

## What this POC does
- Login to a Synapse homeserver using **legacy JWT login**: `org.matrix.login.jwt` (Synapse 1.47.1 compatible)
- Show room list
- Join or create a room
- Show a basic message timeline (text messages only)
- Send text messages
- Detect Xaman xApp context (best-effort) and optionally pick an XRPL address using `xumm-xapp-sdk`

## Setup
```bash
cd poc/xaman-matrix-jwt-xapp
npm install
npm run dev
```

Then open the dev URL (or load it in Xaman sandbox) and paste a JWT.

## Homeserver requirements (Synapse 1.47.1)
- Synapse must be configured with JWT auth enabled and the legacy login type `org.matrix.login.jwt`.
- Your JWT should include a `sub` claim that maps to the Matrix user ID (Synapse-side mapping).
- Ensure CORS allows your xApp origin if you test from a browser.

## Files you may want to edit
- `src/App.tsx`: UI + flow
- `src/lib/matrix.ts`: JWT login + client creation
- `public/xapp.json`: xApp metadata manifest (POC)

