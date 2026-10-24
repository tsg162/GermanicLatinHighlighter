// Word -> origin classifier: lexicon lookup (with stemming), then spelling heuristics.
// Result: { cat, src: "lexicon" | "stem" | "rule" | "wiktionary" | "none", guess: boolean, note?: string }

const CATEGORIES = {
  germanic: { label: "Old English / West Germanic", short: "Germanic" },
  norse: { label: "Old Norse (North Germanic)", short: "Norse" },
  latin: { label: "Latin / French / Romance", short: "Latin" },
  greek: { label: "Greek", short: "Greek" },
  celtic: { label: "Celtic / Scots", short: "Celtic" },
  other: { label: "Other (Arabic, Hindi, …)", short: "Other" },
  unknown: { label: "Unknown", short: "Unknown" },
};

const GREEK_PREFIX = /^(psych|philo|phila|photo|phono|tele|micro|macro|bio|geo|hydr|hyper|hypo|chrom|chron|cosm|morph|neuro|pseudo|anthrop|astro|theo|thermo|poly)/;
const GREEK_SUFFIX = /(ology|ologist|ography|graphy|graph|graphic|phobia|phobic|phone|phonic|scope|scopic|nomy|nomic|ism|asm|esis|osis|itis|pathy|pathic|logue|logy|gram|crat|cracy|archy|sophy)$/;
const LATIN_SUFFIX = [
  [/(tion|sion|xion|ations?|ition|ution)s?$/, 3],
  [/(ment|ity|ety|ive|ative|ous|ious|eous|ance|ence|ancy|ency|able|ible|ure|ary|ory|ify|ific|ial|ual|ular|esque|ette)s?$/, 3],
  [/(ant|ent|ate|ize|ise|ine|ion|age|al|ic|ical|ude|ile)s?$/, 4],
];
const GERMANIC_SUFFIX = /(ness|ship|hood|less|ful|ward|wards|wise|ling|dom|ish)$/;
const GERMANIC_SPELLING = /(ough|igh|ght|ck|^kn|^wr|^wh|^th|^sh|aw|ow|oo)/;
const GERMANIC_PREFIXES = ["under", "over", "out", "fore", "mis", "un", "non", "with"];

// Possible base forms of an inflected / derived English word, most likely first.
function candidates(word) {
  const out = [word];
  const add = (s) => { if (s.length >= 3 && !out.includes(s)) out.push(s); };
  const undouble = (s) => (/(.)\1$/.test(s) ? s.slice(0, -1) : null);
  const strip = (suffix, fn) => {
    if (!word.endsWith(suffix)) return;
    const stem = word.slice(0, -suffix.length);
    for (const s of fn(stem)) if (s) add(s);
  };
  strip("'s", (s) => [s]);
  strip("ies", (s) => [s + "y"]);
  strip("es", (s) => [s, s + "e"]);
  strip("s", (s) => [s]);
  strip("ied", (s) => [s + "y"]);
  strip("ed", (s) => [s, s + "e", undouble(s)]);
  strip("d", (s) => [s]);
  strip("ing", (s) => [s, s + "e", undouble(s)]);
  strip("ily", (s) => [s + "y"]);
  strip("ly", (s) => [s, s + "e"]);
  strip("ier", (s) => [s + "y"]);
  strip("iest", (s) => [s + "y"]);
  strip("er", (s) => [s, s + "e", undouble(s)]);
  strip("est", (s) => [s, s + "e", undouble(s)]);
  strip("ness", (s) => [s, s.replace(/i$/, "y")]);
  strip("iness", (s) => [s + "y"]);
  strip("ful", (s) => [s]);
  strip("less", (s) => [s]);
  strip("ish", (s) => [s]);
  strip("hood", (s) => [s]);
  strip("ship", (s) => [s]);
  strip("dom", (s) => [s]);
  strip("y", (s) => [s, undouble(s)]);
  strip("en", (s) => [s]);
  // chain once more (e.g. "hopelessly" -> hopeless -> hope)
  for (const c of out.slice(1)) {
    if (c !== word && /(ness|less|ful|ly|ing|ed|er|s)$/.test(c)) {
      for (const d of candidates(c).slice(1)) add(d);
    }
  }
  for (const p of GERMANIC_PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 3) add(word.slice(p.length));
  }
  return out;
}

function heuristic(w) {
  if (GREEK_PREFIX.test(w)) return { cat: "greek", note: "Greek combining form" };
  if (GREEK_SUFFIX.test(w) && w.length >= 6) return { cat: "greek", note: "Greek-style ending" };
  for (const [re, minStem] of LATIN_SUFFIX) {
    const m = w.match(re);
    if (m && w.length - m[0].length >= minStem) return { cat: "latin", note: `Latin-style ending “-${m[1] || m[0]}”` };
  }
  if (GERMANIC_SUFFIX.test(w)) return { cat: "germanic", note: "Germanic-style ending" };
  if (GERMANIC_SPELLING.test(w)) return { cat: "germanic", note: "Germanic-style spelling" };
  if (/^(trans|super|inter|circum|contra|multi|post|semi|ultra|intra|counter|sub|pre|pro|con|com|dis|ex|per)/.test(w) && w.length >= 7)
    return { cat: "latin", note: "Latin-style prefix" };
  if (w.length <= 5) return { cat: "germanic", note: "short word" };
  return null;
}

function classify(rawWord, lexicon) {
  const word = rawWord.toLowerCase().replace(/’/g, "'");
  const cands = candidates(word.replace(/n't$|'(s|re|ve|ll|d|m)$/, ""));
  if (cands[0] !== word) cands.unshift(word);
  for (let i = 0; i < cands.length; i++) {
    const cat = lexicon.get(cands[i]);
    if (cat) return { cat, src: i === 0 ? "lexicon" : "stem", guess: false, note: i === 0 ? "" : `from “${cands[i]}”` };
  }
  const h = heuristic(word.replace(/'.*$/, ""));
  if (h) return { cat: h.cat, src: "rule", guess: true, note: h.note };
  return { cat: "unknown", src: "none", guess: true, note: "not in lexicon" };
}

// Wiktionary language code -> category
function langToCategory(code) {
  if (/^(ang|gem-.*|gmw-.*|goh|osx|odt|nl|dum|de|fy|frk|got|gml|nds|yi|ofs|ofr-?x?)$/.test(code)) return "germanic";
  if (/^(non|gmq-(?!sco).*|is|sv|da|no|nb|nn|fo|odt-x)$/.test(code)) return "norse";
  if (/^(la|la-.*|fr|fro|frm|xno|it|es|pt|ca|ro|osp|roa-.*|VL\.|LL\.|ML\.|NL\.|oc|pro)$/i.test(code)) return "latin";
  if (/^(grc|el|gkm)$/.test(code)) return "greek";
  if (/^(ga|gd|sga|mga|cy|wlm|owl|gv|kw|br|cel-.*|xtg|sco|gmq-sco|xcb|pgl)$/.test(code)) return "celtic";
  return "other";
}

if (typeof module !== "undefined") module.exports = { CATEGORIES, classify, candidates, langToCategory };
