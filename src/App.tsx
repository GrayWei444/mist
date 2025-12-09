import { useState, useEffect, useCallback } from 'react';
import { WeatherApp } from './pages/WeatherApp';
import { ChatApp } from './pages/ChatApp';
import { useChatStore } from './stores/chatStore';

const INACTIVITY_TIMEOUT = 30000; // 30 seconds of inactivity

function App() {
  const [isDisguiseMode, setIsDisguiseMode] = useState(true);
  const resetAll = useChatStore(state => state.resetAll);

  const exitToDisguise = useCallback(() => {
    setIsDisguiseMode(true);
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
    setIsDisguiseMode(false);
  };

  const exitChat = () => {
    setIsDisguiseMode(true);
  };

  if (isDisguiseMode) {
    return <WeatherApp onEnterChat={enterChat} />;
  }

  return <ChatApp onBackToDisguise={exitChat} />;
}

export default App;
