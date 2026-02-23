import React, { useState } from 'react';
import type { MatrixRoom } from '../types';

interface RoomListProps {
  rooms: MatrixRoom[];
  userId: string | null;
  onSelectRoom: (roomId: string) => void;
  onJoinRoom: (roomIdOrAlias: string) => void;
  onCreateRoom: (name: string, topic?: string) => void;
  onLogout: () => void;
  xrplAddress?: string;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export function RoomList({
  rooms,
  userId,
  onSelectRoom,
  onJoinRoom,
  onCreateRoom,
  onLogout,
  xrplAddress,
}: RoomListProps) {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [createName, setCreateName] = useState('');
  const [createTopic, setCreateTopic] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    onJoinRoom(joinInput.trim());
    setJoinInput('');
    setShowJoinDialog(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    onCreateRoom(createName.trim(), createTopic.trim() || undefined);
    setCreateName('');
    setCreateTopic('');
    setShowCreateDialog(false);
  };

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <div className="header-top">
          <h2>Rooms</h2>
          <button className="btn btn-icon" onClick={onLogout} title="Logout">
            &times;
          </button>
        </div>
        <div className="user-info">
          <span className="user-id">{userId}</span>
          {xrplAddress && (
            <span className="xrpl-badge" title={xrplAddress}>
              XRPL: {truncate(xrplAddress, 12)}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn btn-small"
            onClick={() => { setShowJoinDialog(!showJoinDialog); setShowCreateDialog(false); }}
          >
            Join Room
          </button>
          <button
            className="btn btn-small"
            onClick={() => { setShowCreateDialog(!showCreateDialog); setShowJoinDialog(false); }}
          >
            Create Room
          </button>
        </div>
      </div>

      {showJoinDialog && (
        <form onSubmit={handleJoin} className="inline-dialog">
          <input
            type="text"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="#room:server.com or !roomId:server.com"
            autoFocus
          />
          <div className="dialog-actions">
            <button type="submit" className="btn btn-small btn-primary" disabled={!joinInput.trim()}>
              Join
            </button>
            <button type="button" className="btn btn-small" onClick={() => setShowJoinDialog(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {showCreateDialog && (
        <form onSubmit={handleCreate} className="inline-dialog">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Room name"
            autoFocus
          />
          <input
            type="text"
            value={createTopic}
            onChange={(e) => setCreateTopic(e.target.value)}
            placeholder="Topic (optional)"
          />
          <div className="dialog-actions">
            <button type="submit" className="btn btn-small btn-primary" disabled={!createName.trim()}>
              Create
            </button>
            <button type="button" className="btn btn-small" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="room-items">
        {rooms.length === 0 && (
          <div className="empty-state">
            <p>No rooms yet</p>
            <p className="empty-hint">Join or create a room to get started</p>
          </div>
        )}
        {rooms.map((room) => (
          <button
            key={room.roomId}
            className="room-item"
            onClick={() => onSelectRoom(room.roomId)}
          >
            <div className="room-avatar">
              {(room.name || '?')[0].toUpperCase()}
            </div>
            <div className="room-details">
              <div className="room-name-row">
                <span className="room-name">{room.name}</span>
                <span className="room-time">{formatTimestamp(room.lastMessageTimestamp)}</span>
              </div>
              {room.lastMessage && (
                <span className="room-preview">{truncate(room.lastMessage, 50)}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
