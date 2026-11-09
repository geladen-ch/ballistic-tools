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

// Translated text: a template writes its fixed text as i18n keys in
// braces, `{printableCard.pdf.rifle}`, or `{key|upper}` for text in
// capitals (upper-cased for the document's language). `translate(key)`
// returns the text, or null for a key it doesn't know. Returns the new
// text and the keys that found no translation (left in place).
const TOKEN = /\{([A-Za-z][\w.-]*)(?:\|(upper))?\}/g;

export function translateText(text, translate, lang) {
  const missing = [];
  const out = text.replace(TOKEN, (token, key, upper) => {
    const v = translate ? translate(key) : null;
    if (typeof v !== 'string' || !v) { missing.push(key); return token; }
    return upper ? v.toLocaleUpperCase(lang || undefined) : v;
  });
  return { text: out, missing };
}

// The keys a text asks for, in order.
export function textKeys(text) {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}
