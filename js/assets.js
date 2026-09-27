// Asset paths + tiny DOM helpers. Every image falls back to an emoji/CSS placeholder if the file is missing.

export const ASSET = {
  icon: (name) => `assets/icons/${name}.png`,
  sprite: (name) => `assets/sprites/${name}.png`,
  spriteData: (name) => `assets/sprites/${name}.json`,
  spriteAgent: (name) => `assets/sprites/${name}.agent.js`,
  audio: (file) => `assets/audio/${file}`,
  sfx: (name) => `assets/sfx/${name}.mp3`,
};

export const ICON_FALLBACK = {
  folder: '📁',
  jpg: '🖼️',
  png: '🖼️',
  mp3: '🎵',
  txt: '📝',
  zip: '🗜️',
  exe: '⚙️',
  virus: '🦠',
  defender: '🛡️',
  'my-computer': '🖥️',
  'recycle-bin': '🗑️',
  'media-player': '▶️',
};

const missing = new Set();

/** Create an element. props: className, style (string), dataset, text, on<event> handlers, other attributes. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Icon from assets/icons/<name>.png, or a fallback glyph if the file is missing.
 * Pass name = null to skip the image and use the fallback directly.
 */
export function iconGraphic(name, { size = 32, fallback } = {}) {
  const wrap = el('span', { className: 'icon-graphic', style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
  const glyph = fallback ?? ICON_FALLBACK[name] ?? '❔';
  const showFallback = () => {
    wrap.replaceChildren(glyph);
    wrap.classList.add('fallback');
    wrap.style.fontSize = `${Math.round(size * 0.78)}px`;
  };
  const src = name ? ASSET.icon(name) : null;
  if (!src || missing.has(src)) {
    showFallback();
  } else {
    const img = el('img', { src, alt: '', draggable: 'false' });
    img.addEventListener('error', () => { missing.add(src); showFallback(); }, { once: true });
    wrap.append(img);
  }
  return wrap;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
