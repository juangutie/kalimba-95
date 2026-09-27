// 25 level definitions: 1-5 relaxed (no timer), 6-25 timed and increasingly tricky.
// Photos are always sorted by what they show: dog, cat, or main color.
// Songs (.mp3) always go in My Music, text files (.txt) in My Documents.
//
// Zip levels start with ONLY zips on the desktop: every file is packed inside, and zips can
// contain more zips (some of them empty). At most one zip per level is locked; its password is
// in password.txt, hidden in an unlocked zip outside the locked one.
//
// Programs (.exe): helpers auto-sort every matching file on the desktop when run.
// Viruses must be dragged to the Recycle Bin; running or filing one costs time.
import { POOLS, FOLDERS, folderIdsFor, generateLevel } from './items.js';

const ANIMALS = ['dogs', 'cats'];
const COLORS = ['red', 'green', 'blue', 'yellow'];
const ALL = [...ANIMALS, ...COLORS];

// Columns: id, name, narrator, photo pools, photos, songs, text files, decoy ratio,
//          seconds (0 = relaxed), zips, locked (0/1), intro line
const TABLE = [
  [1, 'Cats & Dogs', 'clippy', ANIMALS, 6, 0, 0, 0, 0, 0, 0,
    "It looks like you're trying to sort some pets! Cats go in Cats, dogs go in Dogs. I'll be right here. Watching."],
  [2, 'Seeing Red (and Green)', 'clippy', ['red', 'green'], 8, 0, 0, 0, 0, 0, 0,
    'Red pictures go in Red, green ones in Green. Go by the main color of each picture!'],
  [3, 'Spring Cleaning', 'clippy', ANIMALS, 6, 0, 2, 0, 0, 1, 0,
    "It looks like everything got zipped up! Double-click the .zip to extract it, then sort what comes out."],
  [4, 'Full Spectrum', 'bonzi', COLORS, 12, 0, 0, 0, 0, 0, 0,
    "Hiya! I'm BonziBUDDY, your new best friend! Four colors: red, green, blue and yellow. Easy peasy!"],
  [5, 'Zip Inception', 'bonzi', ['cats', 'red', 'blue'], 10, 0, 0, 0, 0, 2, 0,
    "A zip... inside a zip! Unzip 'em all, buddy. I'd help, but I'm busy downloading... stuff."],

  [6, 'The Clock Is Ticking', 'bonzi', ANIMALS, 10, 0, 0, 0, 40, 0, 0,
    "From now on there's a timer! Wrong folders cost you seconds. No pressure, buddy!"],
  [7, 'Primary School', 'clippy', ['red', 'blue', 'yellow'], 12, 0, 0, 0.1, 40, 3, 0,
    "It looks like you're in a hurry. Primary colors, zipped inside zips. Extract fast!"],
  [8, 'Pet Shop Mix-Up', 'bonzi', ANIMALS, 10, 4, 0, 0.25, 45, 0, 0,
    'Cats, dogs and songs! See that Sorter program? Double-click it and it sorts every matching file on the desktop. Magic!'],
  [9, 'Color Me Confused', 'clippy', ['red', 'green', 'yellow'], 14, 0, 0, 0.3, 45, 0, 0,
    "It looks like you have a VIRUS. Drag it to the Recycle Bin! Do NOT double-click it. Seriously."],
  [10, 'Desk Job', 'clippy', ANIMALS, 8, 3, 3, 0.2, 45, 3, 0,
    'Pets, songs and text files, packed into zips. Some zips might be... disappointing.'],
  [11, 'Mislabeled', 'bonzi', ANIMALS, 14, 3, 0, 0.45, 45, 0, 0,
    'Somebody renamed all the pets. Hilarious! Look at the picture, not the name.'],
  [12, 'Locked Out', 'clippy', ['red', 'blue'], 12, 0, 2, 0.3, 45, 3, 1,
    "It looks like one zip is locked! The password is in password.txt... which is inside one of the other zips. Very secure."],
  [13, 'Rainbow Road', 'bonzi', COLORS, 18, 0, 0, 0.4, 50, 0, 0,
    'The whole rainbow! Grab a bunch of the same color and drag them all at once, buddy!'],
  [14, 'Zoo & Palette', 'clippy', ['dogs', 'cats', 'yellow'], 13, 0, 0, 0.35, 45, 4, 1,
    'Animals go in animal folders, yellow things go in Yellow. And yes, one zip is locked. Go find that password.'],
  [15, 'Odd Trio', 'bonzi', ['dogs', 'red', 'green'], 18, 0, 0, 0.4, 45, 0, 0,
    'Dogs, red and green. A strange combination, like me and a banana. Wait, that works. Watch out for viruses!'],
  [16, 'Trust Nothing', 'clippy', ['cats', 'green'], 12, 3, 2, 0.5, 45, 4, 1,
    "It looks like none of these names can be trusted. Would you like help? Too bad, the timer's running."],
  [17, 'Nothing to See Here', 'clippy', [], 0, 0, 0, 0, 30, 8, 0,
    "It looks like you have a lot of very important zip files. Extract them all! Quickly! What could be inside?"],
  [18, 'Nesting Dolls', 'bonzi', ['dogs', 'blue', 'yellow'], 16, 0, 0, 0.5, 45, 5, 1,
    'Zips in zips in zips! One of them is locked, and password.txt is hiding somewhere zippy!'],
  [19, 'Hard Drive Full', 'bonzi', COLORS, 20, 0, 0, 0.6, 50, 0, 0,
    'Your hard drive is full, buddy! And infected! Better sort everything before it crashes. Just kidding. Probably.'],
  [20, 'Encrypted', 'clippy', ['dogs', 'cats', 'red'], 16, 0, 2, 0.6, 45, 5, 1,
    'It looks like someone discovered encryption. Dig through the zips, find password.txt, then crack the locked one.'],
  [21, 'Compression Artifacts', 'bonzi', ['cats', 'blue'], 14, 4, 2, 0.6, 45, 5, 1,
    "Lots of zips, lots of programs. Some programs are helpful. Some are... not. Choose wisely, buddy!"],
  [22, 'Blue Screen', 'clippy', ['dogs', 'green', 'yellow'], 18, 0, 2, 0.7, 45, 6, 1,
    "Everything zipped, nothing trustworthy. If you run a virus, I'm sure it won't blue screen. Probably."],
  [23, 'Y2K', 'clippy', ['dogs', 'cats', 'red'], 16, 3, 2, 0.8, 50, 6, 1,
    'Almost there! Party like it is 1999... but unzip like it is 2001.'],
  [24, 'Firewall', 'bonzi', ['dogs', 'cats', 'blue', 'yellow'], 18, 0, 2, 0.8, 50, 6, 1,
    "Deep zips, sneaky viruses, one locked zip. I'm your firewall today, buddy! ...That's a joke. I'm not."],
  [25, 'Kalimba', 'bonzi', ALL, 20, 4, 4, 0.9, 60, 7, 1,
    "The final level! Every folder, every file type. Put on some Kalimba and unzip everything. I'll be cheering. Loudly."],
];

// How zips nest: `top` = zips on the desktop at the start (the rest are inside other zips),
// `empty` = zips with no files in them (they may still contain other zips).
const ZIP_SHAPES = {
  3: { top: 1 },
  5: { top: 1 },
  7: { top: 1 },
  10: { top: 1, empty: 1 },
  12: { top: 2 },
  14: { top: 1, empty: 1 },
  16: { top: 2, empty: 1 },
  17: { top: 2 },
  18: { top: 1, empty: 1 },
  20: { top: 2, empty: 2 },
  21: { top: 1, empty: 1 },
  22: { top: 2, empty: 2 },
  23: { top: 1, empty: 2 },
  24: { top: 2, empty: 2 },
  25: { top: 2, empty: 2 },
};

// Programs: helpers auto-sort a category, viruses go in the Recycle Bin.
const EXES = {
  8: { helpers: 1 },
  9: { viruses: 1 },
  11: { helpers: 1, viruses: 1 },
  13: { helpers: 1, viruses: 1 },
  15: { viruses: 2 },
  16: { helpers: 1, viruses: 1 },
  18: { helpers: 1, viruses: 1 },
  19: { helpers: 1, viruses: 2 },
  20: { viruses: 2 },
  21: { helpers: 2, viruses: 1 },
  22: { helpers: 1, viruses: 2 },
  23: { helpers: 1, viruses: 2 },
  24: { helpers: 2, viruses: 2 },
  25: { helpers: 2, viruses: 3 },
};

// Level-specific zip names (default: random from items.ZIP_NAMES).
const ZIP_NAMES = {
  17: ['important_stuff', 'definitely_not_empty', 'free_ram', 'more_files', 'trust_me', 'almost_done',
    'the_good_stuff', 'last_one_i_promise'],
};

export const LEVELS = TABLE.map(([id, name, narrator, pools, photos, audio, texts, decoy, time, zips, locked, intro]) => {
  const shape = ZIP_SHAPES[id] ?? {};
  const exes = EXES[id] ?? {};
  return {
    id, name, narrator, pools, photos, audio, texts, decoy, intro, zips, locked,
    zipTop: shape.top ?? Math.min(zips, 1),
    zipEmpty: shape.empty ?? 0,
    zipNames: ZIP_NAMES[id] ?? null,
    helpers: exes.helpers ?? 0,
    viruses: exes.viruses ?? 0,
    timed: time > 0,
    // Extracting and typing a password takes time, so zip levels get a little extra.
    time: time > 0 ? time + zips * 2 + locked * 8 : 0,
    penalty: id >= 16 ? 5 : 3,
    seed: 1000 + id * 7919,
    exts: id === 1 ? ['jpg'] : ['jpg', 'png'],
  };
});

/** Human-readable rules shown in the level intro dialog. */
export function ruleText(level) {
  if (level.photos + level.audio + level.texts === 0) {
    return 'Extract every .zip file on the desktop before time runs out!';
  }
  const parts = [];
  const hasAnimals = level.pools.some((p) => ANIMALS.includes(p));
  const hasColors = level.pools.some((p) => COLORS.includes(p));
  if (hasAnimals && hasColors) parts.push('Animal pictures go in the matching animal folder. Every other picture goes in the folder that matches its main color.');
  else if (hasAnimals) parts.push('Drag each picture into the folder that matches the animal in it.');
  else parts.push('Drag each picture into the folder that matches its main color.');

  const extra = [];
  if (level.audio) extra.push('songs (.mp3) always go in My Music');
  if (level.texts || level.locked) extra.push('text files (.txt) always go in My Documents');
  if (extra.length) parts.push(`Also: ${extra.join(' and ')}.`);

  if (level.zips) {
    parts.push("Everything is zipped up! Double-click each .zip to extract it. Zips can contain more zips. Zips themselves don't go in any folder.");
  }
  if (level.locked) {
    parts.push("The locked zip (🔒) needs a password. It's written in password.txt, hidden inside one of the other zips. "
      + 'Filed it too early? Double-click My Documents to read it again.');
  }
  if (level.helpers) {
    parts.push('Helpful programs like DogSorter.exe sort every matching file on the desktop when you double-click them. Files still inside zips are not touched.');
  }
  if (level.viruses) {
    parts.push(`Viruses belong in the Recycle Bin (drag them there, or select them and press Delete). Double-clicking one gets rid of it too, but costs ${level.penalty} seconds. So does dropping one in a folder.`);
  }
  if (level.decoy > 0) parts.push('Careful: file names can lie. Trust the picture and the file type, not the name.');
  return parts.join('\n\n');
}

/** Load-time sanity check. Warns in the console about levels that can't be solved. */
// Grouping same-type files is the fun part, so keep folder counts low until the finale.
const LEVELS_WITH_ALL_FOLDERS = 25;
const MAX_FOLDERS = (id) => (id >= 23 ? 5 : 4);
function validateLevels(levels) {
  const problems = [];
  const ids = new Set();
  for (const lv of levels) {
    const tag = `Level ${lv.id}`;
    if (ids.has(lv.id)) problems.push(`${tag}: duplicate id`);
    ids.add(lv.id);
    const unknown = lv.pools.filter((p) => !POOLS[p]);
    if (unknown.length) problems.push(`${tag}: unknown pools ${unknown.join(', ')}`);
    const supply = lv.pools.length ? Math.min(...lv.pools.map((p) => POOLS[p]?.count ?? 0)) * lv.pools.length : 0;
    if (lv.photos > supply) problems.push(`${tag}: needs ${lv.photos} photos (split evenly) but pools only have ${supply}`);
    for (const f of folderIdsFor(lv)) if (!FOLDERS[f]) problems.push(`${tag}: missing folder "${f}"`);
    const files = lv.photos + lv.audio + lv.texts;
    if (files === 0 && !lv.zips) problems.push(`${tag}: no files`);
    if (lv.locked > 1) problems.push(`${tag}: at most one locked zip per level`);
    if (lv.locked && lv.zips < 2) problems.push(`${tag}: a locked zip needs another zip to hide password.txt in`);
    if (lv.zipTop > lv.zips) problems.push(`${tag}: more top-level zips than zips`);
    if (lv.zipNames && lv.zipNames.length < lv.zips) problems.push(`${tag}: not enough zip names`);
    if (lv.helpers > folderIdsFor(lv).length) problems.push(`${tag}: more helpers than folders`);
    if (lv.id < LEVELS_WITH_ALL_FOLDERS && folderIdsFor(lv).length > MAX_FOLDERS(lv.id)) {
      problems.push(`${tag}: ${folderIdsFor(lv).length} folders is more than the cap of ${MAX_FOLDERS(lv.id)}`);
    }
    if (lv.timed && !(lv.time > 0)) problems.push(`${tag}: timed without a time limit`);
    if (!lv.intro) problems.push(`${tag}: missing intro line`);
    try {
      generateLevel(lv);
    } catch (err) {
      problems.push(`${tag}: generation failed: ${err.message}`);
    }
  }
  if (problems.length) console.warn(`[Kalimba 95] ${problems.length} level problem(s):\n${problems.join('\n')}`);
}

validateLevels(LEVELS);
