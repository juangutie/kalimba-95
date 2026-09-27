// Zip archives and programs: XP-style progress windows and the password prompt for locked zips.
import { el } from './assets.js';
import { createWindow } from './windows.js';

/** Extraction time: a short base plus a bit per entry, so bigger zips take a little longer. */
export const extractDuration = (entryCount) => Math.min(1000, 325 + entryCount * 90);

/**
 * Generic progress window (extracting a zip, running a program).
 * steps: labels shown one after another while the bar fills.
 * Calls onDone() when finished, onCancel() if the user closes it.
 * Returns abort() which closes the window without calling either callback.
 */
export function startProgress({ id, title, icon, heading, steps, idleText, duration, anim, onDone, onCancel }) {
  const stepLine = el('div', { className: 'extract-file' }, ' ');
  const fill = el('div', { className: 'xp-progress-fill' });
  const bar = el('div', {
    className: 'xp-progress', role: 'progressbar', 'aria-label': title,
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0',
  }, fill);
  const cancelBtn = el('button', { type: 'button', className: 'btn' }, 'Cancel');

  let finished = false;
  let timer = null;
  const win = createWindow({
    id, title, icon, width: 320, className: 'extract-window',
    content: el('div', { className: 'extract' },
      el('div', { className: 'extract-anim', 'aria-hidden': 'true' },
        el('span', {}, anim[0]), el('span', { className: 'extract-flying' }, anim[1]), el('span', {}, anim[2])),
      el('div', {}, heading),
      stepLine,
      bar,
      el('div', { className: 'extract-buttons' }, cancelBtn)),
    onClose: () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      onCancel?.();
    },
  });
  cancelBtn.addEventListener('click', () => win.close());

  const start = performance.now();
  timer = setInterval(() => {
    const p = Math.min(1, (performance.now() - start) / duration);
    fill.style.width = `${Math.round(p * 100)}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    const step = steps[Math.min(steps.length - 1, Math.floor(p * steps.length))];
    stepLine.textContent = step ?? idleText;
    if (p >= 1) {
      finished = true;
      clearInterval(timer);
      win.close();
      onDone?.();
    }
  }, 40);

  return function abort() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    win.close();
  };
}

/** Extract `entries` (files, programs, nested zips) from `zip`. See startProgress for the callbacks. */
export function startExtraction(zip, entries, callbacks) {
  return startProgress({
    id: `extract-${zip.id}`,
    title: `Extracting ${zip.displayName}`,
    icon: 'zip',
    heading: `Extracting files from ${zip.displayName}`,
    steps: entries.map((e) => `Extracting: ${e.displayName}`),
    idleText: 'Reading archive...',
    duration: extractDuration(entries.length),
    anim: ['🗜️', '📄', '📁'],
    ...callbacks,
  });
}

const openPrompts = new Set(); // close functions of open password windows

/** Close every open password window (level change, time up). */
export function closePasswordPrompts() {
  for (const close of [...openPrompts]) close();
}

export const passwordWindowId = (zip) => `password-${zip.id}`;

/**
 * Ask for a zip's password in a normal (non-modal) window, so the desktop stays usable
 * and password.txt can be opened while the prompt is up.
 * A wrong password shows an error in the window and calls onWrong(); the window stays open.
 * Resolves true once the right password is entered, false if the window is closed/cancelled.
 */
export function promptPassword(zip, { onWrong } = {}) {
  return new Promise((resolve) => {
    const input = el('input', {
      type: 'password', className: 'dlg-input', 'aria-label': 'Password',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    });
    const error = el('div', { className: 'pw-error', role: 'alert' });
    const okBtn = el('button', { type: 'button', className: 'btn default' }, 'OK');
    const cancelBtn = el('button', { type: 'button', className: 'btn' }, 'Cancel');

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      openPrompts.delete(close);
      resolve(value);
    };
    const win = createWindow({
      id: passwordWindowId(zip),
      title: 'Password Required',
      icon: 'zip',
      width: 330,
      className: 'password-window',
      content: el('div', { className: 'pw-body' },
        el('div', { className: 'pw-row' },
          el('div', { className: 'dlg-icon lock', 'aria-hidden': 'true' }, '🔒'),
          el('div', {}, `${zip.displayName} is password protected.`, el('br'), 'Enter the password to extract its files.')),
        el('label', { className: 'dlg-field' }, el('span', {}, 'Password:'), input),
        error,
        el('div', { className: 'pw-buttons' }, okBtn, cancelBtn)),
      onClose: () => finish(false),
    });
    const close = () => win.close();
    openPrompts.add(close);

    const submit = () => {
      if (passwordMatches(zip, input.value)) {
        finish(true);
        win.close();
        return;
      }
      error.textContent = 'The password is incorrect. Please try again.';
      input.value = '';
      input.focus();
      onWrong?.();
    };
    okBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', close);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    input.focus();
  });
}

export const passwordMatches = (zip, text) =>
  typeof text === 'string' && text.trim().toLowerCase() === String(zip.password).toLowerCase();
