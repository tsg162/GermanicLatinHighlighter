#!/usr/bin/env python3
"""Build the browser lexicon from a local Kaikki/Wiktextract English JSONL dump.

No word forms or origins are invented. See LEXICON.md for the origin policy,
upstream attribution, refresh instructions, and limitations.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = ("germanic", "norse", "latin", "greek", "celtic", "other")
RELATIONS = {"inh", "der", "bor", "lbor", "ubor", "slbor", "obor", "pbor"}
FORMATIONS = {"af", "affix", "pre", "prefix", "suf", "suffix", "con", "confix", "compound", "com", "blend", "univerbation"}
SHORTENINGS = {"clipping", "clip", "abbreviation", "abbr", "initialism", "acronym", "short for", "back-form", "back-formation"}
SKIP_GROUPS = {"afeq", "surf", "surface", "calque", "cal", "clq", "cog", "compare", "influence", "semantic-loan"}
SKIP_POS = {"name", "character", "symbol", "punct", "proverb"}
BAD_FORM_TAGS = {"misspelling", "error", "romanization", "table-tags", "class", "canonical"}
PROSE_LANGUAGES = {
    "germanic": ["Old English", "Anglian Old English", "West Saxon Old English", "Old Frisian", "West Frisian", "Frisian", "Dutch", "Middle Dutch", "Old Dutch", "German", "Old High German", "Middle High German", "Low German", "Middle Low German", "Old Saxon", "Gothic", "Lombardic", "Frankish", "Scots", "Yiddish", "Afrikaans"],
    "norse": ["Old Norse", "Icelandic", "Danish", "Old Danish", "Swedish", "Old Swedish", "Norwegian", "Norwegian Bokmål", "Norwegian Nynorsk", "Faroese", "Norn"],
    "latin": ["Latin", "Classical Latin", "Late Latin", "Medieval Latin", "Middle Latin", "Vulgar Latin", "New Latin", "Neo-Latin", "Old Latin", "French", "Old French", "Middle French", "Anglo-Norman", "Italian", "Old Italian", "Spanish", "Old Spanish", "Portuguese", "Catalan", "Occitan", "Old Occitan", "Romanian", "Venetian", "Sicilian", "Sardinian"],
    "greek": ["Greek", "Ancient Greek", "Byzantine Greek", "Koine Greek", "Modern Greek"],
    "celtic": ["Irish", "Old Irish", "Middle Irish", "Scottish Gaelic", "Welsh", "Old Welsh", "Middle Welsh", "Breton", "Cornish", "Manx", "Gaulish"],
    "other": ["Arabic", "Classical Arabic", "Persian", "Old Persian", "Middle Persian", "Hebrew", "Aramaic", "Syriac", "Classical Syriac", "Sanskrit", "Hindi", "Urdu", "Hindustani", "Pali", "Bengali", "Tamil", "Telugu", "Malayalam", "Marathi", "Gujarati", "Punjabi", "Turkish", "Ottoman Turkish", "Chinese", "Mandarin", "Cantonese", "Hokkien", "Japanese", "Korean", "Vietnamese", "Thai", "Malay", "Indonesian", "Javanese", "Tagalog", "Russian", "Polish", "Czech", "Slovak", "Serbo-Croatian", "Hungarian", "Finnish", "Estonian", "Lithuanian", "Latvian", "Albanian", "Armenian", "Old Armenian", "Georgian", "Coptic", "Egyptian", "Demotic Egyptian", "Swahili", "Zulu", "Wolof", "Nahuatl", "Quechua", "Taíno", "Taino", "Hawaiian", "Maori", "Māori", "Samoan", "Tahitian", "Inuktitut", "Dharug", "Guugu Yimithirr"],
}
PROSE_NAME_CATEGORY = {name.lower(): cat for cat, names in PROSE_LANGUAGES.items() for name in names}
PROSE_SOURCE_RE = re.compile(r"\b(?:from|via|through)\s+(?:(?:the|earlier)\s+)?(" + "|".join(re.escape(n) for n in sorted(PROSE_NAME_CATEGORY, key=len, reverse=True)) + r")\b", re.I)


def normalize(word):
    return unicodedata.normalize("NFC", word).lower().replace("’", "'").replace("ʼ", "'").replace("‐", "-").replace("‑", "-")


def eligible(word):
    """Match complete tokens, including accented letters, contractions and compounds."""
    return bool(word) and all(
        part and any(c.isalpha() for c in part)
        and all(c.isalpha() or unicodedata.category(c).startswith("M") for c in part)
        for part in re.split("[-']", word)
    )


def language_category(code):
    if not code or code in {"en", "enm", "ine", "ine-pro", "und", "mul", "mis"}:
        return None
    dialect_base = code.split("-", 1)[0]
    if dialect_base in {"nl", "de", "nds", "got", "goh", "gmh", "fy", "frr", "sco", "yi", "af", "fr", "fro", "frm", "it", "es", "pt", "ca", "oc", "ga", "gd", "sga", "cy", "br", "kw"}:
        code = dialect_base
    if re.match(r"^(ang(?:-|$)|gem(?:-|$)|gmw(?:-|$)|gme-)", code) or code in {
        "goh", "gmh", "osx", "odt", "nl", "dum", "de", "fy", "frk", "got", "gml", "nds",
        "yi", "ofs", "ofr", "frr", "stq", "sco", "sco-osc", "lb", "li", "af", "yol", "enm-osc",
        "gsw", "bar", "swg", "vmf", "ksh", "pdc", "pdt", "hrx", "cim", "wym", "vls", "zea", "frs", "xbg", "xvn",
    }:
        return "germanic"
    if re.match(r"^(non(?:-|$)|gmq(?:-|$))", code) or code in {"is", "sv", "da", "no", "nb", "nn", "fo", "svm", "ovd"}:
        return "norse"
    if re.match(r"^(la(?:-|$)|roa-)", code) or code in {
        "fr", "fro", "frm", "xno", "it", "es", "pt", "ca", "ro", "osp", "oc", "pro", "vec", "scn", "nap", "srd", "rm", "fur", "lld",
        "gl", "ast", "an", "mwl", "sc", "co", "nrf", "wa", "lij", "lmo", "pms", "eml", "rgn", "frp", "frc",
    }:
        return "latin"
    if re.match(r"^(grc(?:-|$)|grk-)", code) or code in {"el", "gkm", "gmy"}:
        return "greek"
    if code.startswith("cel-") or code in {"ga", "gd", "sga", "mga", "cy", "wlm", "owl", "gv", "kw", "br", "xtg", "xcb", "pgl", "sga-olc", "obt", "xbm", "oco", "cnx"}:
        return "celtic"
    if code.endswith("-pro") or code.startswith(("qfa-", "ine-")):
        return None
    return "other"


def clean_term(term):
    term = re.sub(r"<[^>]*>", "", term).split("#")[0]
    term = re.sub(r"\[\[(?:[^]|]+\|)?([^]]+)\]\]", r"\1", term)
    return normalize(term.strip())


def free_terms(terms):
    free = [t for t in terms if not t.startswith("-") and not t.endswith("-")]
    return free or terms


def combine(specs):
    specs = [s for s in specs if s]
    if not specs:
        return None
    return {
        "cats": sorted({c for s in specs for c in s.get("cats", [])}),
        "refs": sorted({r for s in specs for r in s.get("refs", [])}),
        "uncertain": any(s.get("uncertain", False) for s in specs),
    }


def tree_spec(node):
    """Follow ancestry only, never the cognates/translations/derived-word lists."""
    if node.get("is_uncertain"):
        return None
    code = node.get("lang", "")
    if code.endswith("-pro"):
        return None  # Stop before reconstructed common ancestors erase distinctions.
    groups = [g for g in node.get("children", []) if g.get("keyword") not in SKIP_GROUPS and not g.get("is_invisible")]
    for group in groups:
        terms = group.get("terms", [])
        free = [t for t in terms if not t.get("term", "").startswith("-") and not t.get("term", "").endswith("-")]
        chosen = free or terms
        resolved = [tree_spec(t) for t in chosen]
        spec = combine(resolved)
        if spec and all(resolved):
            return spec
    cat = language_category(code)
    if cat:
        return {"cats": [cat]}
    term = clean_term(node.get("term", ""))
    if code == "en" and term:
        return {"refs": [term]}
    return None


def embedded_tree(expansion):
    # Some Wiktextract versions include a partially rendered data-tree attribute.
    # Decode its first complete terms array; don't rely on the surrounding HTML.
    match = re.search(r'"terms"\s*:\s*(\[)', expansion)
    if match:
        try:
            terms, _ = json.JSONDecoder().raw_decode(expansion[match.start(1):])
            return combine(tree_spec(t) for t in terms)
        except (ValueError, TypeError):
            pass
    return None


def entry_spec(entry, policy):
    prose = re.search(r"(?:^|\n)(?:From |Inherited |Borrowed |Of |Unknown |Uncertain |Perhaps |Possibly |Probably |Likely )[^\n]*", entry.get("etymology_text", ""))
    if prose and re.match(r"(?:Of )?(?:unknown|uncertain|disputed) origin|(?:Perhaps|Possibly|Probably|Likely) (?:from|borrowed|derived)", prose[0].strip(), re.I):
        return None
    templates = entry.get("etymology_templates", [])
    direct = []
    reconstructed = []
    etymon_direct = []
    formations = []
    trees = []
    primary = re.split(r"\.\s|\.$", prose[0].strip(), maxsplit=1)[0] if prose else ""
    for template in templates:
        name = template.get("name", "").removesuffix("+")
        args = template.get("args", {})
        if args.get("1") != "en":
            continue
        if name in RELATIONS:
            code = args.get("2", "")
            term = clean_term(args.get("3", ""))
            if code == "en" and term:
                formations.append({"refs": [term]})
            elif not code.endswith("-pro"):
                cat = language_category(code)
                expansion = template.get("expansion", "")
                if cat and (not primary or not expansion or expansion in primary):
                    direct.append(cat)
            elif language_category(code):
                reconstructed.append(language_category(code))
        elif name in FORMATIONS:
            terms = [clean_term(args[k]) for k in sorted(args, key=lambda k: int(k) if k.isdigit() else 10000) if k.isdigit() and int(k) >= 2 and args[k]]
            terms = [t for t in terms if t and t != "+" and not t.startswith(":")]
            if name in {"prefix", "pre"} and len(terms) > 1:
                terms[0] = terms[0].rstrip("-") + "-"
            if name in {"suffix", "suf"} and len(terms) > 1:
                terms[-1] = "-" + terms[-1].lstrip("-")
            if name in {"confix", "con"} and len(terms) == 2:
                terms = [terms[0].rstrip("-") + "-", "-" + terms[1].lstrip("-")]
            if terms:
                formations.append({"refs": free_terms(terms)})
        elif name in SHORTENINGS:
            term = clean_term(args.get("2", ""))
            if term:
                formations.append({"refs": [term]})
        elif name in {"ety", "etymon"}:
            spec = embedded_tree(template.get("expansion", ""))
            if spec:
                trees.append(spec)
            # Handle direct etymon arguments even when no expanded tree is present.
            uncertain_relation = any("<unc>" in v or "<unc:" in v for v in args.values())
            operation = None
            formation_terms = []
            for key in sorted((k for k in args if k.isdigit()), key=int):
                if uncertain_relation:
                    continue
                if int(key) < 2:
                    continue
                value = args[key]
                if value.startswith(":"):
                    operation = value[1:].split("<")[0]
                    if "<surf>" in value or operation in SKIP_GROUPS:
                        operation = "skip"
                    continue
                if operation == "skip":
                    continue
                m = re.match(r"^([a-z][a-z.-]+):(.+)", value)
                if m:
                    code, term = m.groups()
                    if code == "en":
                        formations.append({"refs": [clean_term(term)]})
                    elif code not in {"enm"} and not code.endswith("-pro"):
                        cat = language_category(code)
                        if cat:
                            etymon_direct.append(cat)
                elif operation in FORMATIONS | SHORTENINGS | {"der", "from"}:
                    term = clean_term(value)
                    if term:
                        formation_terms.append(term)
            if formation_terms:
                formations.append({"refs": free_terms(formation_terms)})
    if direct:
        # Traditional templates list the ancestry from English towards its source.
        if re.search(r"\bmerger of\b|\band/or\b|\b(?:blend|mixture) of\b", primary):
            return {"cats": sorted(set(direct))}
        return {"cats": [direct[-1] if policy == "roots" else direct[0]]}
    if policy == "roots" and trees:
        return combine(trees)
    if etymon_direct:
        return {"cats": [etymon_direct[-1] if policy == "roots" else etymon_direct[0]]}
    if formations:
        # Alternative analyses are not separate components of one compound.
        return formations[0]
    # Some records render etymon ancestry as prose without exposing its templates.
    # Accept only explicit source-language clauses in the first ancestry sentence.
    prose_cats = [PROSE_NAME_CATEGORY[m[1].lower()] for m in PROSE_SOURCE_RE.finditer(primary)]
    if prose_cats:
        return {"cats": [prose_cats[-1] if policy == "roots" else prose_cats[0]]}
    if reconstructed:
        return {"cats": [reconstructed[0]]}
    refs = []
    for sense in entry.get("senses", []):
        if "misspelling" in sense.get("tags", []):
            continue
        for key in ("form_of", "alt_of"):
            refs.extend(clean_term(r["word"]) for r in sense.get(key, []) if r.get("word"))
    if refs:
        return {"refs": sorted(set(refs))}
    return None


def read_entries(path, policy):
    nodes = {}
    counts = Counter()
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as stream:
        for index, line in enumerate(stream, 1):
            entry = json.loads(line)
            counts["records_read"] += 1
            if entry.get("lang_code") != "en" or entry.get("pos") in SKIP_POS:
                continue
            raw = entry.get("word", "")
            if not raw or (raw != raw.lower() and raw != "I"):
                continue  # Avoid silently turning acronyms/proper names into common words.
            word = normalize(raw)
            node = nodes.setdefault(word, {"specs": [], "forms": []})
            spec = entry_spec(entry, policy)
            if spec:
                spec["cats"] = sorted(set(spec.get("cats", [])))
                spec["refs"] = sorted(set(spec.get("refs", [])) - {word})
                if (spec["cats"] or spec["refs"]) and spec not in node["specs"]:
                    node["specs"].append(spec)
            for form in entry.get("forms", []):
                raw_form = form.get("form", "")
                if set(form.get("tags", [])) & BAD_FORM_TAGS or raw_form != raw_form.lower():
                    continue
                value = normalize(raw_form)
                if value != word and eligible(value) and value not in node["forms"]:
                    node["forms"].append(value)
            if index % 200000 == 0:
                print(f"Read {index:,} records; {len(nodes):,} English headwords", file=sys.stderr)
    counts["english_headwords"] = len(nodes)
    counts["eligible_headwords"] = sum(eligible(w) for w in nodes)
    return nodes, dict(counts)


def primary_origin(specs, origins):
    """Origin of a word's first-listed etymology; Wiktionary lists the principal sense first."""
    for spec in specs:
        cats = set(spec.get("cats", []))
        for ref in spec.get("refs", []):
            if len(origins.get(ref, ())) != 1:
                cats = set()
                break
            cats |= origins[ref]
        if cats:
            # Norse is North Germanic: a Germanic/Norse blend resolves to Germanic.
            return {"germanic"} if cats <= {"germanic", "norse"} else cats
    return None


def resolve_common(nodes, graph, origins, common, fixed):
    """Give frequent words a single origin from their first etymology instead of leaving homographs mixed."""
    chosen = {}
    common_set = set(common)
    for word in common:  # frequency order, so the most frequent word claims a shared inflection
        if word in fixed or len(origins.get(word, ())) < 2 or word not in graph:
            continue
        cats = primary_origin(graph[word], origins)
        if cats and len(cats) == 1:
            chosen[word] = cats
    for word, cats in list(chosen.items()):
        for form in nodes.get(word, {}).get("forms", []):
            if form not in common_set and form not in fixed and cats <= origins.get(form, set()) and len(origins[form]) > 1:
                chosen.setdefault(form, cats)
    origins.update(chosen)
    return len(chosen)


def resolve(nodes, curated, common=(), stats=None):
    graph = {w: list(n["specs"]) for w, n in nodes.items()}
    for word, node in nodes.items():
        for form in node["forms"]:
            if form not in nodes or not nodes[form]["specs"]:
                graph.setdefault(form, []).append({"refs": [word]})
    origins = {w: set().union(*(set(s.get("cats", [])) for s in specs if not s.get("refs"))) for w, specs in graph.items()}
    for cat, words in curated.get("categories", {}).items():
        for word in words.split():
            origins[normalize(word)] = {cat}
    overrides = {normalize(w): d for w, d in curated.get("overrides", {}).items()}
    for word, record in overrides.items():
        origins[word] = set(record["categories"])
    fixed = {normalize(w) for text in curated.get("categories", {}).values() for w in text.split()} | overrides.keys()
    # Monotonic graph propagation handles cycles without recursion-order dependence.
    for iteration in range(50):
        changed = False
        for word, specs in graph.items():
            if word in fixed:
                continue
            cats = set(origins[word])
            for spec in specs:
                refs = spec.get("refs", [])
                if refs and all(origins.get(r) for r in refs):
                    cats.update(spec.get("cats", []), *(origins[r] for r in refs))
            if cats != origins[word]:
                origins[word] = cats
                changed = True
        if not changed:
            break
    else:
        raise RuntimeError("Origin propagation did not converge; inspect the source graph")
    for word, record in overrides.items():
        origins[word] = set(record["categories"])
    resolved = resolve_common(nodes, graph, origins, common, fixed)
    if stats is not None:
        stats["principal_etymology_resolved"] = resolved
    return origins, iteration + 1


def wrap_words(words, width=110):
    lines = []
    line = ""
    for word in sorted(words):
        if len(line) + len(word) + 1 > width:
            lines.append(line)
            line = ""
        line += (" " if line else "") + word
    if line:
        lines.append(line)
    return "\n    ".join(lines)


def render(origins, metadata, curated):
    groups = {c: [] for c in CATEGORIES}
    ambiguous = {}
    for word, cats in sorted(origins.items()):
        if not eligible(word) or not cats:
            continue
        if len(cats) == 1:
            groups[next(iter(cats))].append(word)
        else:
            ambiguous[word] = sorted(cats)
    lines = [
        "// Generated by scripts/build_lexicon.py. Edit data/curated.json, then rebuild.",
        "// Wiktionary contributors / Kaikki.org; lexical data: CC BY-SA 4.0.",
        "// Sources, origin policy and limitations: LEXICON.md. No runtime network required.",
        "const LEXICON_INFO = " + json.dumps(metadata, ensure_ascii=False, indent=2) + ";",
        "\nconst LEXICON_SOURCES = {",
    ]
    for cat, words in groups.items():
        lines.append(f"  {cat}: `{wrap_words(words)}`,\n")
    lines.append("};\n")
    # Store ambiguity by category combination, keeping the shipped file compact.
    combinations = {}
    for word, cats in ambiguous.items():
        combinations.setdefault("+".join(cats), []).append(word)
    lines.append("const LEXICON_AMBIGUOUS_SOURCES = {")
    for combination, words in sorted(combinations.items()):
        lines.append(f"  {json.dumps(combination)}: `{wrap_words(words)}`,\n")
    lines.append("};\n")
    notes = {w: d["note"] for w, d in curated.get("overrides", {}).items() if d.get("note")}
    lines.extend([
        "const LEXICON_NOTES = new Map(Object.entries(" + json.dumps(notes, ensure_ascii=False, indent=2) + "));",
        "const LEXICON_AMBIGUITIES = new Map();",
        "const LEXICON = new Map();",
        "for (const [category, words] of Object.entries(LEXICON_SOURCES)) {",
        "  for (const word of words.split(/\\s+/)) if (word) LEXICON.set(word, category);",
        "}",
        "for (const [combination, words] of Object.entries(LEXICON_AMBIGUOUS_SOURCES)) {",
        "  for (const word of words.split(/\\s+/)) if (word) {",
        "    LEXICON.set(word, 'unknown');",
        "    LEXICON_AMBIGUITIES.set(word, combination.split('+'));",
        "  }",
        "}",
        "// Optional metadata also travels with the Map for classify(word, LEXICON).",
        "LEXICON.ambiguities = LEXICON_AMBIGUITIES;",
        "LEXICON.notes = LEXICON_NOTES;",
        "if (typeof module !== 'undefined') module.exports = { LEXICON, LEXICON_SOURCES, LEXICON_INFO, LEXICON_AMBIGUITIES, LEXICON_NOTES };",
        "",
    ])
    return "\n".join(lines), {c: len(w) for c, w in groups.items()}, len(ambiguous)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="English or multilingual Wiktextract JSONL[.gz]")
    parser.add_argument("--policy", choices=["roots", "entry"], default="roots")
    parser.add_argument("--dump-date", required=True)
    parser.add_argument("--source-url", default="https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz")
    parser.add_argument("--common-words", type=Path, default=ROOT / "data/common-words.txt", help="Frequent words resolved by their principal etymology")
    parser.add_argument("--cache", type=Path, help="Cache the reduced origin graph for quick rebuilds")
    parser.add_argument("--output", type=Path, default=ROOT / "lexicon.js")
    parser.add_argument("--report", type=Path, default=ROOT / "data/build-report.json")
    args = parser.parse_args()
    curated = json.loads((ROOT / "data/curated.json").read_text())
    digest = hashlib.file_digest(args.input.open("rb"), "sha256").hexdigest()
    cache_key = {"sha256": digest, "policy": args.policy, "builder_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    cached = json.loads(args.cache.read_text()) if args.cache and args.cache.exists() else {}
    if cached.get("key") == cache_key:
        nodes, counts = cached["nodes"], cached["counts"]
    else:
        nodes, counts = read_entries(args.input, args.policy)
        if args.cache:
            args.cache.parent.mkdir(parents=True, exist_ok=True)
            args.cache.write_text(json.dumps({"key": cache_key, "counts": counts, "nodes": nodes}, ensure_ascii=False, separators=(",", ":")))
    common = []
    if args.common_words.exists():
        common = list(dict.fromkeys(normalize(w) for w in args.common_words.read_text().split()))
    stats = {}
    origins, iterations = resolve(nodes, curated, common, stats)
    metadata = {"source": "English Wiktionary via Kaikki/Wiktextract", "sourceUrl": args.source_url,
                "dumpDate": args.dump_date, "sourceSha256": digest, "policy": args.policy, "license": "CC-BY-SA-4.0"}
    code, category_counts, ambiguous_count = render(origins, metadata, curated)
    args.output.write_text(code)
    unresolved = sorted(w for w in nodes if eligible(w) and not origins.get(w))
    report = {**metadata, **counts, "category_counts": category_counts, "ambiguous_or_mixed": ambiguous_count,
              "total_entries": sum(category_counts.values()) + ambiguous_count,
              "attested_additional_forms": sum(eligible(w) and w not in nodes and bool(c) for w, c in origins.items()),
              "unresolved_headwords": len(unresolved), "resolution_passes": iterations, **stats,
              "common_words_unresolved": sorted(w for w in common if not origins.get(w)),
              "output_bytes": len(code.encode()), "output_sha256": hashlib.sha256(code.encode()).hexdigest()}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if args.cache:
        args.cache.with_name("unresolved.txt").write_text("\n".join(unresolved) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
