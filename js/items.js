// Item model: photo pools, folders, seeded RNG, per-level file generation and the sorting rule.
// Kept DOM-free so it can be shared by game, desktop and main.

// Photos live at assets/photos/<pool>/<prefix><NN>.jpg, e.g. assets/photos/dogs/dog07.jpg
export const POOLS = {
  dogs:   { prefix: 'dog',    count: 30, emoji: '🐶' },
  cats:   { prefix: 'cat',    count: 30, emoji: '🐱' },
  red:    { prefix: 'red',    count: 15, swatch: '#b5473b' },
  green:  { prefix: 'green',  count: 15, swatch: '#5b8c3f' },
  blue:   { prefix: 'blue',   count: 15, swatch: '#3e6aa8' },
  yellow: { prefix: 'yellow', count: 15, swatch: '#d4b23c' },
};

export const FOLDERS = {
  dogs:      { label: 'Dogs', emblem: '🐶' },
  cats:      { label: 'Cats', emblem: '🐱' },
  red:       { label: 'Red', swatch: POOLS.red.swatch },
  green:     { label: 'Green', swatch: POOLS.green.swatch },
  blue:      { label: 'Blue', swatch: POOLS.blue.swatch },
  yellow:    { label: 'Yellow', swatch: POOLS.yellow.swatch },
  music:     { label: 'My Music', emblem: '🎵' },
  documents: { label: 'My Documents', emblem: '📄' },
};

export const photoPath = (pool, n) =>
  `assets/photos/${pool}/${POOLS[pool].prefix}${String(n).padStart(2, '0')}.jpg`;

// Names that honestly describe a file.
const HONEST = {
  dogs: ['rex', 'buddy', 'fido', 'biscuit', 'max', 'good_boy', 'rover', 'pupper'],
  cats: ['whiskers', 'mittens', 'luna', 'tabby', 'felix', 'socks', 'kitty', 'mr_fluff'],
  music: ['track01', 'bossa_nova', 'chill_mix', 'demo_final', 'jam_session', 'lullaby', 'theme_song'],
  documents: ['notes', 'budget', 'letter', 'todo', 'minutes', 'thesis_v2', 'recipe'],
};

// Names that point at a *different* folder. They never change the correct answer.
const DECOY = {
  dogs: ['dog', 'puppy', 'woof', 'doggo'],
  cats: ['cat', 'kitten', 'meow', 'purr'],
  red: ['red', 'crimson', 'cherry', 'ruby'],
  green: ['green', 'forest', 'lime', 'leaf'],
  blue: ['blue', 'ocean', 'sky', 'navy'],
  yellow: ['yellow', 'banana', 'lemon', 'sunny'],
  music: ['song', 'kalimba', 'mixtape', 'track_02', 'sleep_away'],
  documents: ['report', 'resume', 'homework', 'essay_final', 'passwords'],
};

/* ---------- Seeded RNG (mulberry32) ---------- */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Rules ---------- */

/** Folder ids shown on the desktop for a level, in display order. */
export function folderIdsFor(level) {
  // password.txt is a text file, so levels with locked zips always need My Documents.
  const needsDocs = level.texts || level.locked;
  return [...level.pools, ...(level.audio ? ['music'] : []), ...(needsDocs ? ['documents'] : [])];
}

/** The one correct folder for an item. The display name is never consulted. */
export function correctFolder(item) {
  if (item.kind === 'audio') return 'music';
  if (item.kind === 'text') return 'documents';
  return item.pool;
}

function honestStem(rng, item) {
  if (item.kind === 'audio') return pick(rng, HONEST.music);
  if (item.kind === 'text') return pick(rng, HONEST.documents);
  if (HONEST[item.pool]) return pick(rng, HONEST[item.pool]);
  return pick(rng, ['IMG_', 'DSC0', 'photo_']) + randInt(rng, 1000, 9999);
}

const ZIP_NAMES = [
  'backup', 'stuff', 'old_files', 'New Folder', 'vacation', 'misc', 'downloads', 'archive_2003',
  'my_files', 'desktop_junk', 'DO_NOT_OPEN', 'important', 'from_dad', 'final_FINAL',
];
const PASSWORDS = [
  'hunter2', 'letmein', 'qwerty', 'bonzi4ever', 'iloveclippy', 'kalimba', 'bliss',
  'y2kready', 'password1', 'solitaire', 'minesweeper', 'dialup56k', 'napster', 'geocities',
];
const TEXT_CONTENT = [
  'Remember to defragment the hard drive.\nAlso remember what "defragment" means.',
  'Grocery list:\n- milk\n- eggs\n- 3.5" floppy disks (10 pack)',
  'TODO:\n1. Sort desktop\n2. ???\n3. Profit',
  'Dear diary,\nToday Clippy offered to help me write this entry. I said no.',
  'Q3 budget: $0.00\nQ4 budget: also $0.00',
  'Meeting minutes:\nNothing happened. Meeting adjourned.',
  'AIM screen name ideas:\nxXsorterXx\nfolder_lord_2001\nkalimbafan',
  'Recipe: toast.\n1. Bread.\n2. Toaster.\n3. Wait.',
  'Things to burn onto a CD:\n- Kalimba\n- Sleep Away\n- Kalimba (again)',
];

const zipped = (level) => (level.zips ?? 0) > 0;

// Helpful programs: each one auto-sorts one folder's files.
export const HELPER_NAMES = {
  dogs: 'DogSorter.exe', cats: 'CatHerder.exe', red: 'RedSorter.exe', green: 'GreenSorter.exe',
  blue: 'BlueSorter.exe', yellow: 'YellowSorter.exe', music: 'MusicSorter.exe', documents: 'TextSorter.exe',
};
const VIRUS_NAMES = [
  'VIRUS.exe', 'ILOVEYOU.exe', 'totally_not_a_virus.exe', 'FREE_RAM.exe', 'free_smileys.exe',
  'Y2K_BUG.exe', 'trojan_horse.exe', 'WORM.exe', 'kalimba_FULL_ALBUM.exe', 'you_won_a_prize.exe',
];

/**
 * Build everything for a level. Deterministic for a given level.seed.
 * items: [{ id, kind: 'photo'|'audio'|'text', category, pool?, n?, ext, thumb?, content?, password?, zip?, displayName, correct }]
 * zips:  [{ id, kind: 'zip', ext: 'zip', displayName, locked, password, parent, zip?, contents: [entryId] }]
 *        `contents` holds files, programs and nested zips. `zip` = the zip this one is inside.
 * exes:  [{ id, kind: 'exe', ext: 'exe', displayName, virus, target?, zip? }]
 * Anything with a `zip` id starts hidden inside that archive.
 */
export function generateLevel(level) {
  const rng = makeRng(level.seed);
  const folders = folderIdsFor(level);
  const exts = level.exts ?? ['jpg', 'png'];

  // Split photos evenly across the level's pools so every folder gets a group worth dragging together.
  const perPool = level.pools.map((_, i) =>
    Math.floor(level.photos / level.pools.length) + (i < level.photos % level.pools.length ? 1 : 0));
  const photos = level.pools.flatMap((pool, i) =>
    shuffle(rng, Array.from({ length: POOLS[pool].count }, (_, n) => ({ pool, n: n + 1 }))).slice(0, perPool[i]));

  const raw = [
    ...photos.map((p) => ({
      kind: 'photo', category: p.pool, pool: p.pool, n: p.n, ext: pick(rng, exts), thumb: photoPath(p.pool, p.n),
    })),
    ...Array.from({ length: level.audio ?? 0 }, () => ({ kind: 'audio', category: 'music', ext: 'mp3' })),
    ...Array.from({ length: level.texts ?? 0 }, () => ({
      kind: 'text', category: 'documents', ext: 'txt', content: pick(rng, TEXT_CONTENT),
    })),
  ];

  const used = new Set(['password.txt']);
  const items = shuffle(rng, raw).map((item, i) => {
    const correct = correctFolder(item);
    const others = folders.filter((f) => f !== correct);
    const stem = others.length && rng() < (level.decoy ?? 0)
      ? pick(rng, DECOY[pick(rng, others)])
      : honestStem(rng, item);
    let displayName = `${stem}.${item.ext}`;
    for (let k = 2; used.has(displayName.toLowerCase()); k++) displayName = `${stem} (${k}).${item.ext}`;
    used.add(displayName.toLowerCase());
    return { ...item, id: `f${i}`, displayName, correct };
  });

  // Programs. Helpers target the photo folders with the most files, so running one is worth it.
  const byCount = shuffle(rng, level.pools.length ? level.pools : folders)
    .map((f) => ({ f, n: items.filter((i) => i.correct === f).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const exes = [
    ...byCount.slice(0, level.helpers ?? 0).map((x) => ({ kind: 'exe', virus: false, target: x.f, displayName: HELPER_NAMES[x.f] })),
    ...shuffle(rng, VIRUS_NAMES).slice(0, level.viruses ?? 0).map((displayName) => ({ kind: 'exe', virus: true, displayName })),
  ].map((exe, i) => ({ ...exe, id: `x${i}`, ext: 'exe' }));

  if (!zipped(level)) return { items, zips: [], exes };

  // Build a random tree: the first `zipTop` zips sit on the desktop, each later zip goes inside an earlier one.
  const names = level.zipNames ?? shuffle(rng, ZIP_NAMES);
  const zips = names.slice(0, level.zips).map((name, i) => ({
    id: `z${i}`, kind: 'zip', ext: 'zip', displayName: `${name}.zip`, locked: false, password: null, parent: null, contents: [],
  }));
  const top = Math.max(1, Math.min(level.zipTop ?? 1, zips.length));
  for (let i = top; i < zips.length; i++) {
    const parent = zips[Math.floor(rng() * i)];
    zips[i].parent = parent.id;
    zips[i].zip = parent.id;
    parent.contents.push(zips[i].id);
  }
  const byId = new Map(zips.map((z) => [z.id, z]));
  const insideOf = (z, ancestor) => {
    for (let p = z.parent; p; p = byId.get(p).parent) if (p === ancestor.id) return true;
    return false;
  };

  // At most one locked zip, with password.txt hidden in an unlocked zip outside the locked one.
  let locked = null;
  let pwHost = null;
  if (level.locked) {
    const candidates = shuffle(rng, zips).filter((z) => zips.some((o) => o !== z && !insideOf(o, z)));
    if (!candidates.length) throw new Error('no zip can be locked with a place left for password.txt');
    locked = candidates[0];
    locked.locked = true;
    locked.password = pick(rng, PASSWORDS);
    pwHost = pick(rng, zips.filter((o) => o !== locked && !insideOf(o, locked)));
  }

  // Empty zips: leaves that aren't the locked zip or the password host. Everything else gets files.
  const emptyCandidates = shuffle(rng, zips.filter((z) =>
    z !== locked && z !== pwHost && !z.contents.some((id) => byId.has(id))));
  const empties = new Set(items.length + exes.length ? emptyCandidates.slice(0, level.zipEmpty ?? 0) : zips);
  const fillable = shuffle(rng, zips.filter((z) => !empties.has(z)));
  if ((items.length || exes.length) && !fillable.length) throw new Error('no zip left to hold files');

  // Pack every file and program round-robin: zip levels start with only zips on the desktop.
  shuffle(rng, [...items, ...exes]).forEach((entry, i) => {
    const zip = fillable[i % fillable.length];
    zip.contents.push(entry.id);
    entry.zip = zip.id;
  });

  // password.txt is a text file, so it goes in My Documents too.
  if (locked) {
    const pwItem = {
      id: `f${items.length}`, kind: 'text', category: 'documents', ext: 'txt', password: true,
      displayName: 'password.txt',
      content: ['PASSWORD', '(do NOT share!!)', '', `${locked.displayName} ..... ${locked.password}`].join('\n'),
    };
    pwItem.correct = correctFolder(pwItem);
    pwHost.contents.push(pwItem.id);
    pwItem.zip = pwHost.id;
    items.push(pwItem);
  }

  return { items, zips, exes };
}

/** All sortable files for a level (including those that start inside zips). */
export function generateItems(level) {
  return generateLevel(level).items;
}
