# Matrix xApp for Xaman Wallet

A proof-of-concept Matrix protocol client built as an xApp for the Xaman (formerly Xumm) wallet. It connects to a personal Synapse homeserver (v1.47.1+) using JWT-based authentication via the legacy `org.matrix.login.jwt` login type.

## Features

- JWT-based login compatible with Synapse 1.47.1
- Room list with last-message preview
- Real-time message timeline with auto-scroll
- Send text messages
- Join existing rooms by ID or alias
- Create new private rooms
- Xaman environment detection with XRPL address display
- Mobile-responsive dark theme UI
- Session persistence via localStorage

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- A Synapse homeserver (v1.47.1+) with JWT authentication enabled
- A valid JWT token whose `sub` claim matches a Matrix user localpart

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd xaman-matrix-xapp
npm install
```

### 2. Configure the homeserver

The default homeserver URL is `https://your-synapse-server.com`. You can change it in one of two ways:

- **At runtime** -- enter the URL in the login form.
- **In code** -- edit the constant in `src/services/matrixClient.ts`:

```typescript
const DEFAULT_HOMESERVER = 'https://your-synapse-server.com';
```

### 3. Start the dev server

```bash
npm run dev
```

This launches Vite's development server at **http://localhost:8080** with hot-module replacement enabled. Changes to any source file will be reflected immediately in the browser.

### 4. Open in a browser

Navigate to `http://localhost:8080`, enter your Synapse homeserver URL and a valid JWT, then click **Login with JWT**.

## Development

### Available scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Start the local dev server on port 8080 with HMR |
| `npm run build` | `tsc --noEmit && vite build` | Type-check and create a production build in `dist/` |
| `npm run preview` | `vite preview` | Serve the production build locally for inspection |
| `npm run typecheck` | `tsc --noEmit` | Run TypeScript type checking without emitting files |

### Project structure

```
src/
  index.tsx              Entry point, mounts the React app
  App.tsx                Root component with view routing (login / rooms / room)
  styles.css             Global styles (mobile-responsive dark theme)
  types/
    index.ts             TypeScript interfaces and type aliases
  services/
    matrixClient.ts      matrix-js-sdk wrapper (JWT login, sync, rooms, messaging)
    xamanSdk.ts           Xaman/Xumm SDK integration and environment detection
  components/
    Login.tsx             JWT login form with homeserver URL input
    RoomList.tsx          Room list with inline join/create dialogs
    RoomView.tsx          Single room container (header + timeline + composer)
    MessageTimeline.tsx   Scrollable message timeline with date separators
    SendMessage.tsx       Message input with Enter-to-send
public/
  xapp.json              xApp manifest for Xaman registration
  favicon.svg            App icon
```

### Key source files

- **`src/services/matrixClient.ts`** -- All interaction with the Matrix protocol goes through this module. It wraps `matrix-js-sdk` and exposes functions for login, room listing, message retrieval, sending, pagination, and event subscriptions. The JWT login uses the `org.matrix.login.jwt` type to stay compatible with Synapse 1.47.1.

- **`src/services/xamanSdk.ts`** -- Initialises the Xaman Universal SDK (`xumm` package). When the app runs inside the Xaman wallet, it detects the environment and makes the user's XRPL address available. Outside Xaman it degrades gracefully.

- **`src/App.tsx`** -- Manages application state and view transitions. On mount it attempts to restore a previous session from localStorage and initialises the Xaman SDK. The three views (`login`, `rooms`, `room`) are rendered conditionally.

### Adding a new component

1. Create a `.tsx` file under `src/components/`.
2. Import and use it from `src/App.tsx` or from another component.
3. The dev server will pick up the change automatically.

### Type checking

Run type checks at any time without producing build output:

```bash
npm run typecheck
```

The project uses TypeScript 5.3 with `moduleResolution: "Bundler"` so that `matrix-js-sdk`'s `.ts`-extension re-exports resolve correctly.

### Generating a JWT for testing

Synapse expects a JWT with at minimum a `sub` claim. You can generate one locally with any JWT library or a CLI tool:

```bash
# Using Node.js (jsonwebtoken)
node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: 'alice' },
    'your-jwt-secret',
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  console.log(token);
"
```

Paste the resulting token into the login form. Synapse will map the `sub` value to the Matrix user `@alice:your-server.com`.

## Synapse JWT Configuration

In your Synapse `homeserver.yaml`, enable JWT login:

```yaml
jwt_config:
  enabled: true
  secret: "your-jwt-secret"
  algorithm: "HS256"
```

The JWT payload must include a `sub` claim:

```json
{
  "sub": "username",
  "iat": 1700000000,
  "exp": 1700003600
}
```

Synapse maps the `sub` value to the Matrix user `@username:your-server.com`.

## Production Build

```bash
npm run build
```

This runs the TypeScript compiler for type checking and then produces an optimised bundle in the `dist/` directory. To preview the build locally:

```bash
npm run preview
```

The preview server defaults to `http://localhost:4173`.

## Xaman xApp Deployment

1. Build the production bundle with `npm run build`.
2. Deploy the contents of `dist/` to a publicly accessible HTTPS endpoint.
3. The `xapp.json` manifest in `public/` is included in the build output automatically.
4. Register the xApp in the Xaman Developer Console at https://apps.xaman.dev.
5. For sandbox testing, use the Xaman developer tools to load the xApp URL directly.

### xApp manifest

The `public/xapp.json` file defines the xApp metadata:

```json
{
  "name": "Matrix xApp",
  "description": "A Matrix protocol client for Xaman wallet",
  "version": "1.0.0",
  "permissions": {
    "network": true,
    "storage": true
  }
}
```

## Technology Stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Language | TypeScript 5.3 |
| Bundler | Vite 5 |
| Matrix protocol | matrix-js-sdk 35 |
| Wallet integration | xumm (Xaman Universal SDK) 1.8 |
| Node polyfills | buffer, @esbuild-plugins/node-globals-polyfill |
