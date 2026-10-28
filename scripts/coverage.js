#!/usr/bin/env node
// Audit an external word list without using its frequencies as origin evidence.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { LEXICON } = require('../lexicon');
const { classify, normalizeWord } = require('../classify');
const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node scripts/coverage.js path/to/newline-separated-words.txt [baseline.json]');
  process.exit(1);
}
const bytes = fs.readFileSync(filename);
const words = [...new Set(bytes.toString('utf8').trim().split(/\r?\n/).map(normalizeWord).filter(Boolean))];
const baseline = process.argv[3] ? new Map(Object.entries(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')))) : null;
const audit = (lexicon, size) => {
  const counts = { words: Math.min(size, words.length), recorded_single_family: 0, recorded_multiple_families: 0, inferred_stem: 0, spelling_guess: 0, no_result: 0 };
  for (const word of words.slice(0, size)) {
    const result = classify(word, lexicon);
    if (lexicon.has(word)) counts[lexicon.get(word) === 'unknown' ? 'recorded_multiple_families' : 'recorded_single_family']++;
    else if (result.src === 'stem') counts.inferred_stem++;
    else if (result.src === 'rule') counts.spelling_guess++;
    else counts.no_result++;
  }
  return counts;
};
const report = {
  benchmark_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  current_entries: LEXICON.size,
  coverage: Object.fromEntries([100, 1000, words.length].map(n => [n, { current: audit(LEXICON, n), ...(baseline ? { baseline: audit(baseline, n) } : {}) }])),
  first_unrecorded: words.filter(w => !LEXICON.has(w)).slice(0, 100),
};
console.log(JSON.stringify(report, null, 2));
