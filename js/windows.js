// XP-style windows (draggable, z-ordered, taskbar buttons) and modal dialogs.
import { el, iconGraphic, clamp } from './assets.js';

const TASKBAR_H = 30;
const open = new Map(); // key -> window api
let zTop = 100;
let counter = 0;

function layer(onTop) { return document.getElementById(onTop ? 'top-windows' : 'windows'); }
function taskButtons() { return document.getElementById('task-buttons'); }

/** Drag `win` around the screen by its title bar. */
export function makeDraggable(win, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const rect = win.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      win.style.left = `${clamp(ev.clientX - ox, 80 - rect.width, innerWidth - 80)}px`;
      win.style.top = `${clamp(ev.clientY - oy, 0, innerHeight - TASKBAR_H - 26)}px`;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

function titleBar(title, icon, buttons) {
  return el('div', { className: 'title-bar' },
    icon ? iconGraphic(icon, { size: 16 }) : null,
    el('span', { className: 'title-text' }, title),
    el('div', { className: 'title-buttons' }, ...buttons));
}

function refreshActive() {
  let top = null;
  for (const w of open.values()) {
    if (!w.el.hidden && (!top || Number(w.el.style.zIndex) > Number(top.el.style.zIndex))) top = w;
  }
  for (const w of open.values()) {
    const active = w === top;
    w.el.classList.toggle('active', active);
    w.taskButton.classList.toggle('active', active);
  }
}

/**
 * Open a window. If a window with the same id is already open, it is restored and returned.
 * alwaysInteractive: put the window above modal dialogs so it can be used while one is open.
 * Returns { id, el, body, focus, minimize, restore, close, setTitle }.
 */
export function createWindow({ id, title, icon, width = 360, x, y, content, onClose, className = '', alwaysInteractive = false }) {
  if (id && open.has(id)) {
    const existing = open.get(id);
    existing.restore();
    return existing;
  }
  const key = id ?? `win${++counter}`;
  const minBtn = el('button', { type: 'button', 'aria-label': 'Minimize', title: 'Minimize' }, '_');
  const closeBtn = el('button', { type: 'button', className: 'close', 'aria-label': 'Close', title: 'Close' }, '✕');
  const bar = titleBar(title, icon, [minBtn, closeBtn]);
  const body = el('div', { className: 'window-body' }, content);
  const win = el('section', { className: `window ${className}`, role: 'dialog', 'aria-label': title, style: `width:${width}px` }, bar, body);
  layer(alwaysInteractive).append(win);

  const rect = win.getBoundingClientRect();
  const offset = (open.size % 5) * 24;
  win.style.left = `${x ?? Math.max(10, (innerWidth - rect.width) / 2 + offset)}px`;
  win.style.top = `${y ?? Math.max(10, (innerHeight - TASKBAR_H - rect.height) / 2 - 40 + offset)}px`;
  makeDraggable(win, bar);

  const taskButton = el('button', { type: 'button', className: 'task-button', title },
    icon ? iconGraphic(icon, { size: 16 }) : null, el('span', {}, title));
  taskButtons().append(taskButton);

  const api = {
    id: key, el: win, body, taskButton,
    focus() { win.style.zIndex = ++zTop; refreshActive(); },
    minimize() { win.hidden = true; refreshActive(); },
    restore() { win.hidden = false; api.focus(); },
    close() {
      if (!open.has(key)) return;
      open.delete(key);
      win.remove();
      taskButton.remove();
      refreshActive();
      onClose?.();
    },
    setTitle(text) {
      bar.querySelector('.title-text').textContent = text;
      taskButton.lastChild.textContent = text;
      win.setAttribute('aria-label', text);
    },
  };

  win.addEventListener('pointerdown', () => api.focus());
  minBtn.addEventListener('click', () => api.minimize());
  closeBtn.addEventListener('click', () => api.close());
  taskButton.addEventListener('click', () => {
    if (win.hidden) api.restore();
    else if (win.classList.contains('active')) api.minimize();
    else api.focus();
  });

  open.set(key, api);
  api.focus();
  return api;
}

export function getWindow(id) { return open.get(id) ?? null; }

const DIALOG_GLYPH = { info: 'i', question: '?', error: '✕', warning: '⚠', lock: '🔒' };
const openDialogs = new Set(); // cancel functions of open dialogs

/** Close every open dialog as if Cancel/Esc was pressed (e.g. when the timer runs out). */
export function dismissDialogs() {
  for (const cancel of [...openDialogs]) cancel();
}

/**
 * Modal XP message box. Resolves with the chosen button's value.
 * buttons: [{ label, value, cancel? }] — the first button is the default.
 * input: { label, type? } adds a text field; the promise then resolves with { value, text }.
 */
export function showDialog({ title = 'Kalimba 95', message, icon = 'info', buttons = [{ label: 'OK', value: 'ok' }], input }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-layer');
    const cancelValue = (buttons.find((b) => b.cancel) ?? buttons[buttons.length - 1]).value;
    const btnEls = buttons.map((b, i) =>
      el('button', { type: 'button', className: `btn${i === 0 ? ' default' : ''}`, onClick: () => finish(b.value) }, b.label));
    const closeBtn = el('button', { type: 'button', className: 'close', 'aria-label': 'Close', onClick: () => finish(cancelValue) }, '✕');
    const bar = titleBar(title, null, [closeBtn]);
    const inputEl = input ? el('input', {
      type: input.type ?? 'text', className: 'dlg-input', 'aria-label': input.label,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    }) : null;
    const messageEl = el('div', { className: 'dialog-message' }, message,
      inputEl ? el('label', { className: 'dlg-field' }, el('span', {}, input.label), inputEl) : null);
    const win = el('section', { className: 'window dialog active', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      bar,
      el('div', { className: 'window-body' },
        el('div', { className: `dlg-icon ${icon}`, 'aria-hidden': 'true' }, DIALOG_GLYPH[icon] ?? 'i'),
        messageEl),
      el('div', { className: 'dialog-buttons' }, ...btnEls));

    modal.hidden = false;
    modal.append(win);
    const rect = win.getBoundingClientRect();
    win.style.left = `${Math.max(10, (innerWidth - rect.width) / 2)}px`;
    win.style.top = `${Math.max(10, (innerHeight - TASKBAR_H - rect.height) / 2 - 20)}px`;
    makeDraggable(win, bar);
    win.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue); }
      else if (e.key === 'Enter' && e.target === inputEl) { e.preventDefault(); finish(buttons[0].value); }
    });
    (inputEl ?? btnEls[0]).focus();

    const cancel = () => finish(cancelValue);
    openDialogs.add(cancel);
    let done = false;
    function finish(value) {
      if (done) return;
      done = true;
      openDialogs.delete(cancel);
      win.remove();
      if (!modal.children.length) modal.hidden = true;
      resolve(inputEl ? { value, text: inputEl.value } : value);
    }
  });
}
