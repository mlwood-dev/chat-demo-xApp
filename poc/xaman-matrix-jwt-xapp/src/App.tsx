import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { createAuthedClient, isHttpsUrl, loginWithJwt, type MatrixSession } from './lib/matrix';
import { safeJsonParse, safeJsonStringify } from './lib/storage';
import { createXamanSdk, getXamanContext, pickXrplAddress } from './lib/xaman';

const DEFAULT_HOMESERVER_URL = 'https://your-synapse-server.com';
const STORAGE_SESSION_KEY = 'matrix_jwt_xapp_poc_session';
const STORAGE_XRPL_KEY = 'matrix_jwt_xapp_poc_xrpl_address';

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function roomDisplayName(room: Room): string {
  const name = room.name?.trim();
  if (name) return name;
  const canonical = room.getCanonicalAlias?.();
  if (canonical) return canonical;
  return room.roomId;
}

function isTextEvent(ev: MatrixEvent): boolean {
  if (ev.getType() !== 'm.room.message') return false;
  const content = ev.getContent();
  return content?.msgtype === 'm.text' && typeof content?.body === 'string';
}

export default function App() {
  const xamanSdk = useMemo(() => createXamanSdk(), []);
  const xamanCtx = useMemo(() => getXamanContext(xamanSdk), [xamanSdk]);

  const [xrplAddress, setXrplAddress] = useState<string | undefined>(() => {
    return localStorage.getItem(STORAGE_XRPL_KEY) ?? undefined;
  });
  const [xamanError, setXamanError] = useState<string | undefined>(undefined);

  const [homeserverUrl, setHomeserverUrl] = useState<string>(() => {
    const session = safeJsonParse<MatrixSession>(localStorage.getItem(STORAGE_SESSION_KEY));
    return session?.homeserverUrl ?? DEFAULT_HOMESERVER_URL;
  });
  const [jwt, setJwt] = useState<string>('');

  const [session, setSession] = useState<MatrixSession | undefined>(() =>
    safeJsonParse<MatrixSession>(localStorage.getItem(STORAGE_SESSION_KEY)),
  );
  const [client, setClient] = useState<MatrixClient | undefined>(undefined);
  const [syncState, setSyncState] = useState<string>('IDLE');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<MatrixEvent[]>([]);

  const [joinInput, setJoinInput] = useState('');
  const [createInput, setCreateInput] = useState('');
  const [composer, setComposer] = useState('');

  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Notify Xaman host that UI is ready (best effort).
  useEffect(() => {
    if (!xamanCtx.isXaman) return;
    xamanSdk.ready().catch(() => undefined);
  }, [xamanCtx.isXaman, xamanSdk]);

  // (Re)create Matrix client when we have a session.
  useEffect(() => {
    if (!session) {
      setClient(undefined);
      setSyncState('IDLE');
      setRooms([]);
      setActiveRoomId(undefined);
      setEvents([]);
      return;
    }

    const c = createAuthedClient(session);
    setClient(c);

    const onSync = (state: string) => setSyncState(state);
    c.on('sync', onSync);

    c.startClient({ initialSyncLimit: 20 });

    return () => {
      c.removeListener('sync', onSync);
      c.stopClient();
    };
  }, [session]);

  // Track rooms list.
  useEffect(() => {
    if (!client) return;

    const updateRooms = () => {
      const next = [...client.getRooms()].sort((a, b) =>
        roomDisplayName(a).localeCompare(roomDisplayName(b)),
      );
      setRooms(next);

      setActiveRoomId((cur) => {
        if (cur && next.some((r) => r.roomId === cur)) return cur;
        return next[0]?.roomId;
      });
    };

    const onRoom = () => updateRooms();
    const onRoomName = () => updateRooms();
    const onRoomMyMembership = () => updateRooms();

    client.on('Room', onRoom);
    client.on('Room.name', onRoomName);
    client.on('Room.myMembership', onRoomMyMembership);

    updateRooms();
    return () => {
      client.removeListener('Room', onRoom);
      client.removeListener('Room.name', onRoomName);
      client.removeListener('Room.myMembership', onRoomMyMembership);
    };
  }, [client]);

  // Track timeline for active room.
  useEffect(() => {
    if (!client || !activeRoomId) {
      setEvents([]);
      return;
    }

    const room = client.getRoom(activeRoomId);
    if (!room) {
      setEvents([]);
      return;
    }

    const update = () => {
      const evs = room.getLiveTimeline().getEvents();
      setEvents(evs.filter(isTextEvent));
    };

    const onTimeline = (ev: MatrixEvent, r: Room | undefined) => {
      if (!r || r.roomId !== activeRoomId) return;
      if (!isTextEvent(ev)) return;
      update();
    };

    client.on('Room.timeline', onTimeline);
    update();
    return () => {
      client.removeListener('Room.timeline', onTimeline);
    };
  }, [client, activeRoomId]);

  // Auto-scroll timeline on new events.
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [events.length, activeRoomId]);

  const activeRoom = useMemo(() => {
    if (!client || !activeRoomId) return undefined;
    return client.getRoom(activeRoomId);
  }, [client, activeRoomId]);

  const login = async () => {
    setError(undefined);

    if (!isHttpsUrl(homeserverUrl)) {
      setError('Homeserver URL must be a valid https:// URL.');
      return;
    }
    if (!jwt.trim()) {
      setError('Please paste a JWT.');
      return;
    }

    setBusy('Logging in…');
    try {
      const next = await loginWithJwt(homeserverUrl, jwt);
      const serialized = safeJsonStringify(next);
      if (serialized) localStorage.setItem(STORAGE_SESSION_KEY, serialized);
      setSession(next);
      setJwt('');
    } catch (e) {
      setError(`Login failed.\n${toErrorMessage(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const logout = async () => {
    setError(undefined);
    setBusy('Logging out…');
    try {
      client?.stopClient();
    } finally {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      setSession(undefined);
      setBusy(undefined);
    }
  };

  const joinRoom = async () => {
    if (!client) return;
    setError(undefined);
    const target = joinInput.trim();
    if (!target) {
      setError('Enter a room ID or alias to join.');
      return;
    }
    setBusy('Joining room…');
    try {
      const roomId = await client.joinRoom(target);
      setJoinInput('');
      setActiveRoomId(roomId);
    } catch (e) {
      setError(`Join failed.\n${toErrorMessage(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const createRoom = async () => {
    if (!client) return;
    setError(undefined);
    const name = createInput.trim();
    if (!name) {
      setError('Enter a room name to create.');
      return;
    }
    setBusy('Creating room…');
    try {
      const res = await client.createRoom({
        name,
        preset: 'private_chat',
        visibility: 'private',
      });
      setCreateInput('');
      setActiveRoomId(res.room_id);
    } catch (e) {
      setError(`Create room failed.\n${toErrorMessage(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const sendMessage = async () => {
    if (!client || !activeRoomId) return;
    setError(undefined);
    const body = composer.trim();
    if (!body) return;
    setBusy('Sending…');
    try {
      await client.sendTextMessage(activeRoomId, body);
      setComposer('');
    } catch (e) {
      setError(`Send failed.\n${toErrorMessage(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  const pickAddress = async () => {
    setXamanError(undefined);
    setBusy('Requesting address…');
    try {
      const addr = await pickXrplAddress(xamanSdk);
      setXrplAddress(addr);
      localStorage.setItem(STORAGE_XRPL_KEY, addr);
    } catch (e) {
      setXamanError(toErrorMessage(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="title">
          <img alt="App icon" src="/icon.svg" />
          <h1>Matrix xApp JWT POC</h1>
        </div>
        <div className="badges">
          <div className="badge">
            <strong>Sync</strong> <span>{syncState}</span>
          </div>
          <div className="badge">
            <strong>Env</strong>{' '}
            <span>{xamanCtx.isXaman ? `Xaman xApp (v${xamanCtx.environment.version})` : 'Browser'}</span>
          </div>
          {xrplAddress && (
            <div className="badge">
              <strong>XRPL</strong> <span style={{ fontFamily: 'var(--mono)' }}>{xrplAddress}</span>
            </div>
          )}
          {session?.userId && (
            <div className="badge">
              <strong>User</strong> <span style={{ fontFamily: 'var(--mono)' }}>{session.userId}</span>
            </div>
          )}
        </div>
      </div>

      <div className="layout">
        <div className="panel">
          <div className="panelHeader">
            <h2>{session ? 'Rooms' : 'Login'}</h2>
            {session ? (
              <button className="btn btnDanger" onClick={logout} disabled={!!busy}>
                Logout
              </button>
            ) : null}
          </div>
          <div className="panelBody">
            {!session ? (
              <>
                <div className="row">
                  <label>Homeserver URL (Synapse)</label>
                  <input
                    value={homeserverUrl}
                    onChange={(e) => setHomeserverUrl(e.target.value)}
                    placeholder="https://your-synapse-server.com"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="row">
                  <label>JWT (legacy login type: org.matrix.login.jwt)</label>
                  <input
                    value={jwt}
                    onChange={(e) => setJwt(e.target.value)}
                    placeholder="Paste JWT here"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div className="actions">
                  <button className="btn btnPrimary" onClick={login} disabled={!!busy}>
                    {busy ?? 'Login'}
                  </button>
                  {xamanCtx.isXaman ? (
                    <button className="btn" onClick={pickAddress} disabled={!!busy}>
                      Pick XRPL address (optional)
                    </button>
                  ) : null}
                </div>

                <p className="hint" style={{ marginTop: 12 }}>
                  This POC assumes your Synapse is configured for JWT auth and that the token’s{' '}
                  <code style={{ fontFamily: 'var(--mono)' }}>sub</code> claim maps to the Matrix
                  user ID.
                </p>
                {xamanError ? <div className="error">{xamanError}</div> : null}
                {error ? <div className="error">{error}</div> : null}
              </>
            ) : (
              <>
                <div className="row">
                  <label>Join room (ID or alias)</label>
                  <input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="!roomid:server.tld or #alias:server.tld"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <div className="actions">
                    <button className="btn" onClick={joinRoom} disabled={!!busy}>
                      {busy === 'Joining room…' ? busy : 'Join'}
                    </button>
                  </div>
                </div>
                <div className="row">
                  <label>Create room</label>
                  <input
                    value={createInput}
                    onChange={(e) => setCreateInput(e.target.value)}
                    placeholder="Room name"
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    spellCheck
                  />
                  <div className="actions">
                    <button className="btn" onClick={createRoom} disabled={!!busy}>
                      {busy === 'Creating room…' ? busy : 'Create'}
                    </button>
                  </div>
                </div>

                {xamanCtx.isXaman ? (
                  <div className="actions" style={{ marginBottom: 12 }}>
                    <button className="btn" onClick={pickAddress} disabled={!!busy}>
                      Pick XRPL address (optional)
                    </button>
                  </div>
                ) : null}

                <div className="rooms">
                  {rooms.length === 0 ? (
                    <div className="hint">No rooms yet. Create one or join by ID/alias.</div>
                  ) : null}
                  {rooms.map((r) => {
                    const active = r.roomId === activeRoomId;
                    return (
                      <button
                        key={r.roomId}
                        className={`roomBtn ${active ? 'roomBtnActive' : ''}`}
                        onClick={() => setActiveRoomId(r.roomId)}
                        disabled={!!busy}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div className="roomName">{roomDisplayName(r)}</div>
                          <div className="roomMeta">{r.roomId}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {xamanError ? <div className="error" style={{ marginTop: 12 }}>{xamanError}</div> : null}
                {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h2>{activeRoom ? roomDisplayName(activeRoom) : 'Timeline'}</h2>
            {session && activeRoom ? (
              <div className="hint" style={{ margin: 0 }}>
                {busy ? busy : ''}
              </div>
            ) : null}
          </div>
          <div className="panelBody">
            {!session ? (
              <div className="hint">
                Login first, then you can view timelines and send messages.
              </div>
            ) : !activeRoom ? (
              <div className="hint">No active room selected.</div>
            ) : (
              <>
                <div ref={timelineRef} className="timeline">
                  {events.length === 0 ? (
                    <div className="hint">No messages yet.</div>
                  ) : null}
                  {events.map((ev) => {
                    const content = ev.getContent() as { body?: string } | undefined;
                    const body = content?.body ?? '';
                    const ts = ev.getTs();
                    return (
                      <div key={ev.getId() ?? `${ev.getSender()}-${ts}`} className="event">
                        <div className="eventHeader">
                          <div className="sender">{ev.getSender() ?? 'unknown'}</div>
                          <div className="ts">{new Date(ts).toLocaleString()}</div>
                        </div>
                        <div className="body">{body}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="composer">
                  <input
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Type a message…"
                    disabled={!!busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendMessage();
                    }}
                  />
                  <button className="btn btnPrimary" onClick={sendMessage} disabled={!!busy}>
                    Send
                  </button>
                </div>

                {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

