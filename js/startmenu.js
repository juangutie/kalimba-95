// XP Start menu with an "All Levels" submenu for jumping to any level.
import { el, iconGraphic } from './assets.js';

export function createStartMenu({ levels, isCompleted, currentIndex, actions }) {
  const button = document.getElementById('start-button');
  const submenu = el('div', { id: 'levels-menu', role: 'menu', 'aria-label': 'All Levels', hidden: true });

  const item = (icon, fallback, label, onSelect, extra = {}) => el('button', {
    type: 'button', className: 'sm-item', role: 'menuitem', ...extra,
    onClick: () => { if (!extra['aria-haspopup']) close(); onSelect(); },
  }, iconGraphic(icon, { size: 28, fallback }), el('span', { className: 'sm-label' }, label),
  extra['aria-haspopup'] ? el('span', { className: 'sm-arrow', 'aria-hidden': 'true' }, '▶') : null);

  const levelsBtn = item(null, '🗂️', 'All Levels', () => toggleSubmenu(), { 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
  levelsBtn.addEventListener('pointerenter', () => openSubmenu());

  const leftCol = el('div', { className: 'sm-col sm-left' },
    item('media-player', null, 'Windows Media Player', actions.mediaPlayer),
    item(null, '🔁', 'Restart Level', actions.restartLevel),
    el('div', { className: 'sm-sep', role: 'separator' }),
    levelsBtn);
  const rightCol = el('div', { className: 'sm-col sm-right' },
    item('my-computer', null, 'My Computer', actions.myComputer),
    item('recycle-bin', null, 'Recycle Bin', actions.recycleBin),
    item(null, '❓', 'Help and Support', actions.help));

  // Close the submenu when hovering other items.
  for (const other of [...leftCol.children, ...rightCol.children]) {
    if (other !== levelsBtn) other.addEventListener('pointerenter', closeSubmenu);
  }

  const menu = el('div', { id: 'start-menu', role: 'menu', 'aria-label': 'Start menu', hidden: true },
    el('div', { className: 'sm-header' }, el('span', { className: 'sm-avatar', 'aria-hidden': 'true' }, '🌼'), 'Player'),
    el('div', { className: 'sm-body' }, leftCol, rightCol),
    el('div', { className: 'sm-footer' },
      el('button', { type: 'button', onClick: () => { close(); actions.logOff(); } },
        el('span', { className: 'key-icon', 'aria-hidden': 'true' }, '🔑'), 'Log Off'),
      el('button', { type: 'button', onClick: () => { close(); actions.turnOff(); } },
        el('span', { className: 'power-icon', 'aria-hidden': 'true' }, '⏻'), 'Turn Off Computer')));

  document.body.append(menu, submenu);

  function renderSubmenu() {
    const current = currentIndex();
    submenu.replaceChildren(...levels.map((lv, i) => el('button', {
      type: 'button', role: 'menuitem', className: `lv-item${i === current ? ' current' : ''}`,
      onClick: () => { close(); actions.startLevel(i); },
    },
    el('span', { className: 'lv-check', 'aria-hidden': 'true' }, isCompleted(lv.id) ? '✓' : ''),
    el('span', {}, `${lv.id}. ${lv.name}`),
    el('span', { className: 'lv-tag' }, lv.timed ? '⏱' : 'relaxed'))));
  }

  function openSubmenu() {
    if (!submenu.hidden) return;
    renderSubmenu();
    submenu.hidden = false;
    levelsBtn.setAttribute('aria-expanded', 'true');
    const r = levelsBtn.getBoundingClientRect();
    const h = submenu.offsetHeight;
    submenu.style.left = `${r.right - 2}px`;
    submenu.style.top = `${Math.max(4, Math.min(r.top, innerHeight - 30 - h - 4))}px`;
  }
  function closeSubmenu() {
    submenu.hidden = true;
    levelsBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleSubmenu() {
    // Hover already opens it, so a click just opens (if needed) and moves focus into the list.
    openSubmenu();
    submenu.querySelector('button')?.focus();
  }

  function open() {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector('.sm-item')?.focus();
  }
  function close() {
    menu.hidden = true;
    closeSubmenu();
    button.setAttribute('aria-expanded', 'false');
  }

  // The taskbar stays clickable during modal dialogs (for the media player's task button),
  // but the Start menu waits until the dialog is answered.
  const modalOpen = () => !document.getElementById('modal-layer').hidden;
  button.addEventListener('click', () => {
    if (modalOpen()) return;
    if (menu.hidden) open(); else close();
  });
  document.addEventListener('pointerdown', (e) => {
    if (menu.hidden) return;
    if (!menu.contains(e.target) && !submenu.contains(e.target) && !button.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { close(); button.focus(); }
  });

  return { open, close };
}
