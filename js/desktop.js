// Desktop: system icons, level folders, file icons, multi-select and pointer-event drag & drop.
//
// Selecting files (like Windows):
//   click             select one file
//   Ctrl/Shift+click  add/remove a file from the selection
//   drag on empty desktop  rubber-band (marquee) selection; hold Ctrl/Shift to add to the selection
//   Ctrl+A            select all files, Esc clears the selection
// Dragging any selected file moves the whole selection; dropping on a folder checks every file.
import { el, iconGraphic, clamp } from './assets.js';
import { FOLDERS, POOLS, makeRng, shuffle } from './items.js';

const CELL_W = 96;
const CELL_H = 100;
const ICON_W = 84;
const ICON_H = 84;
const DRAG_THRESHOLD = 4;

/** Thumbnail for a photo item, falling back to a color swatch or animal emoji. */
export function photoGraphic(item, size = 52) {
  const box = el('span', { className: 'thumb', style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  const pool = POOLS[item.pool];
  const fallback = () => {
    box.replaceChildren();
    if (pool.swatch) {
      box.append(el('span', { className: 'ph-swatch', style: `background:${pool.swatch};filter:brightness(${0.8 + (item.n % 5) * 0.1})` }));
    } else {
      box.classList.add('ph-emoji');
      box.style.fontSize = `${Math.round(size * 0.6)}px`;
      box.textContent = pool.emoji;
    }
  };
  const img = el('img', { src: item.thumb, alt: '', draggable: 'false' });
  img.addEventListener('error', fallback, { once: true });
  box.append(img);
  return box;
}

function zipGraphic(entry) {
  return el('span', { className: 'zip-graphic' },
    iconGraphic('zip', { size: 44 }),
    entry.locked ? el('span', { className: 'zip-lock', 'aria-hidden': 'true' }, '🔒') : null);
}

/** Graphic for any desktop entry: photo thumbnail, zip archive, program, or stock file icon. */
export function entryGraphic(item, size = 44) {
  if (item.kind === 'photo') return photoGraphic(item, size + 8);
  if (item.kind === 'zip') return zipGraphic(item);
  if (item.kind === 'exe') return item.virus ? iconGraphic('virus', { size }) : iconGraphic('exe', { size });
  return iconGraphic(item.ext, { size });
}

const fileGraphic = (item) => entryGraphic(item);

const rectsOverlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * onDrop(itemIds, folderId) must return one game result per id:
 * { result: 'correct' | 'wrong' | 'ignored', folder, count }.
 */
export function createDesktop({ onDrop, onOpenFile, onOpenSystem, onOpenFolder, reserved = () => [] }) {
  const desktopEl = document.getElementById('desktop');
  const sysEl = document.getElementById('system-icons');
  const foldersEl = document.getElementById('folders');
  const filesEl = document.getElementById('files');

  const folderEls = new Map(); // folderId -> element
  const fileEls = new Map();   // itemId -> element (document order = creation order)
  const homes = new Map();     // itemId -> { x, y } (last resting position)
  const selectedFiles = new Set(); // itemIds
  let selectedOther = null;    // a selected system icon or folder
  let folderOrder = [];
  let locked = true;
  let drag = null;
  let band = null;

  /* ---------- Selection ---------- */
  function setFileSelected(id, on) {
    const node = fileEls.get(id);
    if (!node) return;
    node.classList.toggle('selected', on);
    node.setAttribute('aria-pressed', String(on));
    if (on) selectedFiles.add(id); else selectedFiles.delete(id);
  }

  function clearSelection() {
    for (const id of [...selectedFiles]) setFileSelected(id, false);
    selectedOther?.classList.remove('selected');
    selectedOther = null;
  }

  function selectOther(node) {
    clearSelection();
    selectedOther = node;
    node.classList.add('selected');
  }

  function selectAllFiles() {
    selectedOther?.classList.remove('selected');
    selectedOther = null;
    for (const id of fileEls.keys()) setFileSelected(id, true);
  }

  /* ---------- System icons ---------- */
  const SYSTEM = [
    ['my-computer', 'My Computer'],
    ['media-player', 'Windows Media Player'],
  ];
  const sysIcon = (id, label) => {
    const node = el('div', { className: 'icon system', tabindex: '0', role: 'button', 'aria-label': `${label}. Press Enter to open.` },
      iconGraphic(id, { size: 40 }), el('span', { className: 'icon-label' }, label));
    node.addEventListener('pointerdown', () => selectOther(node));
    node.addEventListener('dblclick', () => onOpenSystem(id));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') onOpenSystem(id); });
    return node;
  };
  for (const [id, label] of SYSTEM) sysEl.append(sysIcon(id, label));
  // The Recycle Bin is a drop target (id 'recycle'), so it lives bottom-right, under the folders.
  const recycleEl = sysIcon('recycle-bin', 'Recycle Bin');
  recycleEl.id = 'recycle-bin';
  desktopEl.append(recycleEl);

  /* ---------- Rendering ---------- */
  function buildFolder(fid, index) {
    const f = FOLDERS[fid];
    const badge = el('span', { className: 'folder-badge', hidden: true });
    const graphic = el('span', { className: 'folder-graphic' },
      iconGraphic('folder', { size: 40 }),
      f.emblem ? el('span', { className: 'folder-emblem', 'aria-hidden': 'true' }, f.emblem) : null,
      f.swatch ? el('span', { className: 'folder-swatch', style: `background:${f.swatch}` }) : null,
      f.tag ? el('span', { className: 'folder-tag', 'aria-hidden': 'true' }, f.tag) : null,
      badge);
    const node = el('div', {
      className: 'icon folder', tabindex: '0', role: 'button', dataset: { folder: fid },
      title: `${f.label} (key ${index + 1}). Double-click to see what's inside.`,
      'aria-label': `${f.label} folder, keyboard shortcut ${index + 1}. Press Enter to open.`,
    }, graphic, el('span', { className: 'icon-label' }, f.label));
    node.addEventListener('pointerdown', () => selectOther(node));
    node.addEventListener('dblclick', () => onOpenFolder?.(fid));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') onOpenFolder?.(fid); });
    folderEls.set(fid, node);
    return node;
  }

  function buildFile(item, folderCount) {
    const label = item.kind === 'zip'
      ? `${item.displayName}, compressed folder${item.locked ? ', password protected' : ''}. Press Enter to extract.`
      : item.kind === 'exe'
        ? `${item.displayName}, program. Press Enter to run it, Delete to move it to the Recycle Bin.`
        : `${item.displayName}. Space or Ctrl+click to select, 1 to ${folderCount} to move the selection into a folder, Enter to open.`;
    const node = el('div', {
      className: `icon file${item.kind === 'zip' ? ' zip' : ''}${item.kind === 'exe' ? ' exe' : ''}`, tabindex: '0', role: 'button', 'aria-pressed': 'false',
      dataset: { id: item.id }, title: item.displayName, 'aria-label': label,
    }, fileGraphic(item), el('span', { className: 'icon-label' }, item.displayName));
    fileEls.set(item.id, node);
    return node;
  }

  function place(node, pos) {
    node.style.left = `${pos.x}px`;
    node.style.top = `${pos.y}px`;
  }

  function clampPos(pos) {
    const d = desktopEl.getBoundingClientRect();
    return { x: clamp(pos.x, 0, d.width - ICON_W), y: clamp(pos.y, 0, d.height - ICON_H) };
  }

  /** Free area for files: between the system icons and folders, minus reserved rects (narrator). */
  function playArea() {
    const d = desktopEl.getBoundingClientRect();
    const sys = sysEl.getBoundingClientRect();
    const fol = foldersEl.getBoundingClientRect();
    return {
      left: sys.right - d.left + 12,
      right: (fol.width ? fol.left - d.left : d.width) - 12,
      top: 10,
      bottom: d.height - 10,
      blocks: [...reserved(), recycleEl.getBoundingClientRect()].filter(Boolean).map((r) => ({
        l: r.left - d.left - 8, t: r.top - d.top - 8, r: r.right - d.left + 8, b: r.bottom - d.top + 8,
      })),
    };
  }

  const blocked = (area, x, y, w = CELL_W, h = CELL_H) =>
    area.blocks.some((b) => x < b.r && x + w > b.l && y < b.b && y + h > b.t);

  /** Scatter files over free grid cells, avoiding system icons, folders and the narrator. */
  function layout(items, seed) {
    const area = playArea();
    const { left, right, top, bottom } = area;
    const cols = Math.max(1, Math.floor((right - left) / CELL_W));
    const rows = Math.max(1, Math.floor((bottom - top) / CELL_H));
    const padX = Math.max(0, (right - left - cols * CELL_W) / 2);

    let cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left + padX + c * CELL_W;
        const y = top + r * CELL_H;
        if (!blocked(area, x, y)) cells.push({ x, y });
      }
    }
    if (!cells.length) cells = [{ x: left, y: top }];

    const rng = makeRng(seed ^ 0x5f3759df);
    cells = shuffle(rng, cells);
    const jitter = items.length > cells.length ? 30 : 12;
    items.forEach((item, i) => {
      const cell = cells[i % cells.length];
      const pos = clampPos({ x: cell.x + 6 + (rng() - 0.5) * jitter, y: cell.y + (rng() - 0.5) * jitter });
      homes.set(item.id, pos);
      place(fileEls.get(item.id), pos);
    });
  }

  /** Free spots near `origin`, spiralling outward, avoiding other files and blocked areas. */
  function spotsAround(origin, count) {
    const area = playArea();
    const taken = [...homes.values()];
    const free = (p) => p.x >= area.left && p.x + ICON_W <= area.right + 12
      && p.y >= area.top && p.y + ICON_H <= area.bottom
      && !blocked(area, p.x, p.y, ICON_W, ICON_H)
      && taken.every((t) => Math.abs(t.x - p.x) > 70 || Math.abs(t.y - p.y) > 70);
    const spots = [];
    for (let ring = 1; ring <= 8 && spots.length < count; ring++) {
      const steps = ring * 8;
      for (let s = 0; s < steps && spots.length < count; s++) {
        const a = (s / steps) * Math.PI * 2;
        const p = clampPos({ x: origin.x + Math.cos(a) * ring * 80, y: origin.y + Math.sin(a) * ring * 80 });
        if (free(p)) { spots.push(p); taken.push(p); }
      }
    }
    // Crowded desktop: stack the rest loosely around the origin.
    while (spots.length < count) {
      const k = spots.length;
      spots.push(clampPos({ x: origin.x + ((k % 4) - 1.5) * 40, y: origin.y + (Math.floor(k / 4) % 3) * 30 }));
    }
    return spots;
  }

  /** Add files that just came out of a zip. They slide out from `origin`. */
  function addFiles(items, origin) {
    const spots = spotsAround(origin, items.length);
    const nodes = items.map((item, i) => {
      const node = buildFile(item, folderOrder.length);
      place(node, origin);
      filesEl.append(node);
      homes.set(item.id, spots[i]);
      return node;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      nodes.forEach((node, i) => {
        if (!node.isConnected || drag?.ids.includes(items[i].id)) return;
        node.classList.add('snapping');
        place(node, spots[i]);
        setTimeout(() => node.classList.remove('snapping'), 220);
      });
    }));
  }

  /** Update a zip icon (lock removed, or busy while extracting). */
  function setZipState(id, { locked: isLocked, busy } = {}) {
    const node = fileEls.get(id);
    if (!node) return;
    if (isLocked === false) node.querySelector('.zip-lock')?.remove();
    if (busy !== undefined) {
      node.classList.toggle('busy', busy);
      node.setAttribute('aria-busy', String(busy));
    }
  }

  function renderLevel(level, items, folderIds) {
    cancelDrag();
    cancelBand();
    locked = true;
    clearSelection();
    folderEls.clear();
    fileEls.clear();
    homes.clear();
    folderOrder = folderIds;
    foldersEl.replaceChildren(...folderIds.map(buildFolder));
    filesEl.replaceChildren(...items.map((item) => buildFile(item, folderIds.length)));
    layout(items, level.seed);
  }

  function setBadge(fid, count) {
    const badge = folderEls.get(fid)?.querySelector('.folder-badge');
    if (!badge) return;
    badge.hidden = !count;
    badge.textContent = String(count);
  }

  function removeFile(id) {
    selectedFiles.delete(id);
    fileEls.get(id)?.remove();
    fileEls.delete(id);
    homes.delete(id);
  }

  /** Ask the game about a drop of several files and update visuals. Returns ids that were rejected. */
  function commitDrop(ids, folderId) {
    const results = onDrop(ids, folderId);
    const rejected = [];
    results.forEach((res, i) => {
      if (res.result === 'correct') {
        removeFile(ids[i]);
        setBadge(res.folder, res.count);
      } else if (res.result === 'removed') {
        removeFile(ids[i]); // e.g. a program dropped in the Recycle Bin
      } else {
        rejected.push(ids[i]);
      }
    });
    return rejected;
  }

  /* ---------- Drag & drop (pointer events) ---------- */
  function dropTargets() {
    return [...folderEls, ['recycle', recycleEl]];
  }

  function folderAt(x, y) {
    for (const [fid, node] of dropTargets()) {
      const r = node.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return fid;
    }
    return null;
  }

  function setTarget(fid) {
    if (drag) drag.target = fid;
    for (const [id, node] of dropTargets()) node.classList.toggle('drop-target', id === fid);
  }

  function snapBack(ids) {
    for (const id of ids) {
      const node = fileEls.get(id);
      const home = homes.get(id);
      if (!node || !home) continue;
      node.classList.add('snapping');
      place(node, home);
      setTimeout(() => node.classList.remove('snapping'), 220);
    }
  }

  function endDragVisuals() {
    if (!drag) return;
    for (const id of drag.ids) fileEls.get(id)?.classList.remove('dragging', 'drag-lead');
    drag.count?.remove();
    filesEl.classList.remove('drag-active');
    setTarget(null);
  }

  function cancelDrag() {
    if (!drag) return;
    const { ids, moved } = drag;
    endDragVisuals();
    drag = null;
    if (moved) snapBack(ids);
  }

  filesEl.addEventListener('pointerdown', (e) => {
    const node = e.target.closest('.file');
    if (!node || e.button !== 0) return;
    const id = node.dataset.id;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    let reduceOnClick = false;

    selectedOther?.classList.remove('selected');
    selectedOther = null;
    if (additive) {
      setFileSelected(id, !selectedFiles.has(id));
      if (!selectedFiles.has(id)) return; // just deselected it: nothing to drag
    } else if (!selectedFiles.has(id)) {
      clearSelection();
      setFileSelected(id, true);
    } else {
      // Clicking (not dragging) one file of a group narrows the selection to it, like Explorer.
      reduceOnClick = selectedFiles.size > 1;
    }
    if (locked) return;

    const ids = [...selectedFiles];
    drag = {
      node, id, ids, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY,
      starts: new Map(ids.map((fid) => [fid, {
        x: parseFloat(fileEls.get(fid).style.left), y: parseFloat(fileEls.get(fid).style.top),
      }])),
      moved: false, target: null, reduceOnClick, count: null,
    };
    node.setPointerCapture(e.pointerId);
  });

  filesEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      // Raise via CSS z-index, not by re-appending: moving the node in the DOM would drop its pointer capture.
      for (const id of drag.ids) fileEls.get(id)?.classList.add('dragging');
      drag.node.classList.add('drag-lead');
      if (drag.ids.length > 1) {
        drag.count = el('span', { className: 'drag-count', 'aria-hidden': 'true' }, String(drag.ids.length));
        drag.node.append(drag.count);
      }
      filesEl.classList.add('drag-active');
    }
    for (const [id, start] of drag.starts) {
      const node = fileEls.get(id); // may be gone (e.g. a zip that finished extracting mid-drag)
      if (node) place(node, clampPos({ x: start.x + dx, y: start.y + dy }));
    }
    setTarget(folderAt(e.clientX, e.clientY));
  });

  filesEl.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { id, ids, moved, target, reduceOnClick } = drag;
    endDragVisuals();
    drag = null;
    if (!moved) {
      if (reduceOnClick) {
        clearSelection();
        setFileSelected(id, true);
      }
      return;
    }
    if (target) {
      snapBack(commitDrop(ids, target));
    } else {
      // Dropped on empty desktop: the files just stay there.
      for (const fid of ids) {
        const node = fileEls.get(fid);
        if (node) homes.set(fid, { x: parseFloat(node.style.left), y: parseFloat(node.style.top) });
      }
    }
  });

  filesEl.addEventListener('pointercancel', () => cancelDrag());

  filesEl.addEventListener('dblclick', (e) => {
    const node = e.target.closest('.file');
    if (node) onOpenFile(node.dataset.id);
  });

  /* ---------- Rubber-band selection ---------- */
  function cancelBand() {
    band?.el?.remove();
    band = null;
  }

  desktopEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.icon')) return;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    if (!additive) clearSelection();
    band = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, base: new Set(selectedFiles), el: null };
    desktopEl.setPointerCapture(e.pointerId);
  });

  desktopEl.addEventListener('pointermove', (e) => {
    if (!band || e.pointerId !== band.pointerId) return;
    if (!band.el) {
      if (Math.hypot(e.clientX - band.sx, e.clientY - band.sy) < DRAG_THRESHOLD) return;
      band.el = el('div', { className: 'marquee', 'aria-hidden': 'true' });
      desktopEl.append(band.el);
    }
    const d = desktopEl.getBoundingClientRect();
    const r = {
      left: Math.max(d.left, Math.min(band.sx, e.clientX)),
      top: Math.max(d.top, Math.min(band.sy, e.clientY)),
      right: Math.min(d.right, Math.max(band.sx, e.clientX)),
      bottom: Math.min(d.bottom, Math.max(band.sy, e.clientY)),
    };
    Object.assign(band.el.style, {
      left: `${r.left - d.left}px`, top: `${r.top - d.top}px`,
      width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px`,
    });
    for (const [id, node] of fileEls) {
      setFileSelected(id, band.base.has(id) || rectsOverlap(r, node.getBoundingClientRect()));
    }
  });

  const endBand = (e) => { if (band && e.pointerId === band.pointerId) cancelBand(); };
  desktopEl.addEventListener('pointerup', endBand);
  desktopEl.addEventListener('pointercancel', endBand);

  /* ---------- Keyboard ---------- */
  // Focus a file, Space toggles it in the selection, 1-9 moves the selection (or the focused file) into a folder.
  filesEl.addEventListener('keydown', (e) => {
    const node = e.target.closest('.file');
    if (!node) return;
    const id = node.dataset.id;
    if (e.key === 'Enter') { onOpenFile(id); return; }
    if (e.key === ' ') {
      e.preventDefault();
      setFileSelected(id, !selectedFiles.has(id));
      return;
    }
    const n = Number.parseInt(e.key, 10);
    if (locked || !(n >= 1 && n <= folderOrder.length)) return;
    e.preventDefault();
    const ids = selectedFiles.has(id) ? [...selectedFiles] : [id];
    const rejected = commitDrop(ids, folderOrder[n - 1]);
    if (!fileEls.has(id)) {
      // Focused file was filed: move focus to the next remaining file.
      const next = [...fileEls.values()].find((f) => !rejected.includes(f.dataset.id)) ?? fileEls.values().next().value;
      next?.focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('modal-layer').hidden) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.closest('.window, #start-menu, #levels-menu'))) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllFiles();
    } else if (e.key === 'Escape' && !drag) {
      cancelBand();
      clearSelection();
    } else if (e.key === 'Escape') {
      cancelDrag();
    } else if (e.key === 'Delete' && selectedFiles.size && !locked && !drag) {
      // Delete key = drop the selection on the Recycle Bin.
      e.preventDefault();
      commitDrop([...selectedFiles], 'recycle');
    }
  });

  window.addEventListener('resize', () => {
    for (const [id, node] of fileEls) {
      const pos = clampPos(homes.get(id));
      homes.set(id, pos);
      place(node, pos);
    }
  });

  return {
    renderLevel,
    addFiles,
    removeEntry: removeFile,
    setZipState,
    positionOf: (id) => homes.get(id) ?? null,
    /** Ids of everything currently on the desktop. */
    visibleIds: () => [...fileEls.keys()],
    /** Remove an entry with a short glitch effect and a floating label (e.g. "-5s" for a virus). */
    zap(id, text) {
      const node = fileEls.get(id);
      if (!node) return;
      if (drag?.ids.includes(id)) cancelDrag();
      removeFile(id); // gone from the game immediately...
      filesEl.append(node); // ...but the node stays briefly for the animation
      node.classList.add('zapped');
      node.setAttribute('aria-hidden', 'true');
      setTimeout(() => node.remove(), 500);
      if (text) {
        // Separate element so it stays visible while the icon glitches away.
        const pop = el('span', {
          className: 'zap-pop', 'aria-hidden': 'true',
          style: `left:${parseFloat(node.style.left) + ICON_W / 2}px;top:${parseFloat(node.style.top) + 10}px`,
        }, text);
        filesEl.append(pop);
        setTimeout(() => pop.remove(), 800);
      }
    },
    /** File several entries into a folder programmatically (e.g. a helper program). Returns rejected ids. */
    fileMany: (ids, folderId) => (ids.length ? commitDrop(ids, folderId) : []),
    setLocked(value) {
      locked = value;
      if (value) cancelDrag();
    },
    get locked() { return locked; },
  };
}
