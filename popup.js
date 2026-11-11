// Popup: shows the timer and sends commands to the background worker.
// The popup closes whenever the user clicks away, so it re-reads state from
// chrome.storage every time it opens and just counts down to `endTime`.

const FOCUS_MINUTES = 25; 
// only used for the idle display; keep in sync with background.js

const els = {
  time: document.getElementById('time'),
  mode: document.getElementById('mode-label'),
  points: document.getElementById('points'),
  start: document.getElementById('start'),
  stop: document.getElementById('stop'),
  fill: document.getElementById('bar-fill'),
  skip: document.getElementById('skip')
};

let timer = { mode: 'idle', endTime: null, durationMs: 0 };

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function render() {
  const running = timer.mode !== 'idle' && timer.endTime;
  document.body.classList.toggle('break', timer.mode === 'break');

  if (!running) {
    els.time.textContent = formatTime(FOCUS_MINUTES * 60 * 1000);
    els.mode.textContent = 'Ready to focus';
    els.fill.style.width = '0%';
    els.start.hidden = false;
    els.stop.hidden = true;
    els.skip.hidden = true;
    return;
  }

  const remaining = timer.endTime - Date.now();
  const elapsed = timer.durationMs - remaining;
  els.time.textContent = formatTime(remaining);
  els.mode.textContent = timer.mode === 'focus' ? 'Focus time' : 'Break time';
  els.fill.style.width = `${Math.min(100, (elapsed / timer.durationMs) * 100)}%`;
  els.start.hidden = true;
  els.stop.hidden = false;
  els.skip.hidden = timer.mode !== 'break';
}

async function loadState() {
  const data = await chrome.storage.local.get(['timer', 'brainPoints']);
  timer = data.timer ?? timer;
  els.points.textContent = data.brainPoints ?? 0;
  render();
}

els.start.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'START_FOCUS' }));
els.stop.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP' }));
els.skip.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'STOP'}));

// Update instantly when the background changes state
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') loadState();
});

loadState();
setInterval(render, 250);