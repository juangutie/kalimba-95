// Windows Media Player with the Windows 7 sample music. Swap tracks by editing TRACKS.
import { el, ASSET } from './assets.js';
import { createWindow, getWindow } from './windows.js';

export const TRACKS = [
  { title: 'Kalimba', artist: 'Mr. Scruff', album: 'Ninja Tuna', file: 'kalimba.mp3' },
  { title: 'Maid with the Flaxen Hair', artist: 'Richard Stoltzman', album: 'Fine Music, Vol. 1', file: 'maid-with-the-flaxen-hair.mp3' },
  { title: 'Sleep Away', artist: 'Bob Acri', album: 'Bob Acri', file: 'sleep-away.mp3' },
];

const WIN_ID = 'wmp';
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.8;

let index = 0;
let ui = null;
let seeking = false;
let status = 'Ready';
const durations = TRACKS.map(() => NaN);
let probed = false;

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--');

function setStatus(text) {
  status = text;
  if (ui) ui.status.textContent = text;
}

function load(i, autoplay) {
  index = (i + TRACKS.length) % TRACKS.length;
  audio.src = ASSET.audio(TRACKS[index].file);
  setStatus('Opening media...');
  if (autoplay) audio.play().catch(() => {});
  render();
}

function toggle() {
  if (!audio.src) load(index, true);
  else if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function stop() {
  audio.pause();
  if (audio.src) audio.currentTime = 0;
  setStatus('Stopped');
}

function probeDurations() {
  if (probed) return;
  probed = true;
  TRACKS.forEach((track, i) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => { durations[i] = a.duration; render(); }, { once: true });
    a.src = ASSET.audio(track.file);
  });
}

function render() {
  if (!ui) return;
  const track = TRACKS[index];
  ui.title.textContent = track.title;
  ui.meta.textContent = `${track.artist} — ${track.album}`;
  ui.play.textContent = audio.paused ? '▶' : '❚❚';
  ui.play.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  ui.list.querySelectorAll('button').forEach((btn, i) => {
    btn.setAttribute('aria-current', String(i === index));
    btn.lastChild.textContent = fmt(durations[i]);
  });
  updateTime();
  ui.status.textContent = status;
}

function updateTime() {
  if (!ui) return;
  const dur = Number.isFinite(audio.duration) ? audio.duration : durations[index];
  ui.time.textContent = `${fmt(audio.currentTime || 0)} / ${fmt(dur)}`;
  if (!seeking && Number.isFinite(dur) && dur > 0) ui.seek.value = String(Math.round((audio.currentTime / dur) * 1000));
}

audio.addEventListener('play', () => { setStatus('Playing'); render(); });
audio.addEventListener('pause', () => { if (status === 'Playing') setStatus('Paused'); render(); });
audio.addEventListener('timeupdate', updateTime);
audio.addEventListener('loadedmetadata', () => { durations[index] = audio.duration; render(); });
audio.addEventListener('ended', () => load(index + 1, true));
audio.addEventListener('error', () => { if (audio.src) setStatus('Windows Media Player cannot find the file.'); render(); });

function build() {
  const btn = (label, glyph, onClick, extra = '') =>
    el('button', { type: 'button', className: `wmp-btn ${extra}`, 'aria-label': label, title: label, onClick }, glyph);

  const seek = el('input', { type: 'range', className: 'wmp-seek', min: '0', max: '1000', value: '0', 'aria-label': 'Seek' });
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('pointerup', () => { seeking = false; });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
  });

  const vol = el('input', { type: 'range', className: 'wmp-vol', min: '0', max: '100', value: String(Math.round(audio.volume * 100)), 'aria-label': 'Volume' });
  vol.addEventListener('input', () => { audio.volume = Number(vol.value) / 100; });

  const list = el('ol', { className: 'wmp-playlist', 'aria-label': 'Playlist' },
    ...TRACKS.map((t, i) => el('li', {},
      el('button', { type: 'button', onClick: () => load(i, true) }, el('span', {}, `${t.title} — ${t.artist}`), el('span', {}, '--:--')))));

  ui = {
    title: el('div', { className: 'wmp-title' }),
    meta: el('div', { className: 'wmp-meta' }),
    time: el('div', { className: 'wmp-time' }),
    play: btn('Play', '▶', toggle, 'play'),
    status: el('div', { className: 'wmp-status', 'aria-live': 'polite' }),
    seek,
    list,
  };

  return el('div', { className: 'wmp' },
    el('div', { className: 'wmp-now' },
      el('div', { className: 'wmp-art', 'aria-hidden': 'true' }, '🎵'),
      el('div', { className: 'wmp-info' }, ui.title, ui.meta, ui.time)),
    seek,
    el('div', { className: 'wmp-controls' },
      btn('Previous', '⏮', () => load(index - 1, !audio.paused)),
      ui.play,
      btn('Stop', '■', stop),
      btn('Next', '⏭', () => load(index + 1, !audio.paused)),
      el('span', { className: 'wmp-vol-label', 'aria-hidden': 'true' }, '🔊'),
      vol),
    list,
    ui.status);
}

export function openMediaPlayer() {
  const existing = getWindow(WIN_ID);
  if (existing) { existing.restore(); return existing; }
  const content = build();
  const win = createWindow({
    id: WIN_ID, title: 'Windows Media Player', icon: 'media-player', width: 360, className: 'wmp-window', content,
    alwaysInteractive: true,
    onClose: () => { stop(); ui = null; },
  });
  probeDurations();
  render();
  return win;
}

export function stopMedia() {
  audio.pause();
}
