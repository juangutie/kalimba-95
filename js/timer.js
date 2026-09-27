// Countdown timer based on performance.now(), so it stays accurate even if intervals drift.

export function createTimer({ seconds, onTick, onExpire }) {
  let remainingMs = seconds * 1000;
  let endAt = 0;
  let handle = null;
  let running = false;
  let lastShown = null;

  const now = () => performance.now();

  function tick() {
    remainingMs = Math.max(0, endAt - now());
    const shown = Math.ceil(remainingMs / 1000);
    if (shown !== lastShown) {
      lastShown = shown;
      onTick?.(shown);
    }
    if (remainingMs <= 0) {
      stop();
      onExpire?.();
    }
  }

  function start() {
    if (running || remainingMs <= 0) return;
    running = true;
    endAt = now() + remainingMs;
    handle = setInterval(tick, 100);
    tick();
  }

  function stop() {
    if (running) remainingMs = Math.max(0, endAt - now());
    running = false;
    clearInterval(handle);
    handle = null;
  }

  function penalize(secs) {
    if (running) {
      endAt -= secs * 1000;
      tick();
    } else {
      remainingMs = Math.max(0, remainingMs - secs * 1000);
    }
  }

  return {
    start,
    stop,
    penalize,
    get running() { return running; },
    get remaining() {
      const ms = running ? Math.max(0, endAt - now()) : remainingMs;
      return Math.ceil(ms / 1000);
    },
  };
}

export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
