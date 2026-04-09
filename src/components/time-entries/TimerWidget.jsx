import React, { useEffect, useState } from 'react';
import { useTimer } from '../../hooks/useTimer';

function fmt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');
}

export default function TimerWidget() {
  const { isRunning, elapsedSec, start, stop, pause, resume } = useTimer();
  return (
    <div className="flex items-center gap-2">
      <div className="font-mono tabular-nums">{fmt(elapsedSec)}</div>
      {!isRunning && <button className="px-2 py-1 border rounded" onClick={start}>Start</button>}
      {isRunning && <>
        <button className="px-2 py-1 border rounded" onClick={pause}>Pause</button>
        <button className="px-2 py-1 border rounded" onClick={resume}>Resume</button>
        <button className="px-2 py-1 border rounded" onClick={stop}>Stop</button>
      </>}
    </div>
  );
}
