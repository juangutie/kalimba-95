// Narrator: Clippy / BonziBUDDY sprite animation + yellow speech balloon.
//
// Sprite data (optional, drop in assets/sprites/):
//   <name>.png          sprite sheet
//   <name>.json         { "framesize": [w, h], "animations": { "Wave": { "frames": [ { "duration": 100, "images": [[x, y]] }, ... ] } } }
//   or <name>.agent.js  the clippy.js-style agent file; the JSON object inside it is parsed (data only, no library)
// Optional "map" in the JSON overrides which animation plays per event, e.g. "map": { "greet": "Wave" }.
// Without sprite data, an emoji placeholder with CSS animations is shown.
import { el, ASSET } from './assets.js';
import { line } from './dialogue.js';

const CHARACTERS = {
  clippy: {
    name: 'Clippy',
    placeholder: '📎',
    anims: {
      rest: ['RestPose'],
      idle: ['Idle1_1', 'IdleSideToSide', 'IdleEyeBrowRaise', 'IdleAtom'],
      greet: ['Greeting', 'Wave'],
      talk: ['Explain', 'GestureRight'],
      correct: ['Congratulate'],
      wrong: ['Alert', 'GetAttention'],
      hurry: ['GetAttention', 'Alert'],
      win: ['Congratulate', 'GetArtsy'],
      fail: ['EmptyTrash', 'Alert'],
    },
  },
  bonzi: {
    name: 'BonziBUDDY',
    placeholder: '🦍',
    anims: {
      rest: ['RestPose'],
      idle: ['Idle1_1', 'Idle1_2', 'Idle2_1'],
      greet: ['Greet', 'Greeting', 'Wave'],
      talk: ['Explain', 'Speak', 'GestureRight'],
      correct: ['Pleased', 'Congratulate'],
      wrong: ['Surprised', 'Alert', 'Sad'],
      hurry: ['GetAttention', 'Alert'],
      win: ['Congratulate', 'Pleased'],
      fail: ['Sad', 'Surprised'],
    },
  },
};

const PH_CLASSES = ['greet', 'idle', 'talk', 'correct', 'wrong', 'hurry', 'win', 'fail'].map((e) => `ph-${e}`);
const MAX_FRAMES = 240;
const cache = {};

async function fetchData(key) {
  try {
    const res = await fetch(ASSET.spriteData(key));
    if (res.ok) return await res.json();
  } catch { /* fall through */ }
  try {
    const res = await fetch(ASSET.spriteAgent(key));
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    }
  } catch { /* fall through */ }
  return null;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadCharacter(key) {
  cache[key] ??= Promise.all([fetchData(key), loadImage(ASSET.sprite(key))]).then(([data, img]) =>
    data?.framesize && data?.animations && img ? { data, img } : null);
  return cache[key];
}

export function createNarrator(root) {
  const live = el('div', { className: 'visually-hidden', 'aria-live': 'polite' });
  const nameEl = el('strong', { className: 'balloon-name' });
  const textEl = el('span', { className: 'balloon-text', 'aria-hidden': 'true' });
  const balloon = el('div', { className: 'balloon', hidden: true, title: 'Click to dismiss' }, nameEl, textEl);
  const body = el('div', { className: 'narrator-body', title: 'Click for a tip' });
  root.append(live, balloon, body);

  let key = null;
  let sheet = null;    // { data, img } when a real sprite is loaded
  let sprite = null;   // sprite <div>
  let speaking = false;
  let typing = false;
  let currentText = '';
  let typeTimer = null;
  let hideTimer = null;
  let animTimer = null;
  let phTimer = null;
  let animToken = 0;

  balloon.addEventListener('click', () => (typing ? finishTyping() : hideBubble()));
  body.addEventListener('click', () => key && say(line(key, 'idle'), 'talk'));

  /* ---------- Sprite rendering ---------- */
  function resolveAnim(event) {
    if (!sheet) return null;
    const { animations, map } = sheet.data;
    const names = [...(map?.[event] ? [map[event]] : []), ...(CHARACTERS[key].anims[event] ?? [])];
    for (const name of names) if (animations[name]?.frames?.length) return animations[name];
    return null;
  }

  function setFrame([x, y]) {
    sprite.style.backgroundPosition = `${-x}px ${-y}px`;
  }

  function showRest() {
    const anim = resolveAnim('rest') ?? Object.values(sheet.data.animations)[0];
    const frame = anim?.frames?.find((f) => f.images?.length);
    if (frame) setFrame(frame.images[0]);
  }

  function renderPlaceholder() {
    sheet = null;
    sprite = null;
    body.replaceChildren(el('div', { className: `narrator-ph ${key}`, 'aria-hidden': 'true' }, CHARACTERS[key].placeholder));
  }

  function renderSprite(loaded) {
    sheet = loaded;
    const [w, h] = loaded.data.framesize;
    sprite = el('div', {
      className: 'narrator-sprite', 'aria-hidden': 'true',
      style: `width:${w}px;height:${h}px;background-image:url("${loaded.img.src}")`,
    });
    body.replaceChildren(sprite);
    showRest();
  }

  function play(event) {
    animToken++;
    clearTimeout(animTimer);
    clearTimeout(phTimer);
    if (!sprite) {
      const ph = body.firstElementChild;
      if (!ph) return;
      ph.classList.remove(...PH_CLASSES);
      void ph.offsetWidth; // restart CSS animation
      ph.classList.add(`ph-${event}`);
      phTimer = setTimeout(() => ph.classList.remove(`ph-${event}`), 1800);
      return;
    }
    const anim = resolveAnim(event);
    if (!anim) return showRest();
    const token = animToken;
    let i = 0;
    const step = () => {
      if (token !== animToken) return;
      const frame = anim.frames[i++];
      if (!frame || i > MAX_FRAMES) return showRest();
      if (frame.images?.length) setFrame(frame.images[0]);
      animTimer = setTimeout(step, Math.max(40, frame.duration || 100));
    };
    step();
  }

  /* ---------- Speech balloon ---------- */
  function finishTyping() {
    clearInterval(typeTimer);
    typing = false;
    textEl.textContent = currentText;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBubble, 2500 + currentText.length * 40);
  }

  function hideBubble() {
    clearInterval(typeTimer);
    clearTimeout(hideTimer);
    balloon.hidden = true;
    speaking = false;
    typing = false;
  }

  function say(text, event = 'talk') {
    if (!text) return;
    clearInterval(typeTimer);
    clearTimeout(hideTimer);
    currentText = text;
    balloon.hidden = false;
    textEl.textContent = '';
    live.textContent = text;
    speaking = true;
    typing = true;
    let i = 0;
    typeTimer = setInterval(() => {
      i += 2;
      textEl.textContent = text.slice(0, i);
      if (i >= text.length) finishTyping();
    }, 30);
    play(event);
  }

  function setCharacter(next) {
    if (next === key || !CHARACTERS[next]) return;
    key = next;
    nameEl.textContent = CHARACTERS[next].name;
    hideBubble();
    renderPlaceholder();
    loadCharacter(next).then((loaded) => {
      if (key === next && loaded) renderSprite(loaded);
    });
  }

  // Occasional idle animation.
  setInterval(() => {
    if (key && !speaking && !document.hidden) play('idle');
  }, 20000);

  return {
    setCharacter,
    say,
    play,
    hideBubble,
    get speaking() { return speaking; },
    /** Area the desktop should keep clear of files (sized for the largest sprite). */
    reservedRect() {
      const b = body.getBoundingClientRect();
      return { left: b.left, right: b.left + Math.max(b.width, 210), bottom: b.bottom, top: b.bottom - Math.max(b.height, 170) };
    },
  };
}
