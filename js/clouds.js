// Drifting clouds for the CSS placeholder sky, in three parallax layers:
// far clouds are small, faint and slow; near clouds are big, bright and fast.
// Clouds spawn off the left edge, drift across, and are removed once off screen.
//
// Moved with requestAnimationFrame (not CSS animations), so the page-wide reduced-motion
// CSS rule can't freeze them. With prefers-reduced-motion they drift at a gentler speed.

const LAYERS = {
  far:  { scale: [0.45, 0.65], speed: [18, 26], alpha: 0.5,  blur: 2.5, top: [4, 28],  z: 1 },
  mid:  { scale: [0.8, 1.1],   speed: [36, 48], alpha: 0.72, blur: 1.6, top: [6, 34],  z: 2 },
  near: { scale: [1.3, 1.75],  speed: [65, 85], alpha: 0.88, blur: 1,   top: [14, 40], z: 3 },
};
// Far clouds are the most common, near ones rarer so they stay special.
const SPAWN_ORDER = ['far', 'mid', 'far', 'near', 'mid', 'far', 'mid'];
const MAX_CLOUDS = 12;
const START_X = -320; // fully off the left edge, even for the biggest cloud

const rand = (min, max) => min + Math.random() * (max - min);

export function startClouds(wallpaper) {
  const sky = document.createElement('div');
  sky.className = 'clouds';
  sky.setAttribute('aria-hidden', 'true');
  wallpaper.append(sky);

  const gentle = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speedFactor = gentle ? 0.35 : 1;
  const clouds = [];
  let turn = 0;

  /** progress 0..1 = how far across the screen the cloud starts (for the initial sky). */
  function spawn(layerName, progress = 0) {
    if (clouds.length >= MAX_CLOUDS) return;
    const layer = LAYERS[layerName];
    const scale = rand(...layer.scale);
    const node = document.createElement('i');
    node.className = `cloud cloud-${layerName}`;
    node.style.cssText = `top:${rand(...layer.top).toFixed(1)}%;--alpha:${layer.alpha};--blur:${layer.blur}px;z-index:${layer.z}`;
    const cloud = {
      node, scale,
      x: START_X + progress * (innerWidth - START_X),
      speed: rand(...layer.speed) * speedFactor,
    };
    place(cloud);
    sky.append(node);
    clouds.push(cloud);
  }

  function place(cloud) {
    cloud.node.style.transform = `translate3d(${cloud.x.toFixed(1)}px, 0, 0) scale(${cloud.scale.toFixed(2)})`;
  }

  // Start with a sky that already has clouds at various points of their journey.
  for (const [name, progress] of [['far', 0.15], ['mid', 0.35], ['far', 0.55], ['near', 0.7], ['mid', 0.85], ['far', 0.92]]) {
    spawn(name, progress);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); // clamp so a background tab doesn't teleport clouds
    last = now;
    for (let i = clouds.length - 1; i >= 0; i--) {
      const cloud = clouds[i];
      cloud.x += cloud.speed * dt;
      if (cloud.x > innerWidth + 40) {
        cloud.node.remove();
        clouds.splice(i, 1);
      } else {
        place(cloud);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const loop = () => {
    if (!document.hidden) spawn(SPAWN_ORDER[turn++ % SPAWN_ORDER.length]);
    setTimeout(loop, rand(6000, 11000));
  };
  setTimeout(loop, rand(2000, 5000));
}

