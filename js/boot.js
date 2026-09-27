// Boot screen -> Welcome (log on) screen, plus the shutdown sequence.
import { play, unlockAudio } from './sfx.js';
import { wait } from './assets.js';

const $ = (id) => document.getElementById(id);

export async function runBoot() {
  $('boot').hidden = false;
  await wait(3200);
  $('boot').hidden = true;
  await showWelcome();
}

/** Shows the Welcome screen; resolves once the user clicks their tile. */
export function showWelcome() {
  return new Promise((resolve) => {
    const screen = $('welcome');
    const user = $('welcome-user');
    screen.classList.remove('logging-in');
    screen.hidden = false;
    user.focus();

    const login = async () => {
      user.removeEventListener('click', login);
      unlockAudio();
      play('startup');
      screen.classList.add('logging-in');
      await wait(1500);
      screen.hidden = true;
      resolve();
    };
    user.addEventListener('click', login);
    $('welcome-off').onclick = () => {
      user.removeEventListener('click', login);
      unlockAudio();
      screen.hidden = true;
      showShutdown();
    };
  });
}

export function hideBootScreens() {
  $('boot').hidden = true;
  $('welcome').hidden = true;
}

/** "Windows is shutting down..." then "It is now safe to turn off your computer." Click to restart. */
export async function showShutdown() {
  const screen = $('shutdown');
  play('shutdown');
  screen.className = 'screen phase-1';
  screen.hidden = false;
  await wait(2000);
  screen.className = 'screen phase-2';
  screen.addEventListener('click', () => location.reload(), { once: true });
}
