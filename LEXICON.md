# Lexicon

`lexicon.js` is a generated, offline word-to-origin catalogue. Its public lookup
remains a JavaScript `Map`: `LEXICON.get("written")`. Both classic browser scripts
and Node's `require("./lexicon")` work without packages, a build server, or network
requests at runtime.

## Sources and attribution

The principal source is **English Wiktionary, written by Wiktionary contributors**,
extracted by **Tatu Ylonen's Wiktextract** and distributed by **Kaikki.org**:

- [English dictionary and snapshot information](https://kaikki.org/dictionary/English/index.html)
- [English JSONL archive](https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz)
- [Raw Wiktextract downloads](https://kaikki.org/dictionary/rawdata.html)
- [Wiktextract documentation and field descriptions](https://github.com/tatuylonen/wiktextract)
- [Wiktionary contributors' licensing terms](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)

The initial expansion uses the **2026-10-01 Wiktionary dump**, extracted by Kaikki
on **2026-10-21**. `data/build-report.json` records the archive's SHA-256, snapshot,
entry counts, and generated file hash. The download URL changes over time; retain
the input archive to reproduce an older build.

The adapted lexical data in `lexicon.js` and `data/curated.json` is distributed
under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Changes include language-family classification, selecting and normalizing English
tokens, following English formations and attested inflections, excluding unsupported
records, and the corrections in `data/curated.json`. This notice applies to the
lexical data. It does not set a license for the application's code.

For an individual entry, consult `https://en.wiktionary.org/wiki/WORD#English`;
the page's history identifies its contributors. An inflection obtained from a
headword's forms table may require consulting that headword too.

## Origin policy

Classification follows **underlying historical sources through intermediary
languages**, rather than just the last language to pass a word into English.

- **Germanic:** native English roots and other Germanic roots, including Dutch,
  German, Frisian, and Scots. Scots is a Germanic language; Scottish Gaelic is Celtic.
- **Norse:** North Germanic roots, including Old Norse and Scandinavian loans.
  The interface can merge this category into Germanic.
- **Latin:** Latin and Romance roots, including French, Italian, and Spanish.
- **Greek:** Greek roots even when a word arrived through Latin or French.
- **Celtic:** Irish, Scottish Gaelic, Welsh, and other Celtic roots.
- **Other:** positively identified origins outside those families, including
  Arabic, Persian, Indic, Chinese, Japanese, Slavic, and Indigenous languages.
- **Unresolved:** insufficient evidence, or more than one possible family.

For example, *philosophy* is Greek, *coffee* ultimately Arabic/Other, and *street*
Latin. Tracing stops before reconstructed common ancestors would erase useful
distinctions: an Old Norse word does not become native English merely because
both descend from Proto-Germanic. Some familiar words change categories under
this policy; *clan*, for example, has Latin ancestry behind its Celtic intermediaries.

Words in `data/common-words.txt` (the English lists from LexDB) are held to a
stricter standard: when a frequent word has several etymologies, such as *see*,
*like*, *give* or *go*, the first-listed (principal) etymology decides, and its
inflections (*saw*, *seen*) follow it. A Germanic/Norse blend resolves to Germanic.
Rarer homographs stay unresolved. Frequent words with no usable Wiktionary
etymology are set in `data/curated.json`; the rest (mostly names, abbreviations
and imitative words of uncertain origin) fall back to the flagged spelling guess.

Recorded affix formations follow their free lexical base: a Germanic suffix does
not turn *beautiful* into a Germanic-root word. Compounds with different component
families, such as *television*, remain unresolved. A spelling shared by distinct
etymologies, such as *rose* (flower or past tense of *rise*), also remains unresolved.
These entries expose their possible categories and explanatory notes instead of
depending on which category happens to appear first in the file.

## What is included

The importer reads all records in the supplied dump and follows structured
inheritance, borrowing, derivation, affix/compound, alternative-form, and inflection
relationships. It also handles the expanded ancestry trees available in some
Wiktextract versions and explicit source-language clauses when ancestry is supplied
only as prose. A specific reconstructed family is a fallback when no attested donor
is available. Cognates, translations, descendant lists, and mere spelling
similarity are not used as origin evidence.

Recorded forms include regular and irregular plurals, verb conjugations,
comparatives, superlatives, and alternative spellings. **The importer never creates
word forms by blindly appending suffixes.** Unrecorded forms can still use the
classifier's bounded morphology search, but those matches are displayed as guesses.

Accented words, contractions, and hyphenated words are normalized consistently
with the interface tokenizer. Standalone affixes and phrases can help resolve
other entries internally, but are not emitted as single-word entries. Proper-name
records, uppercase-only spellings/acronyms, punctuation, numeric expressions, and
explicit misspelling forms are excluded. Historical and dialectal words may be
included when they have usable evidence.

## Rebuilding and extending

Requirements: Python 3.11+ and Node 18+ for the verification commands. There are no
third-party package dependencies.

```sh
mkdir -p .cache
curl --fail --location --retry 3 \
  https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz \
  -o .cache/english.jsonl.gz
python3 scripts/build_lexicon.py \
  --input .cache/english.jsonl.gz \
  --dump-date 2026-10-01 \
  --cache .cache/origin-graph.json
node --test test/classify.test.js
python3 -m unittest discover -s test -p '*_test.py'
```

Set `--dump-date` to the date shown on Kaikki's download page when refreshing.
The English-only postprocessed download is deprecated upstream. The builder also
accepts raw multilingual Wiktextract JSONL or gzipped JSONL from the raw-data page
and filters it to English; specify `--source-url` when using a different archive.
Large archives and reduced graphs stay in ignored `.cache/`, outside the shipped
lexicon. The cache is invalidated when the input, policy, or builder changes.

Edit **`data/curated.json`**, then rebuild, to add reviewed core vocabulary or fix
an entry. An override can specify one category, or multiple categories for an
ambiguous spelling. Include a source link and a short reason for each exception.
Overrides take priority and are inherited by forms and dependent English
formations. Do not hand-edit the generated word lists.

`LEXICON_INFO` exposes the source metadata. `LEXICON_AMBIGUITIES` maps unresolved
spellings to possible families. `LEXICON_NOTES` holds reviewed explanations. The
last two are also attached to `LEXICON` so `classify(word, LEXICON)` can use them.

## Coverage and limits

This is a much broader catalogue, **not a claim that English etymology is complete
or unambiguous**. Wiktionary has missing, disputed, and occasionally erroneous
analyses; some templates are not yet supported. Unsupported entries remain
unclassified rather than being assigned an invented origin. The build report
counts unresolved headwords, and `.cache/unresolved.txt` lists them for future work.
The importer can trace only the ancestry actually supplied in the English entry;
it does not recursively download every foreign-language ancestor. Reviewed exceptions
can extend those chains, as the entry for *furniture* does through French to Frankish.

A spelling-only classifier cannot pick a meaning from context. Ambiguity can also
propagate from a base to its derivatives when no sense-specific source is available.
Names and ordinary words that share a spelling cannot be distinguished reliably
by lowercasing. A dictionary-backed category describes the available evidence,
not a guarantee that every historical analysis is settled.

For a separate coverage check, `scripts/coverage.js` accepts a newline-separated
word list. The development audit uses the
[Google 10,000 English word list](https://github.com/first20hours/google-10000-english)
as a benchmark, not as etymological evidence. That list contains names,
abbreviations, and web tokens, so its coverage percentage is not an accuracy score:

```sh
node scripts/coverage.js .cache/google-10000-english.txt
```
