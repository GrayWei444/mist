import { useState, useEffect, useCallback } from 'react';
import { WeatherApp } from './pages/WeatherApp';
import { ChatApp } from './pages/ChatApp';
import { DevToolsPage } from './pages/DevToolsPage';
import { useChatStore } from './stores/chatStore';

const INACTIVITY_TIMEOUT = 30000; // 30 seconds of inactivity

type AppMode = 'disguise' | 'chat' | 'devtools';

function App() {
  const [mode, setMode] = useState<AppMode>('disguise');
  const resetAll = useChatStore(state => state.resetAll);

  // 向後兼容的 state
  const isDisguiseMode = mode === 'disguise';

  const exitToDisguise = useCallback(() => {
    setMode('disguise');
  }, []);

  // Inactivity timer - only active when in chat mode
  useEffect(() => {
    if (isDisguiseMode) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        exitToDisguise();
      }, INACTIVITY_TIMEOUT);
    };

    // Events that reset the inactivity timer
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Start the initial timer
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isDisguiseMode, exitToDisguise]);

  const enterChat = () => {
    // Reset all data when entering chat
    resetAll();
    setMode('chat');
  };

  const exitChat = () => {
    setMode('disguise');
  };

  const enterDevTools = () => {
    setMode('devtools');
  };

  // 從 DevTools 直接進入聊天（不重置數據，保留機器人）
  const enterChatFromDevTools = useCallback(() => {
    setMode('chat');
  }, []);

  // 根據模式渲染不同頁面
  switch (mode) {
    case 'devtools':
      return <DevToolsPage onBack={exitToDisguise} onEnterChat={enterChatFromDevTools} />;
    case 'chat':
      return <ChatApp onBackToDisguise={exitChat} />;
    case 'disguise':
    default:
      return <WeatherApp onEnterChat={enterChat} onEnterDevTools={enterDevTools} />;
  }
}

export default App;
