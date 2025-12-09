import { useState, useEffect } from 'react';

interface WeatherWidgetProps {
  onSecretEntry: () => void;
}

export function WeatherWidget({ onSecretEntry }: WeatherWidgetProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [pressProgress, setPressProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePressStart = () => {
    setPressProgress(0);
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 2000) * 100, 100);
      setPressProgress(progress);

      if (elapsed >= 2000) {
        clearInterval(timer);
        setPressTimer(null);
        onSecretEntry();
      }
    }, 50);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearInterval(pressTimer);
      setPressTimer(null);
    }
    setPressProgress(0);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-TW', {
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 to-sky-600 flex flex-col items-center justify-center p-6 select-none">
      {/* Weather Icon - Long press target */}
      <div
        className="relative cursor-pointer"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        <div className="text-9xl mb-4 transition-transform hover:scale-105">
          ☀️
        </div>
        {/* Progress ring */}
        {pressProgress > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-32 h-32 -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="white"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 58}`}
                strokeDashoffset={`${2 * Math.PI * 58 * (1 - pressProgress / 100)}`}
                className="transition-all duration-100"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Temperature */}
      <div className="text-white text-7xl font-light mb-2">
        24°
      </div>

      {/* Weather description */}
      <div className="text-white/90 text-xl mb-8">
        晴朗
      </div>

      {/* Time */}
      <div className="text-white text-5xl font-light mb-2">
        {formatTime(currentTime)}
      </div>

      {/* Date */}
      <div className="text-white/80 text-lg">
        {formatDate(currentTime)}
      </div>

      {/* Location */}
      <div className="mt-8 text-white/70 text-sm flex items-center gap-2">
        <span>📍</span>
        <span>台北市</span>
      </div>

      {/* Subtle hint - only visible on close inspection */}
      <div className="absolute bottom-4 text-white/20 text-xs">
        長按太陽進入
      </div>
    </div>
  );
}
