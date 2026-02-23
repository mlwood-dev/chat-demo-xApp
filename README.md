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

- Node.js 18+
- A Synapse homeserver with JWT authentication enabled
- A valid JWT token with a `sub` claim matching a Matrix user localpart

### Synapse JWT Configuration

In your Synapse `homeserver.yaml`, ensure JWT login is enabled:

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

Synapse will map `sub` to the Matrix user `@username:your-server.com`.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The app runs at `http://localhost:8080`.

## Build

```bash
npm run build
```

Output goes to the `dist/` directory.

## Configuration

Edit the homeserver URL in the login form, or change the default in `src/services/matrixClient.ts`:

```typescript
const DEFAULT_HOMESERVER = 'https://your-synapse-server.com';
```

## Xaman xApp Deployment

1. Build the production bundle with `npm run build`
2. Deploy the `dist/` directory to a publicly accessible HTTPS endpoint
3. The `xapp.json` manifest is in `public/` and will be copied to the build output
4. Register the xApp in the Xaman Developer Console at https://apps.xaman.dev
5. For sandbox testing, use the Xaman developer tools to load the xApp URL directly

### xApp Manifest

The `public/xapp.json` defines the xApp metadata:

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

## Project Structure

```
src/
  index.tsx              Entry point
  App.tsx                Main application component with view routing
  styles.css             Global styles (mobile-responsive dark theme)
  types/index.ts         TypeScript type definitions
  services/
    matrixClient.ts      Matrix JS SDK wrapper (login, rooms, messages)
    xamanSdk.ts           Xaman/Xumm SDK integration
  components/
    Login.tsx             JWT login form
    RoomList.tsx          Room list with join/create dialogs
    RoomView.tsx          Single room view container
    MessageTimeline.tsx   Scrollable message timeline
    SendMessage.tsx       Message input with send button
public/
  xapp.json              xApp manifest
  favicon.svg            App icon
```

## Technology Stack

- React 18 with TypeScript
- Vite for bundling
- matrix-js-sdk for Matrix protocol
- xumm (Xaman Universal SDK) for wallet integration
