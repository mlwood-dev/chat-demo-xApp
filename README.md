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

## Testing Inside Xaman

There are two ways to test the xApp as it will actually run for users: the **xApp Builder** desktop app (recommended for day-to-day development) and **browser-based OTT replay** (useful when you cannot install the desktop app).

Both approaches require a few shared prerequisites.

### Shared prerequisites

1. **Xaman Developer Console account** -- sign up at https://apps.xaman.dev and create a new xApp entry.
2. **Your Xaman Device ID** -- open the Xaman mobile app, go to **Settings > Advanced** and copy the Device ID string.
3. **A publicly reachable URL** -- the Xaman wallet and xApp Builder load your app over the network, so `localhost` alone is not enough. Use a tunnel to expose your local dev server:

```bash
# Install localtunnel globally (one time)
npm install -g localtunnel

# Start your dev server, then in a second terminal:
lt --port 8080
```

Localtunnel will print a public HTTPS URL such as `https://random-name.loca.lt`. Copy it.

4. **Register the URL in the Developer Console** -- paste the tunnel URL into the **WebApp URL** field of your xApp entry. Also paste your Device ID into the **Debug Device ID** field so the OTT replay and xApp Builder features are enabled for your device.

### Option A: xApp Builder (recommended)

xApp Builder is a free desktop application that emulates the Xaman xApp environment on your computer with live console logs, automatic OTT fetching, and hot reload.

1. Install xApp Builder for your platform:
   - macOS -- [Mac App Store](https://apps.apple.com/nl/app/xappbuilder/id6447613145)
   - Windows -- [Microsoft Store](https://apps.microsoft.com/store/detail/xappbuilder/9N38F4HZVDRZ)
   - Linux -- [Snap Store](https://snapcraft.io/xapp-builder)

2. Make sure your dev server is running (`npm run dev`) and the localtunnel is active.

3. Open xApp Builder. It will display a QR code -- scan it with the Xaman mobile app to pair.

4. xApp Builder loads your xApp using the WebApp URL from the Developer Console. You will see the app render in the emulator pane, and the console pane will show any `console.log` / `console.error` output from your code.

5. Edit source files in your editor. Vite's HMR pushes changes to the browser inside xApp Builder automatically -- no manual refresh needed.

6. The Xaman SDK (`xumm` package) will detect the xApp Builder environment, so `xummInstance.user.account` and other wallet-context properties will be populated just as they would be on a real device.

### Option B: Browser-based OTT replay

If you prefer to test in a regular desktop browser instead of xApp Builder:

1. Make sure your dev server and localtunnel are running and the Developer Console entry is configured (WebApp URL + Debug Device ID).

2. Open the Xaman mobile app and launch your xApp once. This generates a One Time Token (OTT). The OTT is appended to the URL as the `xAppToken` query parameter. Copy it.

3. In Chrome DevTools, override the **User Agent** string to `xumm/xapp`:
   - Open DevTools > Network Conditions (or the three-dot menu > More tools > Network conditions).
   - Uncheck **Use browser default** and enter `xumm/xapp`.

4. Your computer and phone must share the same public IP address (same Wi-Fi network, no VPN split).

5. Navigate to the replay URL in your browser:

```
https://xumm.app/detect/xapp:your.xapp.id/force?xAppToken=<OTT>
```

Replace `your.xapp.id` with the identifier from the Developer Console and `<OTT>` with the token you copied.

6. The xApp will load with full OTT context, letting you test SDK calls and wallet interaction in the browser.

### Testing on a physical device

To test the xApp directly inside the Xaman wallet on your phone:

1. Build and deploy the app to a publicly accessible HTTPS host (or keep the localtunnel running).
2. Ensure the WebApp URL in the Developer Console points to that host.
3. Open Xaman on your phone and navigate to your xApp. Because your Device ID is registered as a debug device, Xaman will load the URL from the Developer Console rather than requiring a published release.
4. The app will receive a live OTT, the SDK will initialise fully, and `xummInstance.user.account` will return your real XRPL address.

### Troubleshooting

| Problem | Solution |
|---|---|
| xApp Builder shows a blank screen | Confirm the localtunnel is running and the URL in the Developer Console matches. Try restarting the tunnel -- localtunnel URLs can expire. |
| OTT replay returns 403 | Your phone and computer must share the same public IP. Disable VPNs or split-tunnel configurations. |
| Xaman SDK reports "not in xApp environment" | The SDK detects the environment via the OTT query parameter and the user agent. Make sure you are loading through xApp Builder, the Xaman wallet, or the OTT replay flow -- a plain `localhost` browser tab will not have wallet context. The app is designed to degrade gracefully in this case. |
| Localtunnel password wall | Some localtunnel instances show a confirmation page on first visit. Open the tunnel URL in a browser once and click through before loading it in xApp Builder. |

## Xaman xApp Deployment

When you are ready to publish beyond your debug device:

1. Build the production bundle with `npm run build`.
2. Deploy the contents of `dist/` to a publicly accessible HTTPS endpoint.
3. The `xapp.json` manifest in `public/` is included in the build output automatically.
4. Update the **WebApp URL** in the Xaman Developer Console to point to the production host.
5. Submit the xApp for review in the Developer Console to make it available to all Xaman users.

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
