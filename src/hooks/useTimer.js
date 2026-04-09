import { useEffect, useRef, useState } from 'react';

export function useTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('timeEntries.timer') || 'null');
    if (saved?.isRunning) {
      const delta = Math.floor((Date.now() - saved.startedAt) / 1000);
      setElapsedSec(saved.elapsedSec + delta);
      setIsRunning(true);
      startTicker();
    } else if (saved) {
      setElapsedSec(saved.elapsedSec);
      setIsRunning(false);
    }
    return stopTicker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next) {
    localStorage.setItem('timeEntries.timer', JSON.stringify(next));
  }

  function startTicker() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
  }
  function stopTicker() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function start() {
    setIsRunning(true);
    startTicker();
    persist({ isRunning: true, startedAt: Date.now(), elapsedSec: 0 });
  }
  function pause() {
    setIsRunning(false);
    stopTicker();
    persist({ isRunning: false, startedAt: null, elapsedSec });
  }
  function resume() {
    setIsRunning(true);
    startTicker();
    persist({ isRunning: true, startedAt: Date.now(), elapsedSec });
  }
  function stop() {
    setIsRunning(false);
    stopTicker();
    persist({ isRunning: false, startedAt: null, elapsedSec: 0 });
    setElapsedSec(0);
  }

  return { isRunning, elapsedSec, start, pause, resume, stop };
}
