// Narrator dialogue. Same events for both characters, different personalities.
// Level intro lines live in levels.js.

const LINES = {
  clippy: {
    correct: [
      'Nice sorting!',
      "It looks like you're good at this.",
      'Filed! Just like a real paperclip would.',
      "That's the right folder!",
      'Organized. I love organized.',
    ],
    streak: [
      'Five in a row! Would you like me to write a letter about it?',
      "You're on a roll! I'm genuinely impressed. And I'm a paperclip.",
      'Look at you go!',
    ],
    wrong: [
      'It looks like you put that in the wrong folder. Would you like help?',
      "Hmm, that doesn't go there.",
      'Oops! Try another folder.',
      "Are you sure? Because I'm sure. It's not that one.",
      'Did you mean: a different folder?',
      'That file bounced back. Files do that.',
    ],
    hurry: [
      "It looks like you're running out of time!",
      'Ten seconds left! Drag faster!',
      "Hurry! I'd help, but I have no arms. Well, sort of.",
    ],
    win: [
      'You did it! This desktop has never looked so clean.',
      'All sorted! Would you like to save your progress? Just kidding.',
      'Congratulations! I knew you could do it. Mostly.',
    ],
    fail: [
      'It looks like you ran out of time. Would you like to try again?',
      "Time's up! Everyone fails sometimes. Even me. Especially me.",
      "Oh no. Let's pretend that didn't happen.",
    ],
    zip: [
      "It looks like you're trying to file a zip. Double-click it to extract it first!",
      "Zips don't go in folders. What's inside them does! Double-click it.",
    ],
    extracted: [
      'Extracted! Now sort those too.',
      'Fresh files, straight out of the zip!',
    ],
    empty: [
      "It looks like that zip was empty. Would you like to extract another empty zip?",
      'Empty! Well, it was very well compressed.',
      'Nothing in there. Zero bytes. I checked twice.',
      "Hmm. Empty again. I'm sure the next one has something.",
      'Another empty one! Great compression ratio, though.',
    ],
    locked: [
      "It looks like that zip is locked. The password is in password.txt!",
      'Locked! Have you tried reading password.txt? People always write them down.',
    ],
    badPassword: [
      "It looks like you're guessing passwords. Try reading password.txt instead!",
      "That's not the password. And no, it's not \"password\" either.",
      'Wrong password! Would you like help? The help is: password.txt.',
    ],
    unlocked: [
      'Unlocked! Very hacker-y of you.',
      'Access granted! I always wanted to say that.',
    ],
    helper: [
      'It looks like a program did your job for you. I can relate.',
      'Automation! The future is now. Well, 2001.',
    ],
    helperNothing: [
      "It looks like there was nothing for that program to sort. Maybe extract some zips first?",
    ],
    program: [
      "Programs don't go in folders. Double-click it to run it... if you trust it.",
    ],
    virusRun: [
      'It looks like you ran a virus. It ate some of your time. Would you like help? Recycle Bin next time!',
      'You double-clicked a file called VIRUS. I have so many questions.',
      'That virus just deleted a few seconds of your life. Recycle Bin, please!',
    ],
    virusFiled: [
      "Don't file the virus! It goes in the Recycle Bin!",
      'That virus does NOT belong in a folder. Recycle Bin!',
    ],
    virusDeleted: [
      'Virus deleted! Your computer thanks you.',
      "Into the bin it goes. Good riddance!",
    ],
    recycleWrong: [
      "Don't throw that away! Only viruses go in the Recycle Bin.",
      "That's a perfectly good file! Put it in a folder.",
    ],
    zipRecycle: [
      "Don't delete the zip! There are files in there. Probably.",
    ],
    idle: [
      "It looks like you're sorting files. Would you like help with that?",
      'Tip: .mp3 is always music and .txt is always a document, whatever the name says.',
      "Tip: songs always go in My Music, whatever they're called.",
      'Tip: look at the picture, not the name!',
      "Tip: double-click a picture to see it bigger.",
      'Tip: double-click a folder to see what you already filed.',
      "Did you know I'm made of bent wire?",
    ],
  },
  bonzi: {
    correct: [
      'Nice one, buddy!',
      'Ooh, excellent!',
      "That's where it goes! You're a natural!",
      'Bingo!',
      'Smart cookie!',
    ],
    streak: [
      'Five in a row! You deserve a free toolbar!',
      "Wowie! You're sorting faster than I can download!",
      "You're on fire, buddy! Not literally. I checked.",
    ],
    wrong: [
      'Whoopsie! Wrong folder, buddy!',
      'Nope! Try again!',
      "Uh-oh! That's not it!",
      'Ha! Gotcha! Wrong one!',
      "Oops! Even I knew that one, and I'm a purple gorilla.",
      'Wrong folder! But hey, I still like you.',
    ],
    hurry: [
      'Tick tock, buddy! Ten seconds!',
      'Hurry hurry hurry!',
      "Ooh, it's getting close! Move those fingers!",
    ],
    win: [
      'Hooray! You did it, buddy!',
      "Woohoo! Let's celebrate with a joke! ...Actually, next level.",
      "You're amazing! I'll tell all my friends about you.",
    ],
    fail: [
      "Aww, time's up, buddy! Wanna try again?",
      'Oh no! Well, at least you tried!',
      "Time's up! Don't worry, I won't tell anyone. Maybe.",
    ],
    zip: [
      "Silly! Zips don't go in folders. Double-click to unzip it, buddy!",
      "Ooh, a zip! Double-click it first. I love surprises!",
    ],
    extracted: [
      'Ta-da! Look at all those files!',
      "Unzipped! It's like opening presents!",
    ],
    empty: [
      'Empty?! Who zips NOTHING?',
      "Aww, it's empty! Like my wallet, buddy!",
      'Nothing! Nada! Zilch! Keep going!',
    ],
    locked: [
      'Locked, buddy! Somebody wrote the password in password.txt. Tsk tsk.',
      "Ooh, a secret zip! Check password.txt. I'd never peek. Much.",
    ],
    badPassword: [
      'Nope! Wrong password, buddy! Peek at password.txt!',
      "Ha! That's not it! Was it \"bonzi4ever\"? ...Only sometimes.",
      'Access denied! Sounds like a movie. Check password.txt!',
    ],
    unlocked: [
      "You cracked it! You're a real hacker, buddy!",
      "Unlocked! I won't tell anyone. Maybe.",
    ],
    helper: [
      'Whoosh! The program sorted them all! Almost as helpful as me!',
      "Wowie! Robots doing the work! That's the dream, buddy!",
    ],
    helperNothing: [
      'Aww, nothing to sort yet! Unzip some stuff first, buddy!',
    ],
    program: [
      "Silly! Programs don't go in folders. Double-click to run it!",
    ],
    virusRun: [
      'Ouch! That virus gobbled up some of your time, buddy! Recycle Bin next time!',
      "Yikes! That wasn't me, I swear! ...Okay, it was a little bit me.",
      'Kaboom! Virus go bye-bye, and so did some seconds!',
    ],
    virusFiled: [
      "Nope! Viruses go in the Recycle Bin, not in folders!",
      "Eww, don't put the virus in there! Recycle Bin!",
    ],
    virusDeleted: [
      'Bye-bye, virus! Great job, buddy!',
      'Squashed it! Like a bug! Because it was a bug!',
    ],
    recycleWrong: [
      "Hey! That's not trash! Only viruses go in the bin!",
      "Don't throw that away, buddy! It goes in a folder!",
    ],
    zipRecycle: [
      "Whoa, don't delete the zip! There's stuff in there!",
    ],
    idle: [
      "Did you know I can sing? I won't, though.",
      'Why did the file go to therapy? It had too many issues!',
      'Tip: the picture tells the truth. The name might not!',
      'Psst! Songs go in My Music. Always.',
      'Psst! Double-click a folder to peek inside!',
      "I'm not spyware. Why do people keep asking?",
    ],
  },
};

export function line(narrator, event) {
  const options = LINES[narrator]?.[event];
  if (!options?.length) return '';
  return options[Math.floor(Math.random() * options.length)];
}
