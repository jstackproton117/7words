// A small mixed-bag pool of plain, terminal-mark-free words. Bots pull 7 at
// random per turn — varied enough that the reveal page isn't visually
// monotonous, plain enough that they never trip the contribution validator
// (no punctuation, no apostrophes, all single tokens).
const WORD_POOL: readonly string[] = [
  "moose", "porcupine", "lamp", "swiftly", "octagon", "biscuit", "marmalade",
  "thunder", "purple", "submarine", "quietly", "elbow", "carousel", "noodle",
  "velvet", "trombone", "wandering", "pumpkin", "raccoon", "tangerine",
  "cardboard", "tumbleweed", "feather", "sneaker", "lantern", "cricket",
  "garden", "shimmering", "buffalo", "compass", "drizzle", "pebble", "kettle",
  "harbor", "willow", "muffin", "snorkel", "cobweb", "twilight", "barnacle",
  "saxophone", "crooked", "drowsy", "freckle", "popsicle", "bandit", "hollow",
  "polka", "rumble", "sneeze", "tassel", "vault", "wobble", "yodel", "zigzag",
  "ancient", "billowing", "creaky", "dazzling", "earnest", "fluffy", "ghostly",
  "humming", "indigo", "jagged", "kindly", "lonely", "misty", "nimble",
  "obvious", "patient", "quirky", "restless", "stoic", "tender", "uneven",
  "velvety", "weathered", "yawning", "zealous", "across", "beyond", "during",
  "inside", "above", "below", "around", "between", "the", "a", "some", "many",
  "every", "each", "wandered", "fell", "discovered", "remembered", "asked",
  "answered", "ran", "tumbled", "whispered", "yelled", "balanced", "marched",
  "danced", "skipped", "sang", "growled", "smiled", "vanished",
];

export function randomSevenWords(): string {
  const picks: string[] = [];
  for (let i = 0; i < 7; i++) {
    picks.push(WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)]);
  }
  return picks.join(" ");
}
