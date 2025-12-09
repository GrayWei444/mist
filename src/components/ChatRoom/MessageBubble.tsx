import { useState, useRef, useEffect } from 'react';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  onBurn: () => void;
}

export function MessageBubble({ message, onBurn }: MessageBubbleProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [ttlRemaining, setTtlRemaining] = useState<number | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const ttlTimer = useRef<NodeJS.Timeout | null>(null);
  const isMine = message.senderId === 'me';

  // If message is burned, don't render anything
  if (message.isBurned) {
    return null;
  }

  // TTL countdown effect
  useEffect(() => {
    if (isRevealed && message.ttl && ttlRemaining === null) {
      // Start TTL countdown when first revealed
      setTtlRemaining(message.ttl);
    }
  }, [isRevealed, message.ttl, ttlRemaining]);

  useEffect(() => {
    if (ttlRemaining !== null && ttlRemaining > 0) {
      ttlTimer.current = setTimeout(() => {
        setTtlRemaining(ttlRemaining - 1);
      }, 1000);
      return () => {
        if (ttlTimer.current) clearTimeout(ttlTimer.current);
      };
    } else if (ttlRemaining === 0) {
      // Auto-burn when TTL reaches 0
      onBurn();
    }
  }, [ttlRemaining, onBurn]);

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => {
      setIsRevealed(true);
    }, 300);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    // Only hide if TTL hasn't started (no countdown)
    if (ttlRemaining === null) {
      setIsRevealed(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const isImage = message.type === 'image';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="max-w-[70%]">
        <div
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          className={`
            relative rounded-2xl cursor-pointer select-none
            transition-all duration-200 overflow-hidden
            ${isImage ? 'p-1' : 'px-4 py-2'}
            ${isMine
              ? 'bg-mist-500 text-white rounded-br-md'
              : 'bg-dark-card text-white rounded-bl-md'
            }
          `}
        >
          {/* Blur overlay - hidden when revealed */}
          <div
            className={`
              absolute inset-0 rounded-2xl backdrop-blur-md bg-dark-700/50 z-10
              transition-opacity duration-200
              ${isRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'}
              ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}
            `}
          >
            <div className="w-full h-full flex items-center justify-center text-dark-300 text-sm min-h-[60px]">
              {isImage ? '📷 長按查看圖片' : '長按查看'}
            </div>
          </div>

          {/* Actual message content */}
          {isImage ? (
            <img
              src={message.content}
              alt="圖片訊息"
              className={`rounded-xl max-w-full transition-opacity duration-200 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}
              style={{ maxHeight: '300px' }}
            />
          ) : (
            <span className={`transition-opacity duration-200 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
              {message.content}
            </span>
          )}

          {/* TTL indicator */}
          {message.ttl && (
            <div className={`absolute -top-1 -right-1 text-white text-xs px-1.5 py-0.5 rounded-full z-20 ${
              ttlRemaining !== null && ttlRemaining <= 3 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
            }`}>
              {ttlRemaining !== null ? `${ttlRemaining}s` : `${message.ttl}s`}
            </div>
          )}
        </div>

        {/* Message info row */}
        <div className={`flex items-center gap-2 mt-1 text-xs text-dark-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span>{formatTime(message.timestamp)}</span>
          {isMine && message.isRead && <span>已讀</span>}
          {/* Burn button - only for received messages */}
          {!isMine && (
            <button
              onClick={onBurn}
              className="hover:text-orange-400 transition-colors"
              title="銷毀訊息"
            >
              🔥
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
