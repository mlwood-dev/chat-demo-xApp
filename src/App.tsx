import React, { useEffect, useState, useCallback } from 'react';
import { Login } from './components/Login';
import { RoomList } from './components/RoomList';
import { RoomView } from './components/RoomView';
import {
  loginWithJwt,
  restoreSession,
  getRooms,
  joinRoom,
  createRoom,
  logout as matrixLogout,
  onRoomTimeline,
  setHomeserverUrl,
} from './services/matrixClient';
import { initXaman } from './services/xamanSdk';
import type { AppView, MatrixRoom, XamanUserInfo } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [userId, setUserId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [xamanInfo, setXamanInfo] = useState<XamanUserInfo>({ isXaman: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRooms = useCallback(() => {
    setRooms(getRooms());
  }, []);

  useEffect(() => {
    const init = async () => {
      const xInfo = await initXaman();
      setXamanInfo(xInfo);

      const existingUser = await restoreSession();
      if (existingUser) {
        setUserId(existingUser);
        setView('rooms');
        refreshRooms();
      }
      setLoading(false);
    };
    init();
  }, [refreshRooms]);

  useEffect(() => {
    if (view !== 'login') {
      const unsubscribe = onRoomTimeline(() => {
        refreshRooms();
      });
      return unsubscribe;
    }
  }, [view, refreshRooms]);

  const handleLogin = async (jwt: string, homeserverUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      setHomeserverUrl(homeserverUrl);
      const result = await loginWithJwt(jwt, homeserverUrl);
      setUserId(result.userId);
      setView('rooms');
      refreshRooms();
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || 'Login failed';
      setError(`Login error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setView('room');
  };

  const handleBack = () => {
    setSelectedRoomId(null);
    setView('rooms');
    refreshRooms();
  };

  const handleJoinRoom = async (roomIdOrAlias: string) => {
    setError(null);
    try {
      await joinRoom(roomIdOrAlias);
      refreshRooms();
    } catch (err: any) {
      setError(`Failed to join room: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleCreateRoom = async (name: string, topic?: string) => {
    setError(null);
    try {
      await createRoom(name, topic);
      refreshRooms();
    } catch (err: any) {
      setError(`Failed to create room: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleLogout = () => {
    matrixLogout();
    setUserId(null);
    setRooms([]);
    setSelectedRoomId(null);
    setError(null);
    setView('login');
  };

  if (loading && view === 'login') {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {view === 'login' && (
        <Login
          onLogin={handleLogin}
          loading={loading}
          error={error}
          xamanInfo={xamanInfo}
        />
      )}

      {view === 'rooms' && (
        <RoomList
          rooms={rooms}
          userId={userId}
          onSelectRoom={handleSelectRoom}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          onLogout={handleLogout}
          xrplAddress={xamanInfo.address}
        />
      )}

      {view === 'room' && selectedRoomId && (
        <RoomView
          roomId={selectedRoomId}
          userId={userId}
          onBack={handleBack}
        />
      )}

      {view !== 'login' && error && (
        <div className="toast-error">
          <span>{error}</span>
          <button className="btn-dismiss" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
    </div>
  );
}
