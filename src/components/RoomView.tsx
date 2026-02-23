import React, { useEffect, useState, useCallback } from 'react';
import { MessageTimeline } from './MessageTimeline';
import { SendMessage } from './SendMessage';
import type { MatrixMessage } from '../types';
import {
  getTimelineMessages,
  sendMessage,
  loadMoreMessages,
  onRoomTimeline,
  getClient,
} from '../services/matrixClient';

interface RoomViewProps {
  roomId: string;
  userId: string | null;
  onBack: () => void;
}

export function RoomView({ roomId, userId, onBack }: RoomViewProps) {
  const [messages, setMessages] = useState<MatrixMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomName = getClient()?.getRoom(roomId)?.name || roomId;

  const refreshMessages = useCallback(() => {
    const msgs = getTimelineMessages(roomId);
    setMessages(msgs);
  }, [roomId]);

  useEffect(() => {
    refreshMessages();
    const unsubscribe = onRoomTimeline(() => {
      refreshMessages();
    });
    return unsubscribe;
  }, [roomId, refreshMessages]);

  const handleSend = async (body: string) => {
    setSending(true);
    setError(null);
    try {
      await sendMessage(roomId, body);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const msgs = await loadMoreMessages(roomId);
      setMessages(msgs);
    } catch {
      // Pagination end or error -- ignore silently
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="room-view">
      <div className="room-view-header">
        <button className="btn btn-icon btn-back" onClick={onBack}>
          &#8592;
        </button>
        <div className="room-view-title">
          <h3>{roomName}</h3>
        </div>
      </div>

      {error && (
        <div className="error-banner error-inline">
          {error}
          <button className="btn-dismiss" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <MessageTimeline
        messages={messages}
        currentUserId={userId}
        onLoadMore={handleLoadMore}
        loading={loadingMore}
      />

      <SendMessage onSend={handleSend} disabled={sending} />
    </div>
  );
}
