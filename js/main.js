// Kalimba 95 — wires together boot, desktop, levels, timer, narrator, windows and the media player.
// URL options: ?skipboot (skip boot + welcome), ?level=N (start at level N).
import { LEVELS, ruleText } from './levels.js';
import { generateLevel, folderIdsFor, FOLDERS } from './items.js';
import { createGame } from './game.js';
import { createTimer, formatTime } from './timer.js';
import { createDesktop, photoGraphic, entryGraphic } from './desktop.js';
import { createWindow, getWindow, showDialog, dismissDialogs } from './windows.js';
import { createNarrator } from './narrator.js';
import { line } from './dialogue.js';
import { openMediaPlayer, stopMedia } from './mediaplayer.js';
import { createStartMenu } from './startmenu.js';
import { runBoot, showWelcome, showShutdown, hideBootScreens } from './boot.js';
import { startExtraction, startProgress, promptPassword, passwordWindowId, closePasswordPrompts } from './zip.js';
import * as sfx from './sfx.js';
import { el, iconGraphic } from './assets.js';
import { startClouds } from './clouds.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const COMPLETED_KEY = 'kalimba95.completed';
// Windows that belong to a level and are closed when the level changes.
const LEVEL_WINDOWS = ['viewer', 'notepad', 'fake-audio', 'recycle-bin', ...Object.keys(FOLDERS).map((f) => `folder-${f}`)];

const completed = loadCompleted();
const state = {
  index: 0,
  level: null,
  game: null,
  timer: null,
  runId: 0,
  hurried: false,
  lastWrongLine: 0,
  zips: new Map(),         // zipId -> zip (see items.generateLevel)
  exes: new Map(),         // exeId -> program still on the desktop or in a zip
  recycled: [],            // entries dropped in the Recycle Bin this level
  extractions: new Set(),  // abort functions of running extractions and programs
};

const narrator = createNarrator($('narrator'));
const desktop = createDesktop({
  onDrop: handleDrop,
  onOpenFile: openFile,
  onOpenSystem: openSystem,
  onOpenFolder: openFolder,
  reserved: () => [narrator.reservedRect()],
});
createStartMenu({
  levels: LEVELS,
  isCompleted: (id) => completed.has(id),
  currentIndex: () => state.index,
  actions: {
    mediaPlayer: openMediaPlayer,
    restartLevel: () => startLevel(state.index),
    startLevel: (i) => startLevel(i),
    myComputer: openMyComputer,
    recycleBin: openRecycleBin,
    help: () => withTimerPaused(showHelp),
    logOff: logOff,
    turnOff: turnOff,
  },
});

/* ---------- Persistence ---------- */
function loadCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '[]')); } catch { return new Set(); }
}
function markCompleted(id) {
  completed.add(id);
  try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...completed])); } catch { /* private mode */ }
}

/* ---------- Tray ---------- */
function startClock() {
  const clock = $('tray-clock');
  const update = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  update();
  setTimeout(() => { update(); setInterval(update, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
}

function updateStatus() {
  if (!state.level) return;
  const zipped = [...state.zips.values()].reduce((n, z) => n + z.contents.filter((id) => state.game.item(id)).length, 0);
  const viruses = [...state.exes.values()].filter((x) => x.virus && !x.zip).length;
  $('tray-status').textContent = `Level ${state.level.id}/${LEVELS.length} · ${state.game.remaining} left`
    + `${zipped ? ` (${zipped} zipped)` : ''}${viruses ? ` · ⚠ ${viruses} virus${viruses > 1 ? 'es' : ''}` : ''}`;
}

function showTimer(seconds) {
  const t = $('tray-timer');
  t.hidden = false;
  t.textContent = `⏱ ${formatTime(seconds)}`;
  t.classList.toggle('hurry', seconds <= 10);
}

function flashPenalty() {
  const t = $('tray-timer');
  t.classList.add('penalty');
  setTimeout(() => t.classList.remove('penalty'), 400);
}

function stopTimer() {
  state.timer?.stop();
  state.timer = null;
}

/** Pause the level timer while a modal (help, turn off...) is open. */
async function withTimerPaused(fn) {
  const timer = state.timer;
  const wasRunning = timer?.running;
  if (wasRunning) timer.stop();
  try { return await fn(); } finally {
    if (wasRunning && state.timer === timer) timer.start();
  }
}

/* ---------- Level flow ---------- */
function preloadLevel(index) {
  const level = LEVELS[index];
  if (!level) return;
  for (const item of generateLevel(level).items) {
    if (item.kind === 'photo') new Image().src = item.thumb;
  }
}

/** Stop anything left over from the previous level: extractions, dialogs, level windows. */
function cleanupLevel() {
  for (const abort of state.extractions) abort();
  state.extractions.clear();
  dismissDialogs();
  closePasswordPrompts();
  for (const id of LEVEL_WINDOWS) getWindow(id)?.close();
}

async function startLevel(index) {
  const runId = ++state.runId;
  stopTimer();
  cleanupLevel();
  const level = LEVELS[index];
  state.index = index;
  state.level = level;
  state.hurried = false;
  state.zipHinted = false;

  narrator.setCharacter(level.narrator);
  const { items, zips, exes } = generateLevel(level);
  state.game = createGame(level, items);
  state.zips = new Map(zips.map((z) => [z.id, z]));
  state.exes = new Map(exes.map((x) => [x.id, x]));
  state.recycled = [];
  // Anything inside a zip stays hidden until extracted.
  const onDesktop = [...items, ...zips, ...exes].filter((e) => !e.zip);
  desktop.renderLevel(level, onDesktop, folderIdsFor(level));
  updateStatus();
  if (level.timed) showTimer(level.time); else $('tray-timer').hidden = true;
  preloadLevel(index + 1);

  narrator.say(level.intro, 'greet');
  const timing = level.timed
    ? `Time limit: ${formatTime(level.time)}. Each file dropped in the wrong folder costs ${level.penalty} seconds.`
    : 'No time limit. Take it easy.';
  const tip = level.id <= 3 ? '\n\nTip: drag a box around several files (or Ctrl+click them) to move them all at once.' : '';
  await showDialog({
    title: `Level ${level.id} of ${LEVELS.length}: ${level.name}`,
    message: `${ruleText(level)}\n\n${timing}${tip}`,
    icon: 'info',
    buttons: [{ label: level.timed ? 'Start' : 'OK', value: 'ok' }],
  });
  if (runId !== state.runId) return;

  desktop.setLocked(false);
  if (level.timed) {
    state.timer = createTimer({
      seconds: level.time,
      onTick: (s) => onTick(s, runId),
      onExpire: () => onExpire(runId),
    });
    state.timer.start();
  }
}

/** Drop one or more entries on a folder (or 'recycle'). Returns one result per id (desktop uses them for visuals). */
function handleDrop(itemIds, folderId) {
  const { game, level } = state;
  const streakBefore = game.streak;
  const notes = new Set(); // narrator reasons, most important first below
  const results = itemIds.map((id) => {
    // Zips can't be filed or deleted; they bounce back without a penalty.
    if (state.zips.has(id)) {
      notes.add(folderId === 'recycle' ? 'zipRecycle' : 'zip');
      return { result: 'bounce' };
    }
    const exe = state.exes.get(id);
    if (exe) {
      if (folderId === 'recycle') {
        removeExe(exe);
        notes.add(exe.virus ? 'virusDeleted' : 'recycled');
        return { result: 'removed' };
      }
      if (exe.virus) {
        game.penalize();
        notes.add('virusFiled');
        return { result: 'wrong' };
      }
      notes.add('program');
      return { result: 'bounce' };
    }
    const res = game.drop(id, folderId);
    if (res.result === 'wrong' && folderId === 'recycle') notes.add('recycleWrong');
    return res;
  });
  const right = results.filter((r) => r.result === 'correct').length;
  const wrong = results.filter((r) => r.result === 'wrong').length;

  if (right) {
    sfx.tone('correct');
    updateStatus();
  }
  if (levelCleared()) {
    finishLevelSoon(250);
    return results;
  }

  if (wrong) {
    sfx.play('error');
    // Each misfiled file costs time, so dumping everything into one folder doesn't pay off.
    applyPenalty(wrong);
    const now = performance.now();
    if (now - state.lastWrongLine > 1500) {
      state.lastWrongLine = now;
      const special = ['virusFiled', 'recycleWrong'].find((n) => notes.has(n));
      const prefix = !special && itemIds.length > 1 ? `${wrong} of those ${itemIds.length} files don't go there. ` : '';
      narrator.say(prefix + line(level.narrator, special ?? 'wrong'), 'wrong');
    } else {
      narrator.play('wrong');
    }
  } else if (notes.has('virusDeleted')) {
    sfx.play('ding');
    narrator.say(line(level.narrator, 'virusDeleted'), 'correct');
  } else if (['zipRecycle', 'zip', 'program'].some((n) => notes.has(n))) {
    narrator.say(line(level.narrator, ['zipRecycle', 'zip', 'program'].find((n) => notes.has(n))), 'talk');
  } else if (right) {
    const crossedFive = Math.floor(game.streak / 5) > Math.floor(streakBefore / 5);
    if (crossedFive) narrator.say(line(level.narrator, 'streak'), 'correct');
    else if (!narrator.speaking && Math.random() < 0.15) narrator.say(line(level.narrator, 'correct'), 'correct');
  }
  refreshFolderWindow(folderId);
  return results;
}

function applyPenalty(times = 1) {
  if (!state.timer?.running) return;
  state.timer.penalize(state.level.penalty * times);
  flashPenalty();
}

/**
 * A level is done when every file is sorted, no zips are left (some levels are only empty zips)
 * and no viruses are left on the desktop. Unused helper programs don't matter.
 */
const levelCleared = () =>
  state.game.isComplete() && state.zips.size === 0 && ![...state.exes.values()].some((x) => x.virus);

function finishLevelSoon(delay) {
  const runId = state.runId;
  desktop.setLocked(true);
  setTimeout(() => levelComplete(runId), delay);
}

/** Anything that can be on the desktop: file, zip or program. */
const entryById = (id) => state.game.item(id) ?? state.zips.get(id) ?? state.exes.get(id);

/* ---------- Programs (.exe) ---------- */
/**
 * Windows Defender alert after running a virus. Non-modal on purpose: it lands in the middle
 * of the desktop, on top of your files, so you have to deal with it (like real pop-ups).
 */
function showDefenderAlert(exe) {
  const { level } = state;
  const okBtn = el('button', { type: 'button', className: 'btn default' }, 'OK');
  const win = createWindow({
    id: `defender-${exe.id}`,
    title: 'Windows Defender',
    icon: 'defender',
    width: 360,
    className: 'defender-window',
    content: el('div', { className: 'defender' },
      el('div', { className: 'defender-head' },
        el('span', { className: 'defender-shield', 'aria-hidden': 'true' }, '🛡️'),
        el('div', {},
          el('strong', {}, 'Windows Defender stopped a malicious program'),
          el('div', { className: 'defender-sub' }, 'Alert level: Severe'))),
      el('div', { className: 'defender-body' },
        el('p', {}, 'Windows Defender stopped ', el('strong', {}, `"${exe.displayName}"`), ' from running and removed it from your computer.'),
        level.timed ? el('p', { className: 'defender-cost' }, `Time lost: ${level.penalty} seconds`) : null,
        el('p', { className: 'defender-tip' }, 'Tip: drag suspicious programs to the Recycle Bin instead of running them.'),
        el('div', { className: 'pw-buttons' }, okBtn))),
    onClose: () => state.extractions.delete(close),
  });
  const close = () => win.close();
  state.extractions.add(close); // closed on level change / time up
  okBtn.addEventListener('click', close);
  okBtn.focus();
}

function removeExe(exe) {
  exe.abort?.();
  state.exes.delete(exe.id);
  state.recycled.push(exe);
  refreshFolderWindow('recycle');
  updateStatus();
}

async function openExe(exe) {
  if (exe.busy || desktop.locked) return;
  const { level } = state;
  const runId = state.runId;

  if (exe.virus) {
    // Running a virus: it eats some time and glitches off the desktop. No dialog to dismiss.
    sfx.play('error');
    state.game.penalize();
    applyPenalty();
    state.exes.delete(exe.id);
    desktop.zap(exe.id, level.timed ? `-${level.penalty}s` : 'INFECTED');
    updateStatus();
    narrator.say(line(level.narrator, 'virusRun'), 'wrong');
    showDefenderAlert(exe);
    if (levelCleared()) finishLevelSoon(600);
    return;
  }

  exe.busy = true;
  desktop.setZipState(exe.id, { busy: true });
  const label = FOLDERS[exe.target].label;
  const abort = startProgress({
    id: `run-${exe.id}`,
    title: exe.displayName,
    icon: 'exe',
    heading: `${exe.displayName} is sorting your files...`,
    steps: ['Scanning desktop...', `Finding files for ${label}...`, `Moving files to ${label}...`],
    idleText: 'Working...',
    duration: 900,
    anim: ['💾', '📄', '📁'],
    onDone: () => {
      state.extractions.delete(abort);
      exe.abort = null;
      if (runId !== state.runId) return;
      // Sort every matching file currently on the desktop, then the program deletes itself.
      const ids = desktop.visibleIds().filter((id) => state.game.item(id)?.correct === exe.target);
      state.exes.delete(exe.id);
      desktop.removeEntry(exe.id);
      if (ids.length) {
        desktop.fileMany(ids, exe.target);
        if (!desktop.locked) narrator.say(line(level.narrator, 'helper'), 'correct');
      } else {
        narrator.say(line(level.narrator, 'helperNothing'), 'talk');
        if (levelCleared()) finishLevelSoon(250);
      }
    },
    onCancel: () => {
      state.extractions.delete(abort);
      exe.abort = null;
      exe.busy = false;
      desktop.setZipState(exe.id, { busy: false });
    },
  });
  exe.abort = abort;
  state.extractions.add(abort);
}
async function openZip(zip) {
  if (zip.prompting) { getWindow(passwordWindowId(zip))?.restore(); return; }
  if (zip.busy || zip.extracted || desktop.locked) return;
  const { level } = state;
  const runId = state.runId;

  if (zip.locked) {
    // Non-modal prompt: the player can still open password.txt while it's up.
    zip.prompting = true;
    narrator.say(line(level.narrator, 'locked'), 'talk');
    const unlocked = await promptPassword(zip, {
      onWrong: () => {
        sfx.play('error');
        narrator.say(line(level.narrator, 'badPassword'), 'wrong');
      },
    });
    zip.prompting = false;
    if (runId !== state.runId || !unlocked || desktop.locked) return;
    zip.locked = false;
    desktop.setZipState(zip.id, { locked: false });
    narrator.say(line(level.narrator, 'unlocked'), 'correct');
  }

  zip.busy = true;
  desktop.setZipState(zip.id, { busy: true });
  // Files, programs and nested zips all come out together.
  const entries = zip.contents.map(entryById).filter(Boolean);
  const abort = startExtraction(zip, entries, {
    onDone: () => {
      state.extractions.delete(abort);
      if (runId !== state.runId) return;
      zip.busy = false;
      zip.extracted = true;
      const origin = desktop.positionOf(zip.id) ?? { x: 200, y: 150 };
      desktop.removeEntry(zip.id);
      state.zips.delete(zip.id);
      for (const e of entries) e.zip = null; // now on the desktop
      desktop.addFiles(entries, origin);
      updateStatus();
      if (levelCleared()) {
        finishLevelSoon(400);
        return;
      }
      sfx.tone('notify');
      if (!entries.length) narrator.say(line(level.narrator, 'empty'), 'talk');
      else if (!narrator.speaking) narrator.say(line(level.narrator, 'extracted'), 'correct');
    },
    onCancel: () => {
      state.extractions.delete(abort);
      if (runId !== state.runId) return;
      zip.busy = false;
      desktop.setZipState(zip.id, { busy: false });
    },
  });
  state.extractions.add(abort);
}

function onTick(seconds, runId) {
  if (runId !== state.runId) return;
  showTimer(seconds);
  if (seconds <= 10 && seconds > 0 && !state.hurried) {
    state.hurried = true;
    sfx.play('notify');
    narrator.say(line(state.level.narrator, 'hurry'), 'hurry');
  }
}

async function levelComplete(runId) {
  if (runId !== state.runId) return;
  const { level, game } = state;
  const timeLeft = state.timer?.remaining ?? 0;
  stopTimer();
  markCompleted(level.id);
  sfx.play('ding');
  narrator.say(line(level.narrator, 'win'), 'win');

  const last = state.index === LEVELS.length - 1;
  const lines = [
    game.items.length
      ? `${level.name}: all ${game.correct} files sorted!`
      : `${level.name}: extracted ${level.zips} zips containing a grand total of 0 files.`,
    '',
    `Mistakes: ${game.mistakes}`,
    level.timed ? `Time remaining: ${formatTime(timeLeft)}` : null,
    `Score: ${game.score(timeLeft).toLocaleString()}`,
  ].filter((l) => l !== null);
  const choice = await showDialog({
    title: 'Level Complete',
    message: lines.join('\n'),
    icon: 'info',
    buttons: [{ label: last ? 'Finish' : 'Next Level', value: 'next' }, { label: 'Replay', value: 'replay' }],
  });
  if (runId !== state.runId) return;
  if (choice === 'replay') startLevel(state.index);
  else if (last) finishGame();
  else startLevel(state.index + 1);
}

async function onExpire(runId) {
  if (runId !== state.runId) return;
  desktop.setLocked(true);
  // Close password prompts and stop extractions that were still running.
  for (const abort of state.extractions) abort();
  state.extractions.clear();
  dismissDialogs();
  closePasswordPrompts();
  showTimer(0);
  sfx.play('error');
  narrator.say(line(state.level.narrator, 'fail'), 'fail');
  const choice = await showDialog({
    title: 'Time Expired',
    message: `Kalimba 95 has run out of time.\n\n${state.game.remaining} file(s) were left unsorted.`,
    icon: 'error',
    buttons: [{ label: 'Retry', value: 'retry' }, { label: 'Skip Level', value: 'skip' }],
  });
  if (runId !== state.runId) return;
  if (choice === 'skip' && state.index < LEVELS.length - 1) startLevel(state.index + 1);
  else if (choice === 'skip') finishGame();
  else startLevel(state.index);
}

function finishGame() {
  state.runId++;
  stopTimer();
  cleanupLevel();
  stopMedia();
  narrator.hideBubble();
  showShutdown();
}

/* ---------- Start menu actions ---------- */
async function logOff() {
  const choice = await withTimerPaused(() => showDialog({
    title: 'Log Off Windows', icon: 'question', message: 'Are you sure you want to log off?',
    buttons: [{ label: 'Log Off', value: 'logoff' }, { label: 'Cancel', value: 'cancel' }],
  }));
  if (choice !== 'logoff') return;
  state.runId++;
  stopTimer();
  cleanupLevel();
  stopMedia();
  desktop.setLocked(true);
  narrator.hideBubble();
  await showWelcome();
  startLevel(state.index);
}

async function turnOff() {
  const choice = await withTimerPaused(() => showDialog({
    title: 'Turn off computer', icon: 'question', message: 'What do you want the computer to do?',
    buttons: [{ label: 'Turn Off', value: 'off' }, { label: 'Restart', value: 'restart' }, { label: 'Cancel', value: 'cancel' }],
  }));
  if (choice === 'off') finishGame();
  else if (choice === 'restart') location.reload();
}

function showHelp() {
  return showDialog({
    title: 'Help and Support',
    icon: 'info',
    message: [
      'Drag every file on the desktop into the correct folder.',
      'Each level tells you its rule. Songs (.mp3) always go in My Music and text files (.txt) in My Documents.',
      'File names can lie! Trust the picture and the file type.',
      'Zip files (.zip) must be extracted first: double-click one and wait for the progress bar. Zips can contain more zips. A locked zip (🔒) needs the password written in password.txt.',
      'Programs (.exe): helpers like DogSorter.exe sort every matching file on the desktop when you run them. Viruses belong in the Recycle Bin (drag them there, or select them and press Delete). Double-clicking a virus gets rid of it too, but costs time, and so does filing one in a folder.',
      'Double-click a folder to see the files you already put in it. You can open them from there too.',
      'Levels 1-5 are relaxed. From level 6 on there is a timer, and every file dropped in the wrong folder costs seconds.',
      'Select several files at once: drag a box around them on the empty desktop, or Ctrl+click them. Ctrl+A selects everything. Drag any selected file to move them all.',
      'Keyboard: Tab to a file, Space adds it to the selection, and 1-9 moves the selection into that folder. Enter opens a file.',
      'Use Start > All Levels to jump to any level.',
    ].join('\n\n'),
  });
}

/* ---------- Windows ---------- */
function openSystem(id) {
  if (id === 'media-player') openMediaPlayer();
  else if (id === 'my-computer') openMyComputer();
  else if (id === 'recycle-bin') openRecycleBin();
}

function explorerIcon(fallback, label) {
  return el('div', { className: 'icon' }, iconGraphic(null, { size: 36, fallback }), el('span', { className: 'icon-label' }, label));
}

function openMyComputer() {
  createWindow({
    id: 'my-computer', title: 'My Computer', icon: 'my-computer', width: 380,
    content: el('div', { className: 'explorer' },
      explorerIcon('💾', '3½ Floppy (A:)'),
      explorerIcon('💽', 'Local Disk (C:)'),
      explorerIcon('💿', 'CD Drive (D:)'),
      explorerIcon('🎛️', 'Control Panel')),
  });
}

function recycleContent() {
  if (!state.recycled.length) {
    return el('div', { className: 'window-text' }, 'The Recycle Bin is empty.\nOnly viruses belong in here. Everything else goes in a folder.');
  }
  return el('div', { className: 'explorer' }, ...state.recycled.map((entry) =>
    el('div', { className: 'icon', title: entry.displayName }, entryGraphic(entry, 36), el('span', { className: 'icon-label' }, entry.displayName))));
}

function openRecycleBin() {
  createWindow({ id: 'recycle-bin', title: 'Recycle Bin', icon: 'recycle-bin', width: 340, content: recycleContent() });
}

function openFile(itemId) {
  const zip = state.zips.get(itemId);
  if (zip) { openZip(zip); return; }
  const exe = state.exes.get(itemId);
  if (exe) { openExe(exe); return; }
  const item = state.game?.item(itemId);
  if (!item) return;
  if (item.kind === 'photo') {
    getWindow('viewer')?.close();
    createWindow({
      id: 'viewer', title: `${item.displayName} - Windows Picture and Fax Viewer`, icon: item.ext, width: 320,
      content: el('div', { className: 'viewer' }, photoGraphic(item, 280)),
    });
  } else if (item.kind === 'audio') {
    getWindow('fake-audio')?.close();
    createWindow({
      id: 'fake-audio', title: item.displayName, icon: 'mp3', width: 300,
      content: el('div', { className: 'window-text' },
        `${item.displayName} is 0 KB. It's not a real song, but it still belongs in My Music.\n\nFor real music, open Windows Media Player.`),
    });
  } else {
    // Notepad. Placed at the top-left so it can stay open, readable, next to a password prompt.
    getWindow('notepad')?.close();
    createWindow({
      id: 'notepad', title: `${item.displayName} - Notepad`, icon: 'txt', width: 300, x: 110, y: 20,
      content: el('div', { className: 'notepad', tabindex: '0', 'aria-label': `${item.displayName} contents` }, item.content ?? ''),
    });
  }
}

/* ---------- Folder windows (what's already been filed) ---------- */
function folderContent(fid) {
  const files = state.game?.filedIn(fid) ?? [];
  if (!files.length) return el('div', { className: 'explorer explorer-empty' }, 'This folder is empty.');
  return el('div', { className: 'explorer' }, ...files.map((item) => {
    const node = el('div', { className: 'icon', tabindex: '0', role: 'button', title: item.displayName, 'aria-label': `${item.displayName}. Press Enter to open.` },
      entryGraphic(item, 36), el('span', { className: 'icon-label' }, item.displayName));
    node.addEventListener('dblclick', () => openFile(item.id));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') openFile(item.id); });
    return node;
  }));
}

function openFolder(fid) {
  const label = FOLDERS[fid]?.label ?? fid;
  createWindow({ id: `folder-${fid}`, title: label, icon: 'folder', width: 380, content: folderContent(fid) });
}

function refreshFolderWindow(fid) {
  if (fid === 'recycle') getWindow('recycle-bin')?.body.replaceChildren(recycleContent());
  else getWindow(`folder-${fid}`)?.body.replaceChildren(folderContent(fid));
}

/* ---------- Boot ---------- */
/** The CSS placeholder sky gets drifting clouds; a real Bliss photo already has its own. */
function detectWallpaperPhoto() {
  const img = new Image();
  img.onload = () => $('wallpaper').classList.add('has-photo');
  img.onerror = () => startClouds($('wallpaper'));
  img.src = 'assets/wallpaper/bliss.jpg';
}

async function init() {
  startClock();
  detectWallpaperPhoto();
  const requested = Number.parseInt(params.get('level') ?? '', 10);
  const startIndex = requested >= 1 && requested <= LEVELS.length ? requested - 1 : 0;
  if (params.has('skipboot')) {
    hideBootScreens();
    document.addEventListener('pointerdown', sfx.unlockAudio, { once: true });
  } else {
    await runBoot();
  }
  startLevel(startIndex);
}

init();
