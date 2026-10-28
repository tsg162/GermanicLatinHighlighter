// Word -> origin classifier: attested forms, then inferred stems and spelling rules.
// Result: { cat, src: "lexicon" | "stem" | "rule" | "wiktionary" | "none", guess: boolean, note?: string }

const CATEGORIES = {
  germanic: { label: "English / West and other Germanic", short: "Germanic" },
  norse: { label: "Old Norse (North Germanic)", short: "Norse" },
  latin: { label: "Latin / French / Romance", short: "Latin" },
  greek: { label: "Greek", short: "Greek" },
  celtic: { label: "Celtic", short: "Celtic" },
  other: { label: "Other (Arabic, Hindi, …)", short: "Other" },
  unknown: { label: "Unknown / mixed or ambiguous origins", short: "Unresolved" },
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
const DERIVATIONAL_PREFIXES = ["under", "over", "out", "fore", "mis", "un", "non", "with", "re"];
const WORD_RE = /\p{L}[\p{L}\p{M}]*(?:['’ʼ‐‑-][\p{L}\p{M}]+)*/gu;

function normalizeWord(word) {
  return word.normalize("NFC").toLowerCase().replace(/[’ʼ]/g, "'").replace(/[‐‑]/g, "-");
}

// Possible base forms of an inflected / derived English word, most likely first.
function candidates(word) {
  const out = [word];
  const seen = new Set(out);
  const add = (s) => {
    if (s && s.length >= 3 && !seen.has(s) && out.length < 64) {
      seen.add(s);
      out.push(s);
    }
  };
  const undouble = (s) => (/([bdfgmnprt])\1$/.test(s) ? s.slice(0, -1) : null);
  // A bounded breadth-first search also handles chains such as hopelessly -> hope.
  for (let i = 0; i < out.length; i++) {
    const current = out[i];
    const strip = (suffix, fn) => {
      if (!current.endsWith(suffix)) return;
      const stem = current.slice(0, -suffix.length);
      for (const s of fn(stem)) add(s);
    };
    strip("'s", (s) => [s]);
    strip("'", (s) => [s]);
    strip("ies", (s) => [s + "y"]);
    strip("es", (s) => [s, s + "e"]);
    strip("s", (s) => [s]);
    strip("ied", (s) => [s + "y"]);
    strip("ed", (s) => [s, s + "e", undouble(s)]);
    strip("ing", (s) => [s, s + "e", undouble(s)]);
    strip("ying", (s) => [s + "ie"]);
    strip("ily", (s) => [s + "y"]);
    strip("ly", (s) => [s, s + "e"]);
    strip("ier", (s) => [s + "y"]);
    strip("iest", (s) => [s + "y"]);
    strip("er", (s) => [s, s + "e", undouble(s)]);
    strip("est", (s) => [s, s + "e", undouble(s)]);
    strip("ness", (s) => [s, s.replace(/i$/, "y")]);
    strip("iness", (s) => [s + "y"]);
    strip("ful", (s) => [s, s.replace(/i$/, "y")]);
    for (const suffix of ["less", "ish", "hood", "ship", "dom", "en"]) strip(suffix, (s) => [s]);
    for (const prefix of DERIVATIONAL_PREFIXES) {
      if (current.startsWith(prefix)) add(current.slice(prefix.length));
    }
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
  const word = normalizeWord(rawWord);
  const recorded = (key) => {
    const cat = lexicon.get(key);
    if (!cat) return null;
    const origins = lexicon.ambiguities?.get(key);
    const note = lexicon.notes?.get(key) || (origins ? `Multiple or mixed origins: ${origins.map(c => CATEGORIES[c].short).join(", ")}` : "");
    return { cat, src: "lexicon", guess: !!origins || cat === "unknown", note, ...(origins ? { origins } : {}) };
  };
  const exact = recorded(word);
  if (exact) return exact; // Most words, including irregular inflections, finish here.
  const negatives = { "can't": "can", "cannot": "can", "won't": "will", "shan't": "shall", "ain't": "be" };
  const base = negatives[word] || word.replace(/n't$|'(s|re|ve|ll|d|m)$|(?<=s)'$/, "");
  if (base !== word) {
    const result = recorded(base);
    if (result) return { ...result, src: "stem", note: `Contraction or possessive of “${base}”. ${result.note}`.trim() };
  }
  for (const stem of candidates(base).slice(1)) {
    const result = recorded(stem);
    if (result) return { ...result, src: "stem", guess: true, note: `Inferred from “${stem}”. ${result.note}`.trim() };
  }
  if (word.includes("-")) {
    const parts = word.split("-").map(recorded);
    if (parts.every(Boolean)) {
      const origins = [...new Set(parts.flatMap(p => p.origins || [p.cat]))];
      return { cat: origins.length === 1 ? origins[0] : "unknown", src: "stem", guess: true,
        origins, note: `Inferred from compound parts: ${origins.map(c => CATEGORIES[c].short).join(", ")}` };
    }
  }
  const h = heuristic(word.replace(/'.*$/, ""));
  if (h) return { cat: h.cat, src: "rule", guess: true, note: h.note };
  return { cat: "unknown", src: "none", guess: true, note: "not in lexicon" };
}

// Wiktionary language code -> category
function langToCategory(code) {
  const dialectBase = code.split("-")[0];
  if (["nl", "de", "nds", "got", "goh", "gmh", "fy", "frr", "sco", "yi", "af", "fr", "fro", "frm", "it", "es", "pt", "ca", "oc", "ga", "gd", "sga", "cy", "br", "kw"].includes(dialectBase)) code = dialectBase;
  if (/^(ang(?:-.*)?|gem-.*|gmw-.*|gme-.*|goh|gmh|osx|odt|nl|dum|de|fy|frk|got|gml|nds|yi|ofs|ofr|frr|stq|sco|sco-osc|lb|li|af|yol|enm-osc|gsw|bar|swg|vmf|ksh|pdc|pdt|hrx|cim|wym|vls|zea|frs|xbg|xvn)$/.test(code)) return "germanic";
  if (/^(non(?:-.*)?|gmq-.*|is|sv|da|no|nb|nn|fo|svm|ovd)$/.test(code)) return "norse";
  if (/^(la(?:-.*)?|fr|fro|frm|xno|it|es|pt|ca|ro|osp|roa-.*|VL\.|LL\.|ML\.|NL\.|oc|pro|vec|scn|nap|srd|rm|fur|lld|gl|ast|an|mwl|sc|co|nrf|wa|lij|lmo|pms|eml|rgn|frp|frc)$/i.test(code)) return "latin";
  if (/^(grc(?:-.*)?|grk-.*|el|gkm|gmy)$/.test(code)) return "greek";
  if (/^(ga|gd|sga|mga|cy|wlm|owl|gv|kw|br|cel-.*|xtg|xcb|pgl|sga-olc|obt|xbm|oco|cnx)$/.test(code)) return "celtic";
  if (/^(en|enm|ine|ine-pro|und|mul|mis)$/.test(code) || /-pro$/.test(code) || /^(qfa-|ine-)/.test(code)) return null;
  return "other";
}

if (typeof module !== "undefined") module.exports = { CATEGORIES, classify, candidates, langToCategory, normalizeWord, WORD_RE };
