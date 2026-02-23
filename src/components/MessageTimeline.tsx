import React, { useEffect, useRef } from 'react';
import type { MatrixMessage } from '../types';

interface MessageTimelineProps {
  messages: MatrixMessage[];
  currentUserId: string | null;
  onLoadMore: () => void;
  loading: boolean;
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractLocalpart(userId: string): string {
  const match = userId.match(/^@([^:]+):/);
  return match ? match[1] : userId;
}

export function MessageTimeline({
  messages,
  currentUserId,
  onLoadMore,
  loading,
}: MessageTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const handleScroll = () => {
    if (!containerRef.current || loading) return;
    if (containerRef.current.scrollTop === 0) {
      onLoadMore();
    }
  };

  let lastSender = '';
  let lastDate = '';

  return (
    <div
      className="message-timeline"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {loading && (
        <div className="timeline-loader">Loading older messages...</div>
      )}
      {messages.length === 0 && !loading && (
        <div className="empty-state timeline-empty">
          <p>No messages yet</p>
          <p className="empty-hint">Send a message to start the conversation</p>
        </div>
      )}
      {messages.map((msg) => {
        const isOwn = msg.sender === currentUserId;
        const showSender = msg.sender !== lastSender;
        const msgDate = new Date(msg.timestamp).toLocaleDateString();
        const showDateSep = msgDate !== lastDate;

        lastSender = msg.sender;
        lastDate = msgDate;

        return (
          <React.Fragment key={msg.eventId}>
            {showDateSep && (
              <div className="date-separator">
                <span>{msgDate}</span>
              </div>
            )}
            <div className={`message ${isOwn ? 'message-own' : 'message-other'}`}>
              {showSender && !isOwn && (
                <span className="message-sender">
                  {extractLocalpart(msg.sender)}
                </span>
              )}
              <div className="message-bubble">
                <span className="message-body">{msg.body}</span>
                <span className="message-time">{formatMessageTime(msg.timestamp)}</span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
