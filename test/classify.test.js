const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const path = require('node:path');
const { LEXICON, LEXICON_SOURCES, LEXICON_INFO, LEXICON_AMBIGUITIES } = require('../lexicon');
const { classify, candidates, normalizeWord, WORD_RE, langToCategory } = require('../classify');
const root = path.resolve(__dirname, '..');

test('the generated lexicon is large, unique, valid, and matches its build report', () => {
  const report = require('../data/build-report.json');
  assert.ok(LEXICON.size > 100000);
  assert.equal(LEXICON.size, report.total_entries);
  assert.equal(LEXICON_INFO.sourceSha256, report.sourceSha256);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'lexicon.js'))).digest('hex'), report.output_sha256);
  const seen = new Set();
  for (const [category, words] of Object.entries(LEXICON_SOURCES)) {
    const entries = words.trim().split(/\s+/);
    assert.equal(entries.length, report.category_counts[category]);
    for (const word of entries) {
      assert.equal(word, normalizeWord(word));
      assert.match(word, /^\p{L}[\p{L}\p{M}]*(?:['-][\p{L}\p{M}]+)*$/u);
      assert.ok(!['sorrow?', 'dunno-not-celtic', 'arm-not', 'crack-not'].includes(word));
      assert.ok(!seen.has(word), `duplicate: ${word}`);
      seen.add(word);
      assert.equal(LEXICON.get(word), category);
    }
  }
  for (const [word, origins] of LEXICON_AMBIGUITIES) {
    assert.ok(!seen.has(word), `ambiguous word also has definite category: ${word}`);
    assert.ok(origins.length > 1);
    assert.equal(LEXICON.get(word), 'unknown');
  }
});

test('irregular forms are exact entries rather than suffix guesses', () => {
  for (const word of ['written', 'swum', 'geese', 'wolves', 'children', 'teeth', 'feet', 'oxen', 'brought', 'taught']) {
    const result = classify(word, LEXICON);
    assert.equal(result.cat, 'germanic', word);
    assert.equal(result.src, 'lexicon', word);
    assert.equal(result.guess, false, word);
  }
  for (const word of ['analyses', 'phenomena', 'criteria']) {
    assert.deepEqual(classify(word, LEXICON), { cat: 'greek', src: 'lexicon', guess: false, note: '' });
  }
  assert.equal(classify('antennae', LEXICON).cat, 'latin');
  assert.equal(classify('knives', LEXICON).cat, 'norse');
});

test('historical sources survive intermediary languages', () => {
  for (const word of ['philosophy', 'psychology', 'music', 'theatre']) assert.equal(classify(word, LEXICON).cat, 'greek', word);
  for (const word of ['coffee', 'sugar', 'cotton', 'kayak', 'yoga']) assert.equal(classify(word, LEXICON).cat, 'other', word);
  for (const word of ['street', 'kitchen', 'science', 'colour']) assert.equal(classify(word, LEXICON).cat, 'latin', word);
  for (const word of ['window', 'egg', 'they', 'their']) assert.equal(classify(word, LEXICON).cat, 'norse', word);
  for (const word of ['shamrock', 'banshee', 'ceilidh']) assert.equal(classify(word, LEXICON).cat, 'celtic', word);
  for (const word of ['rosti', 'rösti']) assert.equal(classify(word, LEXICON).cat, 'germanic', word);
});

test('corrects native words previously filed as Latin', () => {
  for (const word of ['answer', 'belief', 'believe', 'evil', 'flood', 'freedom', 'friend', 'knowledge', 'murder', 'queen', 'silver', 'steel']) {
    assert.equal(classify(word, LEXICON).cat, 'germanic', word);
  }
  assert.equal(classify('furniture', LEXICON).cat, 'germanic');
  assert.equal(classify('trust', LEXICON).cat, 'germanic');
  for (const word of ['dinnae', 'cannae', 'didnae']) assert.equal(classify(word, LEXICON).cat, 'germanic');
});

test('ordinary vocabulary with missing structured ancestry has reviewed coverage', () => {
  for (const word of ['father', 'sister', 'meat', 'sweep', 'swept', 'hundred', 'dawn', 'forever', 'anyone', 'nobody', 'drowned']) {
    const result = classify(word, LEXICON);
    assert.equal(result.cat, 'germanic', word);
    assert.equal(result.src, 'lexicon', word);
  }
  for (const word of ['difficult', 'duty', 'factory', 'print', 'suggest', 'previous']) {
    const result = classify(word, LEXICON);
    assert.equal(result.cat, 'latin', word);
    assert.equal(result.src, 'lexicon', word);
  }
});

test('different etymologies and mixed formations remain unresolved', () => {
  for (const word of ['rose', 'school', 'tattoo', 'television', 'pound', 'inch', 'die']) {
    const result = classify(word, LEXICON);
    assert.equal(result.cat, 'unknown', word);
    assert.equal(result.src, 'lexicon', word);
    assert.equal(result.guess, true, word);
    assert.ok(result.origins.length > 1, word);
    assert.ok(result.note.length, word);
  }
});

test('Unicode normalization, apostrophes, and case share one lookup', () => {
  assert.equal(normalizeWord('CAFE\u0301’S'), "café's");
  for (const word of ['PHILOSOPHY', 'Philosophy']) assert.equal(classify(word, LEXICON).cat, 'greek');
  assert.deepEqual(classify('café', LEXICON), classify('cafe\u0301', LEXICON));
  assert.deepEqual(classify("don't", LEXICON), classify('don’t', LEXICON));
});

test('tokenizer retains accented words and hyphenated compounds', () => {
  assert.deepEqual([..."My mother-in-law’s café sells tea.".matchAll(WORD_RE)].map(m => m[0]),
    ['My', 'mother-in-law’s', 'café', 'sells', 'tea']);
  assert.deepEqual([..."cafe\u0301 and naïve".matchAll(WORD_RE)].map(m => m[0]), ['cafe\u0301', 'and', 'naïve']);
});

test('contractions and possessives have recognizable bases', () => {
  const lexicon = new Map([['can', 'germanic'], ['will', 'germanic'], ['shall', 'germanic'], ['be', 'germanic'], ['child', 'germanic'], ['dogs', 'germanic']]);
  for (const word of ["can't", "won't", "shan't", "ain't", "child's", "dogs'"]) {
    const result = classify(word, lexicon);
    assert.equal(result.cat, 'germanic', word);
    assert.equal(result.guess, false, word);
  }
});

test('unattested stem matches are explicitly guesses', () => {
  const lexicon = new Map([['hope', 'germanic'], ['beauty', 'latin'], ['run', 'germanic']]);
  for (const [word, cat] of [['hopelessly', 'germanic'], ['beautifully', 'latin'], ['running', 'germanic']]) {
    const result = classify(word, lexicon);
    assert.equal(result.cat, cat, word);
    assert.equal(result.src, 'stem', word);
    assert.equal(result.guess, true, word);
  }
});

test('morphology search is bounded for adversarial input', () => {
  const result = candidates('under'.repeat(1000) + 'ness'.repeat(1000) + 's'.repeat(1000));
  assert.ok(result.length <= 64);
  assert.equal(new Set(result).size, result.length);
});

test('Scots, Old French, and Old Frisian have distinct mappings', () => {
  assert.equal(langToCategory('sco'), 'germanic');
  assert.equal(langToCategory('ofr'), 'germanic');
  assert.equal(langToCategory('fro'), 'latin');
  assert.equal(langToCategory('gd'), 'celtic');
  assert.equal(langToCategory('enm'), null);
  assert.equal(langToCategory('gsw'), 'germanic');
  assert.equal(langToCategory('nds-de'), 'germanic');
  assert.equal(langToCategory('gl'), 'latin');
  assert.equal(langToCategory('gmy'), 'greek');
});

test('classic browser scripts share globals without a bundler', () => {
  const context = vm.createContext({});
  for (const filename of ['lexicon.js', 'classify.js']) {
    new vm.Script(fs.readFileSync(path.join(root, filename), 'utf8'), { filename }).runInContext(context);
  }
  assert.equal(vm.runInContext("classify('written', LEXICON).cat", context), 'germanic');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  assert.ok(!html.includes('const WORD_RE ='));
});
