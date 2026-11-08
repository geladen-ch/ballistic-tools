// String substitution in template text. Plain string → string, no naming
// convention: the caller says what to look for and what to put there.
// Pairs apply in the order given, each to every occurrence.

// Returns the new text and the indices of the pairs that matched at least
// once, so the caller can report pairs that matched nowhere on a page.
export function replaceInText(text, pairs) {
  const matched = new Set();
  let out = text;
  pairs.forEach(([from, to], i) => {
    if (from && out.includes(from)) {
      // A function, not the string itself: replaceAll would read $&, $' and
      // $` in a string replacement as patterns and mangle such values.
      out = out.replaceAll(from, () => to);
      matched.add(i);
    }
  });
  return { text: out, matched };
}

export function validatePairs(pairs) {
  if (!Array.isArray(pairs)) throw new Error('replacements must be an array of [from, to] pairs');
  pairs.forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || typeof p[1] !== 'string') {
      throw new Error(`replacement #${i} must be a [from, to] pair of strings`);
    }
    if (!p[0]) throw new Error(`replacement #${i} has an empty search string`);
  });
}
