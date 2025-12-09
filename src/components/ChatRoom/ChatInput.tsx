import { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-dark-card border-t border-dark-border">
      {/* Attachment button */}
      <button className="p-2 hover:bg-dark-700 rounded-full transition-colors text-dark-300">
        📎
      </button>

      {/* Input field */}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="輸入訊息..."
        className="flex-1 bg-dark-700 text-white placeholder-dark-400 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-mist-500/50"
      />

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!message.trim()}
        className={`
          p-2 rounded-full transition-all
          ${message.trim()
            ? 'bg-mist-500 hover:bg-mist-600 text-white'
            : 'bg-dark-700 text-dark-400'
          }
        `}
      >
        ➤
      </button>
    </div>
  );
}
