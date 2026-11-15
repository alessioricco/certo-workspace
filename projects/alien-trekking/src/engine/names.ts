const ONSETS = ['v', 'k', 's', 'th', 'z', 'm', 'r', 'ol', 'ny', 'qu', 'br', 'fen', 'dr', 'ash', 'gl', 'ir'];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ae', 'ou', 'ia'];
const CODAS = ['', 'r', 'n', 'th', 'l', 'x', 's', 'k', 'v', 'm'];

export const PLANT_ENDINGS = ['ia', 'ara', 'ose', 'um'];
export const ANIMAL_ENDINGS = ['ox', 'ith', 'an', 'ul'];

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

/** A made-up name: a syllable and an ending. Names in `taken` are skipped, and the chosen one is added to it. */
export function makeName(random: () => number, endings: readonly string[], taken: Set<string>): string {
  let name: string;
  do {
    const raw = pick(random, ONSETS) + pick(random, NUCLEI) + pick(random, CODAS) + pick(random, endings);
    name = raw.charAt(0).toUpperCase() + raw.slice(1);
  } while (taken.has(name));
  taken.add(name);
  return name;
}
