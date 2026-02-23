import React, { useState, useRef } from 'react';

interface SendMessageProps {
  onSend: (body: string) => void;
  disabled: boolean;
}

export function SendMessage({ onSend, disabled }: SendMessageProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="send-message-form" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
        className="message-input"
      />
      <button
        type="submit"
        className="btn btn-send"
        disabled={disabled || !text.trim()}
        title="Send"
      >
        &#10148;
      </button>
    </form>
  );
}
