import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Xumm } from "@xaman/xdk";
import {
  createClient,
  MsgType,
  Preset,
  type MatrixClient,
  type Room,
  SyncState,
  Visibility,
} from "matrix-js-sdk";
import "./App.css";

/**
 * Setup notes:
 * 1) Replace VITE_DEFAULT_HOMESERVER_URL (or this fallback) with your Synapse base URL.
 * 2) Optionally provide VITE_XAMAN_API_KEY to fetch richer Xaman user context in xApp runtime.
 * 3) Start with: npm install && npm run dev
 */
const DEFAULT_HOMESERVER_URL =
  import.meta.env.VITE_DEFAULT_HOMESERVER_URL ?? "https://your-synapse-server.com";
const XAMAN_APP_KEY = import.meta.env.VITE_XAMAN_API_KEY ?? "";
const FALLBACK_XAMAN_UUID = "00000000-0000-4000-8000-000000000000";
const REFRESH_INTERVAL_MS = 1250;

type RoomSummary = {
  roomId: string;
  name: string;
  alias: string | null;
  memberCount: number;
  unreadCount: number;
};

type TimelineMessage = {
  eventId: string;
  sender: string;
  body: string;
  msgType: string;
  timestamp: number;
};

type XamanContext = {
  inXaman: boolean;
  account: string | null;
  network: string | null;
  status: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const maybeError = error as Record<string, unknown>;
    if (typeof maybeError.errcode === "string" && typeof maybeError.error === "string") {
      return `${maybeError.errcode}: ${maybeError.error}`;
    }
    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }
  }
  return "Unknown error";
}

function normalizeHomeserverUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error("Homeserver URL is required.");
  }
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "https:") {
    throw new Error("Homeserver URL must use HTTPS.");
  }
  return parsed.origin;
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, "=");
    const payloadJson = window.atob(paddedPayload);
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch (_error) {
    return null;
  }
}

function roomToSummary(room: Room): RoomSummary {
  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    alias: room.getCanonicalAlias(),
    memberCount: room.getJoinedMemberCount(),
    unreadCount: room.getUnreadNotificationCount(),
  };
}

function roomToTimeline(room: Room): TimelineMessage[] {
  const events = room.getLiveTimeline().getEvents();
  const messages = events.flatMap((event): TimelineMessage[] => {
    const content = event.getContent() as Record<string, unknown>;
    const body = content.body;
    const msgType = content.msgtype;

    if (typeof body !== "string" || typeof msgType !== "string") {
      return [];
    }
    if (msgType !== MsgType.Text && msgType !== MsgType.Notice) {
      return [];
    }

    return [
      {
        eventId: event.getId() ?? `${event.getTs()}-${Math.random().toString(16).slice(2)}`,
        sender: event.getSender() ?? "unknown",
        body,
        msgType,
        timestamp: event.getTs(),
      },
    ];
  });

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

async function waitForSync(client: MatrixClient, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const syncState = client.getSyncState();
    if (syncState === SyncState.Prepared || syncState === SyncState.Syncing) {
      return;
    }
    if (syncState === SyncState.Error) {
      throw new Error("Initial sync failed. Verify homeserver reachability and JWT validity.");
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for initial Matrix sync.");
}

async function withTimeout<T>(promise: Promise<T> | undefined, timeoutMs: number): Promise<T | undefined> {
  if (!promise) {
    return undefined;
  }

  let timeoutHandle = 0;
  const timeoutPromise = new Promise<undefined>((resolve) => {
    timeoutHandle = window.setTimeout(() => resolve(undefined), timeoutMs);
  });

  const result = (await Promise.race([promise, timeoutPromise])) as T | undefined;
  window.clearTimeout(timeoutHandle);
  return result;
}

function App() {
  const [homeserverUrl, setHomeserverUrl] = useState(DEFAULT_HOMESERVER_URL);
  const [jwtToken, setJwtToken] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Idle");

  const [xamanContext, setXamanContext] = useState<XamanContext>({
    inXaman: false,
    account: null,
    network: null,
    status: "Detecting runtime...",
  });

  const [joinRoomValue, setJoinRoomValue] = useState("");
  const [createRoomName, setCreateRoomName] = useState("");
  const [createRoomTopic, setCreateRoomTopic] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [matrixClient, setMatrixClient] = useState<MatrixClient | null>(null);
  const matrixClientRef = useRef<MatrixClient | null>(null);

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoomIdRef = useRef<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineMessage[]>([]);

  const jwtClaims = useMemo(() => decodeJwtClaims(jwtToken), [jwtToken]);
  const jwtSubClaim = useMemo(() => {
    if (!jwtClaims) {
      return null;
    }
    const claim = jwtClaims.sub;
    return typeof claim === "string" ? claim : null;
  }, [jwtClaims]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const stopClient = useCallback(() => {
    const existingClient = matrixClientRef.current;
    if (existingClient) {
      try {
        existingClient.stopClient();
      } catch (_error) {
        // Ignore shutdown errors during POC teardown.
      }
    }

    matrixClientRef.current = null;
    setMatrixClient(null);
    setSessionUserId(null);
    setRooms([]);
    setSelectedRoomId(null);
    setTimeline([]);
  }, []);

  const refreshMatrixView = useCallback((client: MatrixClient) => {
    const sortedRooms = client
      .getVisibleRooms()
      .slice()
      .sort((a, b) => b.getLastActiveTimestamp() - a.getLastActiveTimestamp());
    const roomSummaries = sortedRooms.map(roomToSummary);
    setRooms(roomSummaries);

    let nextSelectedRoomId = selectedRoomIdRef.current;
    const hasSelection = nextSelectedRoomId
      ? roomSummaries.some((room) => room.roomId === nextSelectedRoomId)
      : false;

    if (!hasSelection) {
      nextSelectedRoomId = roomSummaries.length > 0 ? roomSummaries[0].roomId : null;
      selectedRoomIdRef.current = nextSelectedRoomId;
      setSelectedRoomId(nextSelectedRoomId);
    }

    const selectedRoom = client.getRoom(nextSelectedRoomId ?? undefined);
    setTimeline(selectedRoom ? roomToTimeline(selectedRoom) : []);
  }, []);

  useEffect(() => {
    return () => {
      stopClient();
    };
  }, [stopClient]);

  useEffect(() => {
    let cancelled = false;

    const detectXamanRuntime = async () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const inXaman = userAgent.includes("xumm/xapp") || userAgent.includes("xaman/xapp");
      const hasApiKey = isUuid(XAMAN_APP_KEY);

      if (!inXaman && !hasApiKey) {
        setXamanContext({
          inXaman: false,
          account: null,
          network: null,
          status: "Regular browser detected. Open this URL inside Xaman xApp for wallet context.",
        });
        return;
      }

      setXamanContext({
        inXaman,
        account: null,
        network: null,
        status: "Fetching Xaman context...",
      });

      try {
        const credential = hasApiKey ? XAMAN_APP_KEY : FALLBACK_XAMAN_UUID;
        const xaman = new Xumm(credential);

        const openid = await withTimeout(xaman.environment.openid, 4500);
        const jwt = await withTimeout(xaman.environment.jwt, 4500);

        const account =
          typeof openid?.account === "string"
            ? openid.account
            : typeof jwt?.usr === "string"
              ? jwt.usr
              : null;
        const network =
          typeof openid?.networkType === "string"
            ? openid.networkType
            : typeof jwt?.network_type === "string"
              ? jwt.network_type
              : null;

        if (cancelled) {
          return;
        }

        setXamanContext({
          inXaman,
          account,
          network,
          status: account
            ? "Xaman context loaded."
            : "Xaman detected, but no account context returned (check API key setup).",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setXamanContext({
          inXaman,
          account: null,
          network: null,
          status: `Xaman SDK error: ${toErrorMessage(error)}`,
        });
      }
    };

    void detectXamanRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!matrixClient) {
      return;
    }

    const tick = () => refreshMatrixView(matrixClient);
    tick();
    const intervalHandle = window.setInterval(tick, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [matrixClient, refreshMatrixView]);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!jwtToken.trim()) {
        setAuthError("JWT is required.");
        return;
      }

      setAuthError(null);
      setActionError(null);
      setStatusMessage("Logging in with org.matrix.login.jwt...");
      setIsLoggingIn(true);

      stopClient();

      try {
        const baseUrl = normalizeHomeserverUrl(homeserverUrl);
        const loginClient = createClient({ baseUrl });

        const loginResponse = await loginClient.login("org.matrix.login.jwt", {
          token: jwtToken.trim(),
          initial_device_display_name: "Xaman Matrix JWT xApp POC",
          refresh_token: false,
        });

        const authenticatedClient = createClient({
          baseUrl,
          accessToken: loginResponse.access_token,
          userId: loginResponse.user_id,
          deviceId: loginResponse.device_id,
        });

        await authenticatedClient.startClient({
          initialSyncLimit: 25,
          lazyLoadMembers: true,
        });
        await waitForSync(authenticatedClient);

        matrixClientRef.current = authenticatedClient;
        setMatrixClient(authenticatedClient);
        setSessionUserId(loginResponse.user_id);
        setStatusMessage(`Logged in as ${loginResponse.user_id}`);
        refreshMatrixView(authenticatedClient);
      } catch (error) {
        const message = toErrorMessage(error);
        setAuthError(`Login failed: ${message}`);
        setStatusMessage("Login failed.");
        stopClient();
      } finally {
        setIsLoggingIn(false);
      }
    },
    [homeserverUrl, jwtToken, refreshMatrixView, stopClient],
  );

  const handleLogout = useCallback(() => {
    stopClient();
    setStatusMessage("Logged out.");
    setActionError(null);
  }, [stopClient]);

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!matrixClient) {
        setActionError("Log in before joining rooms.");
        return;
      }
      const roomIdOrAlias = joinRoomValue.trim();
      if (!roomIdOrAlias) {
        setActionError("Room ID or alias is required to join.");
        return;
      }

      setActionError(null);
      setStatusMessage(`Joining ${roomIdOrAlias}...`);

      try {
        const joined = await matrixClient.joinRoom(roomIdOrAlias);
        setJoinRoomValue("");
        selectedRoomIdRef.current = joined.roomId;
        setSelectedRoomId(joined.roomId);
        refreshMatrixView(matrixClient);
        setStatusMessage(`Joined ${joined.roomId}`);
      } catch (error) {
        setActionError(`Join failed: ${toErrorMessage(error)}`);
      }
    },
    [joinRoomValue, matrixClient, refreshMatrixView],
  );

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!matrixClient) {
        setActionError("Log in before creating rooms.");
        return;
      }

      const trimmedName = createRoomName.trim();
      const trimmedTopic = createRoomTopic.trim();
      if (!trimmedName) {
        setActionError("Room name is required to create a room.");
        return;
      }

      setActionError(null);
      setStatusMessage(`Creating room "${trimmedName}"...`);

      try {
        const response = await matrixClient.createRoom({
          name: trimmedName,
          topic: trimmedTopic || undefined,
          preset: Preset.PrivateChat,
          visibility: Visibility.Private,
        });
        setCreateRoomName("");
        setCreateRoomTopic("");
        selectedRoomIdRef.current = response.room_id;
        setSelectedRoomId(response.room_id);
        refreshMatrixView(matrixClient);
        setStatusMessage(`Created room ${response.room_id}`);
      } catch (error) {
        setActionError(`Create room failed: ${toErrorMessage(error)}`);
      }
    },
    [createRoomName, createRoomTopic, matrixClient, refreshMatrixView],
  );

  const handleSendMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!matrixClient) {
        setActionError("Log in before sending messages.");
        return;
      }
      if (!selectedRoomId) {
        setActionError("Select a room before sending a message.");
        return;
      }
      const trimmedBody = messageBody.trim();
      if (!trimmedBody) {
        return;
      }

      setActionError(null);

      try {
        await matrixClient.sendTextMessage(selectedRoomId, trimmedBody);
        setMessageBody("");
        refreshMatrixView(matrixClient);
      } catch (error) {
        setActionError(`Send failed: ${toErrorMessage(error)}`);
      }
    },
    [matrixClient, messageBody, refreshMatrixView, selectedRoomId],
  );

  const syncStateText = matrixClient?.getSyncState() ?? "STOPPED";
  const selectedRoomName =
    rooms.find((room) => room.roomId === selectedRoomId)?.name ?? "No room selected";

  return (
    <div className="app">
      <header className="app-header">
        <h1>Matrix JWT xApp POC</h1>
        <p>
          Synapse 1.47.1 compatible login type: <code>org.matrix.login.jwt</code>
        </p>
      </header>

      <section className="card">
        <h2>Xaman runtime</h2>
        <p>
          <strong>Environment:</strong> {xamanContext.inXaman ? "Xaman xApp WebView" : "Regular browser"}
        </p>
        {xamanContext.account && (
          <p>
            <strong>XRPL account:</strong> {xamanContext.account}
          </p>
        )}
        {xamanContext.network && (
          <p>
            <strong>XRPL network:</strong> {xamanContext.network}
          </p>
        )}
        <p className="subtle">{xamanContext.status}</p>
      </section>

      <section className="card">
        <h2>JWT login</h2>
        <form className="stack" onSubmit={handleLogin}>
          <label>
            Homeserver URL (HTTPS)
            <input
              value={homeserverUrl}
              onChange={(event) => setHomeserverUrl(event.target.value)}
              placeholder="https://your-synapse-server.com"
              required
            />
          </label>

          <label>
            JWT token
            <textarea
              value={jwtToken}
              onChange={(event) => setJwtToken(event.target.value)}
              placeholder="Paste a JWT whose 'sub' maps to your Matrix user"
              rows={5}
              required
            />
          </label>

          <div className="jwt-meta">
            {jwtSubClaim ? (
              <span>
                JWT <code>sub</code>: <code>{jwtSubClaim}</code>
              </span>
            ) : jwtToken.trim() ? (
              <span className="warning">JWT payload unreadable or missing required sub claim.</span>
            ) : (
              <span className="subtle">Provide a JWT with a valid sub claim for Synapse JWT auth.</span>
            )}
          </div>

          <div className="actions-row">
            <button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Login with JWT"}
            </button>
            <button type="button" className="secondary" onClick={handleLogout} disabled={!matrixClient}>
              Logout
            </button>
          </div>
        </form>

        {sessionUserId && (
          <p>
            <strong>Logged in user:</strong> {sessionUserId}
          </p>
        )}
        <p>
          <strong>Sync state:</strong> {syncStateText}
        </p>
        <p className="subtle">{statusMessage}</p>
        {authError && <p className="error">{authError}</p>}
      </section>

      {matrixClient && (
        <section className="workspace">
          <aside className="rooms-panel">
            <h2>Rooms</h2>

            <form className="stack" onSubmit={handleJoinRoom}>
              <label>
                Join room (ID or alias)
                <input
                  value={joinRoomValue}
                  onChange={(event) => setJoinRoomValue(event.target.value)}
                  placeholder="!roomId:server or #alias:server"
                />
              </label>
              <button type="submit">Join</button>
            </form>

            <form className="stack" onSubmit={handleCreateRoom}>
              <label>
                Create room name
                <input
                  value={createRoomName}
                  onChange={(event) => setCreateRoomName(event.target.value)}
                  placeholder="My POC Room"
                />
              </label>
              <label>
                Topic (optional)
                <input
                  value={createRoomTopic}
                  onChange={(event) => setCreateRoomTopic(event.target.value)}
                  placeholder="Room topic"
                />
              </label>
              <button type="submit">Create room</button>
            </form>

            <ul className="room-list">
              {rooms.map((room) => (
                <li key={room.roomId}>
                  <button
                    type="button"
                    className={room.roomId === selectedRoomId ? "room-item active" : "room-item"}
                    onClick={() => {
                      selectedRoomIdRef.current = room.roomId;
                      setSelectedRoomId(room.roomId);
                      refreshMatrixView(matrixClient);
                    }}
                  >
                    <span className="room-name">{room.name}</span>
                    <span className="room-meta">{room.alias ?? room.roomId}</span>
                    <span className="room-meta">
                      {room.memberCount} members | {room.unreadCount} unread
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="timeline-panel">
            <h2>{selectedRoomName}</h2>

            <div className="timeline">
              {timeline.length === 0 ? (
                <p className="subtle">No text messages yet.</p>
              ) : (
                timeline.map((message) => (
                  <article className="timeline-message" key={message.eventId}>
                    <div className="timeline-head">
                      <span>{message.sender}</span>
                      <span>{new Date(message.timestamp).toLocaleString()}</span>
                    </div>
                    <p>{message.body}</p>
                    <small>{message.msgType}</small>
                  </article>
                ))
              )}
            </div>

            <form className="send-form" onSubmit={handleSendMessage}>
              <input
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder={selectedRoomId ? "Type a message..." : "Select a room first"}
                disabled={!selectedRoomId}
              />
              <button type="submit" disabled={!selectedRoomId}>
                Send
              </button>
            </form>
            {actionError && <p className="error">{actionError}</p>}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
