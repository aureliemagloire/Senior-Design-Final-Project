// Study Bud background service worker.
// It owns the timer: the popup only displays it and sends commands.
// State lives in chrome.storage.local because the service worker can be
// shut down at any time and loses all in-memory variables.

const ALARM_NAME = 'pomodoro';
const POINTS_PER_FOCUS = 10;

// Sites blocked
const BLOCKED_SITES = [
  'instagram.com', 'x.com', 'tiktok.com', 'reddit.com', 'youtube.com', 'netflix.com', 'hulu.com',
  'roblox.com', 'facebook.com', 'discord.com','hbomax.com', 'peacock.com'
];
const RULE_ID = 1;

// Minutes. For quick testing set focus to 0.5 (packaged extension alarms have a 30-second minimum).
const DURATIONS = { focus: 0.5, break: 5 };

chrome.runtime.onInstalled.addListener(async () => {
  const { brainPoints } = await chrome.storage.local.get('brainPoints');
  if (brainPoints === undefined) {
    await chrome.storage.local.set({
      brainPoints: 0,
      timer: { mode: 'idle', endTime: null, durationMs: 0 }
    });
  }
});

// blocks every site in BLOCKED_SITES. 
async function setBlocking(enabled){
  const addRules = enabled
    ? [{
        id: RULE_ID,
        priority: 1,
        action: { type: 'block' },
        condition: {
          requestDomains: BLOCKED_SITES,
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }]
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules
  });
}

// starts timer
async function startTimer(mode) {
  await setBlocking(mode=='focus'); // blocker on when focus mode starts
  const durationMs = DURATIONS[mode] * 60 * 1000;
  const endTime = Date.now() + durationMs;
  await chrome.alarms.create(ALARM_NAME, { when: endTime });
  await chrome.storage.local.set({ timer: { mode, endTime, durationMs } });
}

async function stopTimer() {
  await setBlocking(false);
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.set({
    timer: { mode: 'idle', endTime: null, durationMs: 0 }
  });
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'catpic.png',
    title,
    message
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const { timer } = await chrome.storage.local.get('timer');

  if (timer?.mode === 'focus') {
    const { brainPoints = 0 } = await chrome.storage.local.get('brainPoints');
    await chrome.storage.local.set({ brainPoints: brainPoints + POINTS_PER_FOCUS });
    notify('Focus session complete!', `+${POINTS_PER_FOCUS} brain points. Time for a break.`);
    await startTimer('break'); // startTimer turns site blocker off
  } else if (timer?.mode === 'break') {
    notify('Break is over', 'Ready for another focus session?');
    await stopTimer();
  }
});

// Commands from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'START_FOCUS') await startTimer('focus');
    if (message.type === 'START_BREAK') await startTimer('break');
    if (message.type === 'SKIP_BREAK'){ const {timer} = await chrome.storage.local.get('timer');
  if (timer?.mode === 'break') await startTimer('focus');
}
    if (message.type === 'STOP') await stopTimer();
    sendResponse({ ok: true });
  })();
  return true; // keep the channel open for the async response
});

// blocker matches saved timer if browser restarts
chrome.runtime.onStartup.addListener(async () => {
  const { timer } = await chrome.storage.local.get('timer');
  if (timer?.mode === 'focus' && timer.endTime > Date.now()) {
    await setBlocking(true);
  } else {
    await setBlocking(false);
  }
});