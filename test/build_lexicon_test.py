import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("builder", ROOT / "scripts/build_lexicon.py")
b = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(b)


def template(name, *args):
    return {"name": name, "args": {str(i): v for i, v in enumerate(args, 1)}}


def node(*specs, forms=()):
    return {"specs": list(specs), "forms": list(forms)}


class OriginImportTests(unittest.TestCase):
    def test_traces_roots_without_using_cognates(self):
        entry = {"etymology_templates": [template("inh", "en", "enm", "word"),
                 template("inh", "en", "ang", "word"), template("cog", "grc", "λόγος")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["germanic"]})

    def test_can_distinguish_roots_from_entry_language(self):
        entry = {"etymology_templates": [template("der", "en", "fro", "musique"),
                 template("der", "en", "la", "musica"), template("der", "en", "grc", "μουσική")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["greek"]})
        self.assertEqual(b.entry_spec(entry, "entry"), {"cats": ["latin"]})

    def test_ignores_cognates_without_any_ancestry(self):
        self.assertIsNone(b.entry_spec({"etymology_templates": [template("cog", "ang", "word")]}, "roots"))

    def test_does_not_use_a_calque_as_a_borrowed_word(self):
        self.assertIsNone(b.entry_spec({"etymology_templates": [template("calque", "en", "fr", "mot")]}, "roots"))

    def test_no_definite_origin_for_explicitly_unknown_etymology(self):
        entry = {"etymology_text": "Of uncertain origin. Perhaps from Old Norse.",
                 "etymology_templates": [template("der", "en", "non", "word")]}
        self.assertIsNone(b.entry_spec(entry, "roots"))

    def test_native_suffix_does_not_erase_borrowed_base(self):
        spec = b.entry_spec({"etymology_templates": [template("af", "en", "beauty", "-ful")]}, "roots")
        self.assertEqual(spec, {"refs": ["beauty"]})

    def test_old_prefix_template_uses_the_free_base(self):
        spec = b.entry_spec({"etymology_templates": [template("prefix", "en", "un", "kind")]}, "roots")
        self.assertEqual(spec, {"refs": ["kind"]})

    def test_old_suffix_template_uses_the_free_base(self):
        spec = b.entry_spec({"etymology_templates": [template("suf", "en", "avail", "able")]}, "roots")
        self.assertEqual(spec, {"refs": ["avail"]})

    def test_unexpanded_etymon_affix_arguments(self):
        spec = b.entry_spec({"etymology_templates": [template("ety", "en", ":af", "un-", "kind", "-ness")]}, "roots")
        self.assertEqual(spec, {"refs": ["kind"]})

    def test_etymon_wrapper_does_not_override_a_deeper_explicit_chain(self):
        entry = {"etymology_templates": [template("ety", "en", ":bor", "ga:clann"),
                 template("der", "en", "la", "planta"), template("ety", "en", ":bor", "ga:clann")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["latin"]})

    def test_speculative_etymon_argument_is_not_definite_evidence(self):
        entry = {"etymology_templates": [template("ety", "en", ":uder<unc>", "fr:œuf")]}
        self.assertIsNone(b.entry_spec(entry, "roots"))

    def test_subsequent_sentence_about_a_displaced_word_is_not_the_origin(self):
        norse = template("der", "en", "non", "þó"); norse["expansion"] = "Old Norse þó"
        native = template("inh", "en", "ang", "þēah"); native["expansion"] = "Old English þēah"
        entry = {"etymology_text": "From Old Norse þó. Superseded Old English þēah.", "etymology_templates": [norse, native]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["norse"]})

    def test_mergers_retain_both_families(self):
        entry = {"etymology_text": "From a merger of Old English and Old Norse forms.",
                 "etymology_templates": [template("der", "en", "ang", "ġefan"), template("der", "en", "non", "gefa")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["germanic", "norse"]})

    def test_plain_source_clause_without_templates(self):
        entry = {"etymology_text": "From Latin praevius."}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["latin"]})

    def test_rendered_ancestry_can_restore_missing_templates(self):
        entry = {"etymology_text": "Etymology tree\nOld English fæder\nEnglish father\nInherited from Middle English fader, from Old English fæder, from Proto-West Germanic *fader."}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["germanic"]})

    def test_specific_reconstructed_family_only_when_no_attested_donor_exists(self):
        entry = {"etymology_templates": [template("inh", "en", "enm", "swepen"), template("inh", "en", "gmw-pro", "*swaipijan")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"cats": ["germanic"]})

    def test_old_confix_template_links_bound_combining_forms(self):
        entry = {"etymology_templates": [template("con", "en", "xylo", "phone")]}
        self.assertEqual(b.entry_spec(entry, "roots"), {"refs": ["xylo-", "-phone"]})

    def test_bound_combining_forms_can_be_mixed(self):
        spec = b.entry_spec({"etymology_templates": [template("af", "en", "tele-", "-vision")]}, "roots")
        nodes = {"tele-": node({"cats": ["greek"]}), "-vision": node({"cats": ["latin"]}), "television": node(spec)}
        origins, _ = b.resolve(nodes, {})
        self.assertEqual(origins["television"], {"greek", "latin"})

    def test_attested_forms_unlock_further_derivations(self):
        nodes = {"goose": node({"cats": ["germanic"]}, forms=["geese"]),
                 "geeselike": node({"refs": ["geese"]})}
        origins, _ = b.resolve(nodes, {})
        self.assertEqual(origins["geeselike"], {"germanic"})
        self.assertNotIn("gooses", origins)

    def test_missing_compound_component_prevents_a_partial_classification(self):
        nodes = {"known": node({"cats": ["latin"]}), "compound": node({"cats": ["greek"], "refs": ["missing"]})}
        origins, _ = b.resolve(nodes, {})
        self.assertEqual(origins["compound"], set())

    def test_cycles_converge_and_do_not_invent_an_origin(self):
        nodes = {"one": node({"refs": ["two"]}), "two": node({"refs": ["one"]}),
                 "three": node({"refs": ["four"]}), "four": node({"cats": ["celtic"]}, {"refs": ["three"]})}
        origins, _ = b.resolve(nodes, {})
        self.assertFalse(origins["one"])
        self.assertEqual(origins["three"], {"celtic"})

    def test_exact_headword_takes_priority_over_another_lemmas_inflection(self):
        nodes = {"rise": node({"cats": ["germanic"]}, forms=["rose"]), "rose": node({"cats": ["latin"]})}
        origins, _ = b.resolve(nodes, {})
        self.assertEqual(origins["rose"], {"latin"})

    def test_expanded_etymon_tree_and_reconstructed_ancestor(self):
        terms = [{"lang": "enm", "term": "sky", "children": [{"keyword": "borrowed", "terms": [
            {"lang": "non", "term": "ský", "children": [{"keyword": "inherited", "terms": [
                {"lang": "gem-pro", "term": "*skiwją"}]}]}]}]}]
        expansion = 'Rendered text, "terms" : ' + json.dumps(terms) + ', "keyword": "inherited" } broken HTML'
        self.assertEqual(b.embedded_tree(expansion)["cats"], ["norse"])

    def test_skip_cognate_or_surface_branches_in_tree(self):
        tree = {"lang": "ang", "term": "word", "children": [
            {"keyword": "compare", "terms": [{"lang": "grc", "term": "λόγος"}]},
            {"keyword": "afeq", "terms": [{"lang": "fr", "term": "mot"}]}]}
        self.assertEqual(b.tree_spec(tree), {"cats": ["germanic"]})

    def test_unicode_tokens_and_no_placeholders(self):
        for word in ["mother-in-law", "don't", "café", "naïve", "ångström"]:
            self.assertTrue(b.eligible(word), word)
        for word in ["", "-ish", "pre-", "two words", "*reconstructed", "word?", "h2o"]:
            self.assertFalse(b.eligible(word), word)
        self.assertEqual(b.normalize("CAFE\u0301’S"), "café's")

    def test_common_homographs_use_first_etymology_and_claim_inflections(self):
        nodes = {
            "see": {"specs": [{"cats": ["germanic"], "refs": []}, {"cats": ["latin"], "refs": []}], "forms": ["saw"]},
            "saw": {"specs": [{"cats": ["germanic"], "refs": []}, {"cats": ["latin"], "refs": []}], "forms": []},
            "rare": {"specs": [{"cats": ["germanic"], "refs": []}, {"cats": ["latin"], "refs": []}], "forms": []},
        }
        stats = {}
        origins, _ = b.resolve(nodes, {}, ["see"], stats)
        self.assertEqual(origins["see"], {"germanic"})
        self.assertEqual(origins["saw"], {"germanic"})
        self.assertEqual(origins["rare"], {"germanic", "latin"})
        self.assertEqual(stats["principal_etymology_resolved"], 2)

    def test_python_and_browser_language_mappings_agree(self):
        codes = ["ang", "ang-wsx", "non", "gmq-osw", "nl", "ofr", "fro", "fr", "sco", "gd", "cy", "ga",
                 "gme-lob", "gsw", "bar", "nds-de", "pdc", "got-cri", "la-lat", "roa-oit", "gl", "ast", "sc", "frc", "obt", "cnx", "grc", "grc-koi", "gmy", "ar", "hi", "zh", "enm", "en", "und", "ine-pro", "sem-pro"]
        script = "const {langToCategory:f}=require('./classify'); console.log(JSON.stringify(JSON.parse(process.argv[1]).map(f)))"
        result = subprocess.check_output(["node", "-e", script, json.dumps(codes)], cwd=ROOT, text=True)
        self.assertEqual(json.loads(result), [b.language_category(c) for c in codes])


if __name__ == "__main__":
    unittest.main()
